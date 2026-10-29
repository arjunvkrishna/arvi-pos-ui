import { describe, expect, it } from 'vitest';
import { initialsOf, niceDate, rupees } from './format';

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initialsOf('Cafe Manager')).toBe('CM');
    expect(initialsOf('  asha  kumari  nair ')).toBe('AN');
    expect(initialsOf('asha')).toBe('A');
  });
  it('copes with nothing', () => { expect(initialsOf('   ')).toBe('?'); });
});

describe('date', () => {
  it('writes a plain date the way people read it', () => {
    expect(niceDate('2026-10-28')).toMatch(/^28 Oct 2026$/);
    expect(niceDate('2027-01-05T10:30:00')).toMatch(/^5 Jan 2027$/);
  });
  it('leaves odd values alone and keeps empty empty', () => {
    expect(niceDate('soon')).toBe('soon');
    expect(niceDate(null)).toBeNull();
    expect(niceDate('')).toBeNull();
  });
});

describe('rupees', () => {
  it('groups digits the Indian way with two decimals', () => {
    expect(rupees(25000)).toBe('₹25,000.00');
    expect(rupees(1234567.5)).toBe('₹12,34,567.50');
    expect(rupees(0)).toBe('₹0.00');
    expect(rupees(null)).toBe('₹0.00');
  });
});
