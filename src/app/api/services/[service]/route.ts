import { NextRequest, NextResponse } from 'next/server';
import { appUrl, sessionToken } from '@/lib/session';
import { clientFor } from '@/lib/preparation-github';
import { credentialSchema, saveRepositorySecret, sonarProjects, sonarSchema } from '@/lib/service-credentials';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ service: string }> }) {
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return json({ error: 'คำขอต้องมาจากหน้าเว็บนี้' }, 403);
  const token = await sessionToken();
  if (!token) return json({ error: 'กรุณาเข้าสู่ระบบ GitHub ใหม่' }, 401);
  const { service } = await context.params;
  if (!['secret', 'sonar'].includes(service)) return json({ error: 'ไม่พบบริการ' }, 404);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'ข้อมูลใหญ่เกินไป' }, 413);
    input = JSON.parse(raw);
    if (service === 'secret') credentialSchema.parse(input); else sonarSchema.parse(input);
  } catch { return json({ error: 'กรอกข้อมูลให้ครบและตรวจว่า key ไม่มีช่องว่าง' }, 400); }
  try {
    return json(service === 'secret' ? await saveRepositorySecret(clientFor(token), input) : await sonarProjects(input));
  } catch {
    return json({ error: service === 'secret'
      ? 'ยังยืนยันการบันทึกไม่ได้ ตรวจสิทธิ์ Secrets: Read and write ของ GitHub App และอนุมัติสิทธิ์ใหม่ แล้วลองอีกครั้ง'
      : 'อ่าน SonarCloud ไม่สำเร็จ ตรวจ token, Organization Key และสิทธิ์เข้าถึงโปรเจกต์ (รองรับภูมิภาค EU)' }, 502);
  }
}
