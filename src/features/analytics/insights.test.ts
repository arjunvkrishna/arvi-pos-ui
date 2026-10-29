import { describe, expect, it } from 'vitest';
import type { Insights, Metric } from './api';
import { deltaView, heatLevel, highlights, hourLabel, hourRange, peakHours } from './insights';
import { DEFAULT_LAYOUT, PRESETS, WIDGET_IDS, isShown, layoutKey, loadLayout, moveWidget, normalizeLayout, saveLayout, shownOrder, toggleWidget } from './layout';

const m = (current: number, previous: number, changePercent: number | null): Metric => ({ current, previous, changePercent });
const base = (): Insights => ({
  start: '2026-10-01', end: '2026-10-23', prevStart: '2026-09-08', prevEnd: '2026-09-30',
  compare: { sales: m(1200, 1000, 20), orders: m(30, 30, 0), avgOrder: m(40, 33, 21.2), itemsPerOrder: m(2, 2, 0), discounts: m(0, 0, null), refunds: m(0, 0, null), voids: m(0, 0, null) },
  byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: h === 20 ? 500 : h === 13 ? 300 : h === 9 ? 100 : 0, orders: h === 20 ? 9 : 1 })),
  byWeekday: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: d, label: 'x', sales: d * 100, orders: d, avgOrder: 100, days: 3, salesPerDay: d * 33 })),
  heatmap: [], byOrderType: [{ label: 'Dine-in', orders: 20, amount: 900, quantity: 0, share: 75 }, { label: 'Takeaway', orders: 10, amount: 300, quantity: 0, share: 25 }],
  byPaymentMode: [], byCategory: [{ label: 'Burgers', orders: 10, amount: 600, quantity: 20, share: 50 }], byStaff: [], byTable: [],
  discounts: { discountAmount: 0, promotionAmount: 0, total: 0, billsWithDiscount: 0, percentOfGross: 0 }, losses: { refundAmount: 0, refundCount: 0, voidedCount: 0, voidedValue: 0, cancelledCount: 0, wasteCost: 0 },
  tax: { taxableSales: 0, cgst: 0, sgst: 0, totalTax: 0, roundOff: 0 }, dishes: [], neverSold: [], neverSoldCount: 0,
  stock: { valueByCategory: [], totalValue: 0, negativeCount: 0, lowCount: 0, expiringCount: 0, expiredCount: 0, wasteByReason: [], wasteCost: 0 },
});

describe('change arrows', () => {
  it('a rise is good for sales and bad for discounts, refunds and voids', () => {
    expect(deltaView(m(120, 100, 20))).toEqual({ text: '▲ 20%', tone: 'ok' });
    expect(deltaView(m(80, 100, -20))).toEqual({ text: '▼ 20%', tone: 'danger' });
    expect(deltaView(m(120, 100, 20), false)).toEqual({ text: '▲ 20%', tone: 'danger' });
    expect(deltaView(m(80, 100, -20), false)).toEqual({ text: '▼ 20%', tone: 'ok' });
  });
  it('nothing before is "new", zero is flat, no data is a dash', () => {
    expect(deltaView(m(50, 0, null))).toEqual({ text: 'new', tone: 'neutral' });
    expect(deltaView(m(0, 0, null))).toEqual({ text: '–', tone: 'neutral' });
    expect(deltaView(m(10, 10, 0))).toEqual({ text: '▬ 0%', tone: 'neutral' });
    expect(deltaView(undefined)).toEqual({ text: '', tone: 'neutral' });
  });
});

describe('busy hours', () => {
  it('labels hours the way people say them', () => {
    expect([hourLabel(0), hourLabel(9), hourLabel(12), hourLabel(13), hourLabel(23)]).toEqual(['12 am', '9 am', '12 pm', '1 pm', '11 pm']);
    expect(hourRange(20)).toBe('8 pm – 9 pm'); expect(hourRange(23)).toBe('11 pm – 12 am');
  });
  it('the busiest hours first, empty hours never', () => {
    expect(peakHours(base().byHour, 3).map((h) => h.hour)).toEqual([20, 13, 9]);
    expect(peakHours(base().byHour, 1)).toHaveLength(1);
    expect(peakHours(Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0 })))).toEqual([]);
  });
  it('heat levels are relative to the busiest square', () => {
    expect([heatLevel(0, 100), heatLevel(10, 100), heatLevel(30, 100), heatLevel(60, 100), heatLevel(100, 100), heatLevel(5, 0)]).toEqual([0, 1, 2, 3, 4, 0]);
  });
});

