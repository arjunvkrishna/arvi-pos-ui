import type { Invoice, Supplier } from './api';

export const fmtINR = (v: number | null | undefined) => `₹${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');

export const PAYMENT_MODES = [['CASH', 'Cash'], ['UPI', 'UPI'], ['BANK_TRANSFER', 'Bank Transfer'], ['CHEQUE', 'Cheque']] as const;

/** Overview search: name, contact, phone, email, category. */
export function filterOverview(list: Supplier[], query: string): Supplier[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => [s.name, s.contactPerson, s.phone, s.email, s.category].some((v) => v && v.toLowerCase().includes(q)));
}

export interface DirectoryFilters { query: string; phone: string; category: string; status: 'ACTIVE' | 'ALL' | 'INACTIVE' }
export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = { query: '', phone: '', category: '', status: 'ACTIVE' };

const digits = (v?: string | null) => (v || '').toLowerCase().replace(/[^0-9+a-z]/g, '');

/** Directory filters: status, category, free text (name, contact, email, GST, UPI, address, notes, bank) and phone / account / GST. */
export function filterDirectory(list: Supplier[], f: DirectoryFilters): Supplier[] {
  const q = f.query.trim().toLowerCase();
  const phone = digits(f.phone);
  const category = f.category.trim().toLowerCase();
  return list.filter((s) => {
    if (f.status === 'ACTIVE' && s.active === false) return false;
    if (f.status === 'INACTIVE' && s.active !== false) return false;
    if (category && (s.category || '').toLowerCase() !== category) return false;
    if (q && ![s.name, s.contactPerson, s.email, s.gstNumber, s.upiId, s.address, s.notes, s.bankName].some((v) => (v || '').toLowerCase().includes(q))) return false;
    if (phone && ![s.phone, s.bankAccount, s.gstNumber].some((v) => digits(v).includes(phone))) return false;
    return true;
  });
}

export const supplierCategories = (list: Supplier[]) =>
  Array.from(new Set(list.map((s) => (s.category || '').trim()).filter(Boolean))).sort();

export function invoiceLabel(i: Invoice): Invoice['status'] { return i.isOverdue && i.status !== 'PAID' ? 'OVERDUE' : i.status; }
export const invoiceTone = (status: string) => ({ PAID: 'ok', PARTIAL: 'info', UNPAID: 'neutral', OVERDUE: 'danger' } as const)[status as 'PAID'] ?? 'neutral';
