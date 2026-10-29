import { describe, expect, it } from 'vitest';
import { testSession } from '../test/session';
import { hasFeature, limitText, canCancelOrder, canManageBranchSettings, canManageMenu, isCafeWide, isManagement, isOwner, normalizePatch, normalizeSession, outranks, roleLabel, tierOf } from './roles';

describe('roles map onto the three tiers the server\'s rules use', () => {
  it('owners are ADMIN, general and branch managers MANAGER, everyone else EMPLOYEE', () => {
    expect(['ADMIN', 'CAFE_ADMIN', 'SUPER_ADMIN'].map(tierOf)).toEqual(['ADMIN', 'ADMIN', 'ADMIN']);
    expect(['GENERAL_MANAGER', 'MANAGER'].map(tierOf)).toEqual(['MANAGER', 'MANAGER']);
    expect(['CASHIER', 'CAPTAIN', 'KITCHEN', 'EMPLOYEE', 'SOMETHING_NEW'].map(tierOf)).toEqual(['EMPLOYEE', 'EMPLOYEE', 'EMPLOYEE', 'EMPLOYEE', 'EMPLOYEE']);
  });
});

describe('normalizeSession', () => {
  it('keeps the exact role next to the tier and marks only the platform owner', () => {
    const gm = normalizeSession({ token: 't', username: 'g', role: 'GENERAL_MANAGER', outletId: 4 });
    expect(gm).toMatchObject({ role: 'MANAGER', realRole: 'GENERAL_MANAGER', platform: false });
    expect(normalizeSession({ token: 't', username: 's', role: 'SUPER_ADMIN' })).toMatchObject({ role: 'ADMIN', realRole: 'SUPER_ADMIN', platform: true });
  });
  it('owners and general managers start in their home branch; branch people have no "picked" branch', () => {
    expect(normalizeSession({ token: 't', username: 'o', role: 'ADMIN', outletId: 1 }).selectedOutletId).toBe(1);
    expect(normalizeSession({ token: 't', username: 'g', role: 'GENERAL_MANAGER', outletId: 2 }).selectedOutletId).toBe(2);
    expect(normalizeSession({ token: 't', username: 'm', role: 'MANAGER', outletId: 3 }).selectedOutletId).toBeNull();
    expect(normalizeSession({ token: 't', username: 'c', role: 'CASHIER', outletId: 3 }).selectedOutletId).toBeNull();
  });
  it('a token refresh updates the role but never undoes the branch the owner picked', () => {
    const patch = normalizePatch({ token: 'new', role: 'ADMIN', outletId: 1 });
    expect(patch).toMatchObject({ token: 'new', role: 'ADMIN', realRole: 'ADMIN' });
    expect('selectedOutletId' in patch).toBe(false);
    expect(normalizePatch({ token: 'only' })).toEqual({ token: 'only' });
  });
});

describe('what each person may do', () => {
  const owner = testSession('ADMIN', { realRole: 'ADMIN' });
  const general = testSession('MANAGER', { realRole: 'GENERAL_MANAGER' });
  const branch = testSession('MANAGER', { realRole: 'MANAGER', outletId: 2 });
  const cashier = testSession('EMPLOYEE', { realRole: 'CASHIER', outletId: 2 });

  it('who runs every branch', () => {
    expect([owner, general, branch, cashier].map(isCafeWide)).toEqual([true, true, false, false]);
    expect([owner, general, branch, cashier].map(isOwner)).toEqual([true, false, false, false]);
    expect([owner, general, branch, cashier].map(isManagement)).toEqual([true, true, true, false]);
  });
  it('cancelling an order: managers always, staff only when given the right', () => {
    expect(canCancelOrder(branch)).toBe(true);
    expect(canCancelOrder(cashier)).toBe(false);
    expect(canCancelOrder({ ...cashier, canCancelOrder: true })).toBe(true);
  });
  it('the shared menu is for owner and general manager, or a branch manager it was handed to', () => {
    expect(canManageMenu(owner) && canManageMenu(general)).toBe(true);
    expect(canManageMenu(branch)).toBe(false);
    expect(canManageMenu({ ...branch, canManageMenu: true })).toBe(true);
  });
  it('branch settings: every manager, and staff they delegate to', () => {
    expect(canManageBranchSettings(branch)).toBe(true);
    expect(canManageBranchSettings(cashier)).toBe(false);
    expect(canManageBranchSettings({ ...cashier, canManageSettings: true })).toBe(true);
  });
  it('rank: only people strictly below you, but owners may manage owners', () => {
    expect(outranks(owner, 'GENERAL_MANAGER') && outranks(owner, 'ADMIN') && outranks(owner, 'CAFE_ADMIN')).toBe(true);
    expect(outranks(general, 'MANAGER') && outranks(general, 'KITCHEN')).toBe(true);
    expect(outranks(general, 'GENERAL_MANAGER') || outranks(general, 'ADMIN')).toBe(false);
    expect(outranks(branch, 'MANAGER') || outranks(branch, 'GENERAL_MANAGER')).toBe(false);
    expect(outranks(owner, 'SUPER_ADMIN')).toBe(false);
  });
  it('speaks plainly', () => {
    expect([owner, general, branch, cashier].map(roleLabel)).toEqual(['Owner', 'General manager', 'Branch manager', 'Cashier']);
  });
});

describe('plan features', () => {
  const withPlan = (features: string[]) => ({ plan: { name: 'PRO' as const, maxBranches: 5, maxLogins: 25, features: features as never } });
  it('is on when the plan lists the module', () => expect(hasFeature(withPlan(['CRM']), 'CRM')).toBe(true));
  it('is off when the plan does not', () => expect(hasFeature(withPlan(['CRM']), 'CAMPAIGNS')).toBe(false));
  it('nothing is hidden for a session saved before plans existed', () => expect(hasFeature({}, 'ACCOUNTING')).toBe(true));
  it('999 and up reads as Unlimited', () => {
    expect(limitText(999)).toBe('Unlimited');
    expect(limitText(5)).toBe('5');
  });
});
