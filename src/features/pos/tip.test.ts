import { describe, expect, it } from 'vitest';
import { parseTip } from './rules';

describe('tip box', () => {
  it('empty is no tip; amounts are rounded to paise', () => { expect(parseTip('')).toBe(0); expect(parseTip('  ')).toBe(0); expect(parseTip('20')).toBe(20); expect(parseTip('12.345')).toBe(12.35); expect(parseTip('0')).toBe(0); });
  it('negative, unreadable or absurd amounts are refused', () => { expect(parseTip('-5')).toBeNull(); expect(parseTip('abc')).toBeNull(); expect(parseTip('100001')).toBeNull(); expect(parseTip('1e9')).toBeNull(); });
});

import { fillLast, partsPayload, partsProblem, partsRemaining, splitEqually, type PayPart } from './rules';
const P = (mode: PayPart['mode'], amount: string): PayPart => ({ mode, amount });

describe('split payment', () => {
  it('shares a bill equally and the last guest takes the odd paise', () => {
    expect(splitEqually(300, 3)).toEqual(['100.00', '100.00', '100.00']);
    expect(splitEqually(100, 3)).toEqual(['33.33', '33.33', '33.34']);
    expect(splitEqually(100.01, 2)).toEqual(['50.00', '50.01']);
    expect(splitEqually(250, 1)).toEqual(['250.00']);
    expect(splitEqually(250, 0)).toEqual(['250.00']);
    expect(splitEqually(600, 9)).toHaveLength(6);                                   // at most six guests
    for (const [net, n] of [[99.99, 7], [1234.57, 4], [0.05, 3]] as const) expect(splitEqually(net, n).reduce((s, v) => s + Math.round(Number(v) * 100), 0)).toBe(Math.round(net * 100));
  });
  it('reports what is left to collect', () => {
    expect(partsRemaining(300, [P('CASH', '200')])).toBe(100);
    expect(partsRemaining(300, [P('CASH', '200'), P('UPI', '100')])).toBe(0);
    expect(partsRemaining(300, [P('CASH', '200'), P('UPI', '150')])).toBe(-50);
    expect(partsRemaining(300, [P('CASH', 'abc')])).toBe(300);
    expect(partsRemaining(0.3, [P('CASH', '0.1'), P('UPI', '0.2')])).toBe(0);       // no floating point drift
  });
  it('refuses parts that cannot be confirmed and explains why', () => {
    expect(partsProblem(300, [P('CASH', '300')])).toMatch(/at least two/);
    expect(partsProblem(300, [P('CASH', '200'), P('UPI', '')])).toMatch(/above zero/);
    expect(partsProblem(300, [P('CASH', '200'), P('UPI', '0')])).toMatch(/above zero/);
    expect(partsProblem(300, [P('CASH', '200'), P('UPI', '50')])).toBe('₹50.00 is still to collect.');
    expect(partsProblem(300, [P('CASH', '200'), P('UPI', '150')])).toBe('The payments are ₹50.00 too much.');
    expect(partsProblem(300, [P('CASH', '200'), P('UPI', '100')])).toBeNull();
    expect(partsProblem(300, Array.from({ length: 7 }, () => P('CASH', '1')))).toMatch(/at most 6/);
  });
  it('fills the last part with the rest and builds the request', () => {
    expect(fillLast(300, [P('CASH', '120'), P('UPI', '')])).toEqual([P('CASH', '120'), P('UPI', '180.00')]);
    expect(fillLast(300, [P('CASH', '400'), P('UPI', '5')])[1].amount).toBe('');
    expect(partsPayload([P('CASH', '200'), P('UPI', '100.005')])).toEqual([{ mode: 'CASH', amount: 200 }, { mode: 'UPI', amount: 100.01 }]);
  });
});
