import type { Insights, Metric } from './api';
import { inr0 } from './rules';

export type Tone = 'ok' | 'danger' | 'neutral';

/** "▲ 12.5%" / "▼ 4%" with a colour: for money coming in a rise is good, for discounts, refunds and voids a rise is bad. */
export function deltaView(m: Metric | undefined, higherIsBetter = true): { text: string; tone: Tone } {
  if (!m) return { text: '', tone: 'neutral' };
  if (m.changePercent == null) return m.current > 0 ? { text: 'new', tone: 'neutral' } : { text: '–', tone: 'neutral' };
  const c = m.changePercent;
  if (c === 0) return { text: '▬ 0%', tone: 'neutral' };
  const up = c > 0;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(c)}%`, tone: up === higherIsBetter ? 'ok' : 'danger' };
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
export const hourRange = (h: number) => `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`;

/** The busiest hours by sales, busiest first (hours with no sales are never listed). */
export function peakHours(byHour: Insights['byHour'], n = 3) {
  return [...byHour].filter((h) => h.sales > 0).sort((a, b) => b.sales - a.sales || a.hour - b.hour).slice(0, n);
}

/** 0 (none) to 4 (busiest) for a heatmap cell, so the colour scale is relative to the busiest cell of the period. */
export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  const r = value / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface Highlight { id: string; text: string; tone: Tone }

/** A few plain sentences about the period, from the numbers: what changed, when it is busy, what to look at. */
export function highlights(i: Insights): Highlight[] {
  const out: Highlight[] = [];
  const c = i.compare;
  if (c.sales.current > 0 || c.sales.previous > 0) {
    if (c.sales.changePercent == null) out.push({ id: 'sales', text: `Sales are ${inr0(c.sales.current)} from ${c.orders.current} orders. There is nothing in the previous period to compare with.`, tone: 'neutral' });
    else out.push({ id: 'sales', text: `Sales are ${inr0(c.sales.current)}, ${c.sales.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(c.sales.changePercent)}% on the previous period (${inr0(c.sales.previous)}).`, tone: c.sales.changePercent >= 0 ? 'ok' : 'danger' });
  }
  if (c.avgOrder.changePercent != null && Math.abs(c.avgOrder.changePercent) >= 5) {
    out.push({ id: 'avg', text: `The average bill is ${inr0(c.avgOrder.current)}, ${c.avgOrder.changePercent > 0 ? 'up' : 'down'} ${Math.abs(c.avgOrder.changePercent)}%.`, tone: c.avgOrder.changePercent > 0 ? 'ok' : 'danger' });
  }
  const peak = peakHours(i.byHour, 1)[0];
  if (peak) out.push({ id: 'peak', text: `The busiest hour is ${hourRange(peak.hour)}: ${inr0(peak.sales)} from ${peak.orders} order${peak.orders === 1 ? '' : 's'}.`, tone: 'neutral' });
  const days = i.byWeekday.filter((d) => d.days > 0 && d.orders > 0);
  if (days.length >= 3) {
    const best = [...days].sort((a, b) => b.salesPerDay - a.salesPerDay)[0];
    const worst = [...days].sort((a, b) => a.salesPerDay - b.salesPerDay)[0];
    if (best.day !== worst.day) out.push({ id: 'days', text: `${DAY_NAMES[best.day - 1]} is the best day (${inr0(best.salesPerDay)} a day) and ${DAY_NAMES[worst.day - 1]} the slowest (${inr0(worst.salesPerDay)}).`, tone: 'neutral' });
  }
  if (i.byOrderType.length > 1) out.push({ id: 'mix', text: `${i.byOrderType[0].label} brings ${i.byOrderType[0].share}% of sales.`, tone: 'neutral' });
  if (i.byCategory.length > 0 && i.byCategory[0].share > 0) out.push({ id: 'cat', text: `${i.byCategory[0].label} is the top category with ${i.byCategory[0].share}% of sales.`, tone: 'neutral' });
  const known = i.dishes.filter((d) => d.quadrant);
  if (known.length > 0) {
    const stars = known.filter((d) => d.quadrant === 'STAR').length;
    const plow = known.filter((d) => d.quadrant === 'PLOWHORSE').length;
    out.push({ id: 'menu', text: `${stars} dish${stars === 1 ? ' is a' : 'es are'} star${stars === 1 ? '' : 's'} (sell well and earn well); ${plow} sell well but earn little.`, tone: plow > 0 ? 'neutral' : 'ok' });
  }
  const noCost = i.dishes.filter((d) => d.cost == null).length;
  if (noCost > 0) out.push({ id: 'nocost', text: `${noCost} dish${noCost === 1 ? ' has' : 'es have'} no recipe linked, so their profit is not known. Link them in Stock Links.`, tone: 'neutral' });
  const l = i.losses;
  if (l.refundAmount > 0 || l.voidedCount > 0 || l.wasteCost > 0) {
    const parts = [l.refundAmount > 0 ? `${inr0(l.refundAmount)} refunded` : '', l.voidedCount > 0 ? `${l.voidedCount} voided order${l.voidedCount === 1 ? '' : 's'}` : '', l.wasteCost > 0 ? `${inr0(l.wasteCost)} of stock wasted` : ''].filter(Boolean);
    out.push({ id: 'loss', text: `Lost to: ${parts.join(', ')}.`, tone: 'danger' });
  }
  const s = i.stock;
  if (s.negativeCount > 0) out.push({ id: 'neg', text: `${s.negativeCount} stock item${s.negativeCount === 1 ? ' is' : 's are'} below zero: enter the missing purchase${s.negativeCount === 1 ? '' : 's'}.`, tone: 'danger' });
  if (s.expiredCount + s.expiringCount > 0) out.push({ id: 'exp', text: `${s.expiredCount} expired and ${s.expiringCount} expiring soon: check Inventory.`, tone: s.expiredCount > 0 ? 'danger' : 'neutral' });
  return out;
}

export const QUADRANT: Record<string, { label: string; tone: 'ok' | 'info' | 'warn' | 'danger'; advice: string }> = {
  STAR: { label: 'Star', tone: 'ok', advice: 'Sells well and earns well. Keep it, show it first.' },
  PLOWHORSE: { label: 'Popular, low profit', tone: 'warn', advice: 'Sells well but earns little. Raise the price a little or trim the cost.' },
  PUZZLE: { label: 'Profitable, rare', tone: 'info', advice: 'Earns well but few order it. Promote it or move it up the menu.' },
  DOG: { label: 'Weak', tone: 'danger', advice: 'Sells little and earns little. Rework it or take it off.' },
};
