import { createHash } from 'node:crypto';
import { GitHubError, github, githubFailure } from './github';
import { planPreparation, type PreparationPlan } from './preparation';

export class PreparationError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export type GitHubClient = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
type Repo = { full_name: string; default_branch: string; archived: boolean; disabled: boolean; permissions?: { push?: boolean } };
type Entry = { path: string; mode: string; type: string; sha: string; size?: number };
type Snapshot = { repository: string; baseBranch: string; baseSha: string; treeSha: string; plan: PreparationPlan; digest: string };
export type PreparationPreview = Omit<Snapshot, 'treeSha'>;
type Pull = { html_url: string; number: number; state: string };

export function clientFor(token: string): GitHubClient { return (path, method, body) => github(token, path, method, body); }
const digestPlan = (repository: string, sha: string, plan: PreparationPlan) => createHash('sha256').update(JSON.stringify({ repository, sha, files: plan.files })).digest('hex');

export async function inspectRepository(api: GitHubClient, repository: string): Promise<Snapshot> {
  // A GitHub App user token is limited to the intersection of user and app access.
  const prefix = `/repos/${repository}`;
  const repo = await api<Repo>(prefix);
  if (!repo.permissions?.push || repo.archived || repo.disabled) throw new PreparationError('ต้องมีสิทธิ์เขียน repo และ repo ต้องไม่ถูก archive', 403);
  const base = await api<{ object: { sha: string } }>(`${prefix}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  const commit = await api<{ tree: { sha: string } }>(`${prefix}/git/commits/${base.object.sha}`);
  const tree = await api<{ tree: Entry[]; truncated: boolean }>(`${prefix}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated || tree.tree.length > 20000) throw new PreparationError('repo ใหญ่เกินขอบเขตการตรวจอัตโนมัติรุ่นนี้');
  async function read(path: string) {
    const entry = tree.tree.find(e => e.path === path);
    if (!entry) return null;
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) || (entry.size || 0) > 1000000) throw new PreparationError(`${path} ไม่ใช่ไฟล์ธรรมดาหรือมีขนาดเกิน 1 MB`);
    const blob = await api<{ encoding: string; content: string }>(`${prefix}/git/blobs/${entry.sha}`);
    if (blob.encoding !== 'base64') throw new PreparationError(`อ่าน ${path} ไม่สำเร็จ`);
    return Buffer.from(blob.content, 'base64').toString('utf8');
  }
  const [packageJson, packageLock] = await Promise.all([read('package.json'), read('package-lock.json')]);
  const plan = planPreparation({ paths: tree.tree.map(e => e.path), packageJson, packageLock });
  for (const file of plan.files) {
    const existing = tree.tree.find(e => e.path === file.path);
    if (existing && (existing.type !== 'blob' || existing.mode !== '100644')) throw new PreparationError(`ไม่แก้ ${file.path} อัตโนมัติ เพราะชนิดไฟล์ไม่ใช่ไฟล์ปกติ`);
  }
  return { repository: repo.full_name, baseBranch: repo.default_branch, baseSha: base.object.sha, treeSha: commit.tree.sha, plan, digest: digestPlan(repo.full_name, base.object.sha, plan) };
}

export async function createPreparationPR(api: GitHubClient, repository: string, expectedSha: string, expectedDigest: string) {
  const snapshot = await inspectRepository(api, repository);
  return createPlannedPR(api, repository, snapshot, expectedSha, expectedDigest);
}

