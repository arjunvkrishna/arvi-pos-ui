import { describe, expect, it } from 'vitest';
import { customRangeProblem, defaultCustomRange, exportFileName, growthLabel, inr0, inr2 } from './rules';

describe('analytics rules', () => {
  it('checks a custom range', () => {
    expect(customRangeProblem('', '2026-01-01')).toMatch(/both start and end/);
    expect(customRangeProblem('2026-02-01', '2026-01-01')).toMatch(/before or equal/);
    expect(customRangeProblem('2026-01-01', '2026-01-01')).toBeNull();
  });
  it('pre-fills thirty days back using local dates', () => {
    expect(defaultCustomRange(new Date(2026, 9, 21, 0, 30))).toEqual({ start: '2026-09-21', end: '2026-10-21' });
  });
  it('formats money and growth', () => {
    expect(inr2(1234.5)).toBe('₹1,234.50');
    expect(inr0(1234.5)).toBe('₹1,235');
    expect(inr2(undefined)).toBe('₹0.00');
    expect(growthLabel(12)).toBe('+12% vs prev');
    expect(growthLabel(-3.5)).toBe('-3.5% vs prev');
  });
  it('names export files', () => {
    expect(exportFileName('excel', 'THIS_MONTH', new Date(2026, 9, 5))).toBe('ARVI_Analytics_THIS_MONTH_2026-10-05.xlsx');
    expect(exportFileName('pdf', 'TODAY', new Date(2026, 9, 5))).toBe('ARVI_Analytics_TODAY_2026-10-05.pdf');
  });
});
