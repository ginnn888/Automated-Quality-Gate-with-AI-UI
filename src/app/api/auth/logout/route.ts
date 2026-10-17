import { NextRequest, NextResponse } from 'next/server';
import { appUrl } from '@/lib/session';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL('/', appUrl()), 303);
  response.cookies.delete('qg_session');
  return response;
}