export async function createPlannedPR(api: GitHubClient, repository: string, snapshot: Snapshot, expectedSha: string, expectedDigest: string, install = false) {
  if (snapshot.baseSha !== expectedSha || snapshot.digest !== expectedDigest) throw new PreparationError('repo เปลี่ยนหลังจากตรวจไฟล์ กรุณาตรวจอีกครั้งก่อนสร้าง PR');
  if (snapshot.plan.status !== 'changes') throw new PreparationError('ไม่มีรายการเปลี่ยนแปลงที่สร้าง PR ได้');
  const prefix = `/repos/${repository}`;
  const branch = `quality-gate/${install ? "install" : "prepare"}-${snapshot.digest.slice(0, 16)}`;
  const owner = repository.split('/')[0];
  const pullQuery = `${prefix}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(snapshot.baseBranch)}&per_page=100`;
  const existing = await api<Pull[]>(pullQuery);
  if (existing.length && existing[0].state !== 'open') throw new PreparationError('PR เตรียมโปรเจกต์ชุดนี้ถูกปิดแล้ว กรุณาตรวจ PR เดิมหรือเปลี่ยน base ก่อนทำใหม่');
  const createdTree = await api<{ sha: string }>(`${prefix}/git/trees`, 'POST', { base_tree: snapshot.treeSha, tree: snapshot.plan.files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.after })) });
  const readBranch = () => api<{ object: { sha: string } }>(`${prefix}/git/ref/heads/${encodeURIComponent(branch)}`);
  async function verifyExistingBranch() {
    const ref = await readBranch();
    const commit = await api<{ tree: { sha: string }; parents: { sha: string }[] }>(`${prefix}/git/commits/${ref.object.sha}`);
    if (commit.tree.sha !== createdTree.sha || commit.parents.length !== 1 || commit.parents[0].sha !== snapshot.baseSha) throw new PreparationError('branch เตรียมโปรเจกต์ถูกแก้ไขแล้ว กรุณาตรวจบน GitHub ก่อนดำเนินการต่อ');
  }
  if (existing.length) {
    await verifyExistingBranch();
    return { url: existing[0].html_url, number: existing[0].number, reused: true };
  }
  try { await verifyExistingBranch(); }
  catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    const commit = await api<{ sha: string }>(`${prefix}/git/commits`, 'POST', { message: install ? 'Install experimental Quality Gate' : 'Prepare npm and Jest for Quality Gate', tree: createdTree.sha, parents: [snapshot.baseSha] });
    try { await api(`${prefix}/git/refs`, 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha }); }
    catch (error) { if (!(error instanceof GitHubError) || error.status !== 422) throw error; await verifyExistingBranch(); }
  }
  const body = install ? ['Install the existing Quality Gate Action for testing. Engine code is unchanged.', ...snapshot.plan.messages, 'Review the files, then merge to enable push runs. Open a subsequent code PR to test PR reporting. A failed or skipped engine run is not a successful code review.', `Base: ${snapshot.baseSha}`].join('\n\n') : [
    'Prepare missing npm/Jest files so this repository can run tests. Existing source files, scripts and Jest configuration are preserved.',
    '## Changes', ...snapshot.plan.files.map(f => `- ${f.before === null ? 'Add' : 'Update'} \`${f.path}\``),
    '\n## Notes', ...snapshot.plan.messages.map(m => `- ${m}`),
    '\nThis PR only prepares the project. It does not install the Quality Gate Action, upload secrets, or claim tests have passed.',
    'Review the diff, then merge. Validate with `npm ci` and `npx jest --coverage` after adding tests. An empty test suite is expected to fail.',
    `\nPrepared from commit \`${snapshot.baseSha}\`.`,
  ].join('\n');
  try {
    const pull = await api<Pull>(`${prefix}/pulls`, 'POST', { title: install ? 'Install experimental Quality Gate' : 'Prepare npm and Jest for Quality Gate', head: branch, base: snapshot.baseBranch, body });
    return { url: pull.html_url, number: pull.number, reused: false };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) {
      const retries = await api<Pull[]>(pullQuery);
      const open = retries.find(p => p.state === 'open');
      if (open) return { url: open.html_url, number: open.number, reused: true };
    }
    throw new PreparationError(`เตรียม branch ${branch} แล้ว แต่สร้าง PR ไม่สำเร็จ ${error instanceof GitHubError ? githubFailure(error) : 'เชื่อมต่อ GitHub ไม่สำเร็จ'} กดสร้าง PR อีกครั้งได้`, 502);
  }
}
