import type { RealRole, Role, Session } from '../api/types';

/** A branch manager is the plain MANAGER of the tests; pass realRole to test the other tiers. */
const DEFAULT_REAL_ROLE: Record<Role, RealRole> = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', EMPLOYEE: 'EMPLOYEE' };

/** A complete session for tests: the tier decides the exact role unless one is given. */
export function testSession(role: Role, over: Partial<Session> = {}): Session {
  return { token: 't', username: 'u', role, realRole: DEFAULT_REAL_ROLE[role], ...over };
}
