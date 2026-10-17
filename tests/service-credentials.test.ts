import { test } from 'node:test';
import assert from 'node:assert/strict';
import sodium from 'libsodium-wrappers';
import { credentialSchema, saveRepositorySecret, sonarProjects } from '../src/lib/service-credentials';
import { github, GitHubError, githubFailure } from '../src/lib/github';
import type { GitHubClient } from '../src/lib/preparation-github';

test('secret is sealed to repository public key; plaintext is not sent to GitHub or returned', async () => {
  await sodium.ready;
  const pair = sodium.crypto_box_keypair();
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const api: GitHubClient = async <T>(path: string, method?: string, body?: unknown) => {
    calls.push({ path, method, body });
    return (path.endsWith('public-key') ? { key: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL), key_id: 'key-id' } : { permissions: { push: true } }) as T;
  };
  const value = 'fake-gemini-secret-for-test';
  const result = await saveRepositorySecret(api, { repository: 'owner/project', name: 'GEMINI_API_KEY', value });
  const last = calls.at(-1)!;
  assert.equal(last.path, '/repos/owner/project/actions/secrets/GEMINI_API_KEY');
  assert.equal(last.method, 'PUT');
  assert.ok(!JSON.stringify({ calls, result }).includes(value));
  const encrypted = (last.body as { encrypted_value: string }).encrypted_value;
  assert.equal(sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(encrypted, sodium.base64_variants.ORIGINAL), pair.publicKey, pair.privateKey)), value);
});

test('invalid secret names and inaccessible repositories cannot write secrets', async () => {
  assert.equal(credentialSchema.safeParse({ repository: 'a/b', name: 'GITHUB_TOKEN', value: 'fake-secret-value' }).success, false);
  let calls = 0;
  const api: GitHubClient = async <T>() => { calls++; return { permissions: { push: false } } as T; };
  await assert.rejects(saveRepositorySecret(api, { repository: 'a/b', name: 'SONAR_TOKEN', value: 'fake-secret-value' }));
  assert.equal(calls, 1);
});

test('Sonar discovery uses fixed host, bearer auth and pagination without returning token', async () => {
  const result = await sonarProjects({ organization: 'my-org', token: 'fake-sonar-token' }, async (url, options) => {
    assert.equal(String(url), 'https://sonarcloud.io/api/projects/search?organization=my-org&p=1&ps=100');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    assert.equal((options?.headers as Record<string,string>).Authorization, 'Bearer fake-sonar-token');
    return Response.json({ paging: { total: 101 }, components: [{ key: 'my-project', name: 'Imported project', unrelated: 'discard' }] });
  });
  assert.deepEqual(result, { projects: [{ key: 'my-project', name: 'Imported project', organization: 'my-org' }], nextPage: 2 });
  await assert.rejects(sonarProjects({ organization: 'my-org', token: 'fake-sonar-token' }, async () => new Response('private upstream details', { status: 403 })), { message: 'SonarCloud unavailable' });
});

test('GitHub secret writes accept empty 201 and 204 responses', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [201, 204]) {
      globalThis.fetch = async () => new Response(null, { status });
      assert.equal(await github('fake-token', '/repos/a/b/actions/secrets/GEMINI_API_KEY', 'PUT', {}), undefined);
    }
  } finally { globalThis.fetch = original; }
});


test('GitHub failures identify the operation without exposing upstream secrets', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ message: 'refusing workflow update secret-private-value', errors: ['secret-private-value'] }, { status: 403, headers: { 'x-github-request-id': 'ABC:123' } });
    await assert.rejects(github('secret-private-value', '/repos/a/b/git/refs', 'POST', {}), error => {
      assert.ok(error instanceof GitHubError);
      const message = githubFailure(error);
      assert.match(message, /403/);
      assert.match(message, /สร้าง branch/);
      assert.match(message, /workflow/);
      assert.match(message, /ABC:123/);
      assert.ok(!message.includes('secret-private-value'));
      return true;
    });
    globalThis.fetch = async () => Response.json(null, { status: 422 });
    await assert.rejects(github('test', '/repos/a/b/git/trees', 'POST'), GitHubError);
  } finally { globalThis.fetch = original; }
});
