import { api } from '../../api/client';

export interface Supplier {
  id: number;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  paymentTerms?: number | null;
  gstNumber?: string | null;
  address?: string | null;
  upiId?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  notes?: string | null;
  active?: boolean;
  totalInvoiced?: number;
  totalPaid?: number;
  totalOutstanding?: number;
}

export type SupplierInput = Omit<Supplier, 'id' | 'active' | 'totalInvoiced' | 'totalPaid' | 'totalOutstanding'> & { name: string; paymentTerms: number };

export interface InvoiceItem {
  inventoryItemId: number | null;
  productName: string;
  itemCategory?: string;
  purchaseMode?: 'UNIT' | 'PACK';
  packName?: string | null;
  packSize?: number | null;
  unit?: string;
  unitVolume?: number | null;
  volume?: number | null;
  volumeUnit?: string | null;
  quantity?: number;
  unitPrice?: number;
  gstRate?: number | null;
  gstAmount?: number | null;
  totalVolume?: number | null;
  costPerVolume?: number | null;
  totalPrice?: number | null;
  /** optional expiry date of the goods on this line (yyyy-mm-dd) */
  expiryDate?: string | null;
}

export interface Invoice {
  id: number;
  supplierId: number;
  supplierName?: string | null;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal?: number;
  gstRate?: number | null;
  gstAmount?: number | null;
  otherCharges?: number | null;
  discount?: number | null;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  isOverdue?: boolean;
  description?: string | null;
  items?: InvoiceItem[];
}

export interface Payment {
  id: number;
  invoiceId?: number;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  paymentReceiptNumber?: string | null;
  paymentDate?: string | null;
  amount: number;
  paymentMode: string;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface SupplierDetails { supplier: Supplier; recentInvoices: Invoice[]; recentPayments: Payment[] }

export interface SupplierAnalytics {
  totalOutstanding: number;
  overdueInvoiceCount: number;
  totalPaidThisMonth: number;
  activeSupplierCount: number;
  outstandingBySupplier?: { supplierName: string; outstanding: number }[];
  monthlyPaymentTrend?: { month: string; paid: number }[];
  paymentModeBreakdown?: Record<string, number>;
  topSuppliersByInvoice?: { supplierName: string; totalInvoiced: number }[];
  onTimeDeliveryRatePercent?: number;
  averageLeadTimeDays?: number;
  fulfillmentRatePercent?: number;
}

export interface InvoiceBody {
  supplierId: number; invoiceNumber: string; invoiceDate: string; dueDate: string | null;
  subtotal: number; gstRate: number; gstAmount: number; otherCharges: number; discount: number; totalAmount: number;
  description: string; itemsReceived: string; items: InvoiceItem[];
}

export interface PaymentBody { invoiceId: number; paymentDate: string; amount: number; paymentMode: string; referenceNumber: string; notes: string }

export const suppliersKey = ['suppliers'] as const;
export const invoicesKey = ['supplier-invoices'] as const;
export const paymentsKey = ['supplier-payments'] as const;

export const fetchSuppliers = () => api<Supplier[]>('/suppliers?activeOnly=false');
export const fetchSupplier = (id: number) => api<Supplier>(`/suppliers/${id}`);
export const saveSupplier = (id: number | null, body: SupplierInput) =>
  id ? api(`/suppliers/${id}`, { method: 'PUT', body }) : api('/suppliers', { method: 'POST', body });
export const deactivateSupplier = (id: number) => api(`/suppliers/${id}`, { method: 'DELETE' });

/** Full dossier; falls back to three plain calls if the combined endpoint is not available (as the classic app did). */
export async function fetchSupplierDetails(id: number): Promise<SupplierDetails> {
  try {
    return await api<SupplierDetails>(`/suppliers/${id}/details`);
  } catch {
    const [supplier, recentInvoices, recentPayments] = await Promise.all([
      api<Supplier>(`/suppliers/${id}`),
      api<Invoice[]>(`/suppliers/${id}/invoices`).catch(() => [] as Invoice[]),
      api<Payment[]>(`/suppliers/${id}/payments`).catch(() => [] as Payment[]),
    ]);
    return { supplier, recentInvoices, recentPayments };
  }
}

export const fetchInvoices = (supplierId: string) => api<Invoice[]>(supplierId ? `/suppliers/${supplierId}/invoices` : '/suppliers/invoices');
export const fetchInvoice = (id: number) => api<Invoice>(`/suppliers/invoices/${id}`);
export const saveInvoice = (id: number | null, body: InvoiceBody) =>
  id ? api(`/suppliers/invoices/${id}`, { method: 'PUT', body }) : api('/suppliers/invoices', { method: 'POST', body });
export const deleteInvoice = (id: number) => api(`/suppliers/invoices/${id}`, { method: 'DELETE' });
export const fetchInvoicePayments = (id: number) => api<Payment[]>(`/suppliers/invoices/${id}/payments`);

export const fetchPayments = (supplierId: string) => api<Payment[]>(supplierId ? `/suppliers/${supplierId}/payments` : '/suppliers/payments');
export const savePayment = (body: PaymentBody) => api('/suppliers/payments', { method: 'POST', body });
export const reversePayment = (id: number) => api(`/suppliers/payments/${id}`, { method: 'DELETE' });
export const fetchSupplierAnalytics = () => api<SupplierAnalytics>('/suppliers/analytics');
