import { NextResponse } from 'next/server';
import { appUrl, configured, sessionToken } from '@/lib/session';
import { connectionDestination } from '@/lib/github-connection';
import { GitHubError } from '@/lib/github';

export async function GET(_request: Request, context: { params: Promise<{ mode: string }> }) {
  const { mode } = await context.params;
  if (!['connect', 'install', 'return'].includes(mode)) return new NextResponse(null, { status: 404 });
  if (!configured()) return NextResponse.redirect(new URL('/?notice=setup', appUrl()));
  try {
    const target = await connectionDestination(await sessionToken(), process.env.GITHUB_APP_SLUG!, mode as 'connect' | 'install' | 'return');
    return NextResponse.redirect(new URL(target, appUrl()));
  } catch (error) {
    const notice = error instanceof GitHubError && error.status === 401 ? 'auth' : 'github-error';
    const response = NextResponse.redirect(new URL(`/?notice=${notice}`, appUrl()));
    if (notice === 'auth') response.cookies.delete('qg_session');
    return response;
  }
}
