import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './api';
import { daysText, daysUntil, expiryTone, formFromItem, isExpiring, payloadFromForm, reasonLabel, visibleItems } from './rules';

const item = (o: Partial<InventoryItem> = {}): InventoryItem => ({ id: 1, name: 'Bread', quantity: 10, unit: 'piece', minQuantity: 2, itemCategory: 'Stock', ...o });

describe('expiry wording and status', () => {
  it('says when in plain words', () => {
    expect(daysText(0)).toBe('today');
    expect(daysText(1)).toBe('tomorrow');
    expect(daysText(-1)).toBe('yesterday');
    expect(daysText(4)).toBe('in 4 days');
    expect(daysText(-3)).toBe('3 days ago');
  });
  it('counts days from the local date, in either direction', () => {
    const now = new Date(2026, 9, 25, 23, 30);                 // 25 Oct, late evening
    expect(daysUntil('2026-10-25', now)).toBe(0);
    expect(daysUntil('2026-10-26', now)).toBe(1);
    expect(daysUntil('2026-10-24', now)).toBe(-1);
    expect(daysUntil('2026-11-01', now)).toBe(7);
  });
  it('only expired and soon count as expiring', () => {
    expect(isExpiring(item({ expiryStatus: 'EXPIRED' }))).toBe(true);
    expect(isExpiring(item({ expiryStatus: 'SOON' }))).toBe(true);
    expect(isExpiring(item({ expiryStatus: 'OK' }))).toBe(false);
    expect(isExpiring(item())).toBe(false);
    expect(expiryTone('EXPIRED')).toBe('danger'); expect(expiryTone('SOON')).toBe('warn'); expect(expiryTone('OK')).toBe('neutral');
  });
  it('the expiring filter keeps only those items', () => {
    const list = [item({ id: 1, expiryStatus: 'SOON' }), item({ id: 2, name: 'Rice' }), item({ id: 3, name: 'Cake', expiryStatus: 'OK' })];
    expect(visibleItems(list, 'ALL', '', false, true).map((i) => i.id)).toEqual([1]);
    expect(visibleItems(list, 'ALL', '', false).map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it('reason labels read well and USAGE is the default', () => {
    expect(reasonLabel('EXPIRED')).toBe('Expired');
    expect(reasonLabel('STAFF_MEAL')).toBe('Staff meal');
    expect(reasonLabel('USAGE')).toBe('Usage');
    expect(reasonLabel(undefined)).toBe('');
  });
});

describe('the item form: automatic deduction, shelf life, warning days', () => {
  it('a new item deducts automatically, has no shelf life and warns 2 days before', () => {
    const f = formFromItem(null, 'Stock');
    expect(f).toMatchObject({ autoDeduct: true, shelfLifeDays: '', expiryWarnDays: '2' });
  });
  it('an existing item shows its saved values', () => {
    expect(formFromItem(item({ autoDeduct: false, shelfLifeDays: 5, expiryWarnDays: 3 }), 'Stock')).toMatchObject({ autoDeduct: false, shelfLifeDays: '5', expiryWarnDays: '3' });
    expect(formFromItem(item({ expiryWarnDays: null }), 'Stock').expiryWarnDays).toBe('2');
  });
  it('saves the values; an empty shelf life is sent as 0 (clears it)', () => {
    const f = { ...formFromItem(item({ autoDeduct: false, shelfLifeDays: 5, expiryWarnDays: 3 }), 'Stock') };
    expect(payloadFromForm(f)).toMatchObject({ autoDeduct: false, shelfLifeDays: 5, expiryWarnDays: 3 });
    expect(payloadFromForm({ ...f, shelfLifeDays: '' })).toMatchObject({ shelfLifeDays: 0 });
  });
  it('refuses a fractional or out-of-range number of days', () => {
    const f = formFromItem(item(), 'Stock');
    expect(payloadFromForm({ ...f, shelfLifeDays: '2.5' })).toMatch(/whole number of days/);
    expect(payloadFromForm({ ...f, shelfLifeDays: '-1' })).toMatch(/whole number of days/);
    expect(payloadFromForm({ ...f, shelfLifeDays: '4000' })).toMatch(/whole number of days/);
    expect(payloadFromForm({ ...f, expiryWarnDays: '400' })).toMatch(/Warn before expiry/);
    expect(payloadFromForm({ ...f, expiryWarnDays: '1.5' })).toMatch(/Warn before expiry/);
  });
});
