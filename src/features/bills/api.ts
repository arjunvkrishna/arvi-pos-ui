import type { SplitBillRequest } from '../printing/api';
import { api, apiPage } from '../../api/client';
import type { Bill, BillLogRow } from './types';

export interface Promotion { id: number; name: string; description?: string | null; discountPercentage: number; startDateTime: string; endDateTime: string; isActive: boolean; status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE' | string; recurring?: boolean; daysOfWeek?: number[] | null; dailyStart?: string | null; dailyEnd?: string | null; scheduleText?: string | null }
export interface PromotionInput { name: string; discountPercentage: number; startDateTime: string; endDateTime: string; isActive: boolean; description: string; recurring?: boolean; daysOfWeek?: number[]; dailyStart?: string; dailyEnd?: string }
export interface EditBillInput { tableNumber: string; customerName: string; paymentMode: string; discountPercent: number; taxPercent: number; notes: string; items: { menuItemId?: number; itemName: string; quantity: number; price: number }[] }

export type Mode = 'daily' | 'monthly';
export const billsKey = ['bills'] as const;
export const promotionsKey = ['promotions'] as const;

export const BILLS_PAGE_SIZE = 15;
export interface BillLogFilters { mode: Mode; value: string; location: string; staff: string; search: string }
export interface BillLogSummary { billCount: number; revenue: number; average: number }

/** The period part of the Bill Log query: a day, or a year + month. */
function periodQuery(mode: Mode, value: string) {
  const p = new URLSearchParams();
  if (mode === 'daily') { if (value) p.set('date', value); } else if (value) { const [year, month] = value.split('-'); p.set('year', year); p.set('month', month); }
  return p.toString();
}
function logQuery(f: BillLogFilters) {
  const p = new URLSearchParams(periodQuery(f.mode, f.value));
  if (f.location !== 'ALL') p.set('orderType', f.location);
  if (f.staff) p.set('staff', f.staff);
  if (f.search.trim()) p.set('q', f.search.trim());
  return p.toString();
}
const withQuery = (path: string, q: string) => (q ? `${path}?${q}` : path);
export const fetchBillsPage = (f: BillLogFilters, page: number) => apiPage<BillLogRow>(withQuery(`/bills/${f.mode}`, logQuery(f)), page, BILLS_PAGE_SIZE);
export const fetchBillSummary = (f: BillLogFilters) => api<BillLogSummary>(`/bills/log/summary?mode=${f.mode}${logQuery(f) ? `&${logQuery(f)}` : ''}`);
export const fetchBillStaff = (mode: Mode, value: string) => api<string[]>(`/bills/log/staff?mode=${mode}${periodQuery(mode, value) ? `&${periodQuery(mode, value)}` : ''}`);
export const fetchDeletableBillIds = () => api<number[]>('/bills/deletable-ids');
export const softDeleteBill = (id: number, reason: string) => api(`/bills/${id}/soft-delete`, { method: 'POST', body: { reason } });
export const fetchBill = (id: number) => api<Bill>(`/bills/${id}`);
export const fetchBillByNumber = (n: string) => api<Bill>(`/bills/number/${encodeURIComponent(n)}`);
export const searchBills = (q: string) => api<Bill[]>(`/bills/search?q=${encodeURIComponent(q)}`);
export const editBill = (id: number, b: EditBillInput) => api(`/bills/${id}`, { method: 'PUT', body: b });
export const voidBill = (id: number, reason: string, foodPrepared: boolean) => api(`/bills/${id}/void`, { method: 'POST', body: { reason, foodPrepared } });
export const refundBill = (billId: number, amount: number, paymentMode: string, reason: string) =>
  api('/refunds', { method: 'POST', body: { billId, amount, paymentMode, reason, idempotencyKey: `refund_${billId}_${Date.now()}` } });

export const fetchPromotions = () => api<Promotion[]>('/promotions');
export const savePromotion = (id: number | null, p: PromotionInput) => (id ? api<Promotion>(`/promotions/${id}`, { method: 'PUT', body: p }) : api<Promotion>('/promotions', { method: 'POST', body: p }));
export const togglePromotion = (id: number) => api<Promotion>(`/promotions/${id}/toggle-active`, { method: 'PATCH' });
export const deletePromotion = (id: number) => api(`/promotions/${id}`, { method: 'DELETE' });

/** What one of the bills made by splitting a bill by items says; the amounts of all of them add up to the bill. */
export interface SplitPortion {
  number: number;
  items: { billItemId: number; itemName: string; quantity: number; unitPrice: number; subtotal: number; takeaway: boolean }[];
  subtotal: number; discountAmount: number; promotionDiscountAmount: number; couponDiscount: number; parcelCharge: number;
  cgstAmount: number; sgstAmount: number; taxAmount: number; roundOff: number; netAmount: number;
}
export interface SplitPreview { billId: number; billNumber: string; status: string; netAmount: number; portions: SplitPortion[] }
export const previewSplit = (id: number, body: SplitBillRequest) => api<SplitPreview>(`/bills/${id}/split-preview`, { method: 'POST', body });
