import { describe, expect, it } from 'vitest';
import type { Bill } from '../bills/types';
import { addLine, balanceTwo, discountPending, discountProblem, gstSplit, cartTotals, hasOrderChanges, matchesFilter, noteWithPrefix, orderGates, orderMode, partsText, phoneDigits, statusLabel, stripNotePrefix, upsertOrder, type CartLine } from './rules';

const dish = (id: number, price = 100) => ({ id, name: `D${id}`, price });
const line = (id: number, quantity = 1, extra: Partial<CartLine> = {}): CartLine => ({ item: dish(id), quantity, customization: '', isTakeaway: false, ...extra });
const order = (o: Partial<Bill> = {}): Bill => ({ id: 1, billNumber: 'B1', status: 'ACTIVE', subtotal: 100, netAmount: 105, items: [{ menuItemId: 1, itemName: 'D1', quantity: 1, price: 100, subtotal: 100, printedQuantity: 0 }], ...o });
const base = { mode: 'TABLE' as const, isManager: true, discount: '0', gstSel: '0', gstCustom: '0', parcel: '10', defaultParcel: 10, order: null };

describe('cartTotals', () => {
  it('adds discount, GST and parcel in the server order', () => {
    const t = cartTotals({ ...base, cart: [line(1, 2)], discount: '10', gstSel: '5' });
    expect(t.subtotal).toBe(200); expect(t.tax).toBe(9); expect(t.net).toBe(189);
  });
  it('charges parcel only for takeaway orders or parcel lines', () => {
    expect(cartTotals({ ...base, cart: [line(1)] }).parcel).toBe(0);
    expect(cartTotals({ ...base, cart: [line(1, 1, { isTakeaway: true })], parcel: '15' }).net).toBe(115);
    expect(cartTotals({ ...base, mode: 'TAKEAWAY', cart: [line(1)], parcel: '' }).parcel).toBe(10);
  });
  it('staff use the order own discount and tax, not typed ones', () => {
    const t = cartTotals({ ...base, isManager: false, discount: '50', gstSel: '18', cart: [line(1)], order: order({ discountPercent: 10, taxPercent: 5 }) });
    expect(t.net).toBe(94.5);
  });
  it('a custom GST rate is used', () => { expect(cartTotals({ ...base, cart: [line(1)], gstSel: 'custom', gstCustom: '12' }).tax).toBe(12); });
});

describe('hasOrderChanges', () => {
  const a = { ready: true, mode: 'TABLE' as const, customer: '', notes: '', parcelVisible: false, parcel: '10' };
  it('is false with no items or no place', () => {
    expect(hasOrderChanges({ ...a, cart: [], order: null })).toBe(false);
    expect(hasOrderChanges({ ...a, ready: false, cart: [line(1)], order: null })).toBe(false);
  });
  it('is true for a new order and false for the unchanged saved one', () => {
    expect(hasOrderChanges({ ...a, cart: [line(1)], order: null })).toBe(true);
    expect(hasOrderChanges({ ...a, cart: [line(1)], order: order() })).toBe(false);
  });
  it('sees quantity, note, customer and parcel edits', () => {
    expect(hasOrderChanges({ ...a, cart: [line(1, 2)], order: order() })).toBe(true);
    expect(hasOrderChanges({ ...a, cart: [line(1, 1, { customization: 'less sugar' })], order: order() })).toBe(true);
    expect(hasOrderChanges({ ...a, customer: 'Asha', cart: [line(1)], order: order() })).toBe(true);
    expect(hasOrderChanges({ ...a, mode: 'TAKEAWAY', parcelVisible: true, parcel: '20', cart: [line(1)], order: order({ orderType: 'TAKEAWAY', parcelCharge: 10, customerName: 'Guest' }) })).toBe(true);
  });
  it('sees the loyalty phone number being added, changed or removed, and ignores how it is written', () => {
    expect(hasOrderChanges({ ...a, phone: '9876543210', cart: [line(1)], order: order() })).toBe(true);
    expect(hasOrderChanges({ ...a, phone: '9876543210', cart: [line(1)], order: order({ customerPhone: '+919876543210' }) })).toBe(false);
    expect(hasOrderChanges({ ...a, phone: '98765 43211', cart: [line(1)], order: order({ customerPhone: '+919876543210' }) })).toBe(true);
    expect(hasOrderChanges({ ...a, phone: '', cart: [line(1)], order: order({ customerPhone: '+919876543210' }) })).toBe(true);
    expect(hasOrderChanges({ ...a, cart: [line(1)], order: order({ customerPhone: '+919876543210' }) })).toBe(false);
  });
  it('treats "Guest" and empty as the same takeaway customer', () => {
    expect(hasOrderChanges({ ...a, mode: 'TAKEAWAY', cart: [line(1)], order: order({ orderType: 'TAKEAWAY', customerName: 'Guest', items: [{ menuItemId: 1, itemName: 'D1', quantity: 1, price: 100, subtotal: 100, isTakeaway: true }] }) })).toBe(false);
  });
});

