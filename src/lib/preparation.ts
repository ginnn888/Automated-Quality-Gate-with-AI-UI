import templateLock from './setup-template-lock.json';

export type PreparationFile = { path: string; before: string | null; after: string };
export type PreparationPlan = {
  status: 'changes' | 'ready' | 'blocked';
  files: PreparationFile[];
  messages: string[];
};
export type ProjectSnapshot = { paths: string[]; packageJson: string | null; packageLock: string | null };
const stringify = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const configNames = ['jest.config.js', 'jest.config.cjs', 'jest.config.mjs', 'jest.config.ts', 'jest.config.cts', 'jest.config.json'];

/** Pure planner: no repository code, scripts or configuration are executed. */
export function planPreparation(snapshot: ProjectSnapshot): PreparationPlan {
  const { paths } = snapshot;
  const messages: string[] = [];
  const blocked = (message: string): PreparationPlan => ({ status: 'blocked', files: [], messages: [message, ...messages] });
  if (!paths.some(p => /^src\/.*\.js$/.test(p))) messages.push('Action เดิมตรวจเฉพาะ src/ หากมี test.js ที่ root ให้ย้ายโค้ดที่ต้องการตรวจเข้า src/ ก่อนทดสอบ Action');
  if (paths.some(p => /(^|\/)(yarn.lock|pnpm-lock.yaml|bun.lockb?|npm-shrinkwrap.json)$/.test(p))) return blocked('พบ package manager หรือ lockfile รูปแบบอื่น จึงไม่เพิ่ม npm/Jest ทับอัตโนมัติ');
  if (paths.some(p => p !== 'package.json' && p.endsWith('/package.json'))) return blocked('พบหลาย package ใน repo ต้องเลือกและตั้งค่าแต่ละ package ก่อน');
  if (paths.some(p => /\.(ts|tsx|jsx|mjs)$/.test(p) && !p.endsWith('.config.mjs'))) return blocked('การเตรียมอัตโนมัติรุ่นนี้รองรับ JavaScript CommonJS ก่อน โปรเจกต์ TypeScript/JSX/ES modules ต้องใช้การตั้งค่าเฉพาะ');
  let pkg: Record<string, unknown> = { name: 'quality-gate-project', version: '1.0.0', private: true };
  if (snapshot.packageJson !== null) {
    try { const parsed: unknown = JSON.parse(snapshot.packageJson); if (!record(parsed)) return blocked('package.json ต้องเป็น JSON object'); pkg = parsed; }
    catch { return blocked('อ่าน package.json ไม่ได้ กรุณาแก้ JSON ให้ถูกต้องก่อน'); }
  } else if (snapshot.packageLock !== null) return blocked('พบ package-lock.json แต่ไม่มี package.json ต้องกู้ package.json เดิมก่อนเพื่อรักษา dependencies');
  if (pkg.type === 'module' || pkg.workspaces) return blocked('พบ ES modules หรือ workspaces ต้องใช้การตั้งค่า Jest เฉพาะโปรเจกต์');
  if (typeof pkg.packageManager === 'string' && !pkg.packageManager.startsWith('npm@')) return blocked('โปรเจกต์นี้ไม่ได้ใช้ npm จึงไม่เปลี่ยน package manager อัตโนมัติ');
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (pkg[key] !== undefined && (!record(pkg[key]) || Object.values(pkg[key]).some(v => typeof v !== 'string'))) return blocked(`รูปแบบ ${key} ใน package.json ไม่ถูกต้อง`);
  }
  const dependencies = (pkg.dependencies || {}) as Record<string, string>;
  const devDependencies = (pkg.devDependencies || {}) as Record<string, string>;
  const scripts = (pkg.scripts || {}) as Record<string, string>;
  const jest = devDependencies.jest || dependencies.jest;
  const hasConfig = paths.some(p => configNames.includes(p)) || pkg.jest !== undefined;
  const files: PreparationFile[] = [];
  let lockReady = false;
  if (snapshot.packageLock !== null) {
    try {
      const lock = JSON.parse(snapshot.packageLock);
      const root = lock?.packages?.[''];
      const equalDeps = (a: unknown, b: unknown) => record(a || {}) && record(b || {}) && stringify(Object.entries((a || {}) as object).sort()) === stringify(Object.entries((b || {}) as object).sort());
      lockReady = Boolean(jest && root && lock.packages['node_modules/jest'] && equalDeps(root.dependencies, pkg.dependencies) && equalDeps(root.devDependencies, pkg.devDependencies) && equalDeps(root.optionalDependencies, pkg.optionalDependencies));
    } catch { return blocked('อ่าน package-lock.json ไม่ได้ กรุณาแก้ lockfile ก่อน'); }
  }
  if (!lockReady) {
    // Use a real, pre-generated npm lock; never fabricate dependency trees or execute a user's scripts on the server.
    const onlyTemplateDependencies = Object.keys(dependencies).length === 0 && Object.keys(devDependencies).every(k => k === 'jest') && (!jest || jest === '30.5.2');
    if (!onlyTemplateDependencies || Object.keys((pkg.optionalDependencies || {}) as object).length || Object.keys((pkg.peerDependencies || {}) as object).length || pkg.overrides || pkg.bundledDependencies || pkg.bundleDependencies) {
      return blocked('พบ dependencies เดิมที่ต้อง resolve lockfile เฉพาะโปรเจกต์ กรุณารัน npm install --save-dev jest และ commit package-lock.json ก่อน เว็บจะรักษา dependencies เดิมไว้');
    }
    if (snapshot.packageLock !== null) return blocked('lockfile เดิมยังไม่ตรงกับ package.json/Jest กรุณารัน npm install และ commit ผลลัพธ์ก่อน เว็บจะไม่สร้างทับ lockfile เดิม');
    pkg = { ...pkg, devDependencies: { ...devDependencies, jest: '30.5.2' } };
    const lock = structuredClone(templateLock) as Record<string, unknown> & { packages: Record<string, Record<string, unknown>> };
    const root: Record<string, unknown> = { devDependencies: pkg.devDependencies };
    for (const field of ['name', 'version', 'license', 'engines']) if (pkg[field] !== undefined) root[field] = pkg[field];
    for (const field of ['name', 'version']) { if (pkg[field] !== undefined) lock[field] = pkg[field]; else delete lock[field]; }
    lock.packages[''] = root;
    files.push({ path: 'package-lock.json', before: null, after: stringify(lock) });
  } else messages.push('พบ Jest และ lockfile ที่ตรงกับ dependencies แล้ว จะคงเวอร์ชันและ lockfile เดิม');
  // Existing test commands are owned by the project. Add only when absent.
  if (!scripts.test) pkg = { ...pkg, scripts: { ...scripts, test: 'jest --coverage' } };
  else messages.push('คงคำสั่ง npm test เดิมไว้; Action เดิมเรียก npx jest โดยตรง');
  const updatedPackage = stringify(pkg);
  if (snapshot.packageJson === null || stringify(JSON.parse(snapshot.packageJson)) !== updatedPackage) files.unshift({ path: 'package.json', before: snapshot.packageJson, after: updatedPackage });
  if (!hasConfig) files.push({ path: 'jest.config.cjs', before: null, after: `/** Prepared by Quality Gate. Review before merging. */\nmodule.exports = {\n  testEnvironment: 'node',\n  testMatch: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],\n  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/**/*.spec.js'],\n  coverageReporters: ['text', 'json-summary', 'lcov'],\n};\n` });
  else messages.push('พบ Jest config เดิมแล้ว จะไม่เขียนทับ กรุณาตรวจว่า config รับเทสต์ที่ AI สร้างใน Test/');
  messages.push('PR นี้เตรียมเครื่องมือเท่านั้น ยังไม่สร้างเทสต์หรือเปิดใช้ Action; Jest จะไม่ผ่านหากยังไม่มีเทสต์');
  return { status: files.length ? 'changes' : 'ready', files, messages };
}

