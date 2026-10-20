import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { defaultSettings, installationFiles, settingsSchema } from '../src/lib/config';

test('JavaScript runs once per PR event, with the same activity types as AngularJS', () => {
  const js = parse(installationFiles(defaultSettings)['.github/workflows/quality-gate.yml']);
  const angular = parse(installationFiles({ ...defaultSettings, projectType: 'angularjs' })['.github/workflows/quality-gate.yml']);
  assert.deepEqual(Object.keys(js.on), ['pull_request']);
  assert.deepEqual(js.on.pull_request.types, angular.on.pull_request_target.types);
  assert.ok(js.jobs.quality.if.includes('github.event.pull_request.head.repo.full_name == github.repository'));
  assert.ok(js.concurrency.group.includes('github.event.pull_request.number'));
});

test('coverage is validated and written to the engine config', () => {
  const files = installationFiles({ ...defaultSettings, coverage: 91 });
  assert.equal(JSON.parse(files['config_cov.json']).global, 91);
  for (const coverage of [0, -1, 101, 2.5, NaN]) assert.equal(settingsSchema.safeParse({ ...defaultSettings, coverage }).success, false);
});
test('disabled Sonar emits no Sonar step, secret or properties', () => {
  const files = installationFiles(defaultSettings);
  assert.equal(Object.keys(files).length, 2);
  assert.ok(!files['.github/workflows/quality-gate.yml'].includes('SONAR_TOKEN'));
});
test('Sonar receives both scan environment and Action input', () => {
  const files = installationFiles({ ...defaultSettings, sonar: true, projectKey: 'team:app', organization: 'my-team' });
  assert.match(files['.github/workflows/quality-gate.yml'], /SONAR_TOKEN: \$\{\{ secrets.SONAR_TOKEN }}/);
  assert.match(files['.github/workflows/quality-gate.yml'], /sonar_token: \$\{\{ secrets.SONAR_TOKEN }}/);
  assert.match(files['sonar-project.properties'], /sonar.projectKey=team:app/);
});
test('rejects missing Sonar config and newline injection', () => {
  assert.throws(() => installationFiles({ ...defaultSettings, sonar: true }));
  assert.throws(() => installationFiles({ ...defaultSettings, sonar: true, projectKey: 'project\nsonar.token=bad', organization: 'org' }));
});
test('preview is pinned and guards fork secrets', () => {
  const workflow = installationFiles(defaultSettings)['.github/workflows/quality-gate.yml'];
  assert.match(workflow, /marketplace@[a-f0-9]{40}/);
  assert.ok(workflow.includes('github.event.pull_request.head.repo.full_name == github.repository'));
  assert.ok(workflow.includes('${{ secrets.GEMINI_API_KEY }}'));
  assert.ok(!workflow.includes('pull_request_target'));
});
