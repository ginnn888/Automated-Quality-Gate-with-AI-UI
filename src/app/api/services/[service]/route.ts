import { matchesAccount } from '@/lib/account-request';
import { NextRequest, NextResponse } from 'next/server';
import { appUrl, unseal } from '@/lib/session';
import { clientFor } from '@/lib/preparation-github';
import { credentialSchema, saveRepositorySecret, sonarProjects, sonarSchema } from '@/lib/service-credentials';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ service: string }> }) {
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return json({ error: 'Send this request from the application.' }, 403);
  const token = await unseal(request.cookies.get('qg_session')?.value);
  if (!token) return json({ error: 'Sign in with GitHub again.' }, 401);
  const { service } = await context.params;
  if (!['secret', 'sonar'].includes(service)) return json({ error: 'Service not found.' }, 404);
  try {
    if (!await matchesAccount(token, request.headers.get('x-qg-user-id'))) return json({code:'ACCOUNT_CHANGED', error:'Your account changed. Reload this page to continue.'}, 409);
  } catch { return json({error:'Unable to verify your account. Please sign in again.'}, 401); }
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'The submitted data is too large.' }, 413);
    input = JSON.parse(raw);
    if (service === 'secret') credentialSchema.parse(input); else sonarSchema.parse(input);
  } catch { return json({ error: 'Complete all fields and check that the key contains no spaces.' }, 400); }
  try {
    return json(service === 'secret' ? await saveRepositorySecret(clientFor(token), input) : await sonarProjects(input));
  } catch {
    return json({ error: service === 'secret'
      ? 'Could not confirm the save. Grant the GitHub App read and write access to Secrets, approve the updated permissions, and try again.'
      : 'Could not read SonarCloud projects. Check the token, organization key and project access in the EU region.' }, 502);
  }
}
