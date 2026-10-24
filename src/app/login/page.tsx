import { Github, ShieldCheck } from 'lucide-react';
import { configured, sessionToken } from '@/lib/session';
import { identityFor } from '@/lib/identity';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const token = await sessionToken();
  const user = token ? await identityFor(token).catch(() => null) : null;
  return <main className="login-page"><section className="login-panel">
    <a className="brand" href="/login"><span className="brand-icon"><ShieldCheck size={26}/></span><span>Quality Gate<small>AI-powered code review</small></span></a>
    <h1>เริ่มต้นด้วยบัญชี<br/>GitHub ของคุณ</h1>
    <p>เลือก repository ของคุณ แล้วให้ AI ช่วยตรวจโค้ด สร้างเทสต์ และรายงานผลใน Pull Request</p>
    {notice === 'auth' && <p role="alert" className="notice">ยืนยันบัญชีไม่ได้ หรือ session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง</p>}
    {notice === 'logout' && <p role="status" className="notice">ออกจากระบบ Quality Gate แล้ว</p>}
    {user ? <div className="login-current"><p>ขณะนี้เข้าสู่ระบบเป็น <strong>@{user.login}</strong></p><a className="primary" href="/">ไปที่ repositories</a><form action="/api/auth/logout" method="post"><button className="text-button">ออกจากระบบเพื่อเปลี่ยนบัญชี</button></form></div> : configured() ? <a className="primary login-cta" href="/api/auth/login"><Github size={20}/> เข้าสู่ระบบด้วย GitHub</a> : <p role="alert" className="notice">บริการเข้าสู่ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง</p>}
    <div className="login-help"><h2>ต้องการใช้บัญชีอื่น?</h2><p>ตรวจบัญชีที่ <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a> แล้วเปลี่ยนเป็นบัญชีของคุณก่อนกดเข้าสู่ระบบ หรือเปิดเว็บนี้ในหน้าต่างไม่ระบุตัวตน</p><small>การออกจาก Quality Gate ไม่ได้ออกจาก GitHub ด้วย เว็บจะแสดง repo ที่บัญชีคุณมีสิทธิ์และอนุญาตให้แอปเข้าถึง</small></div>
  </section></main>;
}
