'use client';

import { useState } from 'react';
import { Check, ExternalLink, FileCode2, GitPullRequest, LoaderCircle } from 'lucide-react';
import type { Settings } from '@/lib/config';
import type { PreparationPreview } from '@/lib/preparation-github';

export default function Installation({ repository, demo, settings }: { repository: string; demo: boolean; settings: Settings }) {
  const [preview, setPreview] = useState<PreparationPreview | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'create' | null>(null);
  const [error, setError] = useState('');
  const [pull, setPull] = useState<{ url: string; number: number } | null>(null);
  async function install() {
    if (demo || busy) return;
    setBusy('inspect'); setError(''); setPreview(null); setPull(null);
    try {
      const response = await fetch('/api/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'install', repository, settings }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview(data.preview); setPull(data.pull);
    } catch (e) { setError(e instanceof Error ? e.message : 'ติดตั้งไม่สำเร็จ'); }
    finally { setBusy(null); }
  }
  return <section className="preparation" aria-label="ติดตั้ง Quality Gate">
    <div className="preparation-heading"><div><h3><FileCode2 size={19}/> ติดตั้ง Quality Gate</h3><p>กด Install เพื่อให้ระบบตรวจและรวมไฟล์ที่จำเป็นใน PR เดียว แล้วตรวจและ merge บน GitHub</p></div><button className="primary" onClick={install} disabled={demo || Boolean(busy) || Boolean(pull)}>{busy ? <LoaderCircle size={16} className="spin"/> : <GitPullRequest size={16}/>} {busy ? 'กำลังตรวจไฟล์และสร้าง PR…' : 'Install / อัปเดต'}</button></div>
    {demo && <p className="preparation-caption">โหมดตัวอย่างไม่สร้าง PR ติดตั้ง / อัปเดต กรุณาเชื่อมต่อ GitHub เพื่อใช้งานจริง</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="preparation-result" aria-live="polite">
      <strong>{preview.plan.status === 'ready' ? 'ไฟล์ติดตั้งตรงกับค่าที่เลือกแล้ว' : preview.plan.status === 'blocked' ? 'ต้องปรับการตั้งค่าโปรเจกต์ก่อน' : `เตรียม ${preview.plan.files.length} ไฟล์ใน PR`}</strong>
      {preview.plan.files.map(file => <details className="preparation-file" key={file.path}><summary><span>{file.before === null ? 'เพิ่ม' : 'แก้ไข'}</span> {file.path}</summary>{file.before !== null && <><p>เนื้อหาเดิม</p><pre className="code-preview"><code>{file.before}</code></pre></>}<p>เนื้อหาที่เสนอ</p><pre className="code-preview"><code>{file.after}</code></pre></details>)}
      <ul>{preview.plan.messages.map(m => <li key={m}>{m}</li>)}</ul>
      {pull && <div className="preparation-success"><Check size={19}/><div><strong>สร้าง PR #{pull.number} แล้ว — รอคุณตรวจและ merge</strong><a href={pull.url} target="_blank" rel="noreferrer">เปิด Pull Request <ExternalLink size={15}/></a><p>หลัง merge ดูผลที่แท็บ Actions แล้วเปิด PR แก้โค้ดใน src/ เพื่อทดสอบการรายงานใน PR</p></div></div>}
    </div>}
  </section>;
}
