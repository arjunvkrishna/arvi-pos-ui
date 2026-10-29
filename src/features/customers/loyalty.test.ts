import { describe, expect, it } from 'vitest';
import { businessToday, expiryInfo, pointsEarnedFor, redeemLimits, redeemProblem } from './loyalty';

describe('business day', () => {
  it('is the Indian date, and a bill at 02:30 still belongs to yesterday', () => {
    // 2027-03-10 22:00 UTC = 2027-03-11 03:30 IST: before the 04:00 change, so still the 10th
    expect(businessToday(new Date('2027-03-10T22:00:00Z'))).toBe('2027-03-10');
    // 2027-03-10 23:00 UTC = 2027-03-11 04:30 IST
    expect(businessToday(new Date('2027-03-10T23:00:00Z'))).toBe('2027-03-11');
    expect(businessToday(new Date('2027-03-10T12:00:00Z'))).toBe('2027-03-10');
  });
});

describe('points earned', () => {
  it('is 1 per full ₹100 and nothing below', () => {
    expect(pointsEarnedFor(99)).toBe(0);
    expect(pointsEarnedFor(100)).toBe(1);
    expect(pointsEarnedFor(259.99)).toBe(2);
    expect(pointsEarnedFor(0)).toBe(0);
    expect(pointsEarnedFor(-50)).toBe(0);
  });
});

describe('expiry wording', () => {
  const today = '2027-03-10';
  it('says nothing when there are no points or no date', () => {
    expect(expiryInfo(0, '2027-06-01', today).tone).toBe('none');
    expect(expiryInfo(50, null, today).tone).toBe('none');
    expect(expiryInfo(50, undefined, today).label).toBe('');
  });
  it('counts the last valid day as still valid', () => {
    const e = expiryInfo(50, '2027-03-10', today);
    expect(e.tone).toBe('soon');
    expect(e.label).toBe('Expires today');
    expect(e.daysLeft).toBe(0);
  });
  it('warns in the last two weeks', () => {
    expect(expiryInfo(50, '2027-03-11', today).label).toBe('Expires tomorrow');
    expect(expiryInfo(50, '2027-03-24', today)).toMatchObject({ tone: 'soon', label: 'Expires in 14 days', daysLeft: 14 });
    expect(expiryInfo(50, '2027-03-25', today).tone).toBe('ok');
  });
  it('shows the date when there is plenty of time', () => {
    const e = expiryInfo(50, '2027-09-01', today);
    expect(e.tone).toBe('ok');
    expect(e.label).toMatch(/^Valid till /);
    expect(e.label).toContain('2027');
  });
  it('marks lapsed points the day after the last valid day', () => {
    const e = expiryInfo(50, '2027-03-09', today);
    expect(e.tone).toBe('lapsed');
    expect(e.label).toMatch(/^Expired /);
    expect(e.daysLeft).toBe(-1);
  });
  it('handles month and year ends', () => {
    expect(expiryInfo(5, '2028-01-01', '2027-12-31').label).toBe('Expires tomorrow');
    expect(expiryInfo(5, '2027-03-01', '2027-02-28').label).toBe('Expires tomorrow');
  });
});

describe('redeeming', () => {
  it('needs the minimum balance', () => {
    const l = redeemLimits(99, 500, 100);
    expect(l.canRedeem).toBe(false);
    expect(l.reason).toContain('at least 100');
  });
  it('lets exactly the minimum balance redeem all of it', () => {
    const l = redeemLimits(100, 500, 100);
    expect(l).toMatchObject({ canRedeem: true, min: 100, max: 100, reason: null });
  });
  it('caps at the smaller of the balance and the bill', () => {
    expect(redeemLimits(450, 300.75, 100).max).toBe(300);
    expect(redeemLimits(250, 900, 100).max).toBe(250);
  });
  it('cannot redeem on a bill smaller than the minimum', () => {
    const l = redeemLimits(500, 60, 100);
    expect(l.canRedeem).toBe(false);
    expect(l.reason).toContain('less than the 100-point minimum');
  });
  it('refuses lapsed points', () => {
    expect(redeemLimits(500, 900, 100, true).canRedeem).toBe(false);
  });
  it('checks what was typed against those limits', () => {
    const l = redeemLimits(250, 900, 100);
    expect(redeemProblem(99, l)).toContain('least that can be redeemed is 100');
    expect(redeemProblem(251, l)).toContain('At most 250');
    expect(redeemProblem(Number.NaN, l)).toContain('Enter');
    expect(redeemProblem(100, l)).toBeNull();
    expect(redeemProblem(250, l)).toBeNull();
    expect(redeemProblem(100, redeemLimits(10, 900, 100))).toContain('at least 100');
  });
  it('follows a changed minimum', () => {
    expect(redeemLimits(60, 500, 50).canRedeem).toBe(true);
    expect(redeemProblem(49, redeemLimits(60, 500, 50))).toContain('50');
  });
});
