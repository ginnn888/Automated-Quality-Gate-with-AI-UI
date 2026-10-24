import Workspace from '@/components/workspace';
import { configured, sessionToken } from '@/lib/session';
import { identityFor } from '@/lib/identity';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const token = await sessionToken();
  if (!token) redirect('/login');
  const user = await identityFor(token).catch(() => null);
  if (!user) redirect('/login?notice=auth');
  return <Workspace key={user.id} user={user} connected configured={configured()} appSlug={process.env.GITHUB_APP_SLUG || ''} />;
}
