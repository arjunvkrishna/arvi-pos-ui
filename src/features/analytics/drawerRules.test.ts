import { describe, expect, it } from 'vitest';
import { cashiers, correctionProblem, effectiveCount, effectiveVariance, signed, transferProblem, varianceTone, varianceWord, visibleShifts } from './drawerRules';

describe('drawer analysis rules', () => {
  it('classifies variance', () => {
    expect([0, 25, -25].map(varianceTone)).toEqual(['ok', 'warn', 'danger']);
    expect([0, 25, -25].map(varianceWord)).toEqual(['BALANCED', 'SURPLUS', 'SHORTAGE']);
    expect(signed(5)).toBe('+₹5.00');
    expect(signed(-5)).toBe('-₹5.00');
  });
  it('uses the corrected count when a manager corrected it', () => {
    const base = { id: 1, status: 'CLOSED', countedCash: 90, variance: -10 };
    expect([effectiveCount(base), effectiveVariance(base)]).toEqual([90, -10]);
    const fixed = { ...base, isCorrected: true, correctedCountedCash: 100, correctedVariance: 0 };
    expect([effectiveCount(fixed), effectiveVariance(fixed)]).toEqual([100, 0]);
  });
  it('filters to flagged shifts and lists cashiers once', () => {
    const items = [{ shift: { id: 1, status: 'CLOSED', cashierId: 5, cashierName: 'Ann' }, anomalyFlags: [{ severity: 'HIGH', flagType: 'X', description: 'd' }] }, { shift: { id: 2, status: 'OPEN', cashierId: 5, cashierName: 'Ann' } }];
    expect(visibleShifts(items, true).map((i) => i.shift.id)).toEqual([1]);
    expect(visibleShifts(items, false)).toHaveLength(2);
    expect(cashiers(items)).toEqual([[5, 'Ann']]);
  });
  it('validates transfers and corrections like the classic screen', () => {
    expect(transferProblem('', 5, 'x')).toMatch(/select a target shift/);
    expect(transferProblem('1', 0, 'x')).toMatch(/greater than zero/);
    expect(transferProblem('1', 5, ' ')).toMatch(/reason is mandatory/);
    expect(transferProblem('1', 5, 'deposit')).toBeNull();
    expect(correctionProblem(NaN, 'recount done')).toMatch(/valid physical/);
    expect(correctionProblem(10, 'abc')).toMatch(/at least 5/);
    expect(correctionProblem(10, 'recount done')).toBeNull();
  });
});