describe('orderGates', () => {
  const g = (o: Bill | null, extra: Partial<Parameters<typeof orderGates>[0]> = {}) => orderGates({ ready: true, mode: 'TABLE', cartCount: 1, order: o, changed: false, saving: false, sendingKot: false, ...extra });
  it('walks the order flow one step at a time', () => {
    expect(g(null, { changed: true }).save.disabled).toBe(false);
    expect(g(null, { changed: true }).kot.disabled).toBe(true);
    expect(g(order()).kot.disabled).toBe(false);
    expect(g(order()).request.disabled).toBe(true);
    const printed = order({ status: 'KOT_PRINTED', kotPrintedAt: 'x', items: [{ menuItemId: 1, itemName: 'D1', quantity: 1, price: 100, subtotal: 100, printedQuantity: 1 }] });
    expect(g(printed).kot.disabled).toBe(true);
    expect(g(printed).request.disabled).toBe(false);
    expect(g(order({ status: 'BILL_REQUESTED' })).print.disabled).toBe(false);
    expect(g(order({ status: 'BILL_REQUESTED' })).request.disabled).toBe(true);
  });
  it('locks everything but the allowed step while saving', () => {
    expect(g(null, { changed: true, saving: true }).save.disabled).toBe(true);
    expect(g(order(), { sendingKot: true }).kot.title).toMatch(/printing/i);
  });
  it('a new dish after the kitchen ticket re-enables Print KOT after saving', () => {
    const o = order({ status: 'KOT_PRINTED', kotPrintedAt: 'x', items: [{ menuItemId: 1, itemName: 'D1', quantity: 2, price: 100, subtotal: 200, printedQuantity: 1 }] });
    expect(g(o).kot.disabled).toBe(false);
    expect(g(o).request.disabled).toBe(true);
  });
});

describe('labels and helpers', () => {
  it('reads the order place', () => {
    expect(orderMode({ orderType: 'TAKEAWAY' })).toBe('TAKEAWAY');
    expect(orderMode({ outdoorToken: 'OUT-1' })).toBe('OUTDOOR');
    expect(orderMode({})).toBe('TABLE');
  });
  it('strips and rebuilds the note prefix', () => {
    expect(stripNotePrefix('Table Order: less ice')).toBe('less ice');
    expect(stripNotePrefix('Takeaway Order')).toBe('');
    expect(noteWithPrefix('OUTDOOR', ' hot ')).toBe('Outdoor Order: hot');
    expect(noteWithPrefix('TABLE', '')).toBe('Table Order');
  });
  it('names the states', () => {
    expect(statusLabel(order({ status: 'BILL_PRINTED' }), 'TABLE', 'chip').text).toBe('Pending Pay');
    expect(statusLabel(order(), 'TABLE', 'badge').text).toBe('OCCUPIED');
    expect(statusLabel(order({ status: 'KOT_PRINTED' }), 'TAKEAWAY', 'chip').text).toBe('Packing');
    expect(statusLabel(null, 'TABLE', 'picker').text).toBe('Vacant');
  });
  it('upserts and drops settled orders', () => {
    expect(upsertOrder([order({ id: 1 })], order({ id: 2 })).map((o) => o.id)).toEqual([1, 2]);
    expect(upsertOrder([order({ id: 1 })], order({ id: 1, status: 'PAID' }))).toEqual([]);
  });
  it('filters active orders', () => {
    const t = order({ tableNumber: 'T-01', customerName: 'Asha' });
    expect(matchesFilter(t, 'TABLE', '')).toBe(true);
    expect(matchesFilter(t, 'OUTDOOR', '')).toBe(false);
    expect(matchesFilter(t, 'ALL', 'ash')).toBe(true);
    expect(matchesFilter(t, 'ALL', 'zzz')).toBe(false);
  });
});

