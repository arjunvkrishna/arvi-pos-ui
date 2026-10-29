import type { Bill } from './types';
import type { EditBillInput, Promotion } from './api';

export type Location = 'ALL' | 'TABLE' | 'OUTDOOR' | 'TAKEAWAY';

export const statusTone = (s: string) => (s === 'PAID' ? 'ok' : s === 'PARTIALLY_REFUNDED' ? 'warn' : s === 'REFUNDED' ? 'danger' : s === 'ACTIVE' ? 'info' : 'neutral') as 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
export const isSettled = (s: string) => s === 'PAID' || s === 'PARTIALLY_REFUNDED' || s === 'REFUNDED';

/** What can be done to a bill, by status and role. */
export function billActions(b: Pick<Bill, 'status'>) {
  return {
    edit: b.status !== 'REFUNDED',
    refund: b.status === 'PAID' || b.status === 'PARTIALLY_REFUNDED',
    void: b.status === 'ACTIVE',
  };
}

/** Part of the money that can still be refunded and why a refund is not possible. */
export function refundState(b: Bill): { remaining: number; blocked: 'VOIDED' | 'FULLY_REFUNDED' | null } {
  const remaining = Math.max(0, Number(b.netAmount || 0) - Number(b.totalRefunded || 0));
  if (b.status === 'VOIDED' || b.paymentStatus === 'VOIDED') return { remaining, blocked: 'VOIDED' };
  return { remaining, blocked: remaining <= 0 ? 'FULLY_REFUNDED' : null };
}
export function refundProblem(amount: number, remaining: number, reason: string): string | null {
  if (!(amount > 0)) return 'Enter the refund amount';
  if (amount > remaining + 0.001) return `Refund cannot be more than ₹${remaining.toFixed(2)}`;
  if (!reason.trim()) return 'A refund reason is required';
  return null;
}

/** Edited bill totals, the same maths the server will redo: discount first, then tax on what is left. */
export function editTotals(items: { price: number; quantity: number }[], discountPct: number, taxPct: number, originalNet: number) {
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const taxable = Math.max(0, subtotal - (subtotal * discountPct) / 100);
  const net = taxable + (taxable * taxPct) / 100;
  return { subtotal, net, diff: Math.round((net - originalNet) * 100) / 100 };
}
export const diffText = (d: number) => (Math.abs(d) < 0.01 ? '' : d > 0 ? `(+₹${d.toFixed(2)})` : `(Diff: -₹${Math.abs(d).toFixed(2)})`);

export function promotionProblem(p: { name: string; pct: number; start: string; end: string; recurring?: boolean; days?: number[]; dailyStart?: string; dailyEnd?: string }): string | null {
  if (!p.name.trim()) return 'Promotion name is required.';
  if (isNaN(p.pct) || p.pct <= 0 || p.pct > 100) return 'Discount percentage must be greater than 0 and at most 100.';
  if (!p.start || !p.end) return 'Both start date/time and end date/time are required.';
  if (new Date(p.end) <= new Date(p.start)) return 'End date/time must be strictly after start date/time.';
  if (p.recurring) {
    if (!p.days || p.days.length === 0) return 'Choose at least one day of the week for the happy hour.';
    if (!p.dailyStart || !p.dailyEnd) return 'Choose the time the happy hour starts and ends each day.';
    if (p.dailyStart === p.dailyEnd) return 'The daily start and end time cannot be the same.';
  }
  return null;
}
export const WEEK_DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
export const toggleDay = (days: number[], d: number) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b));
/** A happy hour runs for a long stretch, so the date range starts now and ends a year later. */
export const defaultRecurringRange = (now = new Date()) => { const end = new Date(now); end.setFullYear(end.getFullYear() + 1); return { start: localDateTime(now), end: localDateTime(end) }; };
export const promotionTone = (s: string) => (s === 'ACTIVE' ? 'ok' : s === 'SCHEDULED' ? 'info' : s === 'EXPIRED' ? 'danger' : 'neutral') as 'ok' | 'info' | 'danger' | 'neutral';
export const activePromotion = (list: Promotion[]) => list.find((p) => p.status === 'ACTIVE');
const pad = (n: number) => String(n).padStart(2, '0');
export const localDateTime = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const defaultPromoRange = (now = new Date()) => ({ start: localDateTime(now), end: localDateTime(new Date(now.getTime() + 7 * 86400000)) });

export type { EditBillInput };
