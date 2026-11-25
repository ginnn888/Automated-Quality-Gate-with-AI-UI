'use client';

import { useAccountFetch } from './account-boundary';
import { useState } from 'react';

async function submit(accountFetch: ReturnType<typeof useAccountFetch>, service: string, body: unknown) {
  const response = await accountFetch(`/api/services/${service}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}

export function RepositorySecret({ repository, name, demo }: { repository: string; name: 'GEMINI_API_KEY' | 'AI_API_KEY' | 'SONAR_TOKEN'; demo: boolean }) {
  const accountFetch = useAccountFetch();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const gemini = name === 'GEMINI_API_KEY';
  async function save() {
    if (demo || busy) return;
    setBusy(true); setMessage('');
    try {
      await submit(accountFetch, 'secret', { repository, name, value });
      setValue(''); setMessage(`Saved ${name} in ${repository} successfully. The key has not been tested.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save the key.'); }
    finally { setBusy(false); }
  }
  return <div className="credential-panel">
    <label className="secret-field" htmlFor={name}>{gemini ? 'Gemini API key' : name === 'AI_API_KEY' ? 'AI API key' : 'Sonar token'}</label>
    <input id={name} type="password" autoComplete="off" spellCheck={false} disabled={demo || busy} value={value} onChange={e => { setValue(e.target.value); setMessage(''); }} placeholder={demo ? 'Demo mode does not accept real keys' : `Paste ${name} here`}/>
    <p className="field-hint">{gemini ? <><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> → Create API key → Select a project → Copy the key</> : name === 'AI_API_KEY' ? 'Use a key for the configured API endpoint. The workflow sends code to that service for review.' : <><a href="https://sonarcloud.io/account/security" target="_blank" rel="noreferrer">SonarCloud → Security</a> → Generate token → Copy the token</>}</p>
    <button className="secondary" disabled={demo || busy || !value.trim()} onClick={save}>{busy ? 'Saving…' : `Save ${name} to repository`}</button>
    <p className="field-hint">Saving replaces any existing repository secret with the same name.</p>
    {message && <p role="status" className="notice">{message}</p>}
  </div>;
}

type Project = { key: string; name: string; organization: string };
export function SonarProjects({ organization, demo, onSelect }: { organization: string; demo: boolean; onSelect: (project: Project) => void }) {
  const accountFetch = useAccountFetch();
  const [token, setToken] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function load(page = 1) {
    if (demo || busy) return;
    setBusy(true); setMessage('');
    if (page === 1) { setProjects([]); setNextPage(null); }
    try {
      const data = await submit(accountFetch, 'sonar', { token, organization, page });
      setProjects(previous => page === 1 ? data.projects : [...previous, ...data.projects]); setNextPage(data.nextPage);
      if (!data.projects.length) setMessage('This token cannot access any projects in that organization.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not load projects.'); }
    finally { setBusy(false); }
  }
  return <div className="credential-panel">
    <h3>Already have a SonarCloud project?</h3>
    <p>Enter the organization key above and use a token to find projects in the EU region.</p>
    <label className="secret-field" htmlFor="sonar-discovery-token">Sonar token for project lookup</label>
    <input id="sonar-discovery-token" type="password" autoComplete="off" spellCheck={false} disabled={demo || busy} value={token} onChange={e => { setToken(e.target.value); setProjects([]); setNextPage(null); setMessage(''); }} placeholder={demo ? 'Connect your account to look up projects' : 'Paste a token to list SonarCloud projects'}/>
    <p className="field-hint"><a href="https://sonarcloud.io/account/security" target="_blank" rel="noreferrer">SonarCloud → Security</a> → Generate token. This lookup does not save the token to the repository.</p>
    <button className="secondary" disabled={demo || busy || !token.trim() || !organization.trim()} onClick={() => load()}>{busy ? 'Loading…' : 'Find projects'}</button>
    {projects.length > 0 && <><p className="field-hint">Choose the project for your repository. Verify the GitHub connection in SonarCloud.</p>{projects.map(project => <button className="repo-choice" key={project.key} onClick={() => onSelect(project)}><span>{project.name}<small> · {project.key}</small></span><span>Select</span></button>)}</>}
    {nextPage && <button className="text-button" disabled={busy} onClick={() => load(nextPage)}>Load more</button>}
    {message && <p className="notice" role="status">{message}</p>}
  </div>;
}
