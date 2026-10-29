import type { BudgetRow, DailyClose, ShiftLine } from './api';

export const rupee0 = (n?: number | null) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const rupee2 = (n?: number | null) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const STATUS_TEXT: Record<BudgetRow['status'], string> = { NONE: 'No budget', OK: 'On track', WATCH: 'Watch', OVER: 'Over budget' };
export const STATUS_TONE: Record<BudgetRow['status'], 'neutral' | 'ok' | 'warn' | 'danger'> = { NONE: 'neutral', OK: 'ok', WATCH: 'warn', OVER: 'danger' };
/** Width of a progress bar: a share of the budget, never more than the full bar. */
export const barWidth = (used?: number | null) => Math.max(0, Math.min(100, used ?? 0));
export const barColor = (s: BudgetRow['status']) => (s === 'OVER' ? 'bg-danger' : s === 'WATCH' ? 'bg-warn' : s === 'OK' ? 'bg-ok' : 'bg-line-strong');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + by;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}
export const isFutureMonth = (year: number, month: number, now = new Date()) => year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1;

/** A budget box: empty clears the budget (null); a negative or unreadable number is refused (undefined). */
export function parseBudget(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 && v <= 100_000_000 ? Math.round(v * 100) / 100 : undefined;
}

export const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function shiftDay(iso: string, by: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + by));
}

export function cashStatus(s: ShiftLine): { text: string; tone: 'ok' | 'danger' | 'warn' | 'neutral' } {
  if (s.status === 'OPEN') return { text: 'Still open', tone: 'warn' };
  if (s.variance == null || Math.abs(s.variance) < 1) return { text: 'Cash matches', tone: 'ok' };
  return s.variance < 0 ? { text: `Short ${rupee0(Math.abs(s.variance))}`, tone: 'danger' } : { text: `Extra ${rupee0(s.variance)}`, tone: 'warn' };
}

/** Things worth a look at the end of the day, in plain words. */
export function attentionList(d: DailyClose): string[] {
  const out: string[] = [];
  if (d.openShifts > 0) out.push(`${d.openShifts} cash shift${d.openShifts === 1 ? ' is' : 's are'} still open.`);
  if (Math.abs(d.cashVarianceTotal) >= 1) out.push(`Cash drawer is ${d.cashVarianceTotal < 0 ? 'short' : 'over'} by ${rupee0(Math.abs(d.cashVarianceTotal))}.`);
  if (d.voidedCount > 0) out.push(`${d.voidedCount} order${d.voidedCount === 1 ? ' was' : 's were'} voided (${rupee0(d.voidedValue)}).`);
  if (d.refundCount > 0) out.push(`${d.refundCount} refund${d.refundCount === 1 ? '' : 's'} given (${rupee0(d.refunds)}).`);
  if (d.belowZero > 0) out.push(`${d.belowZero} stock item${d.belowZero === 1 ? ' is' : 's are'} below zero: enter the purchase.`);
  if (d.expired > 0) out.push(`${d.expired} stock item${d.expired === 1 ? ' has' : 's have'} expired stock.`);
  if (d.overBudget.length > 0) out.push(`Over budget this month: ${d.overBudget.join(', ')}.`);
  return out;
}
