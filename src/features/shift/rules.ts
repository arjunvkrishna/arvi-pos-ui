import type { Shift } from './api';

export const MULTIPLE_OPEN = 'More than one shift is open';
export const isMultipleOpenError = (message?: string) => (message || '').includes(MULTIPLE_OPEN);

/** Counted − expected, as shown while the manager types the count. */
export const varianceOf = (counted: number, expected: number) => Math.round((counted - expected) * 100) / 100;
export const varianceText = (v: number) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toFixed(2)}`;
export const varianceTone = (v: number) => (v === 0 ? 'ok' : v > 0 ? 'info' : 'danger') as 'ok' | 'info' | 'danger';

export function historyTotals(shifts: Shift[]) {
  let closed = 0, shortages = 0, shortage = 0, surpluses = 0, surplus = 0;
  for (const s of shifts) {
    if (s.status !== 'CLOSED') continue;
    closed++;
    const v = Number(s.variance || 0);
    if (v < -0.01) { shortages++; shortage += Math.abs(v); } else if (v > 0.01) { surpluses++; surplus += v; }
  }
  return { total: shifts.length, closed, shortages, shortage, surpluses, surplus, net: surplus - shortage };
}

export function durationText(s: Pick<Shift, 'openedAt' | 'closedAt'>): { text: string; overnight: boolean } {
  if (!s.openedAt || !s.closedAt) return { text: '', overnight: false };
  const open = new Date(s.openedAt), close = new Date(s.closedAt);
  const mins = Math.floor((close.getTime() - open.getTime()) / 60000);
  return { overnight: open.getDate() !== close.getDate(), text: mins > 0 ? ` • Duration: ${Math.floor(mins / 60)}h ${mins % 60}m` : '' };
}

/** Header chip: what it says and which colour the dot is. */
export function chipState(opts: { enabled: boolean; isAdmin: boolean; open: Shift | null; error?: string }): { hidden: boolean; label: string; dot: 'gray' | 'green' | 'red' } {
  if (!opts.enabled) return opts.isAdmin ? { hidden: false, label: 'Shift (Disabled)', dot: 'gray' } : { hidden: true, label: '', dot: 'gray' };
  if (opts.open) return { hidden: false, label: opts.open.cashierName ? `Shift: ${opts.open.cashierName}` : `Shift #${opts.open.id} (Open)`, dot: 'green' };
  if (isMultipleOpenError(opts.error)) return { hidden: false, label: 'Multiple Shifts Open', dot: 'red' };
  return { hidden: false, label: 'Shift Closed', dot: 'gray' };
}
