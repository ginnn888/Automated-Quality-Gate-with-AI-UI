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

export function planAngularPreparation(snapshot: ProjectSnapshot): PreparationPlan {
  const blocked = (message: string): PreparationPlan => ({ status: 'blocked', files: [], messages: [message] });
  try {
    if (!snapshot.packageJson || !snapshot.packageLock) return blocked('AngularJS requires package.json and package-lock.json. Run npm install and commit the files.');
    const pkg = JSON.parse(snapshot.packageJson), lock = JSON.parse(snapshot.packageLock);
    if (pkg.workspaces || (pkg.packageManager && !pkg.packageManager.startsWith('npm@'))) return blocked('AngularJS setup requires npm at the repository root.');
    if (!pkg.dependencies?.angular && !pkg.devDependencies?.angular) return blocked('No AngularJS dependency was found in package.json.');
    const root = lock.packages?.[''];
    if (!root || !lock.packages?.['node_modules/angular']) return blocked('Run npm install and commit a lockfile that includes AngularJS.');
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const sorted = (value: object) => JSON.stringify(Object.entries(value || {}).sort());
      if (sorted(pkg[field]) !== sorted(root[field])) return blocked('package.json and the lockfile differ. Run npm install and commit the result.');
    }
    if (!snapshot.paths.some(path => /^src\/.*\.js$/.test(path))) return blocked('The Action requires AngularJS source files in src/.');
    return { status: 'ready', files: [], messages: ['The Action generates and runs AngularJS tests.'] };
  } catch { return blocked('Could not parse package.json or package-lock.json. Check the JSON syntax.'); }
}

/** Pure planner: no repository code, scripts or configuration are executed. */
export function planPreparation(snapshot: ProjectSnapshot): PreparationPlan {
  const { paths } = snapshot;
  const messages: string[] = [];
  const blocked = (message: string): PreparationPlan => ({ status: 'blocked', files: [], messages: [message, ...messages] });
  if (!paths.some(p => /^src\/.*\.js$/.test(p))) messages.push('Checks inspect JavaScript files in src/. Move the source to this directory before running the Action.');
  if (paths.some(p => /(^|\/)(yarn.lock|pnpm-lock.yaml|bun.lockb?|npm-shrinkwrap.json)$/.test(p))) return blocked('An alternative package manager or lockfile was found. Configure npm and Jest manually.');
  if (paths.some(p => p !== 'package.json' && p.endsWith('/package.json'))) return blocked('Multiple packages found. Configure each package separately.');
  if (paths.some(p => /\.(ts|tsx|jsx|mjs)$/.test(p) && !p.endsWith('.config.mjs'))) return blocked('Automatic setup supports CommonJS JavaScript. TypeScript, JSX and ES modules require a project-specific configuration.');
  let pkg: Record<string, unknown> = { name: 'quality-gate-project', version: '1.0.0', private: true };
  if (snapshot.packageJson !== null) {
    try { const parsed: unknown = JSON.parse(snapshot.packageJson); if (!record(parsed)) return blocked('package.json must contain a JSON object.'); pkg = parsed; }
    catch { return blocked('Could not parse package.json. Correct the JSON syntax.'); }
  } else if (snapshot.packageLock !== null) return blocked('Restore package.json before preparing this repository to preserve its locked dependencies.');
  if (pkg.type === 'module' || pkg.workspaces) return blocked('ES modules and workspaces require a project-specific Jest configuration.');
  if (typeof pkg.packageManager === 'string' && !pkg.packageManager.startsWith('npm@')) return blocked('This project uses another package manager. Configure it manually.');
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (pkg[key] !== undefined && (!record(pkg[key]) || Object.values(pkg[key]).some(v => typeof v !== 'string'))) return blocked(`Invalid ${key} field in package.json.`);
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
    } catch { return blocked('Could not read package-lock.json. Fix the lockfile and retry.'); }
  }
  if (!lockReady) {
    // Use a real, pre-generated npm lock; never fabricate dependency trees or execute a user's scripts on the server.
    const onlyTemplateDependencies = Object.keys(dependencies).length === 0 && Object.keys(devDependencies).every(k => k === 'jest') && (!jest || jest === '30.5.2');
    if (!onlyTemplateDependencies || Object.keys((pkg.optionalDependencies || {}) as object).length || Object.keys((pkg.peerDependencies || {}) as object).length || pkg.overrides || pkg.bundledDependencies || pkg.bundleDependencies) {
      return blocked('Run npm install --save-dev jest and commit package-lock.json to resolve Jest alongside existing dependencies.');
    }
    if (snapshot.packageLock !== null) return blocked('The lockfile does not match package.json and Jest. Run npm install and commit the updated lockfile.');
    pkg = { ...pkg, devDependencies: { ...devDependencies, jest: '30.5.2' } };
    const lock = structuredClone(templateLock) as Record<string, unknown> & { packages: Record<string, Record<string, unknown>> };
    const root: Record<string, unknown> = { devDependencies: pkg.devDependencies };
    for (const field of ['name', 'version', 'license', 'engines']) if (pkg[field] !== undefined) root[field] = pkg[field];
    for (const field of ['name', 'version']) { if (pkg[field] !== undefined) lock[field] = pkg[field]; else delete lock[field]; }
    lock.packages[''] = root;
    files.push({ path: 'package-lock.json', before: null, after: stringify(lock) });
  } else messages.push('The installed Jest version and lockfile match the dependencies.');
  // Existing test commands are owned by the project. Add only when absent.
  if (!scripts.test) pkg = { ...pkg, scripts: { ...scripts, test: 'jest --coverage' } };
  else messages.push('The Action invokes Jest directly and preserves the existing npm test script.');
  const updatedPackage = stringify(pkg);
  if (snapshot.packageJson === null || stringify(JSON.parse(snapshot.packageJson)) !== updatedPackage) files.unshift({ path: 'package.json', before: snapshot.packageJson, after: updatedPackage });
  if (!hasConfig) files.push({ path: 'jest.config.cjs', before: null, after: `/** Prepared by Automated Quality Gate. Review before merging. */\nmodule.exports = {\n  testEnvironment: 'node',\n  testMatch: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],\n  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/**/*.spec.js'],\n  coverageReporters: ['text', 'json-summary', 'lcov'],\n};\n` });
  else messages.push('An existing Jest configuration was found. Check that it includes generated tests under Test/.');
  messages.push('This pull request prepares test tooling only. Install the Action and add tests before running Jest.');
  return { status: files.length ? 'changes' : 'ready', files, messages };
}

