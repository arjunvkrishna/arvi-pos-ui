import { describe, expect, it } from 'vitest';
import type { Salary } from './api';
import { advanceContext, balanceOf, slipStatus } from './rules';

const slip = (o: Partial<Salary> = {}): Salary => ({ id: 1, employeeId: 7, month: 10, year: 2026, basic: 20000, allowances: 0, deductions: 0, netSalary: 20000, paid: false, ...o });

describe('payroll advance', () => {
  it('pay 20000, advance 2000: balance to pay is 18000', () => {
    expect(balanceOf(slip({ advance: 2000, balance: 18000 }))).toBe(18000);
    expect(balanceOf(slip({ advance: 2000 }))).toBe(18000);          // an older response without the balance field
    expect(balanceOf(slip())).toBe(20000);
  });
  it('status: pending, advance given, paid', () => {
    expect(slipStatus(slip()).label).toBe('PENDING');
    expect(slipStatus(slip({ advance: 500 })).label).toBe('ADVANCE GIVEN');
    expect(slipStatus(slip({ advance: 500, paid: true })).label).toBe('PAID');
  });
  const staff = [{ id: 7, basicSalary: 20000 }];
  it('dialog numbers use the staff profile when the month has no slip yet', () => {
    expect(advanceContext(staff, [], 7, 10, 2026, 2000)).toMatchObject({ net: 20000, given: 0, left: 18000, problem: '' });
  });
  it('dialog numbers use the existing slip and what was already advanced', () => {
    expect(advanceContext(staff, [slip({ netSalary: 15000, advance: 4000 })], 7, 10, 2026, 1000)).toMatchObject({ net: 15000, given: 4000, left: 10000, problem: '' });
  });
  it('an advance above the balance, or on a paid month, is flagged', () => {
    expect(advanceContext(staff, [slip({ advance: 19000 })], 7, 10, 2026, 1500).problem).toMatch(/more than the balance of ₹1000.00/);
    expect(advanceContext(staff, [slip({ paid: true })], 7, 10, 2026, 100).problem).toMatch(/already paid/);
    expect(advanceContext(staff, [slip()], 7, 11, 2026, 100).problem).toBe('');   // another month is a different slip
  });
});
