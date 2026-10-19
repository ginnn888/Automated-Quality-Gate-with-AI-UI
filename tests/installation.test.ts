import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreparationPR, inspectRepository, type GitHubClient } from '../src/lib/preparation-github';
import { createInstallation, inspectInstallation } from '../src/lib/installation';
import { defaultSettings, installationFiles } from '../src/lib/config';
import { planPreparation } from '../src/lib/preparation';
import { GitHubError } from '../src/lib/github';

function fakeGitHub(options: { canPush?: boolean; truncated?: boolean; failPR?: boolean; angular?: boolean; alternate?: boolean } = {}) {
  let prepared = planPreparation({ paths: ['src/math.js'], packageJson: null, packageLock: null }).files;
  if (options.angular) {
    const pkg = { dependencies: { angular: '1.8.3' } };
    prepared = [
      { path: 'package.json', before: null, after: JSON.stringify(pkg) },
      { path: 'package-lock.json', before: null, after: JSON.stringify({ packages: { '': pkg, 'node_modules/angular': { version: '1.8.3' } } }) },
    ];
    if (options.alternate) prepared.push({ path: '.github/workflows/aq-review.yml', before: null, after: installationFiles({ ...defaultSettings, projectType: 'angularjs', aiTimeout: 60 })['.github/workflows/quality-gate.yml'] });
  }
  const calls: { path: string; method: string; body: unknown }[] = [];
  let branch = false, opened = false, fail = options.failPR || false;
  const api: GitHubClient = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    calls.push({ path, method, body });
    let result: unknown;
    if (path === '/repos/user/app') result = { full_name: 'user/app', default_branch: 'main', permissions: { push: options.canPush !== false } };
    else if (path.endsWith('/git/ref/heads/main')) result = { object: { sha: 'a'.repeat(40) } };
    else if (path.endsWith(`/git/commits/${'a'.repeat(40)}`)) result = { tree: { sha: 'old-tree' } };
    else if (path.includes('/git/trees/old-tree')) result = { truncated: options.truncated || false, tree: [{ path: 'src/math.js', type: 'blob', mode: '100644', sha: 'source' }, ...prepared.map((f, i) => ({ path: f.path, type: 'blob', mode: '100644', sha: 'blob-' + i }))] };
    else if (path.includes('/git/blobs/blob-')) result = { encoding: 'base64', content: Buffer.from(prepared[Number(path.split('blob-')[1])].after).toString('base64') };
    else if (path.includes('/actions/secrets/')) result = { name: path.split('/').at(-1) };
    else if (path.includes('/pulls?')) result = opened ? [{ html_url: 'https://github.com/user/app/pull/1', number: 1, state: 'open' }] : [];
    else if (path.endsWith('/git/trees') && method === 'POST') result = { sha: 'prepared-tree' };
    else if (path.includes('/git/ref/heads/quality-gate')) { if (!branch) throw new GitHubError(404); result = { object: { sha: 'prepared-commit' } }; }
    else if (path.endsWith('/git/commits') && method === 'POST') result = { sha: 'prepared-commit' };
    else if (path.endsWith('/git/commits/prepared-commit')) result = { tree: { sha: 'prepared-tree' }, parents: [{ sha: 'a'.repeat(40) }] };
    else if (path.endsWith('/git/refs') && method === 'POST') { branch = true; result = {}; }
    else if (path.endsWith('/pulls') && method === 'POST') {
      if (fail) { fail = false; throw new GitHubError(403); }
      opened = true; result = { html_url: 'https://github.com/user/app/pull/1', number: 1, state: 'open' };
    } else throw new Error(`Unexpected API call: ${method} ${path}`);
    return result as T;
  };
  return { api, calls };
}

for (const sonar of [false, true]) test(`installation PR with sonar=${sonar} is reviewed, isolated, retry safe`, async () => {
  const { api, calls } = fakeGitHub();
  const settings = { ...defaultSettings, sonar, projectKey: 'project', organization: 'org' };
  const preview = await inspectInstallation(api, 'user/app', settings);
  assert.equal(preview.plan.files.length, sonar ? 3 : 2);
  assert.ok(calls.every(c => c.method === 'GET'));
  await assert.rejects(createInstallation(api, 'user/app', settings, 'stale', preview.digest));
  assert.ok(calls.every(c => c.method === 'GET'));
  const pull = await createInstallation(api, 'user/app', settings, preview.baseSha, preview.digest);
  assert.equal(pull.number, 1);
  const retry = await createInstallation(api, 'user/app', settings, preview.baseSha, preview.digest);
  assert.equal(retry.reused, true);
  assert.equal(calls.filter(c => c.path.endsWith('/pulls') && c.method === 'POST').length, 1);
  assert.ok(!calls.some(c => c.method === 'PATCH' || c.method === 'DELETE'));
});
test('missing secret blocks installation before mutation', async () => {
  const { api, calls } = fakeGitHub();
  const blocked: GitHubClient = async (path, method, body) => {
    if (path.includes('/actions/secrets/')) throw new GitHubError(404);
    return api(path, method, body);
  };
  await assert.rejects(inspectInstallation(blocked, 'user/app', defaultSettings), /GEMINI_API_KEY/);
  assert.ok(calls.every(c => c.method === 'GET'));
});

for (const alternate of [false, true]) test(`AngularJS installs only upstream workflow, alternate=${alternate}`, async () => {
  const { api, calls } = fakeGitHub({ angular: true, alternate });
  const settings = { ...defaultSettings, projectType: 'angularjs' as const };
  const preview = await inspectInstallation(api, 'user/app', settings);
  assert.equal(preview.plan.files.length, 1);
  assert.equal(preview.plan.files[0].path, alternate ? '.github/workflows/aq-review.yml' : '.github/workflows/quality-gate.yml');
  assert.ok(!calls.some(call => call.path.includes('SONAR_TOKEN')));
  await createInstallation(api, 'user/app', settings, preview.baseSha, preview.digest);
  const tree = calls.find(call => call.path.endsWith('/git/trees') && call.method === 'POST')!.body as { tree: { path: string }[] };
  assert.deepEqual(tree.tree.map(file => file.path), [preview.plan.files[0].path]);
});
