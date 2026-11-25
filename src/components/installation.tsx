'use client';

import { useAccountFetch } from './account-boundary';
import { useState } from 'react';
import { Check, ExternalLink, FileCode2, GitPullRequest, LoaderCircle } from 'lucide-react';
import type { Settings } from '@/lib/config';
import type { PreparationPreview } from '@/lib/preparation-github';

export default function Installation({ repository, demo, settings }: { repository: string; demo: boolean; settings: Settings }) {
  const accountFetch = useAccountFetch();
  const [preview, setPreview] = useState<PreparationPreview | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'create' | null>(null);
  const [error, setError] = useState('');
  const [pull, setPull] = useState<{ url: string; number: number } | null>(null);
  async function install() {
    if (demo || busy) return;
    setBusy('inspect'); setError(''); setPreview(null); setPull(null);
    try {
      const response = await accountFetch('/api/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'install', repository, settings }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview(data.preview); setPull(data.pull);
    } catch (e) { setError(e instanceof Error ? e.message : 'Installation failed.'); }
    finally { setBusy(null); }
  }
  return <section className="preparation" aria-label="Install Automated Quality Gate">
    <div className="preparation-heading"><div><h3><FileCode2 size={19}/> Install Automated Quality Gate</h3><p>Review the setup files in one pull request, then merge it on GitHub.</p></div><button className="primary" onClick={install} disabled={demo || Boolean(busy) || Boolean(pull)}>{busy ? <LoaderCircle size={16} className="spin"/> : <GitPullRequest size={16}/>} {busy ? 'Checking files and creating a pull request…' : 'Install or update'}</button></div>
    {demo && <p className="preparation-caption">Connect GitHub to create an installation pull request. Demo mode uses sample data.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="preparation-result" aria-live="polite">
      <strong>{preview.plan.status === 'ready' ? 'The installed files match your settings.' : preview.plan.status === 'blocked' ? 'Update the project configuration first.' : `Prepared ${preview.plan.files.length} files for this pull request`}</strong>
      {preview.plan.files.map(file => <details className="preparation-file" key={file.path}><summary><span>{file.before === null ? 'Add' : 'Update'}</span> {file.path}</summary>{file.before !== null && <><p>Current content</p><pre className="code-preview"><code>{file.before}</code></pre></>}<p>Proposed content</p><pre className="code-preview"><code>{file.after}</code></pre></details>)}
      <ul>{preview.plan.messages.map(m => <li key={m}>{m}</li>)}</ul>
      {pull && <div className="preparation-success"><Check size={19}/><div><strong>Pull request #{pull.number} is ready to review and merge.</strong><a href={pull.url} target="_blank" rel="noreferrer">Open pull request <ExternalLink size={15}/></a><p>After merging, open a pull request that changes code in src/ to see the report. Run details are available in Actions.</p></div></div>}
    </div>}
  </section>;
}
