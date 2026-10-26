import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInstallation, installationStatus, withInstallationStatuses } from '../src/lib/installation-status';
import { defaultSettings, installationFiles } from '../src/lib/config';
import { GitHubError, type Repository } from '../src/lib/github';
import type { GitHubClient } from '../src/lib/preparation-github';

const files = installationFiles(defaultSettings);
const workflow = files['.github/workflows/quality-gate.yml'];
const config = files['config_cov.json'];
test('classifies installed, missing and incomplete without mistaking comments for an action', () => {
  assert.equal(classifyInstallation(workflow, config), 'active');
  assert.equal(classifyInstallation(null, config), 'missing');
  assert.equal(classifyInstallation(workflow, null), 'incomplete');
  assert.equal(classifyInstallation(workflow, '{broken'), 'incomplete');
  assert.equal(classifyInstallation(workflow, '{"global":101}'), 'incomplete');
  assert.equal(classifyInstallation('# ' + workflow.replaceAll('\n', '\n# '), config), 'incomplete');
  assert.equal(classifyInstallation(workflow.replaceAll('test-github-marketplace@', 'other@'), config), 'incomplete');
  assert.equal(classifyInstallation('jobs: [', config), 'incomplete');
});

test('checks both files at the same default-branch commit, never an unmerged PR', async () => {
  const calls: string[] = [];
  const api: GitHubClient = async <T>(path: string) => {
    calls.push(path);
    if (path.includes('/git/ref/')) return { object: { sha: 'commit-sha' } } as T;
    assert.ok(path.endsWith('?ref=commit-sha'));
    const content = path.includes('quality-gate.yml') ? workflow : config;
    return { type: 'file', encoding: 'base64', content: Buffer.from(content).toString('base64'), size: content.length } as T;
  };
  assert.equal(await installationStatus(api, { full_name: 'user/repo', default_branch: 'release/main' }), 'active');
  assert.match(calls[0], /release%2Fmain/);
  assert.equal(calls.length, 3);
});

test('permission, rate-limit and network failures are unknown rather than uninstalled', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    assert.equal(await installationStatus(async () => { throw new GitHubError(status); }, { full_name: 'a/b', default_branch: 'main' }), 'unknown');
  }
  const api: GitHubClient = async <T>(path: string) => {
    if (path.includes('/git/ref/')) return { object: { sha: 'commit' } } as T;
    throw new GitHubError(404);
  };
  assert.equal(await installationStatus(api, { full_name: 'a/b', default_branch: 'main' }), 'missing');
});

test('one unreadable repository does not hide the remaining repositories', async () => {
  const repos = ['good', 'denied'].map((name, id) => ({ id, full_name: `owner/${name}`, default_branch: 'main' })) as Repository[];
  const api: GitHubClient = async <T>(path: string) => {
    if (path.includes('/denied/')) throw new GitHubError(403);
    if (path.includes('/git/ref/')) return { object: { sha: 'commit' } } as T;
    throw new GitHubError(404);
  };
  const result = await withInstallationStatuses(api, repos);
  assert.deepEqual(result.map(r => r.installation), ['missing', 'unknown']);
  assert.deepEqual(result.map(r => r.id), [0, 1]);
});
