import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './api';
import { isNegative, issuePreview, visibleItems } from './rules';

const item = (o: Partial<InventoryItem> = {}): InventoryItem => ({ id: 1, name: 'Bun', quantity: 3, unit: 'piece', minQuantity: 2, itemCategory: 'Stock', ...o });

describe('stock below zero (used before the purchase was entered)', () => {
  it('only a number under zero counts; zero does not', () => {
    expect(isNegative(item({ quantity: -2 }))).toBe(true);
    expect(isNegative(item({ quantity: 0 }))).toBe(false);
    expect(isNegative(item({ quantity: 0.5 }))).toBe(false);
  });
  it('the list can show just those items', () => {
    const list = [item({ id: 1, quantity: -1 }), item({ id: 2, quantity: 4 }), item({ id: 3, quantity: 0 })];
    expect(visibleItems(list, 'ALL', '', false, false, true).map((i) => i.id)).toEqual([1]);
    expect(visibleItems(list, 'ALL', '', false).map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it('issuing more than is in stock shows how far below zero it would go', () => {
    expect(issuePreview(item({ quantity: 2 }), 5, false)).toEqual({ used: 5, left: -3 });
    expect(issuePreview(item({ quantity: 2, packSize: 4, packName: 'packet' }), 1, true)).toEqual({ used: 4, left: -2 });
  });
});
