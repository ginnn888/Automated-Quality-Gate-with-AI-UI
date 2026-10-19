import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { defaultSettings, engineRef, installationFiles } from '../src/lib/config';
import { planAngularPreparation } from '../src/lib/preparation';
import { classifyInstallation } from '../src/lib/installation-status';
import template from '../src/lib/workflow-templates/angularjs.json';

const settings = { ...defaultSettings, projectType: 'angularjs' as const };
const generated = () => installationFiles(settings)['.github/workflows/quality-gate.yml'];
test('AngularJS follows the upstream three-phase contract and only substitutes user settings', () => {
  const actual = generated();
  assert.equal(actual, template.workflow.replaceAll("${{ vars.GEMINI_MODEL || 'gemini-3.1-flash-lite' }}", JSON.stringify(settings.geminiModel)));
  const flow = parse(actual);
  assert.deepEqual(Object.keys(flow.jobs), ['generate', 'checks', 'report']);
  assert.ok(flow.on.pull_request_target);
  for (const phase of ['generate', 'checks', 'report']) {
    const action = flow.jobs[phase].steps.find((step: { uses?: string }) => step.uses === engineRef);
    assert.equal(action.with.phase, phase);
    assert.equal(action.with.project_type, 'angularjs');
    assert.equal(action.with.test_source, 'generated');
  }
  assert.deepEqual(Object.keys(installationFiles(settings)), ['.github/workflows/quality-gate.yml']);
  assert.equal(classifyInstallation(actual, null), 'active');
});

test('untrusted test execution is isolated from Gemini secrets and comment write privileges', () => {
  const { generate, checks, report } = parse(generated()).jobs;
  assert.ok(!JSON.stringify(checks).includes('GEMINI_API_KEY'));
  assert.deepEqual(checks.permissions, { contents: 'read' });
  assert.equal(checks.steps.find((s: { uses?: string }) => s.uses === 'actions/checkout@v4').with.ref, '${{ github.event.pull_request.head.sha }}');
  assert.equal(checks.steps.find((s: { uses?: string }) => s.uses === 'actions/checkout@v4').with['persist-credentials'], false);
  for (const job of [generate, report]) {
    assert.ok(!job.steps.some((s: { uses?: string; run?: string }) => s.run || s.uses?.startsWith('actions/checkout')));
  }
  assert.equal(report.permissions['pull-requests'], 'write');
  assert.equal(report.if, 'always()');
  assert.equal(report.steps.at(-1).with.report_only, 'true');
  for (const job of [generate, checks]) assert.equal(job.steps.at(-1).with['include-hidden-files'], true);
});

test('user inputs cannot inject YAML and AngularJS cannot silently enable unsupported Sonar', () => {
  assert.throws(() => installationFiles({ ...settings, geminiModel: "x\nrun: evil" }));
  assert.throws(() => installationFiles({ ...settings, aiTimeout: 181 }));
  assert.throws(() => installationFiles({ ...settings, sonar: true, projectKey: 'p', organization: 'o' }));
  const changed = parse(installationFiles({ ...settings, geminiModel: 'gemini-custom', aiTimeout: 120 })['.github/workflows/quality-gate.yml']);
  assert.equal(changed.jobs.generate.steps[0].with.gemini_model, 'gemini-custom');
  assert.equal(changed.jobs.generate.steps[0].with.ai_timeout_seconds, '120');
  assert.ok(!installationFiles(defaultSettings)['.github/workflows/quality-gate.yml'].includes('GITHUB_STEP_SUMMARY'));
  assert.ok(!installationFiles(defaultSettings)['.github/workflows/quality-gate.yml'].includes('run: exit 1'));
});

test('AngularJS preparation preserves app dependencies and does not add Jest or tests', () => {
  const pkg = { dependencies: { angular: '1.8.3' } };
  const snapshot = { paths: ['src/app.js'], packageJson: JSON.stringify(pkg), packageLock: JSON.stringify({ packages: { '': pkg, 'node_modules/angular': { version: '1.8.3' } } }) };
  const plan = planAngularPreparation(snapshot);
  assert.equal(plan.status, 'ready');
  assert.deepEqual(plan.files, []);
  assert.equal(planAngularPreparation({ ...snapshot, packageLock: null }).status, 'blocked');
  assert.equal(planAngularPreparation({ ...snapshot, packageJson: '{"dependencies":{"angular":"1.7.0"}}' }).status, 'blocked');
  assert.equal(planAngularPreparation({ ...snapshot, paths: [] }).status, 'blocked');
});
