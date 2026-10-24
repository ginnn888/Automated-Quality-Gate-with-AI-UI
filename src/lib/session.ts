import { EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
export function configured() {
  return configurationIssues().length === 0;
}
export function configurationIssues(): string[] {
  const issues: string[] = [];
  for (const name of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_SLUG']) {
    if (!process.env[name]?.trim()) issues.push(`ยังไม่มีค่า ${name}`);
  }
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) issues.push('SESSION_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร');
  return issues;
}
function key() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Missing session configuration');
  return createHash('sha256').update(process.env.SESSION_SECRET).digest();
}
export async function seal(token: string) {
  return new EncryptJWT({ token }).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setIssuedAt().setExpirationTime('1h').encrypt(key());
}
export async function sessionToken() {
  const value = (await cookies()).get('qg_session')?.value;
  return unseal(value);
}
export async function unseal(value: string | undefined) {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, key());
    return typeof payload.token === 'string' ? payload.token : null;
  } catch { return null; }
}
export function appUrl() { return process.env.APP_URL || 'http://localhost:3000'; }
