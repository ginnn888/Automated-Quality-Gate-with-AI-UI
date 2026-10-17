import { z } from 'zod';

export const settingsSchema = z.object({
  coverage: z.number().int().min(1).max(100),
  sonar: z.boolean(),
  projectKey: z.string().max(200).regex(/^[a-zA-Z0-9_.:-]*$/),
  organization: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/),
}).refine(v => !v.sonar || Boolean(v.projectKey && v.organization), { message: 'กรอก Project key และ Organization ของ SonarCloud' });
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { coverage: 80, sonar: false, projectKey: '', organization: '' };
export const engineRef = 'NonnaritRammaneekultawat-6609650459/test-github-marketplace@5ea12ad0ce2beed94a301785040e420de25f3095';

export function installationFiles(input: Settings) {
  const s = settingsSchema.parse(input);
  const workflow = `# Experimental installation: existing engine limitations still apply.
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
          node-version: '22'
      - id: dependencies
        run: npm ci
${s.sonar ? `      - name: SonarCloud Scan
        id: sonar
        continue-on-error: true
        uses: SonarSource/sonarqube-scan-action@v6
        env:
          SONAR_TOKEN: \${{ secrets.SONAR_TOKEN }}
` : ''}      - name: Run Automated Quality Gate
        id: engine
        uses: ${engineRef}
        with:
          gemini_api_key: \${{ secrets.GEMINI_API_KEY }}
          github_token: \${{ secrets.GITHUB_TOKEN }}
${s.sonar ? '          sonar_token: \${{ secrets.SONAR_TOKEN }}\n' : ''}      - name: Run summary
        if: always()
        env:
          DEPENDENCIES: \${{ steps.dependencies.outcome }}
          SONAR: \${{ steps.sonar.outcome }}
          ENGINE: \${{ steps.engine.outcome }}
        run: |
          echo '## Quality Gate execution' >> "$GITHUB_STEP_SUMMARY"
          echo "Dependencies: $DEPENDENCIES" >> "$GITHUB_STEP_SUMMARY"
          echo "Sonar scan: $SONAR" >> "$GITHUB_STEP_SUMMARY"
          echo "Existing AI engine: $ENGINE" >> "$GITHUB_STEP_SUMMARY"
          echo 'These are execution outcomes, not a guarantee of completed AI review. See step logs for errors.' >> "$GITHUB_STEP_SUMMARY"
      - name: Preserve Sonar failure
        if: always() && steps.sonar.outcome == 'failure'
        run: exit 1
`;
  const files: Record<string, string> = {
    '.github/workflows/quality-gate.yml': workflow,
    'config_cov.json': JSON.stringify({ global: s.coverage, files: {} }, null, 2),
  };
  if (s.sonar) files['sonar-project.properties'] = `sonar.projectKey=${s.projectKey}\nsonar.organization=${s.organization}\nsonar.sources=src\nsonar.javascript.lcov.reportPaths=coverage/lcov.info\n`;
  return files;
}

