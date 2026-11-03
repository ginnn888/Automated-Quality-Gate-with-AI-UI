import { identityFor } from './identity';

export async function matchesAccount(token: string, expected: string | null, identify = identityFor) {
  if (!expected || !/^[1-9]\d*$/.test(expected)) return false;
  return String((await identify(token)).id) === expected;
}
