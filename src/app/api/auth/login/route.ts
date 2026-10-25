import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { appUrl, configured, cookieOptions } from '@/lib/session';
export async function GET(request: NextRequest) {
  if (!configured()) return NextResponse.redirect(new URL('/?notice=setup', appUrl()));
  const state = randomBytes(32).toString('hex');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${appUrl()}/api/auth/callback`);
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  const response = NextResponse.redirect(url);
  response.cookies.set('qg_oauth_state', state, { ...cookieOptions, maxAge: 600 });
  const next = request.nextUrl.searchParams.get('next');
  response.cookies.set('qg_oauth_next', next === 'install' || next === 'return' ? next : 'connect', { ...cookieOptions, maxAge: 600 });
  return response;
}
