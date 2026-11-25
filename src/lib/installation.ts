import { createHash } from 'node:crypto';
import { aiSecretName, flexibleEngineRef, installationFiles, settingsSchema, type Settings } from './config';
import { createPlannedPR, inspectRepository, PreparationError, type GitHubClient } from './preparation-github';
import { classifyInstallation } from './installation-status';
import type { PreparationPlan } from './preparation';
import angularToolkit from './angularjs-toolkit.json';

export async function inspectInstallation(api: GitHubClient, repository: string, settings: Settings) {
  settings = settingsSchema.parse(settings);
  {
    const [repository, ref] = flexibleEngineRef.split('@');
    try { await api(`/repos/${repository}/commits/${encodeURIComponent(ref)}`); }
    catch { throw new PreparationError('Could not verify the Action version. Publish the Action commit and check access before creating an installation pull request.', 409); }
  }
  const base = await inspectRepository(api, repository, settings.projectType);
  if (base.plan.status === 'blocked') throw new PreparationError(base.plan.messages.join(' '));
  for (const name of settings.sonar ? [aiSecretName(settings), 'SONAR_TOKEN'] : [aiSecretName(settings)]) {
    try { await api(`/repos/${repository}/actions/secrets/${name}`); }
    catch { throw new PreparationError(`Could not verify ${name} in repository secrets. Save the key and check the GitHub App permissions.`, 409); }
  }
  const tree = await api<{ truncated: boolean; tree: { path: string; type: string; mode: string; sha: string; size?: number }[] }>(`/repos/${repository}/git/trees/${base.treeSha}?recursive=1`);
  if (tree.truncated) throw new PreparationError('Installation requires a complete file listing.');
  const files: PreparationPlan['files'] = [...base.plan.files];
  const generated: Record<string, string> = { ...installationFiles(settings), ...(settings.projectType === 'angularjs' ? angularToolkit : {}) };
  const alternate = tree.tree.find(f => f.path === '.github/workflows/aq-review.yml');
  if (alternate && settings.projectType === 'angularjs') {
    if (tree.tree.some(f => f.path === '.github/workflows/quality-gate.yml')) throw new PreparationError('Both quality-gate.yml and aq-review.yml exist. Keep one workflow on GitHub to avoid duplicate checks.');
    if (alternate.mode !== '100644' || alternate.type !== 'blob' || (alternate.size || 0) > 100000) throw new PreparationError('aq-review.yml must be a regular file.');
    const old = await api<{ content: string; encoding: string }>(`/repos/${repository}/git/blobs/${alternate.sha}`);
    if (old.encoding !== 'base64' || classifyInstallation(Buffer.from(old.content, 'base64').toString('utf8'), generated['config_cov.json']) !== 'active') throw new PreparationError('The existing aq-review.yml differs from the recognized AngularJS workflow. Review it before installation.');
    generated['.github/workflows/aq-review.yml'] = generated['.github/workflows/quality-gate.yml'];
    delete generated['.github/workflows/quality-gate.yml'];
  }
  for (const [path, after] of Object.entries(generated)) {
    const existing = tree.tree.find(f => f.path === path);
    let before: string | null = null;
    if (existing) {
      if (existing.type !== 'blob' || existing.mode !== '100644' || (existing.size || 0) > 100000) throw new PreparationError(`Cannot update ${path} automatically.`);
      const blob = await api<{ content: string; encoding: string }>(`/repos/${repository}/git/blobs/${existing.sha}`);
      if (blob.encoding !== 'base64') throw new PreparationError('Could not read the existing file.');
      before = Buffer.from(blob.content, 'base64').toString('utf8');
    }
    if (path.startsWith('quality-gate/') && before !== null && before !== after) throw new PreparationError(`Existing file ${path} differs from the toolkit version. Review the file before installing.`);
    if (path === 'audit-resolve.json' && before !== null) continue;
    let content = after;
    if (path === 'config_cov.json' && before !== null) {
      try {
        const old = JSON.parse(before);
        if (!old || typeof old !== 'object' || Array.isArray(old) || (old.files && (typeof old.files !== 'object' || Array.isArray(old.files) || Object.values(old.files).some(n => !Number.isInteger(n) || Number(n) < 1 || Number(n) > 100)))) throw new Error();
        content = JSON.stringify({ ...old, global: settings.coverage, files: old.files || {} }, null, 2) + '\n';
      } catch { throw new PreparationError('Could not read config_cov.json. Review the file before installing.'); }
    }
    if (before !== content) files.push({ path, before, after: content });
  }
  const warnings: string[] = [];
  if (!settings.sonar && tree.tree.some(f => f.path === 'sonar-project.properties')) warnings.push('The repository contains sonar-project.properties. This installation has SonarCloud disabled and will skip that file.');
  const managed = Object.keys(generated).filter(p => p.startsWith('.github/workflows/'));
  const otherWorkflows = tree.tree.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f.path) && !managed.includes(f.path));
  for (const entry of otherWorkflows.slice(0, 30)) {
    if (entry.type !== 'blob' || entry.mode !== '100644' || (entry.size || 0) > 100000) {
      warnings.push('Could not inspect existing workflow: ' + entry.path); continue;
    }
    const blob = await api<{content:string; encoding:string}>(`/repos/${repository}/git/blobs/${entry.sha}`);
    if (blob.encoding !== 'base64') { warnings.push('Could not inspect existing workflow: ' + entry.path); continue; }
    const source = Buffer.from(blob.content, 'base64').toString('utf8');
    if (/sonar|reusable-gate|test-github-marketplace/i.test(source)) warnings.push('Another workflow may run SonarCloud or Automated Quality Gate: ' + entry.path + ' — review it on GitHub to avoid duplicate runs.');
  }
  if (otherWorkflows.length > 30) warnings.push('Only the first 30 workflows were checked. Review the remaining workflows on GitHub.');
  const plan: PreparationPlan = { status: files.length ? 'changes' : 'ready', files, messages: [
    ...warnings,
    ...base.plan.messages.filter(m => !m.includes('This pull request prepares test tooling only')),
    'This pull request includes project setup files, the workflow and coverage settings. Check results after installation.',
    'The Action generates tests in the pull request and reports coverage. Grant GitHub Actions write access to Contents and Checks.',
    ...(settings.projectType === 'angularjs' ? ['The AngularJS toolkit is in quality-gate/. Run npm ci --prefix quality-gate and node quality-gate/run.cjs to repeat the checks.'] : []),
    'Checks may be skipped when no JavaScript files change in src/.',
    'After merging the installation, create a branch from the updated default branch and open a pull request with code changes. Check GitHub Actions for run details.',
    'The app checks for secret names. The workflow verifies credentials when it uses them.',
    'Review the proposed file changes below. Merge the pull request on GitHub to apply them.',
  ] };
  return { ...base, plan, digest: createHash('sha256').update(JSON.stringify({ repository, sha: base.baseSha, plan })).digest('hex') };
}

export async function createInstallation(api: GitHubClient, repository: string, settings: Settings, sha: string, digest: string) {
  const snapshot = await inspectInstallation(api, repository, settings);
  return createPlannedPR(api, repository, snapshot, sha, digest, true);
}

export async function installOnce(api: GitHubClient, repository: string, settings: Settings) {
  const snapshot = await inspectInstallation(api, repository, settings);
  const { treeSha: _tree, ...preview } = snapshot;
  if (snapshot.plan.status === 'ready') return { preview, pull: null };
  const pull = await createInstallation(api, repository, settings, snapshot.baseSha, snapshot.digest);
  return { preview, pull };
}
