import { parse } from 'yaml';
import { GitHubError, type Repository } from './github';
import type { GitHubClient } from './preparation-github';

export type InstallationStatus = 'active' | 'missing' | 'incomplete' | 'unknown';
const engine = 'nonnaritrammaneekultawat-6609650459/test-github-marketplace@';
export function classifyInstallation(workflow: string | null, config: string | null): InstallationStatus {
  if (workflow === null) return 'missing';
  try {
    const data = parse(workflow, { maxAliasCount: 20 });
    const jobs = data?.jobs;
    const usesEngine = jobs && typeof jobs === 'object' && Object.values(jobs).some(job => {
      const steps = (job as { steps?: unknown[] })?.steps;
      return Array.isArray(steps) && steps.some(step => {
        const uses = (step as { uses?: unknown })?.uses;
        return typeof uses === 'string' && uses.toLowerCase().startsWith(engine) && uses.length > engine.length;
      });
    });
    if (!usesEngine || !data.on) return 'incomplete';
    const actionSteps = Object.values(jobs).flatMap(job => (job as { steps?: { uses?: string; with?: Record<string, unknown> }[] }).steps || []).filter(step => typeof step.uses === 'string' && step.uses.toLowerCase().startsWith(engine));
    if (actionSteps.some(step => step.with?.project_type === 'angularjs')) {
      if (!['generate', 'checks', 'report'].every(phase => actionSteps.some(step => step.with?.project_type === 'angularjs' && step.with?.phase === phase))) return 'incomplete';
      if (!actionSteps.some(step => step.with?.persist_tests === 'true')) return 'active';
    }
    if (config === null) return 'incomplete';
    const coverage = JSON.parse(config);
    return Number.isInteger(coverage?.global) && coverage.global >= 1 && coverage.global <= 100 ? 'active' : 'incomplete';
  } catch { return 'incomplete'; }
}

export async function installationStatus(api: GitHubClient, repo: Pick<Repository, 'full_name' | 'default_branch'>): Promise<InstallationStatus> {
  const prefix = `/repos/${repo.full_name}`;
  try {
    let ref: { object: { sha: string } };
    try { ref = await api<{ object: { sha: string } }>(`${prefix}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`); }
    catch (error) { if (error instanceof GitHubError && error.status === 409) return 'missing'; throw error; }
    async function read(path: string) {
      try {
        const file = await api<{ type: string; encoding: string; content: string; size: number }>(`${prefix}/contents/${path}?ref=${ref.object.sha}`);
        if (file.type !== 'file' || file.encoding !== 'base64' || file.size > 200000) throw new Error('Unsupported file');
        return Buffer.from(file.content, 'base64').toString('utf8');
      } catch (error) { if (error instanceof GitHubError && error.status === 404) return null; throw error; }
    }
    const [workflow, config] = await Promise.all([read('.github/workflows/quality-gate.yml'), read('config_cov.json')]);
    if (workflow !== null) return classifyInstallation(workflow, config);
    return classifyInstallation(await read('.github/workflows/aq-review.yml'), config);
  } catch { return 'unknown'; }
}

export async function withInstallationStatuses(api: GitHubClient, repos: Repository[]) {
  const results = [...repos];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, repos.length) }, async () => {
    while (next < repos.length) {
      const index = next++;
      results[index] = { ...repos[index], installation: await installationStatus(api, repos[index]) };
    }
  }));
  return results;
}
