import { businessToday } from '../customers/loyalty';

/** The pure rules behind "What sold": which dates a range means, how a day or week is written, and the sentence for a search. */

export type RangeKey = 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'last30' | 'custom';
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'last7', label: 'Last 7 days' },
  { key: 'thisWeek', label: 'This week' }, { key: 'lastWeek', label: 'Last week' }, { key: 'thisMonth', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' }, { key: 'custom', label: 'Custom' },
];
export const ORDER_TYPES = [{ v: 'TABLE', label: 'Dine-in' }, { v: 'OUTDOOR', label: 'Outdoor' }, { v: 'TAKEAWAY', label: 'Takeaway' }] as const;
export type GroupBy = 'DAY' | 'WEEK';

const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toYmd = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (ymd: string, n: number) => toYmd(new Date(toDate(ymd).getTime() + n * DAY_MS));

/** Weeks run Monday to Sunday (the same weeks the server adds up). */
export function mondayOf(ymd: string): string {
  const dow = toDate(ymd).getUTCDay();   // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}

export const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;

/** The first and last day a range means, counted from the cafe's trading day. */
export function rangeFor(key: Exclude<RangeKey, 'custom'>, today: string = businessToday()): { from: string; to: string } {
  switch (key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'last7': return { from: addDays(today, -6), to: today };
    case 'thisWeek': return { from: mondayOf(today), to: today };
    case 'lastWeek': { const m = addDays(mondayOf(today), -7); return { from: m, to: addDays(m, 6) }; }
    case 'thisMonth': return { from: monthStart(today), to: today };
    case 'last30': return { from: addDays(today, -29), to: today };
  }
}

const dayName = (ymd: string) => toDate(ymd).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = (ymd: string) => toDate(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Wed, 28 Oct" for a day; "26 Oct - 1 Nov" for a week. */
export function periodLabel(start: string, end: string, groupBy: GroupBy): string {
  return groupBy === 'DAY' ? `${dayName(start)}, ${dayMonth(start)}` : start === end ? dayMonth(start) : `${dayMonth(start)} - ${dayMonth(end)}`;
}

/** Whole days in a range, both ends counted. */
export const daysIn = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;

/** A range the server will accept: start not after end, at most a year. */
export function rangeProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The first date is after the last date.';
  if (daysIn(from, to) > 366) return 'Choose at most 366 days at a time.';
  return null;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** The line shown when something is typed in the search: how many were sold, across how many dishes. */
export function searchSentence(q: string, quantity: number, dishes: number, revenue: string): string | null {
  const text = q.trim();
  if (!text) return null;
  if (quantity === 0) return `Nothing matching "${text}" was sold in this range.`;
  return `"${text}": ${plural(quantity, 'sold', 'sold')} across ${plural(dishes, 'dish', 'dishes')} · ${revenue}`;
}

/** What differs from the plain default view, for the "Reset" link. */
export function activeFilterCount(f: { q: string; categories: number; orderTypes: number; range: RangeKey; groupBy: GroupBy }): number {
  return (f.q.trim() ? 1 : 0) + (f.categories > 0 ? 1 : 0) + (f.orderTypes > 0 ? 1 : 0) + (f.range !== 'last7' ? 1 : 0) + (f.groupBy !== 'DAY' ? 1 : 0);
}
