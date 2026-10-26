import { createHash } from 'node:crypto';
import { aiSecretName, flexibleEngineRef, installationFiles, settingsSchema, type Settings } from './config';
import { createPlannedPR, inspectRepository, PreparationError, type GitHubClient } from './preparation-github';
import { classifyInstallation } from './installation-status';
import type { PreparationPlan } from './preparation';
import angularToolkit from './angularjs-toolkit.json';

export async function inspectInstallation(api: GitHubClient, repository: string, settings: Settings) {
  settings = settingsSchema.parse(settings);
  {
    const [repository, ref] = flexibleEngineRef.split('@');
    try { await api(`/repos/${repository}/commits/${ref}`); }
    catch { throw new PreparationError('ยังยืนยัน Action รุ่นติดตั้งใหม่ไม่ได้ ต้องเผยแพร่ commit ของ Action ไป GitHub และตรวจสิทธิ์เข้าถึงก่อน จึงจะสร้าง PR ติดตั้งได้', 409); }
  }
  const base = await inspectRepository(api, repository, settings.projectType);
  if (base.plan.status === 'blocked') throw new PreparationError(base.plan.messages.join(' '));
  for (const name of settings.sonar ? [aiSecretName(settings), 'SONAR_TOKEN'] : [aiSecretName(settings)]) {
    try { await api(`/repos/${repository}/actions/secrets/${name}`); }
    catch { throw new PreparationError(`ยังตรวจพบ ${name} ไม่ได้ กรุณาบันทึก key และตรวจสิทธิ์ Secrets ของ App`, 409); }
  }
  const tree = await api<{ truncated: boolean; tree: { path: string; type: string; mode: string; sha: string; size?: number }[] }>(`/repos/${repository}/git/trees/${base.treeSha}?recursive=1`);
  if (tree.truncated) throw new PreparationError('รายการไฟล์ไม่ครบ จึงยังติดตั้งไม่ได้');
  const files: PreparationPlan['files'] = [...base.plan.files];
  const generated: Record<string, string> = { ...installationFiles(settings), ...(settings.projectType === 'angularjs' ? angularToolkit : {}) };
  const alternate = tree.tree.find(f => f.path === '.github/workflows/aq-review.yml');
  if (alternate && settings.projectType === 'angularjs') {
    if (tree.tree.some(f => f.path === '.github/workflows/quality-gate.yml')) throw new PreparationError('พบทั้ง quality-gate.yml และ aq-review.yml กรุณาเลือกเก็บ workflow เดียวบน GitHub ก่อน เพื่อไม่ให้ตรวจซ้ำ');
    if (alternate.mode !== '100644' || alternate.type !== 'blob' || (alternate.size || 0) > 100000) throw new PreparationError('ไฟล์ aq-review.yml ไม่ใช่ไฟล์ปกติ');
    const old = await api<{ content: string; encoding: string }>(`/repos/${repository}/git/blobs/${alternate.sha}`);
    if (old.encoding !== 'base64' || classifyInstallation(Buffer.from(old.content, 'base64').toString('utf8'), generated['config_cov.json']) !== 'active') throw new PreparationError('มี aq-review.yml อยู่แล้วแต่ไม่ใช่ workflow AngularJS ที่รู้จัก กรุณาตรวจไฟล์เดิมก่อนติดตั้ง');
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
    if (path.startsWith('quality-gate/') && before !== null && before !== after) throw new PreparationError(`มี ${path} เดิมที่ต่างจากชุดเครื่องมือ กรุณาตรวจไฟล์ก่อนเพื่อไม่เขียนทับงานเดิม`);
    let content = after;
    if (path === 'config_cov.json' && before !== null) {
      try {
        const old = JSON.parse(before);
        if (!old || typeof old !== 'object' || Array.isArray(old) || (old.files && (typeof old.files !== 'object' || Array.isArray(old.files) || Object.values(old.files).some(n => !Number.isInteger(n) || Number(n) < 1 || Number(n) > 100)))) throw new Error();
        content = JSON.stringify({ ...old, global: settings.coverage, files: old.files || {} }, null, 2) + '\n';
      } catch { throw new PreparationError('อ่าน config_cov.json เดิมไม่ได้ กรุณาตรวจไฟล์ก่อนติดตั้ง'); }
    }
    if (before !== content) files.push({ path, before, after: content });
  }
  const plan: PreparationPlan = { status: files.length ? 'changes' : 'ready', files, messages: [
    ...base.plan.messages.filter(m => !m.includes('PR นี้เตรียมเครื่องมือเท่านั้น')),
    'PR เดียวรวมไฟล์เตรียมโปรเจกต์ workflow และ coverage config; ติดตั้งแล้วไม่ได้แปลว่าผลตรวจผ่าน',
    'เมื่อเปิด PR งาน Action จะสร้างเทสต์ เพิ่มไฟล์เทสต์ใน PR เดียวกัน และรายงาน coverage; ต้องอนุญาต GitHub Actions ให้เขียน Contents และ Checks',
    ...(settings.projectType === 'angularjs' ? ['ชุดเครื่องมือ AngularJS อยู่ใน quality-gate/ รันซ้ำด้วย npm ci --prefix quality-gate และ node quality-gate/run.cjs; ยังไม่เปิดใช้ SonarCloud'] : []),
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

export async function installOnce(api: GitHubClient, repository: string, settings: Settings) {
  const snapshot = await inspectInstallation(api, repository, settings);
  const { treeSha: _tree, ...preview } = snapshot;
  if (snapshot.plan.status === 'ready') return { preview, pull: null };
  const pull = await createInstallation(api, repository, settings, snapshot.baseSha, snapshot.digest);
  return { preview, pull };
}
