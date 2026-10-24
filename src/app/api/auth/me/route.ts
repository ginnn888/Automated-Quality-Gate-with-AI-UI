import { NextRequest, NextResponse } from 'next/server';
import { unseal } from '@/lib/session';
import { identityFor } from '@/lib/identity';
import { GitHubError } from '@/lib/github';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  const token = await unseal(request.cookies.get('qg_session')?.value);
  if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers });
  try { return NextResponse.json({ user: await identityFor(token) }, { headers }); }
  catch (error) { return NextResponse.json({ error: 'ยืนยันบัญชีไม่ได้' }, { status: error instanceof GitHubError && error.status === 401 ? 401 : 503, headers }); }
}
