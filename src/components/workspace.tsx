'use client';

import { notifyLogout } from './account-boundary';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, Code2, ExternalLink, FolderGit2, Github, LayoutDashboard, LoaderCircle, LockKeyhole, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { aiSecretName, defaultSettings, installationFiles, settingsSchema, type Settings } from '@/lib/config';
import type { Identity } from '@/lib/identity';
import type { Repository } from '@/lib/github';

import Installation from './installation';
import AISettings from './ai-settings';
import { RepositorySecret, SonarProjects } from './service-credentials';

const examples: Repository[] = [
  { id: 1, full_name: 'your-team/storefront', description: 'Online storefront and product catalog', private: true, language: 'JavaScript', default_branch: 'main', html_url: '', installation: 'active', run: { status: 'completed', conclusion: 'success', html_url: '' } },
  { id: 2, full_name: 'your-team/payment-service', description: 'Payment processing and API integrations', private: true, language: 'JavaScript', default_branch: 'main', html_url: '', installation: 'active', run: { status: 'completed', conclusion: 'failure', html_url: '' } },
  { id: 3, full_name: 'your-team/my-project', description: 'Sample JavaScript project', private: false, language: 'JavaScript', default_branch: 'main', html_url: '', installation: 'missing' },
];
const steps = ['Select repository', 'Configure checks', 'Connect services', 'Review installation'];

