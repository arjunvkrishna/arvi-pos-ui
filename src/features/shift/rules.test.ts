import { describe, expect, it } from 'vitest';
import { chipState, durationText, historyTotals, isMultipleOpenError, varianceOf, varianceText } from './rules';

describe('shift rules', () => {
  it('variance is counted minus expected', () => {
    expect(varianceOf(105, 100)).toBe(5);
    expect(varianceOf(95.5, 100)).toBe(-4.5);
    expect(varianceText(5)).toBe('+₹5.00');
    expect(varianceText(-4.5)).toBe('-₹4.50');
  });
  it('totals the audit history', () => {
    const t = historyTotals([{ id: 1, status: 'CLOSED', variance: -10 }, { id: 2, status: 'CLOSED', variance: 4 }, { id: 3, status: 'CLOSED', variance: 0 }, { id: 4, status: 'OPEN', variance: -99 }]);
    expect(t).toMatchObject({ total: 4, closed: 3, shortages: 1, shortage: 10, surpluses: 1, surplus: 4, net: -6 });
  });
  it('spots an overnight shift and its length', () => {
    expect(durationText({ openedAt: '2026-10-21T15:00:00', closedAt: '2026-10-22T03:30:00' })).toEqual({ text: ' • Duration: 12h 30m', overnight: true });
    expect(durationText({ openedAt: '2026-10-21T09:00:00' })).toEqual({ text: '', overnight: false });
  });
  it('header chip: hidden for managers when disabled, visible to admins, red for two open shifts', () => {
    expect(chipState({ enabled: false, isAdmin: false, open: null })).toMatchObject({ hidden: true });
    expect(chipState({ enabled: false, isAdmin: true, open: null })).toMatchObject({ hidden: false, label: 'Shift (Disabled)' });
    expect(chipState({ enabled: true, isAdmin: false, open: { id: 3, cashierName: 'Ann' } })).toMatchObject({ label: 'Shift: Ann', dot: 'green' });
    expect(chipState({ enabled: true, isAdmin: false, open: null, error: 'More than one shift is open' })).toMatchObject({ label: 'Multiple Shifts Open', dot: 'red' });
    expect(chipState({ enabled: true, isAdmin: false, open: null })).toMatchObject({ label: 'Shift Closed', dot: 'gray' });
    expect(isMultipleOpenError('x More than one shift is open y')).toBe(true);
  });
});
