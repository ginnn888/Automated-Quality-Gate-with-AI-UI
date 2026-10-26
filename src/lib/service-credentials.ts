import sodium from 'libsodium-wrappers';
import { z } from 'zod';
import type { GitHubClient } from './preparation-github';

export const credentialSchema = z.object({
  repository: z.string().max(210).regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/),
  name: z.enum(['GEMINI_API_KEY', 'AI_API_KEY', 'SONAR_TOKEN']),
  value: z.string().trim().min(10).max(512).regex(/^\S+$/),
}).strict();

export async function saveRepositorySecret(api: GitHubClient, input: z.infer<typeof credentialSchema>) {
  const { repository, name, value } = credentialSchema.parse(input);
  const prefix = `/repos/${repository}`;
  const repo = await api<{ archived: boolean; disabled: boolean; permissions?: { push?: boolean } }>(prefix);
  if (!repo.permissions?.push || repo.archived || repo.disabled) throw new Error('Repository unavailable');
  const key = await api<{ key: string; key_id: string }>(`${prefix}/actions/secrets/public-key`);
  await sodium.ready;
  const encrypted = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
  await api(`${prefix}/actions/secrets/${name}`, 'PUT', {
    encrypted_value: sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL), key_id: key.key_id,
  });
  return { saved: true, name };
}

export const sonarSchema = z.object({
  organization: z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/),
  token: z.string().trim().min(10).max(512).regex(/^\S+$/),
  page: z.number().int().min(1).max(100).default(1),
}).strict();
const sonarResponse = z.object({
  paging: z.object({ total: z.number().int().nonnegative() }),
  components: z.array(z.object({ key: z.string(), name: z.string() })),
});
export async function sonarProjects(input: z.input<typeof sonarSchema>, fetcher = fetch) {
  const { organization, token, page } = sonarSchema.parse(input);
  const query = new URLSearchParams({ organization, p: String(page), ps: '100' });
  const response = await fetcher(`https://sonarcloud.io/api/projects/search?${query}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('SonarCloud unavailable');
  const data = sonarResponse.parse(await response.json());
  return { projects: data.components.map(({ key, name }) => ({ key, name, organization })), nextPage: page * 100 < data.paging.total && page < 100 ? page + 1 : null };
}
