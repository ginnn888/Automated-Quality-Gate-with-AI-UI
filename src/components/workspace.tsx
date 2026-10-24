'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, Code2, ExternalLink, FolderGit2, Github, LayoutDashboard, LoaderCircle, LockKeyhole, Plus, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { defaultSettings, installationFiles, type Settings } from '@/lib/config';
import type { Identity } from '@/lib/identity';
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
    catch (error) { setRepos([]); setMessage(error instanceof Error ? error.message : 'โหลด repository ไม่สำเร็จ'); }
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
    if (notice === 'setup') { setView('setup'); setMessage('บริการเชื่อมต่อยังไม่พร้อม กรุณาลองใหม่ภายหลัง'); }
    if (notice === 'auth') setMessage('เชื่อมต่อ GitHub ไม่สำเร็จ กรุณาลองใหม่');
    if (notice === 'github-connected') setMessage('เชื่อมต่อแล้ว เลือก repo เพื่อเตรียมไฟล์ทดสอบได้เลย');
    if (notice === 'github-empty') setMessage('ยังไม่พบ repo ที่อนุญาต อาจยังไม่ได้เลือก repo หรือกำลังรอผู้ดูแลองค์กรอนุมัติ กดอนุญาตและเลือก repo เพื่อตรวจสอบได้');
    if (notice === 'github-error') setMessage('ตรวจสิทธิ์ GitHub ไม่สำเร็จ กรุณาลองใหม่ หรือตรวจชื่อ GitHub App ในการตั้งค่า');
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
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await response.json();
        if (disposed) return;
        if (!response.ok || data.user?.id !== user.id) {
          setRepos([]); setModal(false); setSelected(null);
          window.location.replace(response.ok ? '/' : '/login?notice=auth');
        }
      } catch { if (!disposed) { setRepos([]); setModal(false); setMessage('ตรวจบัญชีไม่ได้ กรุณาโหลดหน้าใหม่'); } }
    };
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); };
  }, [user.id]);
  const displayed = demo ? examples : repos;
  const filtered = displayed.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || r.installation === statusFilter));
  const start = (repo?: Repository) => { setSelected(repo || null); setStep(repo ? 1 : 0); setFormError(''); setModal(true); };
  let files: Record<string, string> = {};
  try { files = installationFiles(settings); } catch { /* form reports validation below */ }
  function next() {
    if (step === 0 && !selected) { setFormError('เลือก repository ก่อนดำเนินการต่อ'); return; }
    if (step === 1) { try { installationFiles(settings); } catch { setFormError(settings.projectType === 'angularjs' ? 'ตรวจชื่อโมเดล (อักษรอังกฤษ ตัวเลข จุด ขีดกลาง) และเวลารอ 10–180 วินาที' : 'Coverage ต้องอยู่ระหว่าง 1–100 และข้อมูล SonarCloud ต้องครบ'); return; } }
    setFormError(''); setStep(v => Math.min(v + 1, 3));
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
      <div className="account"><span className="avatar"><img src={user.avatar_url} alt="" width={40} height={40}/></span><div><strong>@{user.login}</strong><small>{demo ? 'กำลังดูข้อมูลตัวอย่าง' : 'พื้นที่ทำงานของคุณ'}</small></div></div>
    </aside>
    <main>
      <header className="topbar"><span>Workspace <ChevronRight size={15}/> {view === 'repos' ? 'Repositories' : view === 'guide' ? 'คู่มือ' : 'การเชื่อมต่อ'}</span><div className="account-actions"><span>เข้าสู่ระบบเป็น <strong>@{user.login}</strong></span>{connected ? <form action="/api/auth/logout" method="post"><button className="text-button">ออกจากระบบ / เปลี่ยนบัญชี</button></form> : <a className="connect" href={configured ? '/api/github/connect' : '#setup'} onClick={() => { if (!configured) setView('setup'); }}><Github size={17}/> เชื่อมต่อ GitHub</a>}</div></header>
      <div className="content">
        {message && <div className="notice" role="status">{message}<button aria-label="ปิดข้อความ" onClick={() => setMessage('')}><X size={16}/></button></div>}
        {demo && <div className="demo-banner"><span>โหมดตัวอย่าง — ข้อมูลสมมติ ไม่มีการแก้ไข GitHub</span><button onClick={() => setDemo(false)}>ออกจากตัวอย่าง <X size={14}/></button></div>}
        {view === 'repos' && <>
          <div className="heading"><div><p className="kicker">ให้ทุกการเปลี่ยนแปลง ผ่านการตรวจที่ดี</p><h1>Your code. A little more confidence.</h1><p>เชื่อมต่อ repository ตั้งเกณฑ์คุณภาพ แล้วให้ AI ช่วยตรวจโค้ดของคุณ</p></div><button className="primary" onClick={() => start()}><Plus size={18}/> เพิ่ม repository</button></div>
          <section className="overview" aria-label="ภาพรวม"><div><span>Repositories ที่เชื่อมต่อ</span><strong>{displayed.length.toString().padStart(2, '0')}</strong><small>{demo ? 'ตัวอย่าง repository' : 'ที่ GitHub App เข้าถึงได้'}</small></div><div><span>ติดตั้ง Quality Gate</span><strong>{displayed.filter(repo => repo.installation === 'active').length.toString().padStart(2, '0')}</strong><small>{demo ? 'ข้อมูลตัวอย่าง' : 'พบไฟล์ติดตั้งใน branch หลัก'}</small></div><div className="overview-explain"><span className="round-icon"><Sparkles size={23}/></span><div><strong>รีวิวโค้ด สร้างเทสต์ ตรวจ coverage</strong><p>ทำงานบน GitHub Actions พร้อมรายงานใน Pull Request</p></div></div></section>
          <div className="section-heading"><div><h2>Repositories</h2><p>จัดการการตรวจคุณภาพของแต่ละโปรเจกต์ในที่เดียว</p></div><div className="actions">{connected && !demo && <button className="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> รีเฟรชสถานะ</button>}{connected && !demo && <a className="secondary" href="/api/github/install"><Github size={16}/> อนุญาต / เพิ่ม repo</a>}<label className="search"><Search size={17}/><input placeholder="ค้นหา repository…" value={search} onChange={e => setSearch(e.target.value)} aria-label="ค้นหา repository"/></label></div></div>
          <div className="repo-filters" role="group" aria-label="กรองสถานะการติดตั้ง">{[['all', 'ทั้งหมด'], ['active', 'ติดตั้งแล้ว'], ['missing', 'ยังไม่ติดตั้ง'], ['incomplete', 'ตั้งค่าไม่ครบ'], ['unknown', 'ตรวจสอบไม่ได้']].map(([value, label]) => <button key={value} className={statusFilter === value ? 'secondary filter-selected' : 'text-button'} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label} ({displayed.filter(repo => value === 'all' || repo.installation === value).length})</button>)}</div><p className="field-hint">ตรวจไฟล์ใน branch หลักของแต่ละ repo; PR ที่ยังไม่ merge จะยังไม่นับว่าติดตั้ง สถานะนี้ไม่ใช่ผลตรวจโค้ด</p>
          {loading ? <div className="empty"><LoaderCircle className="spin"/><h3>กำลังอ่าน repository จาก GitHub</h3></div> : displayed.length === 0 ? <div className="empty"><div className="empty-art"><FolderGit2 size={42}/><span><ShieldCheck size={23}/></span></div><h2>เริ่มต้นจาก repository แรกของคุณ</h2><p>{connected ? 'กดอนุญาตและเลือก repo บน GitHub แล้วระบบจะพากลับมาที่นี่' : 'เชื่อมต่อ GitHub เพื่อเลือกโปรเจกต์ที่ต้องการตรวจ หรือทดลองหน้าจอด้วยข้อมูลตัวอย่างก่อน'}</p><div className="actions">{connected && appSlug ? <a className="primary" href="/api/github/install">อนุญาตและเลือก repo <ExternalLink size={16}/></a> : <button className="primary" onClick={() => configured ? window.location.assign('/api/github/connect') : setView('setup')}><Github size={18}/> เชื่อมต่อ GitHub</button>}<button className="secondary" onClick={() => setDemo(true)}>ทดลองดูตัวอย่าง</button></div><small>ไม่ต้อง clone ระบบตรวจคุณภาพมารวมกับโปรเจกต์</small></div> : <div className="repo-list">{filtered.length === 0 ? <p className="empty">ไม่พบ repository ที่ตรงกับคำค้นหรือสถานะที่เลือก</p> : filtered.map(repo => <article className="repo-row" key={repo.id}><div className="repo-icon"><FolderGit2 size={24}/></div><div className="repo-info"><h3>{repo.full_name}<span className="visibility">{repo.private ? 'Private' : 'Public'}</span></h3><p>{repo.description || 'ยังไม่มีคำอธิบาย repository'}</p><small><span className={`language ${repo.language === 'TypeScript' ? 'ts' : ''}`}/>{repo.language || 'ไม่ระบุภาษา'}<span className="branch">{repo.default_branch}</span></small></div><div className="repo-status"><span className={`badge ${repo.installation === 'active' ? 'success' : repo.installation === 'incomplete' ? 'warning' : ''}`}>{repo.installation === 'active' ? 'ติดตั้งแล้ว' : repo.installation === 'missing' ? 'ยังไม่ติดตั้ง' : repo.installation === 'incomplete' ? 'ตั้งค่าไม่ครบ' : 'ตรวจสอบไม่ได้'}</span><small>{repo.installation === 'active' ? `พบการตั้งค่าใน ${repo.default_branch}` : repo.installation === 'unknown' ? 'ลองรีเฟรชหรือตรวจสิทธิ์ GitHub' : repo.installation === 'incomplete' ? 'ตรวจ workflow และ config' : 'รวม PR ติดตั้งก่อน แล้วรีเฟรช'}{demo ? ' · ตัวอย่าง' : ''}</small></div><button className="icon-button" aria-label={`ตั้งค่า ${repo.full_name}`} onClick={() => start(repo)}><SlidersHorizontal size={19}/></button></article>)}</div>}
          <section className="bottom-guide"><div><CircleHelp size={23}/><div><h3>เริ่มใช้ครั้งแรก?</h3><p>รู้จัก API key และเตรียมโปรเจกต์ให้พร้อมในไม่กี่ขั้นตอน</p></div></div><button className="text-button" onClick={() => setView('guide')}>อ่านคู่มือ <ArrowUpRight size={17}/></button></section>
        </>}
        {view === 'guide' && <><div className="heading"><div><p className="kicker">เริ่มต้นใช้งาน</p><h1>จาก repo สู่การตรวจอัตโนมัติ</h1><p>ตั้งค่าครั้งเดียว แล้วทำงานต่อใน GitHub ของคุณ</p></div></div><div className="guide-grid"><Guide title="1. เชื่อมต่อ GitHub" text="เข้าสู่ระบบและเลือก repo ที่อนุญาตให้แอปเข้าถึง ไม่ต้องสร้าง GitHub token เอง"/><Guide title="2. สร้าง Gemini API key" text="เข้า Google AI Studio เลือก API keys สร้าง key ในโปรเจกต์ของคุณ แล้วนำมากรอกและกดบันทึกในขั้นเชื่อมต่อบริการ โค้ดที่วิเคราะห์จะถูกส่งให้ Gemini และใช้โควตาของบัญชีคุณ" href="https://aistudio.google.com/apikey" label="เปิด Google AI Studio"/><Guide title="3. ตั้งค่า SonarCloud (ตัวเลือก)" text="เพิ่ม repo งานใน SonarCloud ตั้งค่าการวิเคราะห์ด้วย GitHub Actions แล้วเตรียม token, Project key และ Organization ของโปรเจกต์นั้น" href="https://sonarcloud.io" label="เปิด SonarCloud"/><Guide title="4. ตรวจไฟล์และติดตั้ง" text="ระบบจะเตรียม workflow และ config ใน PR ให้ตรวจสอบ เมื่อ merge แล้วจึงเริ่มทำงาน หลัง merge PR ติดตั้ง ให้สร้าง branch งานจาก branch หลักที่อัปเดตแล้ว และเปิด PR แก้โค้ดเพื่อเริ่มตรวจ"/></div><div className="notice">รองรับ JavaScript/Jest และ AngularJS 1.x เลือกประเภทให้ตรงกับโปรเจกต์ และเตรียม package.json กับ package-lock.json ของแอป</div><h2>ผลตรวจจะอยู่ที่ไหน?</h2><p className="body-copy">เปิดหรืออัปเดต PR เพื่อเริ่มตรวจ และดูรายงานใน PR หรือรายละเอียดใน GitHub Actions; push ที่ไม่มี PR และการ merge จะไม่เริ่มการตรวจรอบใหม่ การตรวจไม่ผ่านจะบล็อก merge ก็ต่อเมื่อตั้ง Required status checks ในกฎ branch ของ repo แล้ว</p><p className="body-copy">โหมด JavaScript จะข้าม PR จาก fork และ Dependabot ส่วน AngularJS แยกการรันโค้ด PR ออกจาก job ที่ใช้ key และเขียนรายงาน</p></>}
        {view === 'setup' && <><div className="heading"><div><p className="kicker">บัญชีของคุณ</p><h1>การเชื่อมต่อ GitHub</h1><p>อนุญาต repository ที่ต้องการติดตั้ง Quality Gate</p></div></div><div className="setup-panel"><div className="setup-row"><Github/><div><h3>GitHub</h3><p>{connected ? 'เชื่อมต่อบัญชีแล้ว คุณเพิ่มหรือเปลี่ยน repo ที่อนุญาตได้' : 'เชื่อมต่อบัญชีเพื่อเลือก repository ของคุณ'}</p></div><span className={`badge ${connected ? 'success' : ''}`}>{connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}</span></div>{configured ? <a className="primary" href={connected ? '/api/github/install' : '/api/github/connect'}>{connected ? 'จัดการ repo ที่อนุญาต' : 'เชื่อมต่อ GitHub'}</a> : <p role="status">บริการเชื่อมต่อยังไม่พร้อม กรุณาลองใหม่ภายหลัง</p>}</div></>}
        <footer><span><ShieldCheck size={15}/> Automated Quality Gate</span><span>Built around your GitHub workflow</span></footer>
      </div>
    </main>
    {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabIndex={-1}><header className="modal-header"><div><span className="kicker">ตั้งค่าการตรวจคุณภาพ</span><h2 id="wizard-title">{selected?.full_name || 'เพิ่ม repository'}</h2></div><button className="icon-button" aria-label="ปิดหน้าตั้งค่า" onClick={() => setModal(false)}><X/></button></header><nav className="wizard-tab-strip" aria-label="ขั้นตอนการติดตั้ง"><ol className="wizard-tabs">{steps.map((label, index) => <li className={index === step ? 'current' : index < step ? 'done' : ''} key={label}><button type="button" aria-current={index === step ? 'step' : undefined} disabled={index > step + 1} onClick={() => { if (index === step + 1) next(); else { setFormError(''); setStep(index); } }}><span className="wizard-tab-icon" aria-hidden="true">{index < step ? <Check size={14}/> : index + 1}</span><span className="wizard-tab-label">{label}</span></button></li>)}</ol></nav><div className="modal-body">
      {step === 0 && <><h3>เลือกโปรเจกต์ที่ต้องการตรวจ</h3><p>แสดงเฉพาะ repo ที่คุณอนุญาตให้แอปเข้าถึง</p>{!demo && configured && <a className="help-link" href="/api/github/install">อนุญาต GitHub App / เพิ่ม repo <ExternalLink size={14}/></a>}{displayed.length ? displayed.map(r => <button key={r.id} className={`repo-choice ${selected?.id === r.id ? 'chosen' : ''}`} onClick={() => setSelected(r)}><FolderGit2 size={21}/><span>{r.full_name}</span>{selected?.id === r.id && <Check size={18}/>}</button>) : <div className="notice">ยังไม่มี repo ให้เลือก <button className="text-button" onClick={() => { setDemo(true); }}>ใช้ข้อมูลตัวอย่าง</button></div>}</>}
      {step === 1 && <><div className="field-grid"><div><label htmlFor="project-type">ชนิดโปรเจกต์</label><select id="project-type" value={settings.projectType} onChange={e => setSettings({ ...settings, projectType: e.target.value as Settings['projectType'], sonar: false })}><option value="javascript">JavaScript / Jest</option><option value="angularjs">AngularJS 1.x</option></select></div></div>{settings.projectType === 'angularjs' ? <><div className="notice">Action จะสร้างเทสต์ ตรวจโค้ด และโพสต์รายงานใน PR ให้เอง โปรเจกต์ต้องมี AngularJS ใน package.json และ package-lock.json พร้อมโค้ดใน src/</div><div className="field-grid"><div><label htmlFor="gemini-model">Gemini model</label><input id="gemini-model" value={settings.geminiModel} onChange={e => setSettings({ ...settings, geminiModel: e.target.value })}/></div><div><label htmlFor="ai-timeout">เวลารอ AI ต่อคำขอ (วินาที)</label><input id="ai-timeout" type="number" min="10" max="180" value={settings.aiTimeout} onChange={e => setSettings({ ...settings, aiTimeout: Number(e.target.value) })}/></div></div><p>AngularJS เวอร์ชันนี้ยังไม่รองรับการตั้งเกณฑ์ coverage และ SonarCloud</p></> : <>{selected && <ProjectPreparation key={`${selected.id}-${demo}`} repository={selected.full_name} demo={demo}/>}<div className="coverage-head"><div><h3>Test coverage ที่ต้องการ</h3><p>กำหนดเกณฑ์ความครอบคลุมของการทดสอบ</p></div><div className="coverage-number"><input aria-label="Coverage เปอร์เซ็นต์" type="number" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><span>%</span></div></div><input className="range" aria-label="ปรับ coverage" type="range" min="1" max="100" value={settings.coverage} onChange={e => setSettings({ ...settings, coverage: Number(e.target.value) })}/><div className="range-labels"><span>1% · เริ่มต้น</span><span>100% · ครอบคลุมทั้งหมด</span></div><div className="feature-line"><Sparkles size={21}/><div><strong>AI review และสร้างเทสต์</strong><p>บันทึก Gemini API key ของคุณในขั้นเชื่อมต่อบริการ</p></div><span className="badge">ใช้ Gemini</span></div><label className="feature-line"><ShieldCheck size={21}/><div><strong>เพิ่ม SonarCloud</strong><p>ตรวจปัญหาคุณภาพและความปลอดภัยเพิ่มเติม</p></div><input type="checkbox" checked={settings.sonar} onChange={e => setSettings({ ...settings, sonar: e.target.checked })}/></label>{settings.sonar && <div className="field-grid"><div><label htmlFor="sonar-project-key">Sonar project key</label><input id="sonar-project-key" aria-describedby="sonar-project-help" value={settings.projectKey} onChange={e => setSettings({ ...settings, projectKey: e.target.value })} placeholder="my-team_my-project"/><p id="sonar-project-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">เปิดโปรเจกต์</a> → Information → คัดลอก Project Key</p></div><div><label htmlFor="sonar-organization">Sonar organization</label><input id="sonar-organization" aria-describedby="sonar-organization-help" value={settings.organization} onChange={e => setSettings({ ...settings, organization: e.target.value })} placeholder="my-team"/><p id="sonar-organization-help" className="field-hint"><a href="https://sonarcloud.io/projects" target="_blank" rel="noreferrer">เปิดโปรเจกต์</a> → Information → คัดลอก Organization Key</p></div></div>}<div>{settings.sonar && <SonarProjects key={`${selected?.id}-${settings.organization}-${demo}`} organization={settings.organization} demo={demo} onSelect={project => setSettings({ ...settings, projectKey: project.key, organization: project.organization })}/>}</div></>}</>}
      {step === 2 && <><h3>Keys อยู่กับ repo ของคุณ</h3><p>กดบันทึกเพื่อเข้ารหัสและเก็บ key ใน GitHub Actions Secrets ของ repo ที่เลือก</p>{selected && <RepositorySecret key={`${selected.id}-gemini-${demo}`} repository={selected.full_name} name="GEMINI_API_KEY" demo={demo}/>} {settings.sonar && selected && <RepositorySecret key={`${selected.id}-sonar-${demo}`} repository={selected.full_name} name="SONAR_TOKEN" demo={demo}/>}<div className="feature-line"><Github size={21}/><div><strong>GitHub token</strong><p>GitHub สร้างให้ workflow อัตโนมัติ ไม่ต้องกรอก</p></div><Check size={20}/></div><div className="notice"><LockKeyhole size={18}/> Keys เก็บใน GitHub Secrets ของ repo คุณ หลังบันทึกให้สร้างและ merge PR ติดตั้งเพื่อเริ่มใช้งาน</div></>}
      {step === 3 && <><div className="review-summary"><div><span>Repository</span><strong>{selected?.full_name}</strong></div><div><span>ชนิดโปรเจกต์</span><strong>{settings.projectType === 'angularjs' ? 'AngularJS 1.x' : 'JavaScript / Jest'}</strong></div>{settings.projectType === 'javascript' && <><div><span>Coverage</span><strong>{settings.coverage}%</strong></div><div><span>SonarCloud</span><strong>{settings.sonar ? 'เปิด' : 'ปิด'}</strong></div></>}</div><details><summary>ดูไฟล์ติดตั้ง</summary><div className="file-tabs">{Object.keys(files).map(name => <button className={name === file ? 'selected' : ''} key={name} onClick={() => setFile(name)}><Code2 size={14}/>{name.split('/').pop()}</button>)}</div><pre className="code-preview"><code>{files[file] || Object.values(files)[0]}</code></pre></details><p>หลังสร้าง PR ให้ตรวจและ merge ก่อน แล้วกลับมารีเฟรชสถานะ repository</p>{selected && <Installation key={`${selected.id}-${JSON.stringify(settings)}-${demo}`} repository={selected.full_name} demo={demo} settings={settings}/>}</>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </div><div className="modal-footer"><button className="secondary" onClick={() => step ? setStep(step - 1) : setModal(false)}>{step ? 'ย้อนกลับ' : 'ยกเลิก'}</button><div className="actions">{step === 3 ? null : <button className="primary" onClick={next}>ถัดไป <ChevronRight size={16}/></button>}</div></div></section></div>}
  </div>;
}

function Guide({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) { return <article className="guide-card"><h3>{title}</h3><p>{text}</p>{href && <a href={href} target="_blank" rel="noreferrer">{label} <ExternalLink size={15}/></a>}</article>; }





