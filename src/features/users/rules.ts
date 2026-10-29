import { isCafeWide, outranks, RANK, roleLabel } from '../../api/roles';
import type { RealRole, Session } from '../../api/types';

export { passwordProblem, PASSWORD_HINT } from '../../lib/password';

/** Owners and general managers run every branch, so they belong to none. */
export const isBranchRole = (r: RealRole) => RANK[r] <= RANK.MANAGER;
export const isStaffRole = (r: RealRole) => RANK[r] < RANK.MANAGER;

/**
 * Whom a person may create, change, reset or deactivate: only people strictly below them (owners may manage other owners), and
 * branch-level people only within their own branch. The server enforces the same rule; this keeps the buttons honest.
 */
export function canManageAccount(me: Session, target: { role: RealRole; outletId?: number | null }): boolean {
  if (!outranks(me, target.role)) return false;
  return isCafeWide(me) || (me.outletId != null && me.outletId === target.outletId);
}

/** Deleting an account is for the people who run every branch. */
export const canDeleteAccount = (me: Session, target: { role: RealRole; outletId?: number | null }) => isCafeWide(me) && canManageAccount(me, target);

/** The roles a person may give to a new account, highest first. */
export function creatableRoles(me: Session): RealRole[] {
  const order: RealRole[] = ['ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'CASHIER', 'CAPTAIN', 'KITCHEN', 'EMPLOYEE'];
  return order.filter((r) => canManageAccount(me, { role: r, outletId: me.outletId }));
}

export const roleName = (role: RealRole) => roleLabel({ realRole: role });

export const subtitleFor = (me: Session) =>
  me.realRole === 'MANAGER' ? 'Branch view: the people of your branch'
    : isCafeWide(me) ? 'All people in the cafe, in every branch' : 'Your people';

/** What the account can do, as short badges. Managers and owners can always do all of it. */
export const hasOrders = (u: { role: RealRole; canTakeOrders?: boolean }) => !isStaffRole(u.role) || u.canTakeOrders !== false;
export const hasInventory = (u: { role: RealRole; canManageInventory?: boolean }) => !isStaffRole(u.role) || u.canManageInventory === true;
export const hasCancel = (u: { role: RealRole; canCancelOrder?: boolean }) => !isStaffRole(u.role) || u.canCancelOrder === true;
