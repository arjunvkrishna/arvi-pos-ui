import { api } from '../../api/client';
import { withOfflineCopy } from '../../offline/cache';
import type { Bill } from '../bills/types';
import { printVia } from '../printing/api';
import type { Mode } from './rules';

export interface DiningTable { id: number; name: string; floor?: string | null; active?: boolean; displayOrder?: number }
export const activeKey = ['active-orders'] as const;
export const tablesKey = ['dining-tables'] as const;
export const tokenKey = ['next-token'] as const;

export interface SaveOrderPayload {
  orderId: number | null; orderType: Mode; tableNumber: string | null; customerName: string; customerId?: number | null; outdoorToken: string | null; takeawayToken: string | null;
  notes: string; parcelCharge: number | null;
  items: { menuItemId: number; itemName: string; quantity: number; price: number; customization: string; isTakeaway: boolean; modifiersSnapshot?: string; comboSnapshot?: string }[];
  discountPercent?: number; gstEnabled?: boolean; taxPercent?: number; cgstPercent?: number; sgstPercent?: number;
}
export interface PrintBillPayload { discountPercent: number; gstEnabled: boolean; taxPercent: number; cgstPercent: number; sgstPercent: number; parcelCharge: number | null }

export const fetchActive = () => api<Bill[]>('/bills/active').then((l) => l ?? []);
export const fetchTables = () => withOfflineCopy('tables', () => api<DiningTable[]>('/tables'));
export const createTable = (name: string, floor?: string) => api<DiningTable>('/tables', { method: 'POST', body: floor ? { name, floor } : { name } });
export const deleteTable = (id: number) => api(`/tables/${id}`, { method: 'DELETE' });
export const fetchNextToken = (mode: 'TAKEAWAY' | 'OUTDOOR') =>
  mode === 'TAKEAWAY' ? api<{ nextTakeawayToken?: string }>('/bills/next-takeaway-token').then((r) => r?.nextTakeawayToken ?? 'TAK-001')
    : api<{ nextOutdoorToken?: string }>('/bills/next-outdoor-token').then((r) => r?.nextOutdoorToken ?? 'OUT-001');

/** `idempotencyKey` is sent when an order that waited offline is replayed: the server saves a given key only once. */
export const saveOrder = (p: SaveOrderPayload, idempotencyKey?: string) => api<Bill>('/bills/order', { method: 'POST', body: p, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });
export const sendKot = (id: number) => api<Bill>(`/bills/${id}/print-kot`, { method: 'POST' });
export const requestBill = (id: number) => api<Bill>(`/bills/${id}/request-bill`, { method: 'POST' });
export const printBillOnly = (id: number, p: PrintBillPayload) => api<Bill>(`/bills/${id}/print-bill`, { method: 'POST', body: p });
export const confirmPayment = (
  id: number,
  paymentMode: string,
  notes: string,
  tipAmount = 0,
  payments?: { mode: string; amount: number; reference?: string }[],
  customerId?: number | null,
  giftCardCode?: string,
  redeemLoyaltyPoints?: number,
  couponCode?: string
) =>
  api<Bill>(`/bills/${id}/confirm-payment`, {
    method: 'POST',
    body: {
      paymentMode,
      notes,
      ...(tipAmount > 0 ? { tipAmount } : {}),
      ...(payments && payments.length > 1 ? { payments } : {}),
      ...(customerId ? { customerId } : {}),
      ...(giftCardCode ? { giftCardCode } : {}),
      ...(redeemLoyaltyPoints ? { redeemLoyaltyPoints } : {}),
      ...(couponCode ? { couponCode } : {}),
    },
  });
export const cancelOrder = (id: number) => api(`/bills/${id}/cancel`, { method: 'POST' });
export interface ChangeLocationBody { orderType: Mode; tableNumber?: string; customerName?: string; reason?: string | null; mergeIfOccupied?: boolean }
export const changeLocation = (id: number, body: ChangeLocationBody) => api<Bill>(`/bills/${id}/change-location`, { method: 'POST', body });

/** Prints the last kitchen ticket once more (marked REPRINT) for an order being prepared; the order itself does not change. */
export const reprintKot = (id: number) => printVia(`/printer/reprint-kot/${id}`);
