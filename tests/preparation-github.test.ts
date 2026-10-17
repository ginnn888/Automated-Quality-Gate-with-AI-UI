import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreparationPR, inspectRepository, type GitHubClient } from '../src/lib/preparation-github';
import { GitHubError } from '../src/lib/github';

function fakeGitHub(options: { canPush?: boolean; truncated?: boolean; failPR?: boolean } = {}) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  let branch = false, opened = false, fail = options.failPR || false;
  const api: GitHubClient = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    calls.push({ path, method, body });
    let result: unknown;
    if (path === '/repos/user/app') result = { full_name: 'user/app', default_branch: 'main', permissions: { push: options.canPush !== false } };
    else if (path.endsWith('/git/ref/heads/main')) result = { object: { sha: 'a'.repeat(40) } };
    else if (path.endsWith(`/git/commits/${'a'.repeat(40)}`)) result = { tree: { sha: 'old-tree' } };
    else if (path.includes('/git/trees/old-tree')) result = { truncated: options.truncated || false, tree: [{ path: 'src/math.js', type: 'blob', mode: '100644', sha: 'source' }] };
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
test('inspection is read-only; PR creates a branch and atomic commit, never writes main', async () => {
  const { api, calls } = fakeGitHub();
  const preview = await inspectRepository(api, 'user/app');
  assert.ok(calls.every(c => c.method === 'GET'));
  const pull = await createPreparationPR(api, 'user/app', preview.baseSha, preview.digest);
  assert.equal(pull.number, 1);
  const refs = calls.filter(c => c.path.endsWith('/git/refs'));
  assert.equal(refs.length, 1);
  assert.match(JSON.stringify(refs[0].body), /refs\/heads\/quality-gate\/prepare-/);
  assert.ok(calls.every(c => c.method !== 'PATCH' && c.method !== 'DELETE'));
  const tree = calls.find(c => c.path.endsWith('/git/trees') && c.method === 'POST')!.body as { tree: { path: string }[] };
  assert.deepEqual(tree.tree.map(f => f.path), ['package.json', 'package-lock.json', 'jest.config.cjs']);
  const again = await createPreparationPR(api, 'user/app', preview.baseSha, preview.digest);
  assert.equal(again.reused, true);
  assert.equal(calls.filter(c => c.path.endsWith('/pulls') && c.method === 'POST').length, 1);
});
test('denies read-only users before any repository file read or write', async () => {
  const { api, calls } = fakeGitHub({ canPush: false });
  await assert.rejects(inspectRepository(api, 'user/app'), /สิทธิ์/);
  assert.equal(calls.length, 1);
});
test('stale or tampered previews cannot create a PR', async () => {
  const { api, calls } = fakeGitHub();
  const preview = await inspectRepository(api, 'user/app');
  await assert.rejects(createPreparationPR(api, 'user/app', 'b'.repeat(40), preview.digest), /เปลี่ยน/);
  await assert.rejects(createPreparationPR(api, 'user/app', preview.baseSha, 'b'.repeat(64)), /เปลี่ยน/);
  assert.ok(calls.every(c => c.method === 'GET'));
});
test('truncated file listings are not mistaken for missing config', async () => {
  const { api } = fakeGitHub({ truncated: true });
  await assert.rejects(inspectRepository(api, 'user/app'), /ใหญ่เกิน/);
});
test('PR failure can be retried using the existing verified branch', async () => {
  const { api, calls } = fakeGitHub({ failPR: true });
  const preview = await inspectRepository(api, 'user/app');
  await assert.rejects(createPreparationPR(api, 'user/app', preview.baseSha, preview.digest), /เตรียม branch/);
  const retry = await createPreparationPR(api, 'user/app', preview.baseSha, preview.digest);
  assert.equal(retry.number, 1);
  assert.equal(calls.filter(c => c.path.endsWith('/git/refs') && c.method === 'POST').length, 1);
});
test('does not reuse an existing PR if someone changed its branch', async () => {
  const { api } = fakeGitHub();
  const preview = await inspectRepository(api, 'user/app');
  await createPreparationPR(api, 'user/app', preview.baseSha, preview.digest);
  const changed: GitHubClient = async <T>(path: string, method?: string, body?: unknown) => {
    if (path.endsWith('/git/commits/prepared-commit')) return { tree: { sha: 'modified-by-user' }, parents: [{ sha: preview.baseSha }] } as T;
    return api<T>(path, method, body);
  };
  await assert.rejects(createPreparationPR(changed, 'user/app', preview.baseSha, preview.digest), /branch.*แก้ไข/);
});
