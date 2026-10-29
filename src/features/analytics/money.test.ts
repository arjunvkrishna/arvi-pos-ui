import { describe, expect, it } from 'vitest';
import type { DailyClose, ShiftLine } from './api';
import { attentionList, barWidth, cashStatus, isFutureMonth, monthLabel, parseBudget, shiftDay, shiftMonth } from './money';

const day = (o: Partial<DailyClose> = {}): DailyClose => ({ date: '2026-10-23', sales: 0, orders: 0, avgBill: 0, previousDaySales: 0, payments: [], discounts: 0, refunds: 0, refundCount: 0, voidedCount: 0, voidedValue: 0, cancelledCount: 0, gst: 0, tips: 0, expenses: 0, shifts: [], cashVarianceTotal: 0, openShifts: 0, lowStock: 0, belowZero: 0, expiringSoon: 0, expired: 0, wasteCost: 0, topDishes: [], topStaff: [], overBudget: [], text: '', ...o });
const shift = (o: Partial<ShiftLine> = {}): ShiftLine => ({ id: 1, cashier: 'asha', status: 'CLOSED', openingFloat: 0, cashSales: 0, ...o });

describe('budget helpers', () => {
  it('bars never pass the full width', () => { expect(barWidth(42.5)).toBe(42.5); expect(barWidth(180)).toBe(100); expect(barWidth(null)).toBe(0); expect(barWidth(-4)).toBe(0); });
  it('parses a budget box: empty clears, junk is refused', () => {
    expect(parseBudget('')).toBeNull(); expect(parseBudget(' 2500 ')).toBe(2500); expect(parseBudget('12.345')).toBe(12.35);
    expect(parseBudget('-1')).toBeUndefined(); expect(parseBudget('abc')).toBeUndefined(); expect(parseBudget('1e12')).toBeUndefined();
  });
  it('moves between months across a year end', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 10, 0)).toEqual({ year: 2026, month: 10 });
    expect(monthLabel(2026, 10)).toBe('October 2026');
    expect(isFutureMonth(2026, 11, new Date(2026, 9, 23))).toBe(true);
    expect(isFutureMonth(2026, 10, new Date(2026, 9, 23))).toBe(false);
  });
  it('moves between days across a month end', () => { expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01'); expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28'); });
});

describe('daily close helpers', () => {
  it('words the cash position of a shift', () => {
    expect(cashStatus(shift({ status: 'OPEN' })).text).toBe('Still open');
    expect(cashStatus(shift({ variance: 0.4 })).text).toBe('Cash matches');
    expect(cashStatus(shift({ variance: -120 }))).toEqual({ text: 'Short ₹120', tone: 'danger' });
    expect(cashStatus(shift({ variance: 50 }))).toEqual({ text: 'Extra ₹50', tone: 'warn' });
  });
  it('lists only what needs attention', () => {
    expect(attentionList(day())).toEqual([]);
    const l = attentionList(day({ openShifts: 1, cashVarianceTotal: -80, voidedCount: 2, voidedValue: 300, refundCount: 1, refunds: 100, belowZero: 3, expired: 1, overBudget: ['Rent', 'Water'] }));
    expect(l).toHaveLength(7);
    expect(l[0]).toContain('1 cash shift is still open');
    expect(l[1]).toContain('short by ₹80');
    expect(l[6]).toContain('Rent, Water');
  });
});
