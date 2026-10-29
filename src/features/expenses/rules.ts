import type { ChecklistItem, Expense, ExpenseType } from './api';

export const EXPENSE_TYPES: [ExpenseType, string][] = [
  ['RENT', 'Rent (fixed monthly)'], ['EMI', 'EMI (loan / equipment)'], ['WATER', 'Water bill'], ['ELECTRICITY', 'Electricity bill'], ['INTERNET', 'Internet / Wi-Fi'],
  ['GAS', 'Gas / LPG'], ['MAINTENANCE', 'Maintenance & repairs'], ['MARKETING', 'Marketing & branding'], ['MISC', 'Miscellaneous'],
];
export const PAYMENT_METHODS = ['Bank Transfer', 'UPI / GPay', 'Cash', 'Cheque', 'Auto-Debit', 'Credit / Debit Card'];
export const FREQUENCIES = [['MONTHLY', 'Monthly (rent & EMI)'], ['WEEKLY', 'Weekly'], ['QUARTERLY', 'Quarterly'], ['YEARLY', 'Yearly']] as const;

export const typeTone = (t: string) => ({ RENT: 'brand', EMI: 'danger', WATER: 'info', ELECTRICITY: 'warn', INTERNET: 'info', GAS: 'warn', MAINTENANCE: 'neutral', MARKETING: 'brand' } as const)[t as 'RENT'] ?? 'neutral';
export const rupees0 = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export interface Filters { month: number; year: number; type: string; status: string; search: string }

export function filterExpenses(list: Expense[], f: Filters): Expense[] {
  const q = f.search.trim().toLowerCase();
  return list.filter((e) => {
    if (f.month && e.month !== f.month) return false;
    if (f.year && e.year !== f.year) return false;
    if (f.type !== 'ALL' && e.type !== f.type) return false;
    if (f.status !== 'ALL' && (e.status || 'PAID') !== f.status) return false;
    if (q && ![e.description, e.vendorOrPayee, e.receiptRef, e.notes].some((v) => (v || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Outflow of the chosen month split like the classic cards: rent, EMI, utilities (water, electricity, internet, gas), everything else. */
export function monthSummary(list: Expense[], month: number, year: number) {
  const s = { rent: 0, emi: 0, utilities: 0, misc: 0, total: 0 };
  for (const e of list.filter((x) => (!month || x.month === month) && (!year || x.year === year))) {
    const a = Number(e.amount) || 0;
    s.total += a;
    if (e.type === 'RENT') s.rent += a;
    else if (e.type === 'EMI') s.emi += a;
    else if (['WATER', 'ELECTRICITY', 'INTERNET', 'GAS'].includes(e.type)) s.utilities += a;
    else s.misc += a;
  }
  return s;
}

/** Commitments still to be dealt with this month (shown on the "Post due recurring" button). */
export const pendingCount = (list: ChecklistItem[]) => list.filter((s) => ['UNRECORDED', 'OVERDUE', 'DUE_SOON'].includes(s.status)).length;

/** Date a recurring expense is posted on for the chosen month: today's day-of-month, capped at 28 so every month has it. */
export const postingDate = (month: number, year: number, now = new Date()) => `${year}-${String(month).padStart(2, '0')}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`;
