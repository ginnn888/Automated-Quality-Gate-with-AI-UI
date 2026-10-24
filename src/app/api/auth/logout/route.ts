import { NextRequest, NextResponse } from 'next/server';
import { appUrl } from '@/lib/session';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL('/login?notice=logout', appUrl()), 303);
  for (const name of ['qg_session', 'qg_oauth_state', 'qg_oauth_next']) response.cookies.delete(name);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
