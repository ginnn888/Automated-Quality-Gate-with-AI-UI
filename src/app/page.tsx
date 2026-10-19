import Workspace from '@/components/workspace';
import { configured, sessionToken } from '@/lib/session';
export const dynamic = 'force-dynamic';
export default async function Page() {
  return <Workspace connected={Boolean(await sessionToken())} configured={configured()} appSlug={process.env.GITHUB_APP_SLUG || ''} />;
}
