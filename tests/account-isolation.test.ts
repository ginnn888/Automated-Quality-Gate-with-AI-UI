import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EncryptJWT } from 'jose';
import { NextRequest } from 'next/server';
import { seal } from '../src/lib/session';
import { GET as me } from '../src/app/api/auth/me/route';
import { GET as repositories } from '../src/app/api/repositories/route';
import { POST as logout } from '../src/app/api/auth/logout/route';

test('two concurrent users receive only their own identity and accessible repositories; invalid sessions never call GitHub', async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = { SESSION_SECRET: process.env.SESSION_SECRET, APP_URL: process.env.APP_URL, GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG };
  process.env.SESSION_SECRET = 'isolation-test-secret-at-least-32-characters';
  process.env.APP_URL = 'http://localhost:3000'; process.env.GITHUB_APP_SLUG = 'quality-gate';
  let calls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      calls++;
      const auth = new Headers(init?.headers).get('Authorization');
      const who = auth === 'Bearer alice-token' ? 'alice' : auth === 'Bearer bob-token' ? 'bob' : null;
      if (!who) return Response.json({ message: 'Bad credentials' }, { status: 401 });
      assert.equal(init?.cache, 'no-store');
      const id = who === 'alice' ? 1 : 2;
      const path = new URL(String(input)).pathname;
      if (path === '/user') return Response.json({ id, login: who, name: who });
      if (path === '/user/installations') return Response.json({ installations: [{ id, app_slug: 'quality-gate', suspended_at: null }] });
      if (path === `/user/installations/${id}/repositories`) return Response.json({ repositories: [{ id, full_name: `${who}/private-project`, private: true, default_branch: 'main', language: 'JavaScript', html_url: `https://github.com/${who}/private-project`, description: null }] });
      assert.ok(path.startsWith(`/repos/${who}/`), 'cross-account GitHub request');
      return Response.json({ message: 'Not Found' }, { status: 404 });
    };
    const sessions = await Promise.all(['alice', 'bob'].map(async who => ({ who, cookie: await seal(`${who}-token`) })));
    await Promise.all(sessions.map(async ({ who, cookie }) => {
      const request = new NextRequest('http://localhost:3000/api/repositories', { headers: { cookie: `qg_session=${cookie}` } });
      const identity = await me(request); const profile = await identity.json();
      assert.equal(profile.user.login, who); assert.equal(profile.token, undefined);
      assert.match(identity.headers.get('Cache-Control')!, /no-store/);
      const response = await repositories(request); const result = await response.json();
      assert.equal(result.userId, profile.user.id);
      assert.deepEqual(result.repositories.map((r: { full_name: string }) => r.full_name), [`${who}/private-project`]);
      assert.equal(response.headers.get('Vary'), 'Cookie');
      assert.ok(!JSON.stringify(result).includes(`${who}-token`));
    }));
    const key = createHash('sha256').update(process.env.SESSION_SECRET).digest();
    const expired = await new EncryptJWT({ token: 'alice-token' }).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setExpirationTime(1).encrypt(key);
    const before = calls;
    for (const cookie of ['', 'tampered-session', expired]) {
      const req = new NextRequest('http://localhost:3000/api/auth/me', { headers: { cookie: `qg_session=${cookie}` } });
      assert.equal((await me(req)).status, 401);
      assert.equal((await repositories(req)).status, 401);
    }
    assert.equal(calls, before);
    const revoked = await seal('revoked-token');
    assert.equal((await me(new NextRequest('http://localhost:3000/api/auth/me', { headers: { cookie: `qg_session=${revoked}` } }))).status, 401);
    const denied = await logout(new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example' } }));
    assert.equal(denied.status, 403);
    const out = await logout(new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { origin: 'http://localhost:3000' } }));
    assert.equal(out.headers.get('location'), 'http://localhost:3000/login?notice=logout');
    for (const name of ['qg_session', 'qg_oauth_state', 'qg_oauth_next']) { assert.equal(out.cookies.get(name)?.value, ''); assert.equal(new Date(out.cookies.get(name)!.expires!).getTime(), 0); }
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
