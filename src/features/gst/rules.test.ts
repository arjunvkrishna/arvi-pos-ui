import { describe, expect, it } from 'vitest';
import { buildPreview, totalPercent } from './rules';

describe('GST receipt preview', () => {
  it('2.5% + 2.5% on ₹200 is a ₹210 tax invoice', () => {
    expect(buildPreview(true, '', 2.5, 2.5, false)).toMatchObject({ title: 'TAX INVOICE', cgstAmt: 5, sgstAmt: 5, grandTotal: 210, roundOff: null, gstin: '32CQRPS5214H3ZK' });
  });
  it('round-off moves the total to a whole rupee and shows the difference', () => {
    expect(buildPreview(true, 'X', 2.5, 3.1, true)).toMatchObject({ roundOff: -0.2, grandTotal: 211 });   // 200 + 5 + 6.2 = 211.20
    expect(buildPreview(true, 'X', 2.5, 3.3, true)).toMatchObject({ roundOff: 0.4, grandTotal: 212 });    // 211.60
  });
  it('with GST off it is a plain cash bill', () => {
    expect(buildPreview(false, 'X', 2.5, 2.5, true)).toMatchObject({ title: 'CASH BILL / RECEIPT', tag: 'GST DISABLED', showGstin: false, grandTotal: 200 });
  });
  it('adds the two halves', () => { expect(totalPercent(2.5, 2.5)).toBe(5); expect(totalPercent(0.1, 0.2)).toBe(0.3); });
});
