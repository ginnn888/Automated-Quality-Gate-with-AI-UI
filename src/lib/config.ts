import { z } from 'zod';
import { stringify } from 'yaml';

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
}).refine(v => v.aiProvider !== 'openai-compatible' || validApiUrl(v.aiApiUrl), { message: 'กรอก HTTPS API URL แบบเต็ม โดยไม่มี key, query หรือ workflow expression ใน URL' }).refine(v => !v.sonar || Boolean(v.projectKey && v.organization), { message: 'กรอก Project key และ Organization ของ SonarCloud' });

function validApiUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash && !/[\s\x00-\x1f\x7f]/.test(value) && !value.includes('${{');
  } catch { return false; }
}
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { projectType: 'javascript', aiProvider: 'gemini', aiApiUrl: '', geminiModel: 'gemini-3.1-flash-lite', aiTimeout: 90, coverage: 80, sonar: false, projectKey: '', organization: '' };
export const engineRef = 'NonnaritRammaneekultawat-6609650459/test-github-marketplace@f9a3080b7fb17580a8fb67e0fc8027fa9e12623a';
// Tested local Action commit. Installation verifies GitHub publication before creating a PR.
export const flexibleEngineRef = engineRef;
export const aiSecretName = (settings: Settings) => settings.aiProvider === 'openai-compatible' ? 'AI_API_KEY' as const : 'GEMINI_API_KEY' as const;

export function installationFiles(input: Settings) {
  const s = settingsSchema.parse(input);
  const uses = engineRef;
  const secret = aiSecretName(s);
  const identity = { project_type: s.projectType, test_source: 'generated' };
  const ai = s.aiProvider === 'gemini'
    ? { gemini_model: s.geminiModel }
    : { ai_provider: s.aiProvider, ai_api_url: s.aiApiUrl, ai_model: s.geminiModel };
  const token = '${{ github.token }}';
  const guard = "github.actor != 'github-actions[bot]' && github.actor != 'dependabot[bot]' && github.event.pull_request.head.repo.full_name == github.repository";
  const upload = (name: string, path: string) => ({ uses: 'actions/upload-artifact@v4', if: 'always()', with: { name, path, 'include-hidden-files': true, 'if-no-files-found': 'warn', 'retention-days': 7 } });
  const download = (name: string, path: string) => ({ uses: 'actions/download-artifact@v4', if: 'always()', 'continue-on-error': true, with: { name, path } });
  const workflow = {
    name: 'Automated Quality Gate',
    on: { pull_request_target: { types: ['opened', 'synchronize', 'reopened', 'ready_for_review'] } },
    permissions: {},
    concurrency: { group: 'quality-${{ github.workflow }}-pr-${{ github.event.pull_request.number }}', 'cancel-in-progress': true },
    jobs: {
      generate: { if: guard, 'runs-on': 'ubuntu-latest', 'timeout-minutes': 10,
        permissions: { contents: 'read', 'pull-requests': 'read' },
        steps: [{ name: 'Generate tests and review without executing PR code', uses,
          with: { ...identity, ...ai, phase: 'generate', [s.aiProvider === 'gemini' ? 'gemini_api_key' : 'ai_api_key']: '${{ secrets.' + secret + ' }}', github_token: token, ai_timeout_seconds: String(s.aiTimeout) } },
          upload('aq-generated-tests', '.aq-generated/') ] },
      checks: { needs: 'generate', if: 'always() && (' + guard + ')', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 15,
        permissions: { contents: 'read' },
        steps: [ { uses: 'actions/checkout@v4', with: { repository: '${{ github.event.pull_request.head.repo.full_name }}', ref: '${{ github.event.pull_request.head.sha }}', 'persist-credentials': false } },
          { uses: 'actions/setup-node@v4', with: { 'node-version': '24' } },
          { id: 'install', run: 'npm ci --ignore-scripts', 'continue-on-error': true },
          download('aq-generated-tests', '.aq-generated'),
          { name: 'Run tests and measure coverage without AI keys or write permissions', uses, if: 'always()', with: { ...identity, phase: 'checks', install_status: '${{ steps.install.outcome }}' } },
          upload('quality-gate-results', '.gate-state.json\ncoverage/') ] },
      ...(s.sonar ? { sonar: { needs: 'checks', if: 'always() && (' + guard + ')', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 10,
        permissions: { contents: 'read' },
        steps: [
          { uses: 'actions/checkout@v4', with: { ref: '${{ github.event.pull_request.head.sha }}', 'persist-credentials': false, 'fetch-depth': 0 } },
          download('quality-gate-results', '.'),
          { name: 'SonarCloud Scan', uses: 'SonarSource/sonarqube-scan-action@v6', env: { SONAR_TOKEN: '${{ secrets.SONAR_TOKEN }}' },
            with: { args: [
              '-Dproject.settings=/dev/null',
              '-Dsonar.host.url=https://sonarcloud.io', '-Dsonar.projectKey=' + s.projectKey, '-Dsonar.organization=' + s.organization,
              '-Dsonar.sources=src', '-Dsonar.exclusions=src/**/*.test.js,src/**/*.spec.js,src/**/*.test.cjs,src/**/*.spec.cjs',
              '-Dsonar.javascript.lcov.reportPaths=' + (s.projectType === 'angularjs' ? 'coverage/quality-gate/lcov.info' : 'coverage/lcov.info'),
              '-Dsonar.scm.revision=${{ github.event.pull_request.head.sha }}',
              '-Dsonar.pullrequest.key=${{ github.event.pull_request.number }}',
              '-Dsonar.pullrequest.branch=${{ github.event.pull_request.head.ref }}',
              '-Dsonar.pullrequest.base=${{ github.event.pull_request.base.ref }}',
              '-Dsonar.scanner.metadataFilePath=.scannerwork/report-task.txt',
            ].join('\n') } },
          upload('quality-gate-sonar', '.scannerwork/report-task.txt'),
        ] } } : {}),
      report: { needs: ['generate', 'checks', ...(s.sonar ? ['sonar'] : [])], if: 'always() && (' + guard + ')', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 5,
        permissions: { contents: 'write', 'pull-requests': 'write', checks: 'write' },
        steps: [ download('aq-generated-tests', '.aq-generated'), download('quality-gate-results', '.'), ...(s.sonar ? [download('quality-gate-sonar', '.aq-sonar')] : []),
          { name: 'Save tests to PR and publish results', uses, with: { ...identity, ...ai, phase: 'report', github_token: token, persist_tests: 'true', report_only: 'false', ...(s.sonar ? { sonar_token: '${{ secrets.SONAR_TOKEN }}', sonar_project_key: s.projectKey, sonar_scan_status: '${{ needs.sonar.result }}' } : {}) } } ] },
    },
  };
  const files: Record<string, string> = {
    '.github/workflows/quality-gate.yml': '# PR code only executes in the read-only checks job.\n' + stringify(workflow),
    'config_cov.json': JSON.stringify({ global: s.coverage, files: {} }, null, 2) + '\n',
  };
  if (s.sonar) files['sonar-project.properties'] = 'sonar.projectKey=' + s.projectKey + '\nsonar.organization=' + s.organization + '\nsonar.host.url=https://sonarcloud.io\nsonar.sources=src\nsonar.exclusions=src/**/*.test.js,src/**/*.spec.js,src/**/*.test.cjs,src/**/*.spec.cjs\nsonar.javascript.lcov.reportPaths=' + (s.projectType === 'angularjs' ? 'coverage/quality-gate/lcov.info' : 'coverage/lcov.info') + '\n';
  return files;
}
