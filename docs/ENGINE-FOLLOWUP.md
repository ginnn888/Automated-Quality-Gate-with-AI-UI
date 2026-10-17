# Action compatibility — follow-up, not changed in this project

Inspected 2026-10-16 at commit `5ea12ad0ce2beed94a301785040e420de25f3095` in NonnaritRammaneekultawat-6609650459/test-github-marketplace.

User decision: implement the website first; revisit the engine together later. No engine changes, repository mutations, PR creation, secret uploads or remote pushes were made.

## Observed in generate-tests.js

- `fetchSonarCloudResults()` defaults `passed` to false and returns it when no token exists. Final success requires `summary.sonar?.passed !== false`, so the optional service can fail the whole gate.
- `getModifiedFiles()` compares `origin/${GITHUB_BASE_REF || 'main'}...HEAD`. A push to main can compare the current commit to itself. Use event-specific base/head SHAs and handle new branches, deleted files and manual dispatch.
- Only src/ is scanned and Jest is invoked. This is not a universal language/test-runner integration.
- `Test/` is removed recursively before generated tests are written. Avoid colliding with users' existing test directories.
- Coverage uses truthy fallbacks and per-file validation only for files present in the report. Validate missing coverage and explicit thresholds.
- Sonar analysis ordering must be revisited: the current UI preview scans before AI-generated coverage exists. Use prepare -> scan -> report with a supported public Action interface, wait for the actual analysis task rather than a potentially stale project result.
- Verify dist/index.js matches the source and rebuild/publish a tested immutable release before updating the UI reference.

## Before enabling installation

1. Fix and test engine behavior on PR, push, merge, no source changes, missing/invalid key and optional Sonar.
2. Implement server-side installation authorization using user/app intersection; validate repo access again on each mutation.
3. Use GitHub repository public-key sealed-box encryption to upload secrets. Never store raw keys in logs, localStorage or database.
4. Read existing files, show conflicts, create a unique branch and atomic Git tree commit, then a PR. Handle partial secret writes and retry without duplicating PRs.
5. Track pending PR vs merged install vs removed workflow. Do not treat GitHub App authorization as a completed Quality Gate installation.
6. Add installation webhooks with signature verification and deduplication or authenticated API polling; surface API failures instead of displaying fabricated success.
7. Run end-to-end tests with a dedicated repository and actual GitHub App credentials. Configure required status checks separately if merging must be blocked.

The `/api/install` route intentionally returns 409 without parsing credentials. Downloaded files are labeled previews and must not be treated as deployable until these issues are resolved.
