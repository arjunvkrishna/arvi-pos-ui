import { describe, expect, it } from 'vitest';
import type { Bill } from './types';
import { billActions, defaultPromoRange, diffText, editTotals, promotionProblem, refundProblem, refundState } from './rules';

const bill = (o: Partial<Bill>): Bill => ({ id: 1, billNumber: 'NRM-1', status: 'PAID', items: [], subtotal: 100, netAmount: 100, tableNumber: 'T1', createdByName: 'Ann', printedByName: 'Bob', ...o });

describe('bill log', () => {
  it('actions follow status', () => {
    expect(billActions(bill({ status: 'PAID' }))).toEqual({ edit: true, refund: true, void: false });
    expect(billActions(bill({ status: 'ACTIVE' }))).toEqual({ edit: true, refund: false, void: true });
    expect(billActions(bill({ status: 'REFUNDED' }))).toEqual({ edit: false, refund: false, void: false });
  });
});

describe('refund', () => {
  it('knows what is left and why a refund is blocked', () => {
    expect(refundState(bill({ netAmount: 100, totalRefunded: 30 }))).toEqual({ remaining: 70, blocked: null });
    expect(refundState(bill({ netAmount: 100, totalRefunded: 100 })).blocked).toBe('FULLY_REFUNDED');
    expect(refundState(bill({ status: 'VOIDED' })).blocked).toBe('VOIDED');
  });
  it('checks amount and reason', () => {
    expect(refundProblem(0, 50, 'x')).toMatch(/amount/);
    expect(refundProblem(60, 50, 'x')).toMatch(/more than ₹50.00/);
    expect(refundProblem(10, 50, ' ')).toMatch(/reason/);
    expect(refundProblem(50, 50, 'wrong item')).toBeNull();
  });
});

describe('edit bill', () => {
  it('discount first, then tax; shows the change against the original', () => {
    const t = editTotals([{ price: 100, quantity: 2 }], 10, 5, 200);
    expect(t.subtotal).toBe(200);
    expect(t.net).toBeCloseTo(189, 5);
    expect(t.diff).toBe(-11);
    expect(diffText(-11)).toBe('(Diff: -₹11.00)');
    expect(diffText(5)).toBe('(+₹5.00)');
    expect(diffText(0)).toBe('');
  });
});

describe('promotions', () => {
  it('validates the form', () => {
    expect(promotionProblem({ name: '', pct: 5, start: 'a', end: 'b' })).toMatch(/name/);
    expect(promotionProblem({ name: 'x', pct: 0, start: 'a', end: 'b' })).toMatch(/greater than 0/);
    expect(promotionProblem({ name: 'x', pct: 101, start: 'a', end: 'b' })).toMatch(/at most 100/);
    expect(promotionProblem({ name: 'x', pct: 5, start: '', end: 'b' })).toMatch(/Both start/);
    expect(promotionProblem({ name: 'x', pct: 5, start: '2026-10-02T10:00', end: '2026-10-02T10:00' })).toMatch(/strictly after/);
    expect(promotionProblem({ name: 'x', pct: 5, start: '2026-10-02T10:00', end: '2026-10-09T10:00' })).toBeNull();
  });
  it('defaults to a week starting now', () => { expect(defaultPromoRange(new Date(2026, 9, 21, 9, 5))).toEqual({ start: '2026-10-21T09:05', end: '2026-10-28T09:05' }); });
});

describe('happy hour form', () => {
  const base = { name: 'Happy hour', pct: 15, start: '2026-10-23T10:00', end: '2027-10-23T10:00' };
  it('a weekly promotion needs days and a time window', async () => {
    const { promotionProblem } = await import('./rules');
    expect(promotionProblem({ ...base, recurring: true, days: [], dailyStart: '16:00', dailyEnd: '19:00' })).toMatch(/at least one day/);
    expect(promotionProblem({ ...base, recurring: true, days: [1], dailyStart: '', dailyEnd: '19:00' })).toMatch(/starts and ends/);
    expect(promotionProblem({ ...base, recurring: true, days: [1], dailyStart: '16:00', dailyEnd: '16:00' })).toMatch(/cannot be the same/);
    expect(promotionProblem({ ...base, recurring: true, days: [1, 5], dailyStart: '22:00', dailyEnd: '02:00' })).toBeNull();   // past midnight is allowed
    expect(promotionProblem({ ...base })).toBeNull();                                                                            // one-off needs none of it
  });
  it('days toggle in order; a happy hour range lasts a year', async () => {
    const { toggleDay, defaultRecurringRange } = await import('./rules');
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]); expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    const r = defaultRecurringRange(new Date(2026, 9, 23, 10, 0));
    expect(r.start).toBe('2026-10-23T10:00'); expect(r.end).toBe('2027-10-23T10:00');
  });
});
