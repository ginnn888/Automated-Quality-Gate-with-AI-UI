import { createHash } from 'node:crypto';
import { installationFiles, settingsSchema, type Settings } from './config';
import { createPlannedPR, inspectRepository, PreparationError, type GitHubClient } from './preparation-github';
import { classifyInstallation } from './installation-status';
import type { PreparationPlan } from './preparation';

export async function inspectInstallation(api: GitHubClient, repository: string, settings: Settings) {
  settings = settingsSchema.parse(settings);
  const base = await inspectRepository(api, repository, settings.projectType);
  if (base.plan.status !== 'ready') throw new PreparationError(settings.projectType === 'angularjs' ? base.plan.messages.join(' ') : 'ตรวจและ merge PR เตรียม npm/Jest ในขั้นตั้งค่าการตรวจก่อนติดตั้ง');
  for (const name of settings.sonar ? ['GEMINI_API_KEY', 'SONAR_TOKEN'] : ['GEMINI_API_KEY']) {
    try { await api(`/repos/${repository}/actions/secrets/${name}`); }
    catch { throw new PreparationError(`ยังตรวจพบ ${name} ไม่ได้ กรุณาบันทึก key และตรวจสิทธิ์ Secrets ของ App`, 409); }
  }
  const tree = await api<{ truncated: boolean; tree: { path: string; type: string; mode: string; sha: string; size?: number }[] }>(`/repos/${repository}/git/trees/${base.treeSha}?recursive=1`);
  if (tree.truncated) throw new PreparationError('รายการไฟล์ไม่ครบ จึงยังติดตั้งไม่ได้');
  const files: PreparationPlan['files'] = [];
  const generated = installationFiles(settings);
  const alternate = tree.tree.find(f => f.path === '.github/workflows/aq-review.yml');
  if (alternate && settings.projectType === 'angularjs') {
    if (tree.tree.some(f => f.path === '.github/workflows/quality-gate.yml')) throw new PreparationError('พบทั้ง quality-gate.yml และ aq-review.yml กรุณาเลือกเก็บ workflow เดียวบน GitHub ก่อน เพื่อไม่ให้ตรวจซ้ำ');
    if (alternate.mode !== '100644' || alternate.type !== 'blob' || (alternate.size || 0) > 100000) throw new PreparationError('ไฟล์ aq-review.yml ไม่ใช่ไฟล์ปกติ');
    const old = await api<{ content: string; encoding: string }>(`/repos/${repository}/git/blobs/${alternate.sha}`);
    if (old.encoding !== 'base64' || classifyInstallation(Buffer.from(old.content, 'base64').toString('utf8'), null) !== 'active') throw new PreparationError('มี aq-review.yml อยู่แล้วแต่ไม่ใช่ workflow AngularJS ที่รู้จัก กรุณาตรวจไฟล์เดิมก่อนติดตั้ง');
    generated['.github/workflows/aq-review.yml'] = generated['.github/workflows/quality-gate.yml'];
    delete generated['.github/workflows/quality-gate.yml'];
  }
  for (const [path, after] of Object.entries(generated)) {
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
    ...(settings.projectType === 'angularjs' ? ['Action ต้นฉบับเป็นผู้สร้างเทสต์ ตรวจโค้ด และโพสต์รายงาน AngularJS; workflow ทำงานเมื่อเปิดหรืออัปเดต PR', 'โหมดนี้รายงานผลตามต้นฉบับ ไม่บังคับ coverage หรือใช้ SonarCloud; config เดิมที่มีอยู่จะถูกเก็บไว้'] : []),
    'หากไม่มีไฟล์ JavaScript ใน src/ เปลี่ยนแปลง การตรวจอาจถูกข้าม',
    'หลัง merge PR ติดตั้ง ให้สร้าง branch งานใหม่จาก branch หลัก แล้วเปิด PR แก้โค้ดเพื่อดูรายงาน; หากตรวจไม่สำเร็จ ดูรายละเอียดใน GitHub Actions',
    'การตั้งค่า Secrets ยืนยันได้เฉพาะว่ามีชื่อ key ไม่ได้ยืนยันว่า key ใช้งานได้',
    'ไฟล์ที่มีอยู่จะถูกแก้ตามตัวอย่างด้านล่างใน PR เท่านั้น ไม่มีการ merge อัตโนมัติ',
  ] };
  return { ...base, plan, digest: createHash('sha256').update(JSON.stringify({ repository, sha: base.baseSha, plan })).digest('hex') };
}

export async function createInstallation(api: GitHubClient, repository: string, settings: Settings, sha: string, digest: string) {
  const snapshot = await inspectInstallation(api, repository, settings);
  return createPlannedPR(api, repository, snapshot, sha, digest, true);
}
