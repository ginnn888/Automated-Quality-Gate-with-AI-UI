import { github } from './github';
export type Identity = { id: number; login: string; name: string | null; avatar_url: string };
export async function identityFor(token: string): Promise<Identity> {
  const user = await github<Identity>(token, '/user');
  if (!Number.isSafeInteger(user.id) || !user.login) throw new Error('Invalid GitHub identity');
  return { id: user.id, login: user.login, name: user.name, avatar_url: `https://avatars.githubusercontent.com/u/${user.id}?s=80` };
}