describe('phoneDigits', () => {
  it('keeps the last 10 digits of a number typed by hand or stored with +91', () => {
    expect(phoneDigits('+91 98765-43210')).toBe('9876543210');
    expect(phoneDigits('09876543210')).toBe('9876543210');
    expect(phoneDigits('98765')).toBe('98765');
    expect(phoneDigits(null)).toBe('');
  });
});

describe('addLine', () => {
  it('raises the quantity of the same kind and keeps dine-in and parcel apart', () => {
    const once = addLine([], dish(1), false);
    expect(addLine(once, dish(1), false)[0].quantity).toBe(2);
    expect(addLine(once, dish(1), true)).toHaveLength(2);
  });
});

describe('gstSplit', () => {
  const cfg = { enabled: true, cgstPercent: 2.5, sgstPercent: 2.5, totalGstPercent: 5 };
  it('keeps the configured halves for the configured rate and splits any other rate evenly', () => {
    expect(gstSplit(5, cfg)).toEqual({ cgst: 2.5, sgst: 2.5 });
    expect(gstSplit(12, cfg)).toEqual({ cgst: 6, sgst: 6 });
    expect(gstSplit(18, null)).toEqual({ cgst: 9, sgst: 9 });
  });
});

describe('discount save', () => {
  it('a typed discount is pending until it is saved', () => {
    expect(discountPending({ discount: '0', discountInput: '0' })).toBe(false);
    expect(discountPending({ discount: '0', discountInput: '10' })).toBe(true);
    expect(discountPending({ discount: '10', discountInput: '10.0' })).toBe(false);
    expect(discountPending({ discount: '10', discountInput: '' })).toBe(true);
  });
  it('rejects a discount outside 0-100', () => {
    expect(discountProblem('15')).toBeNull();
    expect(discountProblem('')).toBeNull();
    expect(discountProblem('101')).not.toBeNull();
    expect(discountProblem('-5')).not.toBeNull();
  });
});

describe('cash plus UPI', () => {
  const two = () => [{ mode: 'CASH' as const, amount: '' }, { mode: 'UPI' as const, amount: '' }];
  it('typing the cash makes the UPI what is left of the bill', () => {
    const p = balanceTwo(300, two(), 0, '100');
    expect(p.map((x) => x.amount)).toEqual(['100', '200.00']);
    expect(partsText(p)).toBe('Cash ₹100.00 + UPI ₹200.00');
  });
  it('typing the UPI first works the same way', () => {
    expect(balanceTwo(300, two(), 1, '250.50').map((x) => x.amount)).toEqual(['49.50', '250.50']);
  });
  it('paise stay exact and a clear box clears the other one', () => {
    expect(balanceTwo(480.1, two(), 0, '0.1').map((x) => x.amount)).toEqual(['0.1', '480.00']);
    expect(balanceTwo(300, [{ mode: 'CASH', amount: '100' }, { mode: 'UPI', amount: '200.00' }], 0, '').map((x) => x.amount)).toEqual(['', '']);
  });
  it('more than the bill leaves nothing for the other way (the screen then says it is too much)', () => {
    expect(balanceTwo(300, two(), 0, '350').map((x) => x.amount)).toEqual(['350', '']);
  });
  it('with three or more payments only the typed one changes', () => {
    const three = [{ mode: 'CASH' as const, amount: '' }, { mode: 'UPI' as const, amount: '50' }, { mode: 'CARD' as const, amount: '' }];
    expect(balanceTwo(300, three, 0, '100').map((x) => x.amount)).toEqual(['100', '50', '']);
  });
});
