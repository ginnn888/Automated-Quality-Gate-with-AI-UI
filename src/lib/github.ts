export class GitHubError extends Error {
  constructor(public status: number, public operation = '', public reason = '', public requestId = '') { super(`GitHub request failed (${status})`); }
}
export function githubFailure(error: GitHubError) {
  return `GitHub HTTP ${error.status}${error.operation ? ` — ${error.operation}` : ''}: ${error.reason || (error.status === 401 ? 'Your session expired. Sign in again.' : error.status === 404 ? 'Resource not found or inaccessible to this token.' : error.status === 422 ? 'GitHub rejected the data or detected a branch conflict.' : 'GitHub rejected the request without a specific reason.')}${error.requestId ? ` (Request ID: ${error.requestId})` : ''}`;
}
export async function github<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    // Never return upstream bodies, request payloads, or credentials to the UI.
    const data = await response.json().catch(() => ({}));
    const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
    const reason = message.includes('workflow') ? 'GitHub denied this token permission to write workflows.'
      : message.includes('rate limit') ? 'GitHub API rate limit reached. Try again later.'
      : message.includes('resource not accessible') ? 'This token cannot perform the operation. Check its approved permissions.'
      : message.includes('rules') || message.includes('protected') ? 'Repository rules blocked this change.'
      : message.includes('bad credentials') ? 'The GitHub token is invalid. Sign in again.'
      : message.includes('empty') ? 'The repository is empty.'
      : '';
    const operation = path.includes('/pulls') ? (method === 'POST' ? 'Create pull request' : 'Find existing pull request')
      : path.endsWith('/git/refs') ? 'Create branch'
      : path.includes('/git/ref/') ? 'Read branch'
      : path.includes('/git/trees') ? (method === 'POST' ? 'Prepare files' : 'List files')
      : path.includes('/git/commits') ? (method === 'POST' ? 'Create commit' : 'Read commit')
      : path.includes('/actions/secrets') ? 'Access secrets'
      : 'Read GitHub data';
    const id = response.headers.get('x-github-request-id') || '';
    throw new GitHubError(response.status, operation, reason, /^[A-Za-z0-9:-]{1,100}$/.test(id) ? id : '');
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}
export type Repository = { id: number; full_name: string; description: string | null; private: boolean; default_branch: string; language: string | null; html_url: string; installation?: 'active' | 'missing' | 'incomplete' | 'unknown'; run?: { conclusion: string | null; status: string; html_url: string } };
