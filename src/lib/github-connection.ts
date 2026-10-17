import { github } from './github';

type Api = <T>(token: string, path: string) => Promise<T>;
type Installation = { id: number; app_slug: string; suspended_at: string | null };

export function installationUrl(slug: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(slug)) throw new Error('Invalid GitHub App slug');
  return `https://github.com/apps/${slug}/installations/new`;
}

// Always derive access from GitHub using the current user's token.
// installation_id/setup_action in the browser URL never grant access.
export async function hasRepositoryAccess(token: string, slug: string, api: Api = github) {
  for (let page = 1; ; page++) {
    const data = await api<{ installations: Installation[] }>(token, `/user/installations?per_page=100&page=${page}`);
    for (const installation of data.installations) {
      if (installation.app_slug !== slug || installation.suspended_at) continue;
      const list = await api<{ repositories: unknown[] }>(token, `/user/installations/${installation.id}/repositories?per_page=1`);
      if (list.repositories.length > 0) return true;
    }
    if (data.installations.length < 100) return false;
  }
}

export async function connectionDestination(token: string | null, slug: string, mode: 'connect' | 'install' | 'return', api: Api = github) {
  if (!token) return `/api/auth/login?next=${mode}`;
  if (mode === 'install') return installationUrl(slug);
  const allowed = await hasRepositoryAccess(token, slug, api);
  if (allowed) return '/?notice=github-connected';
  // Do not bounce back to GitHub automatically after cancellation or pending approval.
  return mode === 'return' ? '/?notice=github-empty' : installationUrl(slug);
}
