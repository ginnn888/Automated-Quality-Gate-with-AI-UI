import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Quality Gate — AI code quality', description: 'เชื่อมต่อ GitHub และตั้งค่าการตรวจคุณภาพโค้ดด้วย AI' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="th"><body>{children}</body></html>; }
