import type { Period, Query } from './api';

export const PERIODS: [Period, string][] = [['TODAY', 'Today'], ['YESTERDAY', 'Yesterday'], ['THIS_WEEK', 'This week'], ['LAST_WEEK', 'Last week'], ['THIS_MONTH', 'This month'], ['LAST_MONTH', 'Last month'], ['THIS_YEAR', 'This year'], ['CUSTOM', 'Custom']];
export const DRILL_TABS = [['sales', 'Sales'], ['expenses', 'Expenses'], ['purchases', 'Purchases'], ['supplierPayments', 'Supplier payments'], ['salaries', 'Salaries']] as const;
export type DrillTab = (typeof DRILL_TABS)[number][0];

export const inr2 = (n?: number | null) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
export const inr0 = (n?: number | null) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** Why a custom range cannot be applied yet (null = fine). */
export function customRangeProblem(start: string, end: string): string | null {
  if (!start || !end) return 'Please select both start and end date';
  if (start > end) return 'Start date must be before or equal to end date';
  return null;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Pre-filled custom range: the last 30 days. */
export const defaultCustomRange = (now = new Date()) => ({ start: ymd(new Date(now.getTime() - 30 * 86400000)), end: ymd(now) });

export const growthLabel = (g?: number) => { const v = g || 0; return `${v >= 0 ? '+' : ''}${v}% vs prev`; };
export const isCustomReady = (q: Query) => q.period !== 'CUSTOM' || (!!q.start && !!q.end);
export const exportFileName = (format: 'pdf' | 'excel', period: string, now = new Date()) => `ARVI_Analytics_${period}_${ymd(now)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
