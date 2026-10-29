import { describe, expect, it } from 'vitest';
import type { CountLine, ReorderRow } from './api';
import { NO_SUPPLIER, changeText, groupBySupplier, groupTotal, orderLabel, orderQty, orderText, parseCounted, summarize, varianceText } from './stockops';

const row = (o: Partial<ReorderRow> = {}): ReorderRow => ({ itemId: 1, name: 'Cola', unit: 'bottle', quantity: 0, minQuantity: 5, reason: 'OUT', suggestedUnits: 24, suggestedPacks: 2, packName: 'case', packSize: 12, supplier: 'Coorg Foods', lastUnitCost: 20, estimatedCost: 480, ...o });
const line = (o: Partial<CountLine> = {}): CountLine => ({ id: 1, itemId: 1, name: 'Cola', unit: 'bottle', bookQty: 10, countedQty: null, ...o });

describe('reorder list', () => {
  it('groups by supplier, no-supplier last', () => {
    const g = groupBySupplier([row({ itemId: 1, supplier: 'Metro' }), row({ itemId: 2, supplier: null }), row({ itemId: 3, supplier: 'Coorg Foods' }), row({ itemId: 4, supplier: 'Metro' })]);
    expect(g.map((x) => x.supplier)).toEqual(['Coorg Foods', 'Metro', NO_SUPPLIER]);
    expect(g[1].rows).toHaveLength(2);
  });
  it('an edited quantity wins; nonsense falls back to the suggestion', () => {
    expect(orderQty(row(), {})).toBe(24);
    expect(orderQty(row(), { 1: 36 })).toBe(36);
    expect(orderQty(row(), { 1: 0 })).toBe(0);
    expect(orderQty(row(), { 1: -4 })).toBe(24);
    expect(orderQty(row(), { 1: NaN })).toBe(24);
  });
  it('labels packs and plain units', () => {
    expect(orderLabel(row(), 24)).toBe('2 case (24 bottle)');
    expect(orderLabel(row(), 30)).toBe('30 bottle');
    expect(orderLabel(row({ packSize: null, packName: null, unit: 'kg' }), 6)).toBe('6 kg');
  });
  it('total follows the edited quantities', () => {
    const g = groupBySupplier([row({ itemId: 1 }), row({ itemId: 2, lastUnitCost: 10, suggestedUnits: 10 })])[0];
    expect(groupTotal(g, {})).toBe(24 * 20 + 10 * 10);
    expect(groupTotal(g, { 2: 0 })).toBe(24 * 20);
  });
  it('writes a message and leaves out zero rows; empty when nothing to order', () => {
    const g = groupBySupplier([row({ itemId: 1 }), row({ itemId: 2, name: 'Bun', packSize: null, packName: null, unit: 'pcs', suggestedUnits: 10 })])[0];
    const t = orderText(g, { 2: 0 }, new Date(2026, 9, 23));
    expect(t).toContain('Order for Coorg Foods (23 Oct 2026)');
    expect(t).toContain('1. Cola - 2 case (24 bottle)');
    expect(t).not.toContain('Bun');
    expect(orderText(g, { 1: 0, 2: 0 })).toBe('');
  });
});

describe('stock count sheet', () => {
  it('parses typed figures', () => {
    expect(parseCounted('')).toBeNull();
    expect(parseCounted(' 8 ')).toBe(8);
    expect(parseCounted('2.5')).toBe(2.5);
    expect(parseCounted('-1')).toBeUndefined();
    expect(parseCounted('abc')).toBeUndefined();
  });
  it('summarizes counted, differing and the money value live', () => {
    const lines = [line({ id: 1, bookQty: 10 }), line({ id: 2, bookQty: 24, name: 'Bun' }), line({ id: 3, bookQty: 8, name: 'Rice', countedQty: 8 })];
    const cost = (l: CountLine) => ({ 1: 20, 2: 5, 3: 60 }[l.id] ?? 0);
    const s = summarize(lines, { 1: '8', 2: '26' }, cost);
    expect(s).toEqual({ counted: 3, total: 3, differences: 2, value: -30 });
    expect(summarize(lines, {}, cost)).toEqual({ counted: 1, total: 3, differences: 0, value: 0 });
    expect(summarize(lines, { 3: '' }, cost).counted).toBe(0);
    expect(summarize(lines, { 1: 'x' }, cost).counted).toBe(1);   // an invalid box does not count
  });
  it('words a variance', () => {
    expect(varianceText(-2, 'bottle')).toBe('−2 bottle');
    expect(varianceText(3, 'kg')).toBe('+3 kg');
    expect(varianceText(0)).toBe('matches');
    expect(varianceText(null)).toBe('');
  });
});

describe('cost alerts', () => {
  it('signs the change', () => { expect(changeText(25)).toBe('+25%'); expect(changeText(-10.5)).toBe('−10.5%'); });
});
