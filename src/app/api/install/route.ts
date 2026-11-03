import { matchesAccount } from '@/lib/account-request';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appUrl, unseal } from '@/lib/session';
import { clientFor, PreparationError } from '@/lib/preparation-github';
import { settingsSchema } from '@/lib/config';
import { createInstallation, inspectInstallation, installOnce } from '@/lib/installation';
import { GitHubError, githubFailure } from '@/lib/github';

export const runtime = 'nodejs';
const schema = z.object({ repository: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/).max(210), settings: settingsSchema, action: z.enum(['inspect', 'create', 'install']), baseSha: z.string().regex(/^[a-f0-9]{40}$/).optional(), digest: z.string().regex(/^[a-f0-9]{64}$/).optional() });
export async function POST(request: NextRequest) {
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return json({ error: 'คำขอต้องมาจากหน้าเว็บนี้' }, 403);
  const token = await unseal(request.cookies.get('qg_session')?.value);
  if (!token) return json({ error: 'กรุณาเข้าสู่ระบบ GitHub ก่อน' }, 401);
  try {
    if (!await matchesAccount(token, request.headers.get('x-qg-user-id'))) return json({code:'ACCOUNT_CHANGED', error:'บัญชีเปลี่ยน กรุณาโหลดหน้าใหม่ก่อนทำรายการ'}, 409);
  } catch { return json({error:'ยืนยันบัญชีไม่ได้ กรุณาเข้าสู่ระบบใหม่'}, 401); }
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'ข้อมูลคำขอใหญ่เกินไป' }, 413);
    input = schema.parse(JSON.parse(raw));
  } catch { return json({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }
  try {
    const api = clientFor(token);
    if (input.action === 'install') return json(await installOnce(api, input.repository, input.settings));
    if (input.action === 'create') {
      if (!input.baseSha || !input.digest) return json({ error: 'ตรวจไฟล์ก่อนสร้าง PR' }, 400);
      return json(await createInstallation(api, input.repository, input.settings, input.baseSha, input.digest));
    }
    const { treeSha: _tree, ...preview } = await inspectInstallation(api, input.repository, input.settings);
    return json(preview);
  } catch (error) {
    if (error instanceof PreparationError) return json({ error: error.message }, error.status);
    if (error instanceof GitHubError) return json({ error: githubFailure(error) }, error.status === 401 ? 401 : 502);
    return json({ error: 'ติดตั้งไม่สำเร็จ ลองตรวจไฟล์อีกครั้ง' }, 502);
  }
}
