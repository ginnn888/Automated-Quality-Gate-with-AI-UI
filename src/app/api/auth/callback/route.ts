import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { appUrl, cookieOptions, seal } from '@/lib/session';
export async function GET(request: NextRequest) {
  const expected = request.cookies.get('qg_oauth_state')?.value;
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const fail = () => {
    const res = NextResponse.redirect(new URL('/?notice=auth', appUrl()));
    res.cookies.delete('qg_oauth_state');
    res.cookies.delete('qg_oauth_next');
    return res;
  };
  if (!expected || !state || !code || !/^[a-f0-9]{64}$/.test(state) || expected.length !== state.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(state))) return fail();
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${appUrl()}/api/auth/callback` }), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.access_token) return fail();
    const next = request.cookies.get('qg_oauth_next')?.value;
    const mode = next === 'install' || next === 'return' ? next : 'connect';
    const result = NextResponse.redirect(new URL(`/api/github/${mode}`, appUrl()));
    result.cookies.set('qg_session', await seal(data.access_token), { ...cookieOptions, maxAge: 3600 });
    result.cookies.delete('qg_oauth_state');
    result.cookies.delete('qg_oauth_next');
    return result;
  } catch { return fail(); }
}
