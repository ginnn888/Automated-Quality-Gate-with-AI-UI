import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/session';
import { github, type Repository } from '@/lib/github';
export async function GET() {
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'กรุณาเชื่อมต่อ GitHub อีกครั้ง' }, { status: 401 });
  try {
    const repos = new Map<number, Repository>();
    for (let page = 1; ; page++) {
      const data = await github<{ installations: { id: number }[] }>(token, `/user/installations?per_page=100&page=${page}`);
      for (const installation of data.installations) {
        for (let rp = 1; ; rp++) {
          const list = await github<{ repositories: Repository[] }>(token, `/user/installations/${installation.id}/repositories?per_page=100&page=${rp}`);
          list.repositories.forEach(repo => repos.set(repo.id, repo));
          if (list.repositories.length < 100) break;
        }
      }
      if (data.installations.length < 100) break;
    }
    return NextResponse.json({ repositories: [...repos.values()].map(r => ({ id: r.id, full_name: r.full_name, description: r.description, private: r.private, default_branch: r.default_branch, language: r.language, html_url: r.html_url })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'อ่าน repo ไม่สำเร็จ กรุณาตรวจสิทธิ์ GitHub App หรือเข้าสู่ระบบใหม่' }, { status: 502 }); }
}
