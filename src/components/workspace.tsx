'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, Code2, Download, ExternalLink, FolderGit2, Github, LayoutDashboard, LoaderCircle, LockKeyhole, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { defaultSettings, installationFiles, type Settings } from '@/lib/config';
import type { Repository } from '@/lib/github';
import ProjectPreparation from './project-preparation';
import Installation from './installation';
import { RepositorySecret, SonarProjects } from './service-credentials';

const examples: Repository[] = [
  { id: 1, full_name: 'your-team/storefront', description: 'หน้าร้านออนไลน์และระบบจัดการสินค้า', private: true, language: 'TypeScript', default_branch: 'main', html_url: '', installation: 'active', run: { status: 'completed', conclusion: 'success', html_url: '' } },
  { id: 2, full_name: 'your-team/payment-service', description: 'บริการชำระเงินและการเชื่อมต่อ API', private: true, language: 'JavaScript', default_branch: 'main', html_url: '', installation: 'active', run: { status: 'completed', conclusion: 'failure', html_url: '' } },
  { id: 3, full_name: 'your-team/my-project', description: 'โปรเจกต์ถัดไปที่พร้อมให้ AI ช่วยดูแล', private: false, language: 'JavaScript', default_branch: 'main', html_url: '', installation: 'missing' },
];
const steps = ['เลือก repository', 'ตั้งค่าการตรวจ', 'เชื่อมต่อบริการ', 'ตรวจสอบก่อนติดตั้ง'];

