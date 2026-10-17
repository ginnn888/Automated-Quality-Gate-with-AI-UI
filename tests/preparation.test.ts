import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPreparation, type ProjectSnapshot } from '../src/lib/preparation';

const bare: ProjectSnapshot = { paths: ['src/math.js'], packageJson: null, packageLock: null };
test('bare repo receives a real npm lock, package and Jest config without source edits', () => {
  const plan = planPreparation(bare);
  assert.equal(plan.status, 'changes');
  assert.deepEqual(plan.files.map(f => f.path), ['package.json', 'package-lock.json', 'jest.config.cjs']);
  const pkg = JSON.parse(plan.files[0].after);
  const lock = JSON.parse(plan.files[1].after);
  assert.equal(pkg.devDependencies.jest, '30.5.2');
  assert.equal(lock.packages['node_modules/jest'].version, pkg.devDependencies.jest);
  assert.ok(Object.keys(lock.packages).length > 100);
  assert.ok(lock.packages['node_modules/jest'].integrity);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
});
test('existing scripts and metadata survive and package remains byte-identical if unchanged', () => {
  const pkg = { name: 'existing-project', version: '2.3.0', description: 'keep me', scripts: { test: 'custom-test', build: 'custom-build' } };
  const plan = planPreparation({ ...bare, packageJson: JSON.stringify(pkg) });
  const updated = JSON.parse(plan.files.find(f => f.path === 'package.json')!.after);
  assert.deepEqual(updated.scripts, pkg.scripts);
  assert.equal(updated.description, pkg.description);
  const lock = JSON.parse(plan.files.find(f => f.path === 'package-lock.json')!.after);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  const ready = planPreparation({ paths: [...bare.paths, ...plan.files.map(f => f.path)], packageJson: JSON.stringify(updated, null, 4), packageLock: JSON.stringify(lock) });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.files.length, 0);
});
test('existing Jest configuration is never overwritten', () => {
  const plan = planPreparation({ ...bare, paths: [...bare.paths, 'jest.config.cjs'] });
  assert.ok(!plan.files.some(f => f.path === 'jest.config.cjs'));
  const withEmbeddedConfig = planPreparation({ ...bare, packageJson: JSON.stringify({ jest: { testEnvironment: 'jsdom' } }) });
  assert.ok(!withEmbeddedConfig.files.some(f => f.path === 'jest.config.cjs'));
  assert.equal(JSON.parse(withEmbeddedConfig.files[0].after).jest.testEnvironment, 'jsdom');
});
test('unsupported projects produce no mutations and a useful reason', () => {
  const snapshots: ProjectSnapshot[] = [
    { ...bare, packageJson: '{broken' },
    { ...bare, packageJson: JSON.stringify({ type: 'module' }) },
    { ...bare, packageJson: JSON.stringify({ scripts: [] }) },
    { ...bare, packageJson: JSON.stringify({ dependencies: { express: '^5.0.0' } }) },
    { ...bare, packageJson: JSON.stringify({ dependencies: { custom: 'file:../secret' } }) },
    { ...bare, paths: [...bare.paths, 'pnpm-lock.yaml'] },
    { ...bare, paths: [...bare.paths, 'src/main.ts'] },
    { ...bare, paths: [...bare.paths, 'packages/server/package.json'] },
    { ...bare, packageLock: '{}' },
  ];
  for (const snapshot of snapshots) {
    const plan = planPreparation(snapshot);
    assert.equal(plan.status, 'blocked');
    assert.deepEqual(plan.files, []);
    assert.ok(plan.messages.length);
  }
});
test('an existing compatible npm/Jest repo keeps its dependencies and lockfile', () => {
  const pkg = { name: 'app', scripts: { test: 'jest' }, dependencies: { express: '^5.0.0' }, devDependencies: { jest: '^29.0.0' } };
  const lock = { lockfileVersion: 3, packages: { '': { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies }, 'node_modules/jest': { version: '29.7.0' } } };
  const plan = planPreparation({ ...bare, packageJson: JSON.stringify(pkg), packageLock: JSON.stringify(lock) });
  assert.deepEqual(plan.files.map(f => f.path), ['jest.config.cjs']);
});
test('root test.js gets an explicit engine limitation rather than false readiness', () => {
  const plan = planPreparation({ ...bare, paths: ['test.js'] });
  assert.ok(plan.messages.some(m => m.includes('src/')));
});

