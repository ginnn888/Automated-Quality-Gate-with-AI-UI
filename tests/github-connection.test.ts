import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionDestination, hasRepositoryAccess, installationUrl } from '../src/lib/github-connection';
import { GET as login } from '../src/app/api/auth/login/route';
import { GET as callback } from '../src/app/api/auth/callback/route';
import { NextRequest } from 'next/server';
import { GitHubError } from '../src/lib/github';

function fakeApi(installations: unknown[], repositories: unknown[] = []) {
  return async <T>(_token: string, path: string): Promise<T> => (path.includes('/repositories?') ? { repositories } : { installations }) as T;
}
const ours = { id: 42, app_slug: 'quality-gate', suspended_at: null };
test('new visitors log in first and cannot supply arbitrary redirect destinations', async () => {
  assert.equal(await connectionDestination(null, 'quality-gate', 'connect'), '/api/auth/login?next=connect');
  assert.equal(await connectionDestination(null, 'quality-gate', 'return'), '/api/auth/login?next=return');
  assert.throws(() => installationUrl('https://evil.example'));
});
test('users with no authorized repo go to GitHub; authorized users skip installation', async () => {
  assert.equal(await connectionDestination('token', 'quality-gate', 'connect', fakeApi([])), 'https://github.com/apps/quality-gate/installations/new');
  assert.equal(await connectionDestination('token', 'quality-gate', 'connect', fakeApi([ours], [{ id: 1 }])), '/?notice=github-connected');
  assert.equal(await connectionDestination('token', 'quality-gate', 'connect', fakeApi([ours], [])), 'https://github.com/apps/quality-gate/installations/new');
});
test('return verifies accessible repositories and never loops for pending/denied installation', async () => {
  assert.equal(await connectionDestination('token', 'quality-gate', 'return', fakeApi([])), '/?notice=github-empty');
  assert.equal(await connectionDestination('token', 'quality-gate', 'return', fakeApi([ours], [{ id: 1 }])), '/?notice=github-connected');
  assert.equal(await hasRepositoryAccess('token', 'quality-gate', fakeApi([{ ...ours, app_slug: 'another-app' }], [{ id: 1 }])), false);
  assert.equal(await hasRepositoryAccess('token', 'quality-gate', fakeApi([{ ...ours, suspended_at: 'today' }], [{ id: 1 }])), false);
});
test('explicit add-repo action always opens the permission selector', async () => {
  assert.equal(await connectionDestination('token', 'quality-gate', 'install', fakeApi([ours], [{ id: 1 }])), 'https://github.com/apps/quality-gate/installations/new');
});
test('API errors do not become an empty-installation success', async () => {
  await assert.rejects(connectionDestination('token', 'quality-gate', 'return', async () => { throw new GitHubError(403); }), GitHubError);
});
test('installation discovery paginates before deciding access is missing', async () => {
  const api = async <T>(_token: string, path: string): Promise<T> => {
    if (path.includes('/repositories?')) return { repositories: [{ id: 1 }] } as T;
    return { installations: path.endsWith('page=1') ? Array.from({ length: 100 }, (_, id) => ({ ...ours, id, app_slug: 'other' })) : [ours] } as T;
  };
  assert.equal(await hasRepositoryAccess('token', 'quality-gate', api), true);
});
test('OAuth continuation is internal-only and is cleared after the callback', async () => {
  const previous = { id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET, slug: process.env.GITHUB_APP_SLUG, session: process.env.SESSION_SECRET, url: process.env.APP_URL };
  const originalFetch = globalThis.fetch;
  try {
    process.env.GITHUB_CLIENT_ID = 'test-client'; process.env.GITHUB_CLIENT_SECRET = 'test-secret';
    process.env.GITHUB_APP_SLUG = 'quality-gate'; process.env.SESSION_SECRET = 'test-only-session-key-with-more-than-32-characters';
    process.env.APP_URL = 'http://localhost:3000';
    const start = await login(new NextRequest('http://localhost:3000/api/auth/login?next=https://evil.example'));
    assert.equal(start.cookies.get('qg_oauth_next')?.value, 'connect');
    globalThis.fetch = async (url) => String(url).endsWith('/user') ? Response.json({ id: 123, login: 'test-user', name: null }) : Response.json({ access_token: 'fake-test-token' });
    for (const next of ['return', 'install', 'connect', 'https://evil.example']) {
      const state = 'a'.repeat(64);
      const res = await callback(new NextRequest(`http://localhost:3000/api/auth/callback?code=test&state=${state}`, { headers: { cookie: `qg_oauth_state=${state}; qg_oauth_next=${next}` } }));
      assert.equal(res.headers.get('location'), `http://localhost:3000/api/github/${next === 'install' || next === 'return' ? next : 'connect'}`);
      assert.ok(res.cookies.get('qg_session')?.value);
      assert.equal(res.cookies.get('qg_oauth_next')?.value, '');
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries({ GITHUB_CLIENT_ID: previous.id, GITHUB_CLIENT_SECRET: previous.secret, GITHUB_APP_SLUG: previous.slug, SESSION_SECRET: previous.session, APP_URL: previous.url })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
