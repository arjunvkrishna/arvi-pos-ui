import { describe, expect, it } from 'vitest';
import { testSession } from '../../test/session';
import { canDeleteAccount, canManageAccount, creatableRoles, hasCancel, hasInventory, hasOrders, isBranchRole, subtitleFor } from './rules';

const owner = testSession('ADMIN', { realRole: 'ADMIN' });
const general = testSession('MANAGER', { realRole: 'GENERAL_MANAGER' });
const branchA = testSession('MANAGER', { realRole: 'MANAGER', outletId: 10 });

describe('who may manage whom (owner > general manager > branch manager > staff)', () => {
  it('an owner manages everyone, including another owner', () => {
    for (const role of ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'CASHIER', 'KITCHEN'] as const) expect(canManageAccount(owner, { role, outletId: 3 })).toBe(true);
  });
  it('a general manager manages branch managers and staff in any branch, never an owner or a peer', () => {
    expect(canManageAccount(general, { role: 'MANAGER', outletId: 3 })).toBe(true);
    expect(canManageAccount(general, { role: 'CASHIER', outletId: 7 })).toBe(true);
    expect(canManageAccount(general, { role: 'ADMIN' })).toBe(false);
    expect(canManageAccount(general, { role: 'GENERAL_MANAGER' })).toBe(false);
  });
  it('a branch manager manages staff of their own branch only', () => {
    expect(canManageAccount(branchA, { role: 'CASHIER', outletId: 10 })).toBe(true);
    expect(canManageAccount(branchA, { role: 'CASHIER', outletId: 11 })).toBe(false);
    expect(canManageAccount(branchA, { role: 'MANAGER', outletId: 10 })).toBe(false);
    expect(canManageAccount(branchA, { role: 'GENERAL_MANAGER' })).toBe(false);
    expect(canManageAccount(branchA, { role: 'ADMIN' })).toBe(false);
  });
  it('staff manage nobody, and nobody manages the platform owner', () => {
    expect(canManageAccount(testSession('EMPLOYEE', { realRole: 'CASHIER', outletId: 10 }), { role: 'EMPLOYEE', outletId: 10 })).toBe(false);
    expect(canManageAccount(owner, { role: 'SUPER_ADMIN' })).toBe(false);
  });
  it('deleting an account is for owners and general managers only', () => {
    expect(canDeleteAccount(owner, { role: 'CASHIER' })).toBe(true);
    expect(canDeleteAccount(general, { role: 'MANAGER' })).toBe(true);
    expect(canDeleteAccount(general, { role: 'ADMIN' })).toBe(false);
    expect(canDeleteAccount(branchA, { role: 'CASHIER', outletId: 10 })).toBe(false);
  });
});

describe('the roles a person can give to a new account', () => {
  it('owner: every tier; general manager: below them; branch manager: staff only', () => {
    expect(creatableRoles(owner)).toEqual(['ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'CASHIER', 'CAPTAIN', 'KITCHEN', 'EMPLOYEE']);
    expect(creatableRoles(general)).toEqual(['MANAGER', 'CASHIER', 'CAPTAIN', 'KITCHEN', 'EMPLOYEE']);
    expect(creatableRoles(branchA)).toEqual(['CASHIER', 'CAPTAIN', 'KITCHEN', 'EMPLOYEE']);
  });
  it('only branch-level roles belong to a branch', () => {
    expect(isBranchRole('MANAGER')).toBe(true);
    expect(isBranchRole('CASHIER')).toBe(true);
    expect(isBranchRole('GENERAL_MANAGER')).toBe(false);
    expect(isBranchRole('ADMIN')).toBe(false);
  });
});

describe('what an account can do', () => {
  it('managers and owners always can; staff only what was given', () => {
    expect(hasOrders({ role: 'MANAGER' }) && hasInventory({ role: 'MANAGER' }) && hasCancel({ role: 'MANAGER' })).toBe(true);
    expect(hasOrders({ role: 'CASHIER', canTakeOrders: true })).toBe(true);
    expect(hasInventory({ role: 'CASHIER' })).toBe(false);
    expect(hasCancel({ role: 'CASHIER', canCancelOrder: false })).toBe(false);
    expect(hasCancel({ role: 'CASHIER', canCancelOrder: true })).toBe(true);
  });
  it('says whose people are listed', () => {
    expect(subtitleFor(owner)).toMatch(/every branch/);
    expect(subtitleFor(branchA)).toMatch(/your branch/);
  });
});
