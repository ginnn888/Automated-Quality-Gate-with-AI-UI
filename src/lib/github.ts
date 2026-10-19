export class GitHubError extends Error {
  constructor(public status: number, public operation = '', public reason = '', public requestId = '') { super(`GitHub request failed (${status})`); }
}
export function githubFailure(error: GitHubError) {
  return `GitHub HTTP ${error.status}${error.operation ? ` — ${error.operation}` : ''}: ${error.reason || (error.status === 401 ? 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' : error.status === 404 ? 'ไม่พบข้อมูลหรือ token เข้าถึงไม่ได้' : error.status === 422 ? 'GitHub ไม่รับข้อมูลที่ส่งหรือสถานะ branch ขัดแย้ง' : 'GitHub ปฏิเสธคำขอ ยังระบุสาเหตุไม่ได้')}${error.requestId ? ` (Request ID: ${error.requestId})` : ''}`;
}
export async function github<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    // Never return upstream bodies, request payloads, or credentials to the UI.
    const data = await response.json().catch(() => ({}));
    const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
    const reason = message.includes('workflow') ? 'GitHub ปฏิเสธการเขียน workflow ด้วย token ที่เว็บใช้อยู่'
      : message.includes('rate limit') ? 'เกินขีดจำกัดการเรียก GitHub API กรุณารอแล้วลองใหม่'
      : message.includes('resource not accessible') ? 'token ที่เว็บใช้อยู่เข้าถึงการทำงานนี้ไม่ได้ แม้หน้าตั้งค่า App อาจมีสิทธิ์แล้ว'
      : message.includes('rules') || message.includes('protected') ? 'กฎของ repository ปฏิเสธการเปลี่ยนแปลงนี้'
      : message.includes('bad credentials') ? 'GitHub token ใช้งานไม่ได้ กรุณาเข้าสู่ระบบใหม่'
      : message.includes('empty') ? 'GitHub แจ้งว่า repository ยังว่าง'
      : '';
    const operation = path.includes('/pulls') ? (method === 'POST' ? 'สร้าง Pull Request' : 'ค้นหา Pull Request เดิม')
      : path.endsWith('/git/refs') ? 'สร้าง branch'
      : path.includes('/git/ref/') ? 'อ่าน branch'
      : path.includes('/git/trees') ? (method === 'POST' ? 'เตรียมชุดไฟล์' : 'อ่านรายการไฟล์')
      : path.includes('/git/commits') ? (method === 'POST' ? 'สร้าง commit' : 'อ่าน commit')
      : path.includes('/actions/secrets') ? 'เข้าถึง Secrets'
      : 'อ่านข้อมูล GitHub';
    const id = response.headers.get('x-github-request-id') || '';
    throw new GitHubError(response.status, operation, reason, /^[A-Za-z0-9:-]{1,100}$/.test(id) ? id : '');
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}
export type Repository = { id: number; full_name: string; description: string | null; private: boolean; default_branch: string; language: string | null; html_url: string; installation?: 'active' | 'missing' | 'incomplete' | 'unknown'; run?: { conclusion: string | null; status: string; html_url: string } };
