import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { jwtDecrypt } from 'jose';
import { NextRequest } from 'next/server';
import { seal } from '../src/lib/session';
import { GET as callback } from '../src/app/api/auth/callback/route';
import { POST as install } from '../src/app/api/install/route';
import { POST as preparation } from '../src/app/api/preparation/route';

test('session is encrypted, authenticated and expires', async () => {
  process.env.SESSION_SECRET = 'test-only-session-key-with-more-than-32-characters';
  const token = await seal('test-only-github-token');
  assert.ok(!token.includes('test-only-github-token'));
  const key = createHash('sha256').update(process.env.SESSION_SECRET).digest();
  const { payload } = await jwtDecrypt(token, key);
  assert.equal(payload.token, 'test-only-github-token');
  assert.equal(payload.exp! - payload.iat!, 3600);
  await assert.rejects(jwtDecrypt(token, new Uint8Array(32)));
  delete process.env.SESSION_SECRET;
});
test('OAuth callback rejects missing, mismatched and non-ASCII state before token exchange', async () => {
  for (const state of ['', 'b'.repeat(64), 'ก'.repeat(64)]) {
    const req = new NextRequest(`http://localhost:3000/api/auth/callback?code=example&state=${encodeURIComponent(state)}`, { headers: { cookie: `qg_oauth_state=${'a'.repeat(64)}` } });
    const res = await callback(req);
    assert.equal(res.status, 307);
    assert.match(res.headers.get('location')!, /notice=auth/);
    assert.equal(res.cookies.get('qg_session')?.value, '');
  }
});
test('installation rejects cross-origin mutations', async () => {
  const response = await install(new NextRequest('http://localhost:3000/api/install', { method: 'POST', headers: { origin: 'https://untrusted.example' } }));
  assert.equal(response.status, 403);
  assert.ok((await response.json()).error);
});
test('preparation rejects cross-origin requests before touching the session or GitHub', async () => {
  const request = new NextRequest('http://localhost:3000/api/preparation', { method: 'POST', headers: { origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', repository: 'user/repo' }) });
  assert.equal((await preparation(request)).status, 403);
});
