import { describe, expect, it } from 'vitest';
import { joinedNote, percentTone, summaryYears } from './rules';
import { lifetimePaid, netSalary } from '../staff/rules';
import type { Salary } from '../staff/api';

describe('attendance and payroll rules', () => {
  it('explains the joining date against the month', () => {
    expect(joinedNote({ joinedDate: '2026-10-09', year: 2026, month: 10 })).toBe('Joined day 9 of this month');
    expect(joinedNote({ joinedDate: '2026-11-01', year: 2026, month: 10 })).toBe('Joined in future month');
    expect(joinedNote({ joinedDate: '2025-01-01', year: 2026, month: 10 })).toBe('Joined prior to this month');
    expect(joinedNote({ joinedDate: null, year: 2026, month: 10 })).toBe('Joined prior (full month)');
  });
  it('colours the percentage', () => {
    expect([90, 80, 79, 50, 49].map(percentTone)).toEqual(['ok', 'ok', 'warn', 'warn', 'danger']);
  });
  it('offers two years back and one ahead', () => {
    expect(summaryYears(new Date(2026, 5, 1))).toEqual([2024, 2025, 2026, 2027]);
  });
  it('net salary never goes below zero; lifetime pay counts only paid slips', () => {
    expect(netSalary(1000, 200, 300)).toBe(900);
    expect(netSalary(100, 0, 500)).toBe(0);
    const slips = [{ netSalary: 100, paid: true }, { netSalary: 50, paid: false }, { netSalary: 25, paid: true }] as Salary[];
    expect(lifetimePaid(slips)).toBe(125);
  });
});
