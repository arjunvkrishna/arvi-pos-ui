import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './api';
import { formFromItem, hasSize, issuePreview, packBreakdown, payloadFromForm, presetRange, visibleItems } from './rules';

const item = (o: Partial<InventoryItem>): InventoryItem => ({ id: 1, name: 'Cola', unit: 'bottle', quantity: 79, minQuantity: 10, packName: 'case', packSize: 12, itemCategory: 'Stock', ...o });

describe('inventory rules', () => {
  it('shows packs and the remainder', () => {
    expect(packBreakdown(item({}), 79)).toBe('6 case + 7 bottle');
    expect(packBreakdown(item({}), 24)).toBe('2 case');
    expect(packBreakdown(item({}), 5)).toBe('');
    expect(packBreakdown(item({ packSize: 0 }), 79)).toBe('');
  });
  it('knows when an item has a separate size', () => {
    expect(hasSize({ unit: 'bottle', volumeUnit: 'ml', unitVolume: 500 })).toBe(true);
    expect(hasSize({ unit: 'bottle', volumeUnit: 'na', unitVolume: 1 })).toBe(false);
    expect(hasSize({ unit: 'kg', volumeUnit: 'kg', unitVolume: 1 })).toBe(false);
  });
  it('filters by category, low stock and search', () => {
    const list = [item({ id: 1 }), item({ id: 2, name: 'Napkins', itemCategory: 'Consumable', lowStock: true, supplier: 'Paper Co' }), item({ id: 3, name: 'Grinder', itemCategory: 'Fixed asset' })];
    expect(visibleItems(list, 'Consumable', '', false).map((i) => i.id)).toEqual([2]);
    expect(visibleItems(list, 'ALL', '', true).map((i) => i.id)).toEqual([2]);
    expect(visibleItems(list, 'ALL', ' paper ', false).map((i) => i.id)).toEqual([2]);
    expect(visibleItems(list, 'ALL', '', false)).toHaveLength(3);
  });
  it('previews an issue in units or packs', () => {
    expect(issuePreview(item({}), 5, false)).toEqual({ used: 5, left: 74 });
    expect(issuePreview(item({}), 2, true)).toEqual({ used: 24, left: 55 });
    expect(issuePreview(item({ quantity: 3 }), 5, false).left).toBeLessThan(0);
  });
  it('builds the save payload; countable units ignore the size; a pack needs more than 1', () => {
    const base = { ...formFromItem(null, 'Stock'), name: ' Cola ', unit: 'bottle', quantity: '24', costPerUnit: '20', minQuantity: '6', unitVolume: '0.5', volumeUnit: 'ltr' };
    const p = payloadFromForm(base);
    expect(p).toMatchObject({ name: 'Cola', quantity: 24, unitVolume: 0.5, totalVolume: 12, costPerVolume: 40, packSize: 0, packName: null });
    expect(payloadFromForm({ ...base, unit: 'piece', volumeUnit: 'pieces' })).toMatchObject({ unitVolume: 1, totalVolume: 24, costPerVolume: 20 });
    expect(typeof payloadFromForm({ ...base, hasPack: true, packSize: '1' })).toBe('string');
    expect(payloadFromForm({ ...base, hasPack: true, packSize: '12', packName: '' })).toMatchObject({ packName: 'pack', packSize: 12 });
  });
  it('resolves history date presets (week starts Monday)', () => {
    const wed = new Date(2026, 9, 21, 12);   // Wed 21 Oct 2026
    expect(presetRange('this_week', '', '', wed).startDate).toBe('2026-10-19');
    expect(presetRange('this_month', '', '', wed).startDate).toBe('2026-10-01');
    expect(presetRange('custom', '2026-01-01', '2026-01-31', wed)).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(presetRange('all', '', '', wed)).toEqual({ startDate: '', endDate: '' });
  });
});
