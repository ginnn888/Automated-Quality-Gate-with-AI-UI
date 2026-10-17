'use client';

import { useState } from 'react';

async function submit(service: string, body: unknown) {
  const response = await fetch(`/api/services/${service}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
  return data;
}

export function RepositorySecret({ repository, name, demo }: { repository: string; name: 'GEMINI_API_KEY' | 'SONAR_TOKEN'; demo: boolean }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const gemini = name === 'GEMINI_API_KEY';
  async function save() {
    if (demo || busy) return;
    setBusy(true); setMessage('');
    try {
      await submit('secret', { repository, name, value });
      setValue(''); setMessage(`บันทึก ${name} ใน ${repository} แล้ว — ยังไม่ได้ทดสอบว่า key ใช้งานได้`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <div className="credential-panel">
    <label className="secret-field" htmlFor={name}>{gemini ? 'Gemini API key' : 'Sonar token'}</label>
    <input id={name} type="password" autoComplete="off" spellCheck={false} disabled={demo || busy} value={value} onChange={e => { setValue(e.target.value); setMessage(''); }} placeholder={demo ? 'โหมดตัวอย่าง ไม่รับ key จริง' : `วาง ${name} ของคุณ`}/>
    <p className="field-hint">{gemini ? <><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> → Create API key → เลือกโปรเจกต์ → คัดลอก key</> : <><a href="https://sonarcloud.io/account/security" target="_blank" rel="noreferrer">SonarCloud → Security</a> → Generate token → คัดลอก token</>}</p>
    <button className="secondary" disabled={demo || busy || !value.trim()} onClick={save}>{busy ? 'กำลังบันทึก…' : `บันทึก ${name} ลง repo`}</button>
    <p className="field-hint">หาก repo มี secret ชื่อนี้แล้ว การบันทึกจะเปลี่ยนเป็นค่าใหม่</p>
    {message && <p role="status" className="notice">{message}</p>}
  </div>;
}

type Project = { key: string; name: string; organization: string };
export function SonarProjects({ organization, demo, onSelect }: { organization: string; demo: boolean; onSelect: (project: Project) => void }) {
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
      const data = await submit('sonar', { token, organization, page });
      setProjects(previous => page === 1 ? data.projects : [...previous, ...data.projects]); setNextPage(data.nextPage);
      if (!data.projects.length) setMessage('ไม่พบโปรเจกต์ที่ token นี้เข้าถึงได้ใน organization นี้');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'อ่านโปรเจกต์ไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <div className="credential-panel">
    <h3>มีโปรเจกต์ใน SonarCloud แล้ว?</h3>
    <p>กรอก Organization Key ด้านบน แล้วใช้ token เพื่อดูโปรเจกต์ที่มีอยู่ (EU)</p>
    <label className="secret-field" htmlFor="sonar-discovery-token">Sonar token สำหรับค้นหาโปรเจกต์</label>
    <input id="sonar-discovery-token" type="password" autoComplete="off" spellCheck={false} disabled={demo || busy} value={token} onChange={e => { setToken(e.target.value); setProjects([]); setNextPage(null); setMessage(''); }} placeholder={demo ? 'ใช้ได้เมื่อเชื่อมต่อบัญชีจริง' : 'วาง token เพื่ออ่านรายการจาก SonarCloud'}/>
    <p className="field-hint"><a href="https://sonarcloud.io/account/security" target="_blank" rel="noreferrer">SonarCloud → Security</a> → Generate token; ช่องนี้ใช้ค้นหาเท่านั้น ไม่บันทึกลง repo</p>
    <button className="secondary" disabled={demo || busy || !token.trim() || !organization.trim()} onClick={() => load()}>{busy ? 'กำลังอ่าน…' : 'แสดงโปรเจกต์ที่มีอยู่'}</button>
    {projects.length > 0 && <><p className="field-hint">เลือกโปรเจกต์ให้ตรงกับ repo ของคุณ — รายการนี้ยังไม่ยืนยันการผูกกับ GitHub</p>{projects.map(project => <button className="repo-choice" key={project.key} onClick={() => onSelect(project)}><span>{project.name}<small> · {project.key}</small></span><span>เลือก</span></button>)}</>}
    {nextPage && <button className="text-button" disabled={busy} onClick={() => load(nextPage)}>โหลดเพิ่มเติม</button>}
    {message && <p className="notice" role="status">{message}</p>}
  </div>;
}
