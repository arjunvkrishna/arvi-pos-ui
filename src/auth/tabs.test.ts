import { describe, expect, it } from 'vitest';
import type { RealRole, Session } from '../api/types';
import { testSession } from '../test/session';
import { bottomBarTabs, canOpenTab, defaultTab, isTabId, tabFromHash, TAB_IDS, visibleTabs } from './tabs';

const person = (realRole: RealRole, over: Partial<Session> = {}): Session => {
  const tier = realRole === 'ADMIN' || realRole === 'CAFE_ADMIN' || realRole === 'SUPER_ADMIN' ? 'ADMIN' : realRole === 'GENERAL_MANAGER' || realRole === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE';
  return testSession(tier, { realRole, platform: realRole === 'SUPER_ADMIN', ...over });
};
const ids = (u: Session) => visibleTabs(u).map((t) => t.id);
const CAFE_TABS = TAB_IDS.filter((t) => t !== 'cafes');

describe('who can open which screen', () => {
  it('an owner opens every cafe screen, but never the platform one', () => {
    expect(ids(person('ADMIN'))).toEqual(CAFE_TABS);
    expect(ids(person('CAFE_ADMIN'))).toEqual(CAFE_TABS);
  });

  it('a general manager opens everything except the owner-only Audit Log', () => {
    expect(ids(person('GENERAL_MANAGER'))).toEqual(CAFE_TABS.filter((t) => t !== 'audit'));
  });

  it('a branch manager has no Audit, Telegram, GST or Branches (cafe-wide), and no Stock Links without the menu right', () => {
    const list = ids(person('MANAGER'));
    for (const hidden of ['audit', 'telegram', 'gst', 'outlets', 'stocklinks', 'cafes'] as const) expect(list).not.toContain(hidden);
    for (const shown of ['pos', 'kds', 'bills', 'menu', 'inventory', 'staff', 'users', 'settings', 'analytics', 'attendance'] as const) expect(list).toContain(shown);
  });

  it('a branch manager given the menu right also gets Stock Links', () => {
    expect(ids(person('MANAGER', { canManageMenu: true }))).toContain('stocklinks');
  });

  it('a cashier who takes orders sees the till, the kitchen display and attendance only', () => {
    expect(ids(person('CASHIER', { canTakeOrders: true, canManageInventory: false }))).toEqual(['pos', 'kds', 'attendance']);
  });

  it('kitchen staff without an order right see the kitchen display and attendance, not the till', () => {
    expect(ids(person('KITCHEN', { canTakeOrders: false }))).toEqual(['kds', 'attendance']);
  });

  it('an inventory-only employee sees Inventory and Attendance', () => {
    expect(ids(person('EMPLOYEE', { canTakeOrders: false, canManageInventory: true }))).toEqual(['inventory', 'attendance']);
  });

  it('an employee with no permissions still sees Attendance', () => {
    expect(ids(person('EMPLOYEE', { canTakeOrders: false, canManageInventory: false }))).toEqual(['attendance']);
  });

  it('the platform owner sees only the Cafes screen and no cafe screen', () => {
    const owner = person('SUPER_ADMIN');
    expect(ids(owner)).toEqual(['cafes']);
    expect(canOpenTab(owner, 'pos')).toBe(false);
    expect(canOpenTab(owner, 'cafes')).toBe(true);
    expect(canOpenTab(person('ADMIN'), 'cafes')).toBe(false);
  });

  it('canOpenTab rejects unknown and forbidden screens', () => {
    const emp = person('EMPLOYEE');
    expect(canOpenTab(emp, 'audit')).toBe(false);
    expect(canOpenTab(emp, 'nope')).toBe(false);
    expect(canOpenTab(emp, 'pos')).toBe(true);
    expect(isTabId('menu')).toBe(true);
    expect(isTabId('tab-menu')).toBe(false);
  });
});

describe('landing screen', () => {
  it('managers and owners land on Analytics, the platform owner on Cafes', () => {
    expect(defaultTab(person('ADMIN'))).toBe('analytics');
    expect(defaultTab(person('GENERAL_MANAGER'))).toBe('analytics');
    expect(defaultTab(person('MANAGER'))).toBe('analytics');
    expect(defaultTab(person('SUPER_ADMIN'))).toBe('cafes');
  });
  it('staff land on POS, else Inventory, else Attendance; kitchen staff on the kitchen display', () => {
    expect(defaultTab(person('CASHIER'))).toBe('pos');
    expect(defaultTab(person('EMPLOYEE', { canTakeOrders: false, canManageInventory: true }))).toBe('inventory');
    expect(defaultTab(person('EMPLOYEE', { canTakeOrders: false }))).toBe('attendance');
    expect(defaultTab(person('KITCHEN', { canTakeOrders: false }))).toBe('kds');
  });
});

describe('phone bottom bar', () => {
  it('shows at most five primary screens, in screen order (POS, Kitchen, Bills, Menu, Stock for an owner)', () => {
    expect(bottomBarTabs(person('ADMIN')).map((t) => t.id)).toEqual(['pos', 'kds', 'bills', 'menu', 'inventory']);
  });
  it('falls back to whatever the user may open', () => {
    expect(bottomBarTabs(person('EMPLOYEE', { canTakeOrders: false, canManageInventory: false })).map((t) => t.id)).toEqual(['attendance']);
    expect(bottomBarTabs(person('SUPER_ADMIN')).map((t) => t.id)).toEqual(['cafes']);
  });
});

describe('tabFromHash (old links)', () => {
  it('reads #menu and #tab-menu', () => {
    expect(tabFromHash('#menu')).toBe('menu');
    expect(tabFromHash('#tab-bills')).toBe('bills');
    expect(tabFromHash('menu')).toBe('menu');
  });
  it('returns null for anything else', () => {
    expect(tabFromHash('')).toBeNull();
    expect(tabFromHash('#whatever')).toBeNull();
    expect(tabFromHash('#tab-')).toBeNull();
  });
});
