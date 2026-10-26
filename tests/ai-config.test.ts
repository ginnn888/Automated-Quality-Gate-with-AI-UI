import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import sodium from 'libsodium-wrappers';
import { aiSecretName, defaultSettings, engineRef, flexibleEngineRef, installationFiles, settingsSchema } from '../src/lib/config';
import { inspectInstallation } from '../src/lib/installation';
import { saveRepositorySecret } from '../src/lib/service-credentials';
import type { GitHubClient } from '../src/lib/preparation-github';

const custom = { ...defaultSettings, aiProvider: 'openai-compatible' as const, aiApiUrl: 'https://provider.example/api/v1/chat/completions', geminiModel: 'vendor/model:latest' };

test('JavaScript forwards arbitrary model, exact URL and secret reference, retaining PR guards', () => {
  assert.match(flexibleEngineRef, /@[a-f0-9]{40}$/);
  const workflow = parse(installationFiles(custom)['.github/workflows/quality-gate.yml']);
  const step = workflow.jobs.quality.steps.find((s: { uses?: string }) => s.uses === flexibleEngineRef);
  assert.equal(step.with.ai_provider, 'openai-compatible');
  assert.equal(step.with.ai_model, custom.geminiModel);
  assert.equal(step.with.ai_api_url, custom.aiApiUrl);
  assert.equal(step.with.ai_api_key, '${{ secrets.AI_API_KEY }}');
  assert.equal(step.with.ai_timeout_seconds, '90');
  assert.equal(step.with.gemini_api_key, undefined);
  assert.ok(workflow.jobs.quality.if.includes('head.repo.full_name'));
  assert.deepEqual(Object.keys(workflow.on), ['pull_request']);
});

test('AngularJS custom service preserves isolated checks and three phases on the same new Action commit', () => {
  const workflow = parse(installationFiles({ ...custom, projectType: 'angularjs' })['.github/workflows/quality-gate.yml']);
  for (const phase of ['generate', 'checks', 'report']) {
    const step = workflow.jobs[phase].steps.find((s: { uses?: string }) => s.uses === flexibleEngineRef);
    assert.equal(step.with.phase, phase);
    if (phase !== 'checks') {
      assert.equal(step.with.ai_model, custom.geminiModel);
      assert.equal(step.with.ai_api_url, custom.aiApiUrl);
    }
  }
  const checks = JSON.stringify(workflow.jobs.checks);
  assert.ok(!checks.includes('AI_API_KEY'));
  assert.ok(!checks.includes('ai_api_url'));
  assert.deepEqual(workflow.jobs.checks.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.generate.steps[0].with.ai_api_key, '${{ secrets.AI_API_KEY }}');
  assert.ok(!JSON.stringify(workflow.jobs.report).includes('secrets.AI_API_KEY'));
});

test('native Gemini remains on the published original commit and now forwards JavaScript model settings', () => {
  const workflow = parse(installationFiles({ ...defaultSettings, geminiModel: 'gemini-custom', aiTimeout: 120 })['.github/workflows/quality-gate.yml']);
  const step = workflow.jobs.quality.steps.find((s: { uses?: string }) => s.uses === engineRef);
  assert.equal(step.with.gemini_model, 'gemini-custom');
  assert.equal(step.with.ai_timeout_seconds, '120');
  assert.equal(aiSecretName(defaultSettings), 'GEMINI_API_KEY');
  assert.equal(aiSecretName(custom), 'AI_API_KEY');
});

test('validation rejects embedded credentials, query strings, expressions, unsafe protocols and blank model IDs', () => {
  for (const aiApiUrl of ['http://provider.example/chat', 'https://user:secret@provider.example/chat', 'https://provider.example/chat?key=secret', 'https://provider.example/chat#secret', 'https://provider.example/${{ secrets.GITHUB_TOKEN }}']) {
    assert.equal(settingsSchema.safeParse({ ...custom, aiApiUrl }).success, false);
  }
  for (const geminiModel of ['', ' ', 'x\nrun: bad', '${{ secrets.GITHUB_TOKEN }}']) assert.equal(settingsSchema.safeParse({ ...custom, geminiModel }).success, false);
  const strange = 'vendor/model:"quoted"';
  const workflow = parse(installationFiles({ ...custom, geminiModel: strange })['.github/workflows/quality-gate.yml']);
  assert.equal(workflow.jobs.quality.steps.at(-1).with.ai_model, strange);
});

test('unpublished Action version stops custom installation before repository mutations or secrets', async () => {
  const paths: string[] = [];
  const api: GitHubClient = async path => { paths.push(path); throw new Error('not published'); };
  await assert.rejects(inspectInstallation(api, 'user/app', custom), /เผยแพร่ commit/);
  assert.equal(paths.length, 1);
  assert.ok(paths[0].includes('/commits/'));
});

test('generic AI key is sealed into AI_API_KEY without returning plaintext', async () => {
  await sodium.ready;
  const pair = sodium.crypto_box_keypair();
  let encrypted = '';
  const api: GitHubClient = async <T>(path: string, method?: string, body?: unknown) => {
    if (path.endsWith('/public-key')) return { key: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL), key_id: 'test-key' } as T;
    if (method === 'PUT') { assert.ok(path.endsWith('/AI_API_KEY')); encrypted = (body as { encrypted_value: string }).encrypted_value; }
    return { permissions: { push: true } } as T;
  };
  const value = 'fake-custom-ai-key';
  const result = await saveRepositorySecret(api, { repository: 'user/app', name: 'AI_API_KEY', value });
  assert.equal(sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(encrypted, sodium.base64_variants.ORIGINAL), pair.publicKey, pair.privateKey)), value);
  assert.ok(!JSON.stringify(result).includes(value));
});
