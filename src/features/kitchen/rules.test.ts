import { describe, expect, it } from 'vitest';
import type { KitchenTicket } from './api';
import { minutesOpen, newQuantity, oldestFirst, ticketLabel, urgencyOf } from './rules';

const t = (over: Partial<KitchenTicket>): KitchenTicket => ({ id: 1, billNumber: 'B-1', orderType: 'TABLE', tableNumber: 'T4', status: 'KOT_PRINTED', createdAt: '2026-10-29T12:00:00', items: [], ...over });

describe('kitchen display rules', () => {
  it('labels where the dish goes', () => {
    expect(ticketLabel(t({}))).toBe('Table T4');
    expect(ticketLabel(t({ orderType: 'OUTDOOR', outdoorToken: '14' }))).toBe('Outdoor 14');
    expect(ticketLabel(t({ orderType: 'TAKEAWAY', takeawayToken: '7' }))).toBe('Takeaway 7');
  });
  it('counts minutes open, never negative, and tolerates a bad date', () => {
    const now = Date.parse('2026-10-29T12:25:00');
    expect(minutesOpen('2026-10-29T12:00:00', now)).toBe(25);
    expect(minutesOpen('2026-10-29T12:30:00', now)).toBe(0);
    expect(minutesOpen('not a date', now)).toBe(0);
  });
  it('turns orange after 10 minutes and red after 20', () => {
    expect([0, 9, 10, 19, 20, 45].map(urgencyOf)).toEqual(['fresh', 'fresh', 'slow', 'slow', 'late', 'late']);
  });
  it('shows how many of a line are new in this round', () => {
    expect(newQuantity({ name: 'Tea', quantity: 3, printedQuantity: 1 })).toBe(2);
    expect(newQuantity({ name: 'Tea', quantity: 2 })).toBe(2);
    expect(newQuantity({ name: 'Tea', quantity: 1, printedQuantity: 4 })).toBe(0);
  });
  it('puts the order that has waited longest first', () => {
    const list = [t({ id: 2, createdAt: '2026-10-29T12:10:00' }), t({ id: 1, createdAt: '2026-10-29T12:00:00' }), t({ id: 3, createdAt: '2026-10-29T12:20:00' })];
    expect(oldestFirst(list).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(list.map((x) => x.id)).toEqual([2, 1, 3]);   // the original is untouched
  });
});
