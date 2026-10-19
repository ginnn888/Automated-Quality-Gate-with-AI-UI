import { z } from 'zod';
import angularTemplate from './workflow-templates/angularjs.json';

export const settingsSchema = z.object({
  projectType: z.enum(['javascript', 'angularjs']).default('javascript'),
  geminiModel: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/).default('gemini-3.1-flash-lite'),
  aiTimeout: z.number().int().min(10).max(180).default(90),
  coverage: z.number().int().min(1).max(100),
  sonar: z.boolean(),
  projectKey: z.string().max(200).regex(/^[a-zA-Z0-9_.:-]*$/),
  organization: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/),
}).refine(v => v.projectType !== 'angularjs' || !v.sonar, { message: 'AngularJS ยังไม่รองรับ SonarCloud' }).refine(v => !v.sonar || Boolean(v.projectKey && v.organization), { message: 'กรอก Project key และ Organization ของ SonarCloud' });
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { projectType: 'javascript', geminiModel: 'gemini-3.1-flash-lite', aiTimeout: 90, coverage: 80, sonar: false, projectKey: '', organization: '' };
export const engineRef = 'NonnaritRammaneekultawat-6609650459/test-github-marketplace@971b31492c474d0c6d3760b0606e6dd0a64a6c34';

export function installationFiles(input: Settings) {
  const s = settingsSchema.parse(input);
  if (s.projectType === 'angularjs') {
    const workflow = angularTemplate.workflow
      .replaceAll("${{ vars.GEMINI_MODEL || 'gemini-3.1-flash-lite' }}", JSON.stringify(s.geminiModel))
      .replaceAll("ai_timeout_seconds: '90'", `ai_timeout_seconds: '${s.aiTimeout}'`);
    return { '.github/workflows/quality-gate.yml': workflow } as Record<string, string>;
  }
  const workflow = `# Calls the upstream JavaScript Action; reports are produced by the Action.
name: Automated Quality Gate
on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: write
concurrency:
  group: quality-\${{ github.workflow }}-\${{ github.ref }}
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
        uses: ${engineRef}
        with:
          project_type: javascript
          gemini_api_key: \${{ secrets.GEMINI_API_KEY }}
          github_token: \${{ secrets.GITHUB_TOKEN }}
${s.sonar ? '          sonar_token: \${{ secrets.SONAR_TOKEN }}\n' : ''}`;
  const files: Record<string, string> = {
    '.github/workflows/quality-gate.yml': workflow,
    'config_cov.json': JSON.stringify({ global: s.coverage, files: {} }, null, 2),
  };
  if (s.sonar) files['sonar-project.properties'] = `sonar.projectKey=${s.projectKey}\nsonar.organization=${s.organization}\nsonar.sources=src\nsonar.javascript.lcov.reportPaths=coverage/lcov.info\n`;
  return files;
}

