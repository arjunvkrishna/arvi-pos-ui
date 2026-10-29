import { describe, expect, it } from 'vitest';

export const calculateLoyaltyEarned = (amount: number): number => {
  if (amount < 100) return 0;
  return Math.floor(amount / 100);
};

export const normalizePhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
};

export const maxRedeemablePoints = (customerBalance: number, billAmount: number): number => {
  return Math.max(0, Math.min(customerBalance, Math.floor(billAmount)));
};

describe('Customer CRM & Loyalty Points Rules', () => {
  it('calculates 1 point earned per ₹100 spent', () => {
    expect(calculateLoyaltyEarned(50)).toBe(0);
    expect(calculateLoyaltyEarned(99.99)).toBe(0);
    expect(calculateLoyaltyEarned(100)).toBe(1);
    expect(calculateLoyaltyEarned(250)).toBe(2);
    expect(calculateLoyaltyEarned(1099)).toBe(10);
  });

  it('normalizes 10-digit Indian mobile numbers to E.164 standard', () => {
    expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhoneNumber('09876543210')).toBe('+09876543210');
  });

  it('caps loyalty points redemption to min of balance and bill amount', () => {
    expect(maxRedeemablePoints(150, 80)).toBe(80);
    expect(maxRedeemablePoints(50, 120)).toBe(50);
    expect(maxRedeemablePoints(0, 100)).toBe(0);
  });
});
