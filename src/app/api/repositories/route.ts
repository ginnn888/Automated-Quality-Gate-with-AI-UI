import { NextRequest, NextResponse } from 'next/server';
import { unseal } from '@/lib/session';
import { identityFor } from '@/lib/identity';
import { GitHubError, github, type Repository } from '@/lib/github';
import { clientFor } from '@/lib/preparation-github';
import { withInstallationStatuses } from '@/lib/installation-status';
export async function GET(request: NextRequest) {
  const token = await unseal(request.cookies.get('qg_session')?.value);
  if (!token) return NextResponse.json({ error: 'กรุณาเชื่อมต่อ GitHub อีกครั้ง' }, { status: 401 });
  try {
    const user = await identityFor(token);
    const repos = new Map<number, Repository>();
    for (let page = 1; ; page++) {
      const list = await github<Repository[]>(token, `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`);
      if (!Array.isArray(list) || list.length === 0) break;
      for (const repo of list) {
        repos.set(repo.id, repo);
      }
      if (list.length < 100) break;
    }
    const listed = [...repos.values()].map(r => ({ id: r.id, full_name: r.full_name, description: r.description, private: r.private, default_branch: r.default_branch, language: r.language, html_url: r.html_url }));
    return NextResponse.json({ userId: user.id, repositories: await withInstallationStatuses(clientFor(token), listed) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (error) { return NextResponse.json({ error: 'อ่าน repo ไม่สำเร็จ กรุณาตรวจสิทธิ์ GitHub App หรือเข้าสู่ระบบใหม่' }, { status: error instanceof GitHubError && error.status === 401 ? 401 : 502, headers: { 'Cache-Control': 'private, no-store' } }); }
}
