import { createHash } from 'node:crypto';
import { installationFiles, type Settings } from './config';
import { createPlannedPR, inspectRepository, PreparationError, type GitHubClient } from './preparation-github';
import type { PreparationPlan } from './preparation';

export async function inspectInstallation(api: GitHubClient, repository: string, settings: Settings) {
  const base = await inspectRepository(api, repository);
  if (base.plan.status !== 'ready') throw new PreparationError('ตรวจและ merge PR เตรียม npm/Jest ในขั้นตั้งค่าการตรวจก่อนติดตั้ง');
  for (const name of settings.sonar ? ['GEMINI_API_KEY', 'SONAR_TOKEN'] : ['GEMINI_API_KEY']) {
    try { await api(`/repos/${repository}/actions/secrets/${name}`); }
    catch { throw new PreparationError(`ยังตรวจพบ ${name} ไม่ได้ กรุณาบันทึก key และตรวจสิทธิ์ Secrets ของ App`, 409); }
  }
  const tree = await api<{ truncated: boolean; tree: { path: string; type: string; mode: string; sha: string; size?: number }[] }>(`/repos/${repository}/git/trees/${base.treeSha}?recursive=1`);
  if (tree.truncated) throw new PreparationError('รายการไฟล์ไม่ครบ จึงยังติดตั้งไม่ได้');
  const files: PreparationPlan['files'] = [];
  for (const [path, after] of Object.entries(installationFiles(settings))) {
    const existing = tree.tree.find(f => f.path === path);
    let before: string | null = null;
    if (existing) {
      if (existing.type !== 'blob' || existing.mode !== '100644' || (existing.size || 0) > 100000) throw new PreparationError(`ไม่สามารถแก้ ${path} อัตโนมัติ`);
      const blob = await api<{ content: string; encoding: string }>(`/repos/${repository}/git/blobs/${existing.sha}`);
      if (blob.encoding !== 'base64') throw new PreparationError('อ่านไฟล์เดิมไม่ได้');
      before = Buffer.from(blob.content, 'base64').toString('utf8');
    }
    if (before !== after) files.push({ path, before, after });
  }
  const plan: PreparationPlan = { status: files.length ? 'changes' : 'ready', files, messages: [
    'ใช้ Action เดิม: push อาจหาไฟล์ไม่พบ และการปิด SonarCloud อาจทำให้ผลรวมไม่ผ่าน',
    'ดูสถานะแต่ละขั้นใน GitHub Actions → Summary; รายงาน AI ใน PR ขึ้นกับว่า engine รันสำเร็จถึงขั้นรายงานหรือไม่',
    'การตั้งค่า Secrets ยืนยันได้เฉพาะว่ามีชื่อ key ไม่ได้ยืนยันว่า key ใช้งานได้',
    'ไฟล์ที่มีอยู่จะถูกแก้ตามตัวอย่างด้านล่างใน PR เท่านั้น ไม่มีการ merge อัตโนมัติ',
  ] };
  return { ...base, plan, digest: createHash('sha256').update(JSON.stringify({ repository, sha: base.baseSha, plan })).digest('hex') };
}

export async function createInstallation(api: GitHubClient, repository: string, settings: Settings, sha: string, digest: string) {
  const snapshot = await inspectInstallation(api, repository, settings);
  return createPlannedPR(api, repository, snapshot, sha, digest, true);
}
