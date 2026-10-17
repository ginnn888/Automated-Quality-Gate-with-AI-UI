import { NextResponse } from 'next/server';
import { planPreparation } from '@/lib/preparation';
export async function GET() {
  return NextResponse.json({ repository: 'your-team/my-project', baseBranch: 'main', baseSha: '0'.repeat(40), digest: '0'.repeat(64), plan: planPreparation({ paths: ['src/math.js'], packageJson: null, packageLock: null }) });
}
