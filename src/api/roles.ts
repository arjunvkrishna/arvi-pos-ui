import type { RealRole, Role, Session } from './types';

/** Owners are ADMIN, general managers and branch managers are MANAGER, everyone else is EMPLOYEE: exactly how the server's rules read them. */
export function tierOf(role: string): Role {
  switch (role) {
    case 'SUPER_ADMIN': case 'ADMIN': case 'CAFE_ADMIN': return 'ADMIN';
    case 'GENERAL_MANAGER': case 'MANAGER': return 'MANAGER';
    default: return 'EMPLOYEE';
  }
}

/** Turns what the server sent (role = the exact role) into a Session (role = tier, realRole = the exact role). */
export function normalizeSession(raw: Record<string, unknown>): Session {
  const real = String(raw.role ?? 'EMPLOYEE').toUpperCase() as RealRole;
  const session = { ...(raw as object), role: tierOf(real), realRole: real, platform: real === 'SUPER_ADMIN' } as Session;
  // Owners and general managers start in their home branch (they can switch to another or to "All branches" from the top bar).
  session.selectedOutletId = isCafeWide(session) ? (session.outletId ?? null) : null;
  return session;
}

/** Same for a partial update (a token refresh answers with the full login response). */
export function normalizePatch(raw: Record<string, unknown>): Partial<Session> {
  if (typeof raw.role !== 'string') return raw as Partial<Session>;
  // a refresh keeps the branch the person picked: only the login response itself starts in the home branch
  const next = normalizeSession(raw);
  delete next.selectedOutletId;
  return next;
}

/** The chain of command, as the server ranks it: owner > general manager > branch manager > staff. */
export const RANK: Record<RealRole, number> = { SUPER_ADMIN: 100, ADMIN: 80, CAFE_ADMIN: 80, GENERAL_MANAGER: 60, MANAGER: 40, CASHIER: 10, CAPTAIN: 10, KITCHEN: 10, EMPLOYEE: 10 };

/** May this person create, change or deactivate someone of that role? Only people strictly below them; owners may manage owners. */
export function outranks(u: Pick<Session, 'realRole'>, target: RealRole): boolean {
  const owner = (r: RealRole) => r === 'ADMIN' || r === 'CAFE_ADMIN';
  return target !== 'SUPER_ADMIN' && (RANK[u.realRole] > RANK[target] || (owner(u.realRole) && owner(target)));
}

/** Owner and general manager run every branch; a branch manager and staff work in one. */
export const isCafeWide = (u: Session) => u.realRole === 'ADMIN' || u.realRole === 'CAFE_ADMIN' || u.realRole === 'GENERAL_MANAGER';
export const isOwner = (u: Session) => u.realRole === 'ADMIN' || u.realRole === 'CAFE_ADMIN';
/** Owner, general manager and branch manager. */
export const isManagement = (u: Session) => u.role !== 'EMPLOYEE';

/** Cancelling or voiding an order that is not yet paid: managers always, staff when a manager gave them the right. */
export const canCancelOrder = (u: Session) => isManagement(u) || u.canCancelOrder === true;
/** Dishes, add-ons and combos are shared by every branch, so changing them is a right of its own. */
export const canManageMenu = (u: Session) => isCafeWide(u) || u.canManageMenu === true;
/** Own-branch settings: branch profile, printers, receipt text, the branch's payment QR. */
export const canManageBranchSettings = (u: Session) => isCafeWide(u) || u.realRole === 'MANAGER' || u.canManageSettings === true;

const LABELS: Record<RealRole, string> = {
  SUPER_ADMIN: 'Platform owner', ADMIN: 'Owner', CAFE_ADMIN: 'Cafe admin', GENERAL_MANAGER: 'General manager', MANAGER: 'Branch manager',
  CASHIER: 'Cashier', CAPTAIN: 'Captain', KITCHEN: 'Kitchen', EMPLOYEE: 'Staff',
};
export const roleLabel = (u: Pick<Session, 'realRole'>) => LABELS[u.realRole] ?? 'Staff';