export default function Workspace({ user, connected, configured, appSlug }: { user: Identity; connected: boolean; configured: boolean; appSlug: string }) {
  const [view, setView] = useState<'repos' | 'guide' | 'setup'>('repos');
  const [demo, setDemo] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const refresh = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try { const response = await fetch('/api/repositories', { cache: 'no-store' }); const data = await response.json(); if (response.status === 401) { setRepos([]); window.location.replace('/login?notice=auth'); return; } if (!response.ok) throw new Error(data.error); if (data.userId !== user.id) { setRepos([]); window.location.reload(); return; } setRepos(data.repositories); }
    catch (error) { setRepos([]); setMessage(error instanceof Error ? error.message : 'Could not load repositories.'); }
    finally { setLoading(false); }
  }, [connected, user.id]);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Repository | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [file, setFile] = useState('.github/workflows/quality-gate.yml');
  const [formError, setFormError] = useState('');
  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get('notice');
    if (notice === 'setup') { setView('setup'); setMessage('The connection service is temporarily unavailable. Try again later.'); }
    if (notice === 'auth') setMessage('Could not connect to GitHub. Try again.');
    if (notice === 'github-connected') setMessage('GitHub connected. Select a repository to prepare its tests.');
    if (notice === 'github-empty') setMessage('No repositories have been authorized. Select repositories on GitHub or check whether organization approval is pending.');
    if (notice === 'github-error') setMessage('Could not verify GitHub permissions. Try again or check the configured GitHub App name.');
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(false);
      if (e.key === 'Tab') {
        const nodes = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select, textarea');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [modal]);
  const displayed = demo ? examples : repos;
  const filtered = displayed.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || r.installation === statusFilter));
  const start = (repo?: Repository) => { setSettings({...defaultSettings}); setFile('.github/workflows/quality-gate.yml'); setSelected(repo || null); setStep(repo ? 1 : 0); setFormError(''); setModal(true); };
  let files: Record<string, string> = {};
  try { files = installationFiles(settings); } catch { /* form reports validation below */ }
  function next() {
    if (step === 0 && !selected) { setFormError('Select a repository to continue.'); return; }
    if (step === 1) { const result = settingsSchema.safeParse(settings); if (!result.success) { setFormError(result.error.issues[0]?.message || 'Check the coverage and SonarCloud settings.'); return; } }
    setFormError(''); setStep(v => Math.min(v + 1, 3));
  }
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-icon"><ShieldCheck size={24}/></span><span>Automated Quality Gate<small>AI-powered code review</small></span></a>
      <nav aria-label="Main navigation">
        <button className={view === 'repos' ? 'nav active' : 'nav'} onClick={() => setView('repos')}><LayoutDashboard size={19}/> Repositories</button>
        <button className={view === 'guide' ? 'nav active' : 'nav'} onClick={() => setView('guide')}><BookOpen size={19}/> Setup guide</button>
        <button className={view === 'setup' ? 'nav active' : 'nav'} onClick={() => setView('setup')}><Settings2 size={19}/> Connections</button>
      </nav>
      <div className="sidebar-note"><ShieldCheck size={22}/><strong>GitHub Actions</strong><p>Checks run in your repository and publish results in the pull request.</p><a href="https://github.com/NonnaritRammaneekultawat-6609650459/test-github-marketplace" target="_blank" rel="noreferrer">View action source <ArrowUpRight size={15}/></a></div>
      <div className="account"><span className="avatar"><img src={user.avatar_url} alt="" width={40} height={40}/></span><div><strong>@{user.login}</strong><small>{demo ? 'Demo account' : 'GitHub account'}</small></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="account-actions"><span>Signed in as <strong>@{user.login}</strong></span>{connected ? <form action="/api/auth/logout" method="post" onSubmit={() => { setModal(false); setSelected(null); setRepos([]); setSettings({...defaultSettings}); notifyLogout(); }}><button className="text-button">Sign out / switch account</button></form> : <a className="connect" href={configured ? '/api/github/connect' : '#setup'} onClick={() => { if (!configured) setView('setup'); }}><Github size={17}/> Connect GitHub</a>}</div></header>
      <div className="content">
        {message && <div className="notice" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16}/></button></div>}
        {demo && <div className="demo-banner"><span>Demo mode uses sample repositories.</span><button onClick={() => setDemo(false)}>Exit demo <X size={14}/></button></div>}
        {view === 'repos' && <>
          <div className="section-heading"><h1>Repositories</h1><div className="actions"><button className="primary" onClick={() => start()}>Set up repository</button>{connected && !demo && <button className="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> Refresh</button>}{connected && !demo && <a className="secondary" href="/api/github/install"><Github size={16}/> Manage access</a>}<label className="search"><Search size={17}/><input placeholder="Search repositories…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search repositories"/></label></div></div>
          <div className="repo-filters" role="group" aria-label="Filter by installation status">{[['all', 'All'], ['active', 'Installed'], ['missing', 'Not installed'], ['incomplete', 'Incomplete'], ['unknown', 'Unknown']].map(([value, label]) => <button key={value} className="repo-filter" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label} ({displayed.filter(repo => value === 'all' || repo.installation === value).length})</button>)}</div><p className="field-hint">Installation status reflects the default branch. Merge the setup pull request to update it.</p>
          {loading ? <div className="empty"><LoaderCircle className="spin"/><h3>Loading repositories from GitHub…</h3></div> : displayed.length === 0 ? <div className="empty"><div className="empty-art"><FolderGit2 size={42}/><span><ShieldCheck size={23}/></span></div><h2>Connect your first repository</h2><p>{connected ? 'Select repositories on GitHub to make them available here.' : 'Connect GitHub to choose a repository, or explore the sample repositories.'}</p><div className="actions">{connected && appSlug ? <a className="primary" href="/api/github/install">Select repositories on GitHub <ExternalLink size={16}/></a> : <button className="primary" onClick={() => configured ? window.location.assign('/api/github/connect') : setView('setup')}><Github size={18}/> Connect GitHub</button>}<button className="secondary" onClick={() => setDemo(true)}>Explore demo</button></div><small>Installation files are added through a pull request.</small></div> : <div className="repo-list">{filtered.length === 0 ? <p className="empty">No repositories match your search and filter.</p> : filtered.map(repo => <article className="repo-row" key={repo.id}><div className="repo-icon"><FolderGit2 size={24}/></div><div className="repo-info"><h3>{repo.full_name}<span className="visibility">{repo.private ? 'Private' : 'Public'}</span></h3><p>{repo.description || 'No description provided.'}</p><small><span className={`language ${repo.language === 'TypeScript' ? 'ts' : ''}`}/>{repo.language || 'Unknown language'}<span className="branch">{repo.default_branch}</span></small></div><div className="repo-status"><span className={`badge ${repo.installation === 'active' ? 'success' : repo.installation === 'incomplete' ? 'warning' : ''}`}>{repo.installation === 'active' ? 'Installed' : repo.installation === 'missing' ? 'Not installed' : repo.installation === 'incomplete' ? 'Incomplete' : 'Unknown'}</span><small>{repo.installation === 'active' ? `Configured on ${repo.default_branch}` : repo.installation === 'unknown' ? 'Refresh or check GitHub permissions' : repo.installation === 'incomplete' ? 'Check workflow and configuration files' : 'Merge the installation pull request, then refresh'}{demo ? ' · Demo' : ''}</small></div><button className="icon-button" aria-label={`Configure ${repo.full_name}`} onClick={() => start(repo)}><SlidersHorizontal size={19}/></button></article>)}</div>}
        </>}
        {view === 'guide' && <><div className="heading"><div><p className="kicker">Getting started</p><h1>Set up pull request checks</h1><p>Connect a JavaScript repository and configure its checks on GitHub.</p></div></div><div className="guide-grid"><Guide title="1. Connect GitHub" text="Sign in and choose which repositories the GitHub App can access."/><Guide title="2. Create a Gemini API key" text="Create a key in Google AI Studio and save it in the Connect services step. Gemini reviews code using your account quota." href="https://aistudio.google.com/apikey" label="Open Google AI Studio"/><Guide title="3. Connect SonarCloud (optional)" text="Add the repository to SonarCloud, choose GitHub Actions analysis and copy the project key, organization key and token." href="https://sonarcloud.io" label="Open SonarCloud"/><Guide title="4. Review the installation pull request" text="Install creates a pull request with the test tooling, workflow and coverage settings. Merge it, then open a new pull request from the updated default branch."/></div><div className="notice">Checks use Jest for JavaScript and Gemini for AI code review.</div><h2>Where can I see the results?</h2><p className="body-copy">Open or update a pull request to run checks. Reports appear in the pull request, with logs in GitHub Actions. To block merges on failure, configure required status checks in your branch rules.</p><p className="body-copy">Checks skip pull requests from forks and Dependabot.</p></>}
        {view === 'setup' && <><div className="heading"><div><p className="kicker">Account</p><h1>GitHub connection</h1><p>Choose the repositories that can use Automated Quality Gate.</p></div></div><div className="setup-panel"><div className="setup-row"><Github/><div><h3>GitHub</h3><p>{connected ? 'Your account is connected. Manage which repositories the app can access.' : 'Connect your account to select repositories.'}</p></div><span className={`badge ${connected ? 'success' : ''}`}>{connected ? 'Connected' : 'Disconnected'}</span></div>{configured ? <a className="primary" href={connected ? '/api/github/install' : '/api/github/connect'}>{connected ? 'Manage repository access' : 'Connect GitHub'}</a> : <p role="status">The connection service is temporarily unavailable. Try again later.</p>}</div></>}
        <footer><span><ShieldCheck size={15}/> Automated Quality Gate</span></footer>
      </div>
    </main>
    {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabIndex={-1}><header className="modal-header"><div><span className="kicker">Configure checks</span><h2 id="wizard-title">{selected?.full_name || 'Set up repository'}</h2></div><button className="icon-button" aria-label="Close setup" onClick={() => setModal(false)}><X/></button></header><nav className="wizard-tab-strip" aria-label="Setup steps"><ol className="wizard-tabs">{steps.map((label, index) => <li className={index === step ? 'current' : index < step ? 'done' : ''} key={label}><button type="button" aria-current={index === step ? 'step' : undefined} disabled={index > step + 1} onClick={() => { if (index === step + 1) next(); else { setFormError(''); setStep(index); } }}><span className="wizard-tab-icon" aria-hidden="true">{index < step ? <Check size={14}/> : index + 1}</span><span className="wizard-tab-label">{label}</span></button></li>)}</ol></nav><div className="modal-body">
      {step === 0 && <><h3>Select a repository</h3><p>Only repositories shared with the GitHub App appear here.</p>{!demo && configured && <a className="help-link" href="/api/github/install">Manage GitHub App access <ExternalLink size={14}/></a>}{displayed.length ? displayed.map(r => <button key={r.id} className={`repo-choice ${selected?.id === r.id ? 'chosen' : ''}`} onClick={() => { setSettings({...defaultSettings}); setSelected(r); }}><FolderGit2 size={21}/><span>{r.full_name}</span>{selected?.id === r.id && <Check size={18}/>}</button>) : <div className="notice">No repositories available. <button className="text-button" onClick={() => { setDemo(true); }}>Use sample data</button></div>}</>}
      {step === 1 && <><AISettings model={settings.geminiModel}/><div className="coverage-head"><div><h3>Test coverage</h3><p>Set the minimum percentage of code the tests must cover.</p></div><div className="coverage-number"><input aria-label="Coverage percentage" type="number" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><span>%</span></div></div><input className="range" aria-label="Adjust coverage" type="range" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><div className="range-labels"><span>1% · Minimum</span><span>100% · Full coverage</span></div><label className="feature-line"><ShieldCheck size={21}/><div><strong>Enable SonarCloud</strong><p>Include additional code quality and security checks.</p></div><input type="checkbox" checked={settings.sonar} onChange={e => setSettings({ ...settings, sonar: e.target.checked })}/></label>{settings.sonar && <div className="field-grid"><div><label htmlFor="sonar-project-key">Sonar project key</label><input id="sonar-project-key" aria-describedby="sonar-project-help" value={settings.projectKey} onChange={e => setSettings({ ...settings, projectKey: e.target.value })} placeholder="my-team_my-project"/><p id="sonar-project-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">Open your project</a> → Information → Copy the project key</p></div><div><label htmlFor="sonar-organization">Sonar organization</label><input id="sonar-organization" aria-describedby="sonar-organization-help" value={settings.organization} onChange={e => setSettings({ ...settings, organization: e.target.value })} placeholder="my-team"/><p id="sonar-organization-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">Open your project</a> → Information → Copy the organization key</p></div></div>}<div>{settings.sonar && <SonarProjects key={`${selected?.id}-${settings.organization}-${demo}`} organization={settings.organization} demo={demo} onSelect={project => setSettings({ ...settings, projectKey: project.key, organization: project.organization })}/>}</div></>}
      {step === 2 && <><h3>Repository secrets</h3><p>Save each key as an encrypted GitHub Actions secret in the selected repository.</p>{selected && <RepositorySecret key={`${selected.id}-${aiSecretName(settings)}-${demo}`} repository={selected.full_name} name={aiSecretName(settings)} demo={demo}/>} {settings.sonar && selected && <RepositorySecret key={`${selected.id}-sonar-${demo}`} repository={selected.full_name} name="SONAR_TOKEN" demo={demo}/>}<div className="feature-line"><Github size={21}/><div><strong>GitHub token</strong><p>GitHub supplies this token automatically.</p></div><Check size={20}/></div><div className="notice"><LockKeyhole size={18}/> After saving the keys, create and merge the installation pull request.</div></>}
      {step === 3 && <><div className="review-summary"><div><span>Repository</span><strong>{selected?.full_name}</strong></div><div><span>Project type</span><strong>JavaScript / Jest</strong></div><div><span>AI model</span><strong>{settings.geminiModel}</strong></div><div><span>AI provider</span><strong>Gemini API</strong></div><div><span>Coverage</span><strong>{settings.coverage}%</strong></div><div><span>SonarCloud</span><strong>{settings.sonar ? 'Enabled' : 'Disabled'}</strong></div></div><details><summary>Preview installation files</summary><div className="file-tabs">{Object.keys(files).map(name => <button className={name === file ? 'selected' : ''} key={name} onClick={() => setFile(name)}><Code2 size={14}/>{name.split('/').pop()}</button>)}</div><pre className="code-preview"><code>{files[file] || Object.values(files)[0]}</code></pre></details><p>Review and merge the pull request, then refresh the repository status here.</p>{selected && <Installation key={`${selected.id}-${JSON.stringify(settings)}-${demo}`} repository={selected.full_name} demo={demo} settings={settings}/>}</>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </div><div className="modal-footer"><button className="secondary" onClick={() => step ? setStep(step - 1) : setModal(false)}>{step ? 'Back' : 'Cancel'}</button><div className="actions">{step === 3 ? null : <button className="primary" onClick={next}>Next <ChevronRight size={16}/></button>}</div></div></section></div>}
  </div>;
}

function Guide({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) { return <article className="guide-card"><h3>{title}</h3><p>{text}</p>{href && <a href={href} target="_blank" rel="noreferrer">{label} <ExternalLink size={15}/></a>}</article>; }





