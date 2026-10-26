import { z } from 'zod';
import angularTemplate from './workflow-templates/angularjs.json';

export const settingsSchema = z.object({
  projectType: z.enum(['javascript', 'angularjs']).default('javascript'),
  aiProvider: z.enum(['gemini', 'openai-compatible']).default('gemini'),
  aiApiUrl: z.string().max(2000).default(''),
  geminiModel: z.string().trim().min(1).max(200).regex(/^[^\s\x00-\x1f\x7f]+$/).refine(v => !v.includes('${{'), 'ชื่อโมเดลต้องไม่มี workflow expression').default('gemini-3.1-flash-lite'),
  aiTimeout: z.number().int().min(10).max(180).default(90),
  coverage: z.number().int().min(1).max(100),
  sonar: z.boolean(),
  projectKey: z.string().max(200).regex(/^[a-zA-Z0-9_.:-]*$/),
  organization: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/),
}).refine(v => v.aiProvider !== 'openai-compatible' || validApiUrl(v.aiApiUrl), { message: 'กรอก HTTPS API URL แบบเต็ม โดยไม่มี key, query หรือ workflow expression ใน URL' }).refine(v => v.projectType !== 'angularjs' || !v.sonar, { message: 'AngularJS ยังไม่รองรับ SonarCloud' }).refine(v => !v.sonar || Boolean(v.projectKey && v.organization), { message: 'กรอก Project key และ Organization ของ SonarCloud' });

function validApiUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash && !/[\s\x00-\x1f\x7f]/.test(value) && !value.includes('${{');
  } catch { return false; }
}
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { projectType: 'javascript', aiProvider: 'gemini', aiApiUrl: '', geminiModel: 'gemini-3.1-flash-lite', aiTimeout: 90, coverage: 80, sonar: false, projectKey: '', organization: '' };
export const engineRef = 'NonnaritRammaneekultawat-6609650459/test-github-marketplace@aa02584e5fe1b41af88b6a2091302484920e2915';
// Tested local Action commit. Installation verifies GitHub publication before creating a PR.
export const flexibleEngineRef = 'NonnaritRammaneekultawat-6609650459/test-github-marketplace@3d88cb218b4fa1ea2db009ab1531b9c332b52ffe';
export const aiSecretName = (settings: Settings) => settings.aiProvider === 'openai-compatible' ? 'AI_API_KEY' as const : 'GEMINI_API_KEY' as const;

export function installationFiles(input: Settings) {
  const s = settingsSchema.parse(input);
  if (s.projectType === 'angularjs') {
    let workflow = angularTemplate.workflow
      .replaceAll("${{ vars.GEMINI_MODEL || 'gemini-3.1-flash-lite' }}", JSON.stringify(s.geminiModel))
      .replaceAll("ai_timeout_seconds: '90'", `ai_timeout_seconds: '${s.aiTimeout}'`);
    if (s.aiProvider === 'openai-compatible') {
      workflow = workflow.replaceAll(engineRef, flexibleEngineRef)
        .replaceAll('gemini_api_key: ${{ secrets.GEMINI_API_KEY }}', 'ai_api_key: ${{ secrets.AI_API_KEY }}')
        .replaceAll(`gemini_model: ${JSON.stringify(s.geminiModel)}`, `ai_provider: openai-compatible\n          ai_api_url: ${JSON.stringify(s.aiApiUrl)}\n          ai_model: ${JSON.stringify(s.geminiModel)}`);
    }
    return { '.github/workflows/quality-gate.yml': workflow } as Record<string, string>;
  }
  const workflow = `# Calls the upstream JavaScript Action; reports are produced by the Action.
name: Automated Quality Gate
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
permissions:
  contents: read
  pull-requests: write
concurrency:
  group: quality-\${{ github.workflow }}-pr-\${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  quality:
    if: github.actor != 'dependabot[bot]' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - id: dependencies
        run: npm ci
${s.sonar ? `      - name: SonarCloud Scan
        if: always()
        uses: SonarSource/sonarqube-scan-action@v6
        env:
          SONAR_TOKEN: \${{ secrets.SONAR_TOKEN }}
` : ''}      - name: Run Automated Quality Gate
        if: always()
        uses: ${s.aiProvider === 'openai-compatible' ? flexibleEngineRef : engineRef}
        with:
          project_type: javascript
${s.aiProvider === 'openai-compatible' ? `          ai_provider: openai-compatible
          ai_api_url: ${JSON.stringify(s.aiApiUrl)}
          ai_model: ${JSON.stringify(s.geminiModel)}
          ai_api_key: \${{ secrets.AI_API_KEY }}
` : `          gemini_model: ${JSON.stringify(s.geminiModel)}
          gemini_api_key: \${{ secrets.GEMINI_API_KEY }}
`}          ai_timeout_seconds: '${s.aiTimeout}'
          github_token: \${{ secrets.GITHUB_TOKEN }}
${s.sonar ? '          sonar_token: \${{ secrets.SONAR_TOKEN }}\n' : ''}`;
  const files: Record<string, string> = {
    '.github/workflows/quality-gate.yml': workflow,
    'config_cov.json': JSON.stringify({ global: s.coverage, files: {} }, null, 2),
  };
  if (s.sonar) files['sonar-project.properties'] = `sonar.projectKey=${s.projectKey}\nsonar.organization=${s.organization}\nsonar.sources=src\nsonar.javascript.lcov.reportPaths=coverage/lcov.info\n`;
  return files;
}