describe('highlights in plain words', () => {
  it('says what changed, when it is busy and the best and slowest day', () => {
    const t = highlights(base()).map((h) => h.text);
    expect(t[0]).toMatch(/Sales are ₹1,200, up 20% on the previous period/);
    expect(t.some((x) => /busiest hour is 8 pm – 9 pm/.test(x))).toBe(true);
    expect(t.some((x) => /Sunday is the best day.*Monday the slowest/.test(x))).toBe(true);
    expect(t.some((x) => /Dine-in brings 75% of sales/.test(x))).toBe(true);
    expect(t.some((x) => /Burgers is the top category with 50%/.test(x))).toBe(true);
  });
  it('without a previous period it says so; a quiet period gives no sales sentence', () => {
    const i = base(); i.compare.sales = m(900, 0, null);
    expect(highlights(i)[0].text).toMatch(/nothing in the previous period/);
    const quiet = base(); quiet.compare.sales = m(0, 0, null); quiet.byHour.forEach((h) => { h.sales = 0; });
    expect(highlights(quiet).some((h) => h.id === 'sales' || h.id === 'peak')).toBe(false);
  });
  it('warns about losses, stock below zero, expiry and dishes with no recipe', () => {
    const i = base();
    i.losses = { refundAmount: 250, refundCount: 1, voidedCount: 2, voidedValue: 300, cancelledCount: 0, wasteCost: 90 };
    i.stock.negativeCount = 2; i.stock.expiredCount = 1; i.stock.expiringCount = 3;
    i.dishes = [{ name: 'A', category: 'x', quantity: 5, revenue: 500, cost: null }, { name: 'B', category: 'x', quantity: 9, revenue: 900, cost: 200, profit: 700, marginPercent: 77.8, quadrant: 'STAR' }];
    const t = highlights(i);
    expect(t.find((x) => x.id === 'loss')?.text).toBe('Lost to: ₹250 refunded, 2 voided orders, ₹90 of stock wasted.');
    expect(t.find((x) => x.id === 'neg')?.text).toMatch(/2 stock items are below zero/);
    expect(t.find((x) => x.id === 'exp')?.text).toMatch(/1 expired and 3 expiring soon/);
    expect(t.find((x) => x.id === 'nocost')?.text).toMatch(/1 dish has no recipe linked/);
    expect(t.find((x) => x.id === 'menu')?.text).toMatch(/1 dish is a star/);
  });
});

describe('the customisable layout', () => {
  it('shows every section by default, in order', () => {
    expect(shownOrder(DEFAULT_LAYOUT)).toEqual(WIDGET_IDS);
    expect(new Set(WIDGET_IDS).size).toBe(WIDGET_IDS.length);
  });
  it('hide, show and move', () => {
    let l = toggleWidget(DEFAULT_LAYOUT, 'tax');
    expect(isShown(l, 'tax')).toBe(false); expect(shownOrder(l)).not.toContain('tax');
    l = toggleWidget(l, 'tax');
    expect(isShown(l, 'tax')).toBe(true);
    const moved = moveWidget(DEFAULT_LAYOUT, 'kpis', -1);
    expect(moved.order[0]).toBe('kpis'); expect(moved.order[1]).toBe('highlights');
    expect(moveWidget(DEFAULT_LAYOUT, 'highlights', -1)).toBe(DEFAULT_LAYOUT);
    expect(moveWidget(DEFAULT_LAYOUT, WIDGET_IDS[WIDGET_IDS.length - 1], 1)).toBe(DEFAULT_LAYOUT);
  });
  it('a saved layout from an older version loses removed sections and gains new ones at the end; nonsense falls back to the default', () => {
    const l = normalizeLayout({ order: ['kpis', 'gone', 'kpis', 'profit'], hidden: ['profit', 'gone2'] });
    expect(l.order.slice(0, 2)).toEqual(['kpis', 'profit']);
    expect(l.order).toHaveLength(WIDGET_IDS.length);
    expect(l.hidden).toEqual(['profit']);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('x')).toEqual(DEFAULT_LAYOUT);
  });
  it('every preset lists real sections, shows what it names first and hides the rest', () => {
    for (const p of PRESETS) {
      expect(p.layout.order).toHaveLength(WIDGET_IDS.length);
      expect(shownOrder(p.layout).length + p.layout.hidden.length).toBe(WIDGET_IDS.length);
    }
    const owner = PRESETS.find((p) => p.id === 'owner')!.layout;
    expect(shownOrder(owner)[0]).toBe('highlights'); expect(isShown(owner, 'staff')).toBe(false); expect(isShown(owner, 'profit')).toBe(true);
  });
  it('is saved per user; the default is not stored; broken storage never throws', () => {
    const store = new Map<string, string>();
    const st = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    saveLayout('asha', toggleWidget(DEFAULT_LAYOUT, 'tax'), st);
    expect(store.has(layoutKey('asha'))).toBe(true);
    expect(isShown(loadLayout('asha', st), 'tax')).toBe(false);
    expect(isShown(loadLayout('ravi', st), 'tax')).toBe(true);
    saveLayout('asha', DEFAULT_LAYOUT, st);
    expect(store.has(layoutKey('asha'))).toBe(false);
    expect(loadLayout('x', { getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_LAYOUT);
    expect(() => saveLayout('x', toggleWidget(DEFAULT_LAYOUT, 'tax'), { setItem: () => { throw new Error('full'); }, removeItem: () => undefined })).not.toThrow();
    expect(loadLayout('asha', { getItem: () => '{bad json' })).toEqual(DEFAULT_LAYOUT);
  });
});
