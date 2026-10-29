import { describe, expect, it } from 'vitest';
import type { AuditLog } from './api';
import { NO_FILTERS, auditStats, billDiff, filterAudit } from './rules';

const logs: AuditLog[] = [
  { id: 1, action: 'LOGIN', entityType: 'USER', performedByName: 'admin', performedAt: '2026-10-21T09:00:00' },
  { id: 2, action: 'EDIT_BILL', entityType: 'BILL', entityId: 7, performedByName: 'manager', performedAt: '2026-10-21T10:00:00', oldValue: 'Total ₹100', newValue: 'Total ₹60 Diff: -₹40.00' },
  { id: 3, action: 'CREATE', entityType: 'MENU_ITEM', entityId: 3, performedByName: 'manager', performedAt: '2026-10-20T10:00:00', newValue: 'Paneer' },
  { id: 4, action: 'PRINT_BILL', entityType: 'BILL', entityId: 7, performedByName: 'waiter', performedAt: '2026-10-21T11:00:00' },
];

describe('audit log rules', () => {
  it('bill audit mode keeps bill events and ignores the category filter', () => {
    expect(filterAudit(logs, { ...NO_FILTERS, mode: 'bills', category: 'USER' }).map((l) => l.id)).toEqual([2, 4]);
  });
  it('filters by category, date, user, action and text', () => {
    expect(filterAudit(logs, { ...NO_FILTERS, category: 'MENU_ITEM' }).map((l) => l.id)).toEqual([3]);
    expect(filterAudit(logs, { ...NO_FILTERS, date: '2026-10-20' }).map((l) => l.id)).toEqual([3]);
    expect(filterAudit(logs, { ...NO_FILTERS, user: 'MANAGER' }).map((l) => l.id)).toEqual([2, 3]);
    expect(filterAudit(logs, { ...NO_FILTERS, action: 'LOGIN' }).map((l) => l.id)).toEqual([1]);
    expect(filterAudit(logs, { ...NO_FILTERS, search: ' paneer ' }).map((l) => l.id)).toEqual([3]);
    expect(filterAudit(logs, { ...NO_FILTERS, search: '7' }).map((l) => l.id)).toEqual([2, 4]);
  });
  it('counts the headline numbers over everything', () => {
    expect(auditStats(logs)).toEqual({ total: 4, billOps: 2, billEdits: 1, users: 3 });
  });
  it('flags a reduced bill amount', () => {
    expect(billDiff('x Diff: -₹40.00')).toEqual({ text: '-₹40.00', negative: true });
    expect(billDiff('Diff: +₹5.00')).toEqual({ text: '+₹5.00', negative: false });
    expect(billDiff('nothing')).toBeNull();
  });
});
