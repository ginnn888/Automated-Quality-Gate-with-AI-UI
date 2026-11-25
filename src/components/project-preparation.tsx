'use client';

import { useAccountFetch } from './account-boundary';
import { useState } from 'react';
import { Check, ExternalLink, FileCode2, GitPullRequest, LoaderCircle, Search } from 'lucide-react';
import type { PreparationPreview } from '@/lib/preparation-github';

export default function ProjectPreparation({ repository, demo }: { repository: string; demo: boolean }) {
  const accountFetch = useAccountFetch();
  const [preview, setPreview] = useState<PreparationPreview | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'create' | null>(null);
  const [error, setError] = useState('');
  const [pull, setPull] = useState<{ url: string; number: number } | null>(null);
  async function inspect() {
    setBusy('inspect'); setError(''); setPreview(null); setPull(null);
    try {
      const response = demo ? await accountFetch('/api/preparation/demo') : await accountFetch('/api/preparation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'inspect', repository }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'File inspection failed.'); }
    finally { setBusy(null); }
  }
  async function create() {
    if (!preview || demo) return;
    setBusy('create'); setError('');
    try {
      const response = await accountFetch('/api/preparation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', repository, baseSha: preview.baseSha, digest: preview.digest }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPull(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the pull request.'); }
    finally { setBusy(null); }
  }
  return <section className="preparation" aria-label="Prepare test files">
    <div className="preparation-heading"><div><h3><FileCode2 size={19}/> Prepare the project for testing</h3><p>Check package.json, the lockfile and Jest configuration. Add missing files through a pull request.</p></div><button className="secondary" onClick={inspect} disabled={Boolean(busy)}>{busy === 'inspect' ? <LoaderCircle size={16} className="spin"/> : <Search size={16}/>} {preview ? 'Check again' : 'Check for missing files'}</button></div>
    {demo && <p className="preparation-caption">Sample repository with src/math.js and no npm or Jest files. This preview uses local sample data.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="preparation-result" aria-live="polite">
      <strong>{preview.plan.status === 'ready' ? 'All required test setup files are present.' : preview.plan.status === 'blocked' ? 'Update the project configuration first.' : `Prepared ${preview.plan.files.length} files for this pull request`}</strong>
      {preview.plan.files.map(file => <details className="preparation-file" key={file.path}><summary><span>{file.before === null ? 'Add' : 'Update'}</span> {file.path}</summary>{file.before !== null && <><p>Current content</p><pre className="code-preview"><code>{file.before}</code></pre></>}<p>Proposed content</p><pre className="code-preview"><code>{file.after}</code></pre></details>)}
      <ul>{preview.plan.messages.map(m => <li key={m}>{m}</li>)}</ul>
      {preview.plan.status === 'changes' && !pull && <><button className="primary" onClick={create} disabled={demo || Boolean(busy)}>{busy === 'create' ? <LoaderCircle size={16} className="spin"/> : <GitPullRequest size={16}/>} {demo ? 'Demo preview only' : 'Create preparation pull request'}</button><p className="preparation-caption">This creates a branch and pull request for review. Action installation and API key setup follow separately.</p></>}
      {pull && <div className="preparation-success"><Check size={19}/><div><strong>Pull request #{pull.number} is ready to review and merge.</strong><a href={pull.url} target="_blank" rel="noreferrer">Open pull request <ExternalLink size={15}/></a><p>After merging, check the files again, then continue with test setup and Action installation.</p></div></div>}
    </div>}
  </section>;
}