export default function Workspace({ connected, configured, appSlug, configurationIssues = [] }: { connected: boolean; configured: boolean; appSlug: string; configurationIssues?: string[] }) {
  const [view, setView] = useState<'repos' | 'guide' | 'setup'>('repos');
  const [demo, setDemo] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Repository | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [file, setFile] = useState('.github/workflows/quality-gate.yml');
  const [formError, setFormError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get('notice');
    if (notice === 'setup') { setView('setup'); setMessage('ต้องตั้งค่า GitHub App ก่อนเชื่อมต่อบัญชีจริง'); }
    if (notice === 'auth') setMessage('เชื่อมต่อ GitHub ไม่สำเร็จ กรุณาลองใหม่');
    if (notice === 'github-connected') setMessage('เชื่อมต่อแล้ว เลือก repo เพื่อเตรียมไฟล์ทดสอบได้เลย');
    if (notice === 'github-empty') setMessage('ยังไม่พบ repo ที่อนุญาต อาจยังไม่ได้เลือก repo หรือกำลังรอผู้ดูแลองค์กรอนุมัติ กดอนุญาตและเลือก repo เพื่อตรวจสอบได้');
    if (notice === 'github-error') setMessage('ตรวจสิทธิ์ GitHub ไม่สำเร็จ กรุณาลองใหม่ หรือตรวจชื่อ GitHub App ในการตั้งค่า');
    if (!connected) return;
    setLoading(true);
    fetch('/api/repositories').then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setRepos(data.repositories); }).catch(e => setMessage(e.message)).finally(() => setLoading(false));
  }, [connected]);
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
  const filtered = displayed.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));
  const start = (repo?: Repository) => { setSelected(repo || null); setStep(repo ? 1 : 0); setFormError(''); setDraftSaved(false); setModal(true); };
  let files: Record<string, string> = {};
  try { files = installationFiles(settings); } catch { /* form reports validation below */ }
  function next() {
    if (step === 0 && !selected) { setFormError('เลือก repository ก่อนดำเนินการต่อ'); return; }
    if (step === 1) { try { installationFiles(settings); } catch { setFormError('Coverage ต้องอยู่ระหว่าง 1–100 และข้อมูล SonarCloud ต้องครบ ใช้อักษรอังกฤษ ตัวเลข และ - _ . : ตามช่องที่กำหนด'); return; } }
    setFormError(''); setStep(v => Math.min(v + 1, 3));
  }
  function download() {
    const content = JSON.stringify({ warning: 'Experimental installation; existing engine limitations apply.', repository: selected?.full_name, files }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'quality-gate-preview.json'; a.click(); URL.revokeObjectURL(url);
    setDraftSaved(true);
  }
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-icon"><ShieldCheck size={24}/></span><span>Quality Gate<small>AI-powered code review</small></span></a>
      <div className="workspace-label">Workspace <span>Beta</span></div>
      <nav aria-label="เมนูหลัก">
        <button className={view === 'repos' ? 'nav active' : 'nav'} onClick={() => setView('repos')}><LayoutDashboard size={19}/> Repositories</button>
        <button className={view === 'guide' ? 'nav active' : 'nav'} onClick={() => setView('guide')}><BookOpen size={19}/> คู่มือการใช้งาน</button>
        <button className={view === 'setup' ? 'nav active' : 'nav'} onClick={() => setView('setup')}><Settings2 size={19}/> การเชื่อมต่อ</button>
      </nav>
      <div className="sidebar-note"><ShieldCheck size={22}/><strong>โค้ดของคุณ อยู่ใน repo คุณ</strong><p>ตรวจผ่าน GitHub Actions แล้วกลับไปทำงานใน workflow ที่คุ้นเคย</p><a href="https://github.com/NonnaritRammaneekultawat-6609650459/test-github-marketplace" target="_blank" rel="noreferrer">ดูเครื่องมือตรวจโค้ด <ArrowUpRight size={15}/></a></div>
      <div className="account"><span className="avatar"><Github size={21}/></span><div><strong>{connected ? 'GitHub connected' : 'ยังไม่ได้เชื่อมต่อ'}</strong><small>{demo ? 'กำลังดูข้อมูลตัวอย่าง' : 'พื้นที่ทำงานของคุณ'}</small></div></div>
    </aside>
    <main>
      <header className="topbar"><span>Workspace <ChevronRight size={15}/> {view === 'repos' ? 'Repositories' : view === 'guide' ? 'คู่มือ' : 'การเชื่อมต่อ'}</span><div>{connected ? <form action="/api/auth/logout" method="post"><button className="text-button">ออกจากระบบ</button></form> : <a className="connect" href={configured ? '/api/github/connect' : '#setup'} onClick={() => { if (!configured) setView('setup'); }}><Github size={17}/> เชื่อมต่อ GitHub</a>}</div></header>
      <div className="content">
        {message && <div className="notice" role="status">{message}<button aria-label="ปิดข้อความ" onClick={() => setMessage('')}><X size={16}/></button></div>}
        {demo && <div className="demo-banner"><span>โหมดตัวอย่าง — ข้อมูลสมมติ ไม่มีการแก้ไข GitHub</span><button onClick={() => setDemo(false)}>ออกจากตัวอย่าง <X size={14}/></button></div>}
        {view === 'repos' && <>
          <div className="heading"><div><p className="kicker">ให้ทุกการเปลี่ยนแปลง ผ่านการตรวจที่ดี</p><h1>Your code. A little more confidence.</h1><p>เชื่อมต่อ repository ตั้งเกณฑ์คุณภาพ แล้วให้ AI ช่วยตรวจโค้ดของคุณ</p></div><button className="primary" onClick={() => start()}><Plus size={18}/> เพิ่ม repository</button></div>
          <section className="overview" aria-label="ภาพรวม"><div><span>Repositories ที่เชื่อมต่อ</span><strong>{displayed.length.toString().padStart(2, '0')}</strong><small>{demo ? 'ตัวอย่าง repository' : 'ที่ GitHub App เข้าถึงได้'}</small></div><div><span>ติดตั้ง Quality Gate</span><strong>{demo ? '02' : '—'}</strong><small>{demo ? 'ข้อมูลตัวอย่าง' : 'ยังไม่ตรวจสถานะการติดตั้ง'}</small></div><div className="overview-explain"><span className="round-icon"><Sparkles size={23}/></span><div><strong>รีวิวโค้ด สร้างเทสต์ ตรวจ coverage</strong><p>ทำงานบน GitHub Actions พร้อมรายงานใน Pull Request</p></div></div></section>
          <div className="section-heading"><div><h2>Repositories</h2><p>จัดการการตรวจคุณภาพของแต่ละโปรเจกต์ในที่เดียว</p></div><div className="actions">{connected && !demo && <a className="secondary" href="/api/github/install"><Github size={16}/> อนุญาต / เพิ่ม repo</a>}<label className="search"><Search size={17}/><input placeholder="ค้นหา repository…" value={search} onChange={e => setSearch(e.target.value)} aria-label="ค้นหา repository"/></label></div></div>
          {loading ? <div className="empty"><LoaderCircle className="spin"/><h3>กำลังอ่าน repository จาก GitHub</h3></div> : displayed.length === 0 ? <div className="empty"><div className="empty-art"><FolderGit2 size={42}/><span><ShieldCheck size={23}/></span></div><h2>เริ่มต้นจาก repository แรกของคุณ</h2><p>{connected ? 'กดอนุญาตและเลือก repo บน GitHub แล้วระบบจะพากลับมาที่นี่' : 'เชื่อมต่อ GitHub เพื่อเลือกโปรเจกต์ที่ต้องการตรวจ หรือทดลองหน้าจอด้วยข้อมูลตัวอย่างก่อน'}</p><div className="actions">{connected && appSlug ? <a className="primary" href="/api/github/install">อนุญาตและเลือก repo <ExternalLink size={16}/></a> : <button className="primary" onClick={() => configured ? window.location.assign('/api/github/connect') : setView('setup')}><Github size={18}/> เชื่อมต่อ GitHub</button>}<button className="secondary" onClick={() => setDemo(true)}>ทดลองดูตัวอย่าง</button></div><small>ไม่ต้อง clone ระบบตรวจคุณภาพมารวมกับโปรเจกต์</small></div> : <div className="repo-list">{filtered.length === 0 ? <p className="empty">ไม่พบ repository ที่ตรงกับคำค้น</p> : filtered.map(repo => <article className="repo-row" key={repo.id}><div className="repo-icon"><FolderGit2 size={24}/></div><div className="repo-info"><h3>{repo.full_name}<span className="visibility">{repo.private ? 'Private' : 'Public'}</span></h3><p>{repo.description || 'ยังไม่มีคำอธิบาย repository'}</p><small><span className={`language ${repo.language === 'TypeScript' ? 'ts' : ''}`}/>{repo.language || 'ไม่ระบุภาษา'}<span className="branch">{repo.default_branch}</span></small></div><div className="repo-status">{demo && repo.installation === 'active' ? <><span className={repo.run?.conclusion === 'success' ? 'badge success' : 'badge warning'}>{repo.run?.conclusion === 'success' ? 'ผ่านการตรวจ' : 'มีจุดที่ต้องแก้ไข'}</span><small>ผลตัวอย่าง · Coverage {repo.id === 1 ? '92' : '64'}%</small></> : <span className="badge">ยังไม่ยืนยันสถานะติดตั้ง</span>}</div><button className="icon-button" aria-label={`ตั้งค่า ${repo.full_name}`} onClick={() => start(repo)}><SlidersHorizontal size={19}/></button></article>)}</div>}
          <section className="bottom-guide"><div><CircleHelp size={23}/><div><h3>เริ่มใช้ครั้งแรก?</h3><p>รู้จัก API key และเตรียมโปรเจกต์ให้พร้อมในไม่กี่ขั้นตอน</p></div></div><button className="text-button" onClick={() => setView('guide')}>อ่านคู่มือ <ArrowUpRight size={17}/></button></section>
        </>}
        {view === 'guide' && <><div className="heading"><div><p className="kicker">เริ่มต้นใช้งาน</p><h1>จาก repo สู่การตรวจอัตโนมัติ</h1><p>ตั้งค่าครั้งเดียว แล้วทำงานต่อใน GitHub ของคุณ</p></div></div><div className="guide-grid"><Guide title="1. เชื่อมต่อ GitHub" text="เข้าสู่ระบบและเลือก repo ที่อนุญาตให้แอปเข้าถึง ไม่ต้องสร้าง GitHub token เอง"/><Guide title="2. สร้าง Gemini API key" text="เข้า Google AI Studio เลือก API keys สร้าง key ในโปรเจกต์ของคุณ แล้วนำมากรอกและกดบันทึกในขั้นเชื่อมต่อบริการ โค้ดที่วิเคราะห์จะถูกส่งให้ Gemini และใช้โควตาของบัญชีคุณ" href="https://aistudio.google.com/apikey" label="เปิด Google AI Studio"/><Guide title="3. ตั้งค่า SonarCloud (ตัวเลือก)" text="เพิ่ม repo งานใน SonarCloud ตั้งค่าการวิเคราะห์ด้วย GitHub Actions แล้วเตรียม token, Project key และ Organization ของโปรเจกต์นั้น" href="https://sonarcloud.io" label="เปิด SonarCloud"/><Guide title="4. ตรวจไฟล์และติดตั้ง" text="ระบบจะเตรียม workflow และ config ใน PR ให้ตรวจสอบ เมื่อ merge แล้วจึงเริ่มทำงาน ขณะนี้ทดลองติดตั้ง Action เดิมได้ แต่ยังมีข้อจำกัดในการตรวจ"/></div><div className="notice">รุ่นแรกออกแบบสำหรับ Node.js / npm / Jest และโค้ดใน src/ โดยต้องมี package-lock.json ส่วน TypeScript ต้องตั้งค่า Jest ให้รันได้ก่อน</div><h2>ผลตรวจจะอยู่ที่ไหน?</h2><p className="body-copy">PR จะมีรายงานและสถานะตรวจ ส่วน push ที่ไม่มี PR จะดูผลได้ใน GitHub Actions การตรวจไม่ผ่านจะบล็อก merge ก็ต่อเมื่อตั้ง Required status checks ในกฎ branch ของ repo แล้ว</p><p className="body-copy">PR จาก fork และ Dependabot จะข้ามงานที่ต้องใช้ secrets ตาม workflow ตัวอย่าง เพื่อไม่ส่ง keys ให้โค้ดภายนอก</p></>}
        {view === 'setup' && <><div className="heading"><div><p className="kicker">สำหรับเจ้าของระบบ</p><h1>เชื่อมบริการให้พร้อมใช้งาน</h1><p>หน้าเว็บพร้อมทดลอง ส่วนบัญชีและข้อมูลลับต้องตั้งค่าด้วยบัญชีของคุณ</p></div></div>{!configured && <div className="notice" role="alert"><div><strong>ยังเข้าสู่ระบบไม่ได้ เพราะการตั้งค่ายังไม่ครบ</strong><ul>{configurationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul><p>ตรวจชื่อให้ตรงใน .env.local แล้วบันทึกและรีสตาร์ตเว็บ</p></div></div>}<div className="setup-panel"><div className="setup-row"><Github/><div><h3>GitHub App</h3><p>ใช้เชื่อมบัญชีและเลือก repo; การสร้าง PR เตรียมโปรเจกต์ต้องมี Contents และ Pull requests แบบ Read and write; การบันทึก key ต้องมี Secrets แบบ Read and write</p></div><span className={`badge ${configured ? 'success' : 'warning'}`}>{configured ? 'ตั้งค่าแล้ว' : 'รอตั้งค่า'}</span></div><p>สร้าง GitHub App แล้วกำหนด Redirect URI เป็น <code>/api/auth/callback</code> บน URL ของเว็บ ใส่ Client ID, Client secret, App slug และ Session secret ใน <code>.env.local</code> ตามคู่มือ README และตั้ง Setup URL เป็น <code>/api/github/return</code> บน URL ของเว็บ เพื่อกลับมาหลังเลือก repo</p><a href="https://github.com/settings/apps/new" target="_blank" rel="noreferrer" className="secondary">สร้าง GitHub App <ExternalLink size={16}/></a>{configured && <a className="primary" href="/api/github/connect">เชื่อมต่อบัญชี</a>}</div><div className="setup-panel"><div className="setup-row"><ShieldCheck/><div><h3>Quality Gate engine</h3><p>ยังต้องแก้พฤติกรรม SonarCloud และการหาไฟล์บน push</p></div><span className="badge warning">รอปรับปรุง</span></div><p>ตามขอบเขตที่ตกลง รอบนี้ทำเฉพาะเว็บ สร้าง PR ติดตั้งเพื่อทดลองได้แล้ว แต่บันทึก keys ลง Secrets ของ repo ได้แล้ว</p></div><button className="text-button" onClick={() => { setDemo(true); setView('repos'); }}>ทดลองหน้าจอโดยไม่ใช้บัญชี <ChevronRight size={16}/></button></>}
        <footer><span><ShieldCheck size={15}/> Automated Quality Gate</span><span>Built around your GitHub workflow</span></footer>
      </div>
    </main>
    {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabIndex={-1}><header className="modal-header"><div><span className="kicker">ตั้งค่าการตรวจคุณภาพ</span><h2 id="wizard-title">{selected?.full_name || 'เพิ่ม repository'}</h2></div><button className="icon-button" aria-label="ปิดหน้าตั้งค่า" onClick={() => setModal(false)}><X/></button></header><ol className="steps">{steps.map((s, i) => <li className={i === step ? 'current' : i < step ? 'done' : ''} key={s}><span>{i < step ? <Check size={14}/> : i + 1}</span>{s}</li>)}</ol><div className="modal-body">
      {step === 0 && <><h3>เลือกโปรเจกต์ที่ต้องการตรวจ</h3><p>แสดงเฉพาะ repo ที่คุณอนุญาตให้แอปเข้าถึง</p>{!demo && configured && <a className="help-link" href="/api/github/install">อนุญาต GitHub App / เพิ่ม repo <ExternalLink size={14}/></a>}{displayed.length ? displayed.map(r => <button key={r.id} className={`repo-choice ${selected?.id === r.id ? 'chosen' : ''}`} onClick={() => setSelected(r)}><FolderGit2 size={21}/><span>{r.full_name}</span>{selected?.id === r.id && <Check size={18}/>}</button>) : <div className="notice">ยังไม่มี repo ให้เลือก <button className="text-button" onClick={() => { setDemo(true); }}>ใช้ข้อมูลตัวอย่าง</button></div>}</>}
      {step === 1 && <>{selected && <ProjectPreparation key={`${selected.id}-${demo}`} repository={selected.full_name} demo={demo}/>}<div className="coverage-head"><div><h3>Test coverage ที่ต้องการ</h3><p>กำหนดเกณฑ์ความครอบคลุมของการทดสอบ</p></div><div className="coverage-number"><input aria-label="Coverage เปอร์เซ็นต์" type="number" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><span>%</span></div></div><input className="range" aria-label="ปรับ coverage" type="range" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><div className="range-labels"><span>1% · เริ่มต้น</span><span>100% · ครอบคลุมทั้งหมด</span></div><div className="feature-line"><Sparkles size={21}/><div><strong>AI review และสร้างเทสต์</strong><p>บันทึก Gemini API key ของคุณในขั้นเชื่อมต่อบริการ</p></div><span className="badge">ใช้ Gemini</span></div><label className="feature-line"><ShieldCheck size={21}/><div><strong>เพิ่ม SonarCloud</strong><p>ตรวจปัญหาคุณภาพและความปลอดภัยเพิ่มเติม</p></div><input type="checkbox" checked={settings.sonar} onChange={e => setSettings({ ...settings, sonar: e.target.checked })}/></label>{settings.sonar && <div className="field-grid"><div><label htmlFor="sonar-project-key">Sonar project key</label><input id="sonar-project-key" aria-describedby="sonar-project-help" value={settings.projectKey} onChange={e => setSettings({ ...settings, projectKey: e.target.value })} placeholder="my-team_my-project"/><p id="sonar-project-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">เปิดโปรเจกต์</a> → Information → คัดลอก Project Key</p></div><div><label htmlFor="sonar-organization">Sonar organization</label><input id="sonar-organization" aria-describedby="sonar-organization-help" value={settings.organization} onChange={e => setSettings({ ...settings, organization: e.target.value })} placeholder="my-team"/><p id="sonar-organization-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">เปิดโปรเจกต์</a> → Information → คัดลอก Organization Key</p></div></div>}<div>{settings.sonar && <SonarProjects key={`${selected?.id}-${settings.organization}-${demo}`} organization={settings.organization} demo={demo} onSelect={project => setSettings({ ...settings, projectKey: project.key, organization: project.organization })}/>}</div><div className="notice">การบังคับ coverage ขึ้นกับ Action เดิม ยังต้องทดสอบให้ครบก่อนเปิดใช้งานจริง</div></>}
      {step === 2 && <><h3>Keys อยู่กับ repo ของคุณ</h3><p>กดบันทึกเพื่อเข้ารหัสและเก็บ key ใน GitHub Actions Secrets ของ repo ที่เลือก</p>{selected && <RepositorySecret key={`${selected.id}-gemini-${demo}`} repository={selected.full_name} name="GEMINI_API_KEY" demo={demo}/>} {settings.sonar && selected && <RepositorySecret key={`${selected.id}-sonar-${demo}`} repository={selected.full_name} name="SONAR_TOKEN" demo={demo}/>}<div className="feature-line"><Github size={21}/><div><strong>GitHub token</strong><p>GitHub สร้างให้ workflow อัตโนมัติ ไม่ต้องกรอก</p></div><Check size={20}/></div><div className="notice"><LockKeyhole size={18}/> key จะผ่านเซิร์ฟเวอร์เว็บเพื่อบันทึกลง GitHub โดยไม่เก็บในฐานข้อมูลหรือ localStorage การบันทึกยังไม่เปิดการตรวจโค้ดอัตโนมัติ</div></>}
      {step === 3 && <><div className="review-summary"><div><span>Repository</span><strong>{selected?.full_name}</strong></div><div><span>Coverage</span><strong>{settings.coverage}%</strong></div><div><span>SonarCloud</span><strong>{settings.sonar ? 'เปิด' : 'ปิด'}</strong></div></div><h3>ไฟล์ที่จะเตรียมใน Pull Request</h3><div className="file-tabs">{Object.keys(files).map(name => <button className={name === file ? 'selected' : ''} key={name} onClick={() => setFile(name)}><Code2 size={14}/>{name.split('/').pop()}</button>)}</div><pre className="code-preview"><code>{files[file] || Object.values(files)[0]}</code></pre><div className="notice">ทดลองติดตั้ง Action เดิมได้ ผลอาจล้มเหลวหรือข้ามการตรวจ ดูรายละเอียดใน GitHub Actions หลัง merge PR</div>{selected && <Installation key={`${selected.id}-${JSON.stringify(settings)}-${demo}`} repository={selected.full_name} demo={demo} settings={settings}/>} {draftSaved && <p className="saved" role="status"><Check size={17}/> ดาวน์โหลดตัวอย่างแล้ว ไม่มีการแก้ไข repo</p>}</>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </div><div className="modal-footer"><button className="secondary" onClick={() => step ? setStep(step - 1) : setModal(false)}>{step ? 'ย้อนกลับ' : 'ยกเลิก'}</button><div className="actions">{step === 3 ? <><button className="secondary" onClick={download}><Download size={16}/> ดาวน์โหลดตัวอย่าง</button></> : <button className="primary" onClick={next}>ถัดไป <ChevronRight size={16}/></button>}</div></div></section></div>}
  </div>;
}

function Guide({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) { return <article className="guide-card"><h3>{title}</h3><p>{text}</p>{href && <a href={href} target="_blank" rel="noreferrer">{label} <ExternalLink size={15}/></a>}</article>; }





