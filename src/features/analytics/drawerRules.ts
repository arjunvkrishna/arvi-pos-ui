import type { ShiftItem } from './drawerApi';

export const fmt = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;
export const signed = (n?: number | null) => `${Number(n || 0) >= 0 ? '+' : '-'}₹${Math.abs(Number(n || 0)).toFixed(2)}`;
export const varianceTone = (v: number) => (v === 0 ? 'ok' : v > 0 ? 'warn' : 'danger') as 'ok' | 'warn' | 'danger';
export const varianceWord = (v: number) => (v === 0 ? 'BALANCED' : v > 0 ? 'SURPLUS' : 'SHORTAGE');
export const hasFlags = (i: ShiftItem) => (i.anomalyFlags?.length ?? 0) > 0;
export const visibleShifts = (items: ShiftItem[], onlyAnomalies: boolean) => (onlyAnomalies ? items.filter(hasFlags) : items);

/** The count that counts: a manager's correction replaces the original physical count and variance. */
export const effectiveCount = (s: ShiftItem['shift']) => Number((s.isCorrected ? s.correctedCountedCash : s.countedCash) || 0);
export const effectiveVariance = (s: ShiftItem['shift']) => Number((s.isCorrected ? s.correctedVariance : s.variance) || 0);

export const cashiers = (items: ShiftItem[]) => { const m = new Map<number, string>(); items.forEach((i) => { if (i.shift.cashierId && i.shift.cashierName) m.set(i.shift.cashierId, i.shift.cashierName); }); return [...m.entries()]; };

export const TRANSFER_TYPES: [string, string][] = [['DRAWER_TO_BANK', 'Drawer to bank account (deposit)'], ['DRAWER_TO_SAFE', 'Drawer to safe vault'], ['BANK_TO_DRAWER', 'Bank account to drawer (till replenishment)'], ['SAFE_TO_DRAWER', 'Safe vault to drawer']];

export function transferProblem(shiftId: string, amount: number, reason: string): string | null {
  if (!shiftId) return 'Please select a target shift';
  if (!amount || amount <= 0) return 'Please enter a valid transfer amount greater than zero';
  if (!reason.trim()) return 'A reason is mandatory for cash transfers';
  return null;
}
export function correctionProblem(counted: number, reason: string): string | null {
  if (isNaN(counted) || counted < 0) return 'Enter a valid physical cash count';
  if (!reason.trim() || reason.trim().length < 5) return 'Enter an audit reason (at least 5 characters) explaining the correction';
  return null;
}
