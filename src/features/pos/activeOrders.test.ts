import { describe, expect, it } from 'vitest';
import { countsByMode, minutesSince, orderChip, orderItems, orderTitle, timeAgo, waitTone } from './activeOrders';

const NOW = new Date('2027-03-10T12:00:00Z').getTime();
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe('status chip', () => {
  it('follows the order from the guest to the till', () => {
    expect(orderChip({ status: 'ACTIVE' }, 'TABLE')).toMatchObject({ text: 'NEW', tone: 'info' });
    expect(orderChip({ status: 'KOT_REQUESTED' }, 'TABLE')).toMatchObject({ text: 'SENDING', pulse: true });
    expect(orderChip({ status: 'KOT_PRINTED' }, 'TABLE')).toMatchObject({ text: 'PREP', tone: 'warn', pulse: false });
    expect(orderChip({ status: 'BILL_REQUESTED' }, 'TABLE')).toMatchObject({ text: 'BILL ASKED', tone: 'violet', pulse: true });
    expect(orderChip({ status: 'BILL_PRINTED' }, 'TABLE')).toMatchObject({ text: 'BILLED', tone: 'violet' });
  });
  it('says packing for takeaway', () => { expect(orderChip({ status: 'KOT_PRINTED' }, 'TAKEAWAY').text).toBe('PACKING'); });
  it('shows an unknown status as plain words', () => { expect(orderChip({ status: 'SOME_NEW_STATE' }, 'TABLE')).toMatchObject({ text: 'SOME NEW STATE', tone: 'neutral' }); });
});

describe('title', () => {
  it('a table order names the table, then the guest or Dine-In', () => {
    expect(orderTitle({ orderType: 'TABLE', tableNumber: 'T-01', customerName: 'Guest' })).toMatchObject({ title: 'Table T-01', sub: 'Dine-In', mode: 'TABLE' });
    expect(orderTitle({ orderType: 'TABLE', tableNumber: 'T-02', customerName: 'Elena R.' })).toMatchObject({ title: 'Table T-02', sub: 'Elena R.' });
    expect(orderTitle({ orderType: 'TABLE', tableNumber: 'T-03', customerName: '  ' }).sub).toBe('Dine-In');
  });
  it('outdoor and takeaway show their token', () => {
    expect(orderTitle({ orderType: 'OUTDOOR', outdoorToken: 'OUT-7', customerName: 'Marco' })).toMatchObject({ title: 'Outdoor OUT-7', sub: 'Marco', mode: 'OUTDOOR' });
    expect(orderTitle({ orderType: 'TAKEAWAY', takeawayToken: 'TAK-4', customerName: null })).toMatchObject({ title: 'Takeaway TAK-4', sub: 'Guest', mode: 'TAKEAWAY' });
  });
});

describe('time', () => {
  it('counts minutes and never goes negative', () => {
    expect(minutesSince(ago(12), NOW)).toBe(12);
    expect(minutesSince(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toBe(0);
    expect(minutesSince(null, NOW)).toBeNull();
    expect(minutesSince('not a date', NOW)).toBeNull();
  });
  it('writes it the way people say it', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now');
    expect(timeAgo(ago(12), NOW)).toBe('12m ago');
    expect(timeAgo(ago(65), NOW)).toBe('1h 05m ago');
    expect(timeAgo(ago(60 * 26), NOW)).toBe('1d ago');
    expect(timeAgo(undefined, NOW)).toBe('');
  });
  it('flags long waits', () => {
    expect(waitTone(ago(10), NOW)).toBe('calm');
    expect(waitTone(ago(45), NOW)).toBe('late');
    expect(waitTone(ago(90), NOW)).toBe('overdue');
    expect(waitTone(undefined, NOW)).toBe('calm');
  });
});

describe('dishes on a card', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ itemName: `Dish ${i + 1}`, quantity: i + 1, price: 10, subtotal: 10, customization: i === 0 ? ' less spicy ' : '' }));
  it('lists quantity and name, and how many more there are', () => {
    const r = orderItems({ items: items(6) }, 4);
    expect(r.lines).toHaveLength(4);
    expect(r.more).toBe(2);
    expect(r.lines[0]).toEqual({ qty: 1, name: 'Dish 1', note: 'less spicy' });
  });
  it('leaves out lines with no quantity', () => {
    const r = orderItems({ items: [{ itemName: 'Gone', quantity: 0, price: 1, subtotal: 0 }, { itemName: 'Here', quantity: 2, price: 1, subtotal: 2 }] });
    expect(r.lines.map((l) => l.name)).toEqual(['Here']);
    expect(r.more).toBe(0);
  });
  it('copes with no items', () => { expect(orderItems({ items: [] })).toEqual({ lines: [], more: 0 }); });
});

describe('filter counts', () => {
  it('counts every kind of order', () => {
    const c = countsByMode([
      { orderType: 'TABLE', tableNumber: 'T-01' }, { orderType: 'TABLE', tableNumber: 'T-02' },
      { orderType: 'OUTDOOR', outdoorToken: 'OUT-1' }, { orderType: 'TAKEAWAY', takeawayToken: 'TAK-1' },
    ]);
    expect(c).toEqual({ ALL: 4, TABLE: 2, OUTDOOR: 1, TAKEAWAY: 1 });
  });
});
