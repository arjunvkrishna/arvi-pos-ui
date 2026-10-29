import { api, apiBlob, authHeaders } from '../../api/client';

export type Period = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM';
export interface Query { period: Period; start: string; end: string }

export interface Kpis {
  totalSales?: number; salesGrowthPercent?: number; totalOrders?: number; totalExpenses?: number; totalOperatingExpenses?: number; totalSalariesPaid?: number;
  totalSupplierPurchases?: number; totalSupplierPayments?: number; netProfit?: number; grossProfit?: number; inventoryValuation?: number; avgOrderValue?: number; lowStockCount?: number;
}
export interface Comprehensive {
  periodInfo?: { startDate: string; endDate: string }; kpis?: Kpis;
  salesTrend?: { label: string; sales: number; orders: number }[];
  expenseBreakdown?: { category: string; amount: number }[];
  cashFlowTrend?: { label: string; moneyIn: number; moneyOut: number }[];
  topSellingDishes?: { dishName: string; quantity: number; revenue: number; percentageOfSales?: number }[];
  supplierSpending?: { supplierName: string; invoiceCount: number; totalSpend: number; amountPaid?: number; outstandingBalance?: number | null; percentage?: number }[];
  topPurchasedProducts?: { productName: string; totalQuantity: number; unit?: string; avgUnitRate?: number; totalSpend?: number }[];
  drillDown?: {
    sales?: { billNumber: string; createdAt: string; tableNumber?: string; customerName?: string; paymentMode: string; netAmount: number }[];
    expenses?: { type: string; description: string; expenseDate: string; paidBy?: string; receiptRef?: string; amount: number }[];
    purchases?: { invoiceNumber: string; supplierName: string; invoiceDate: string; subtotal?: number; gstAmount?: number; totalAmount?: number; status?: string }[];
    supplierPayments?: { paymentDate?: string; supplierName?: string; invoiceNumber?: string; paymentMode?: string; referenceNumber?: string; notes?: string; amount?: number }[];
    salaries?: { employeeName: string; month: number; year: number; paymentDate?: string; paymentMode?: string; status?: string; netSalary?: number }[];
  };
}
export interface Profit {
  netSales?: number; grossSales?: number; totalRefunds?: number; cogs?: number; ingredientConsumptionCost?: number; wasteCost?: number; grossProfit?: number; grossMarginPercentage?: number;
  operatingExpenses?: number; payrollExpense?: number; netOperatingProfit?: number; netOperatingMarginPercentage?: number; netCashFlow?: number; totalCashIn?: number; totalCashOut?: number;
}

const range = (q: Query) => (q.period === 'CUSTOM' && q.start && q.end ? `&startDate=${encodeURIComponent(q.start)}&endDate=${encodeURIComponent(q.end)}` : '');
export const fetchComprehensive = (q: Query) => api<Comprehensive>(`/analytics/comprehensive?period=${encodeURIComponent(q.period)}${range(q)}`);
export const fetchProfit = (q: Query) => api<Profit>(`/analytics/comprehensive-profit${q.period === 'CUSTOM' && q.start && q.end ? `?${range(q).slice(1)}` : ''}`).catch(() => null);
export const exportReport = (format: 'pdf' | 'excel', q: Query) => apiBlob(`/analytics/export/${format}?period=${encodeURIComponent(q.period)}${range(q)}`);

// ---- Insights: how the period compares, when and how people buy, what earns money, where money is lost ----
export interface Metric { current: number; previous: number; changePercent: number | null }
export interface Slice { label: string; orders: number; amount: number; quantity: number; share: number }
export interface DishRow { menuItemId?: number | null; name: string; category: string; quantity: number; revenue: number; costPerServing?: number | null; cost?: number | null; profit?: number | null; marginPercent?: number | null; quadrant?: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG' | null }
export interface Insights {
  start: string; end: string; prevStart: string; prevEnd: string;
  compare: { sales: Metric; orders: Metric; avgOrder: Metric; itemsPerOrder: Metric; discounts: Metric; refunds: Metric; voids: Metric };
  byHour: { hour: number; sales: number; orders: number }[];
  byWeekday: { day: number; label: string; sales: number; orders: number; avgOrder: number; days: number; salesPerDay: number }[];
  heatmap: number[][];
  byOrderType: Slice[]; byPaymentMode: Slice[]; byCategory: Slice[];
  byStaff: { staff: string; orders: number; sales: number; avgOrder: number; share: number }[];
  byTable: { table: string; orders: number; sales: number }[];
  discounts: { discountAmount: number; promotionAmount: number; total: number; billsWithDiscount: number; percentOfGross: number };
  losses: { refundAmount: number; refundCount: number; voidedCount: number; voidedValue: number; cancelledCount: number; wasteCost: number };
  tax: { taxableSales: number; cgst: number; sgst: number; totalTax: number; roundOff: number };
  dishes: DishRow[]; neverSold: { name: string; category: string }[]; neverSoldCount: number;
  stock: { valueByCategory: Slice[]; totalValue: number; negativeCount: number; lowCount: number; expiringCount: number; expiredCount: number; wasteByReason: Slice[]; wasteCost: number };
}
export const fetchInsights = (q: Query) => api<Insights>(`/analytics/insights?period=${encodeURIComponent(q.period)}${range(q)}`);

// ---- daily close, budget, staff and tips ----
export interface NameAmount { name: string; amount: number; count: number }
export interface ShiftLine { id: number; cashier: string; openedAt?: string; closedAt?: string | null; status: string; openingFloat: number; cashSales: number; expectedCash?: number | null; countedCash?: number | null; variance?: number | null }
export interface DailyClose {
  date: string; sales: number; orders: number; avgBill: number; previousDaySales: number; changePercent?: number | null; payments: NameAmount[];
  discounts: number; refunds: number; refundCount: number; voidedCount: number; voidedValue: number; cancelledCount: number; gst: number; tips: number;
  expenses: number; topExpense?: string | null; shifts: ShiftLine[]; cashVarianceTotal: number; openShifts: number;
  lowStock: number; belowZero: number; expiringSoon: number; expired: number; wasteCost: number;
  topDishes: NameAmount[]; busiestHour?: string | null; topStaff: NameAmount[]; overBudget: string[]; text: string;
}
export interface DailyCloseSettings { enabled: boolean; time: string }
export interface SendResult { sent: number; failed: number; recipients: number; message: string }
export interface BudgetRow { category: string; label: string; budget?: number | null; actual: number; remaining?: number | null; usedPercent?: number | null; projected: number; status: 'NONE' | 'OK' | 'WATCH' | 'OVER' }
export interface Budget { year: number; month: number; daysElapsed: number; daysInMonth: number; rows: BudgetRow[]; total: BudgetRow }
export interface StaffRow { staffId: number; staff: string; orders: number; sales: number; avgOrder: number; itemsPerOrder: number; discounts: number; refunds: number; tips: number; tipsPaid: number; tipsOwed: number; salesShare: number }
export interface StaffReport { start: string; end: string; staff: StaffRow[]; totalSales: number; totalOrders: number; totalTips: number; totalTipsOwed: number; equalShare: number }
export interface Payout { id: number; staffId: number; staffName: string; amount: number; paidOn: string; note?: string | null; createdBy?: string | null }

export const fetchDailyClose = (date: string) => api<DailyClose>(`/reports/daily-close?date=${encodeURIComponent(date)}`);
export const sendDailyClose = (date: string) => api<SendResult>(`/reports/daily-close/send?date=${encodeURIComponent(date)}`, { method: 'POST', body: {} });
export const fetchDailyCloseSettings = () => api<DailyCloseSettings>('/reports/daily-close/settings');
export const saveDailyCloseSettings = (s: DailyCloseSettings) => api<DailyCloseSettings>('/reports/daily-close/settings', { method: 'PUT', body: s });
export const fetchBudget = (year: number, month: number) => api<Budget>(`/reports/budget?year=${year}&month=${month}`);
export const saveBudget = (updates: { category: string; monthlyAmount: number | null }[]) => api('/reports/budget', { method: 'PUT', body: updates });
export const fetchStaffReport = (q: Query) => api<StaffReport>(`/reports/staff?period=${encodeURIComponent(q.period)}${range(q)}`);
export const fetchPayouts = () => api<Payout[]>('/reports/tip-payouts');
export const payTips = (staffId: number, amount: number, note: string) => api<Payout>('/reports/tip-payouts', { method: 'POST', body: { staffId, amount, note } });

// ---- Phase 3: Accounting, Banking Reconciliation & Reports Catalog ----
export interface ProfitAndLossReport {
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  gstCollected: number;
  tipsCollected: number;
  netSalesRevenue: number;
  cogs: number;
  loyaltyPointsRedeemed: number;
  grossProfit: number;
  operatingExpenses: number;
  salariesPaid: number;
  netProfit: number;
  expenseBreakdown: { category: string; amount: number; percentage: number }[];
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: { cashInDrawerAndBank: number; inventoryValuationAtCost: number; totalAssets: number };
  liabilities: { unpaidSupplierInvoices: number; giftCardLiability: number; unpaidTips: number; totalLiabilities: number };
  netWorthOrEquity: number;
}

export interface BankStatementSummary {
  id: number;
  description: string;
  importDate: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export interface BankStatementRow {
  id: number;
  statementId: number;
  transactionDate: string;
  description: string;
  amount: number;
  balance?: number;
  refNo?: string;
  status: 'UNMATCHED' | 'MATCHED' | 'IGNORED';
  matchedExpenseId?: number;
  matchedExpenseDescription?: string;
  matchedExpenseAmount?: number;
}

export interface ReportMetadata {
  id: string;
  title: string;
  category: string;
  description: string;
  supportedFormats: string[];
}

export interface ExportJobStatus {
  jobId: string;
  reportId: string;
  format: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export const fetchProfitAndLoss = (startDate?: string, endDate?: string) =>
  api<ProfitAndLossReport>(`/accounting/pl${startDate && endDate ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` : ''}`);

export const fetchBalanceSheet = () => api<BalanceSheetReport>('/accounting/balance-sheet');

export const fetchBankStatements = () => api<BankStatementSummary[]>('/banking/statements');

export const fetchBankStatementRows = (statementId: number, status?: string) =>
  api<BankStatementRow[]>(`/banking/statements/${statementId}/rows${status ? `?status=${encodeURIComponent(status)}` : ''}`);

export const importBankStatement = (formData: FormData) =>
  fetch('/api/banking/statements/import', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  }).then((r) => {
    if (!r.ok) throw new Error('Upload failed: ' + r.statusText);
    return r.json();
  });

export const matchBankRow = (rowId: number, expenseId: number) =>
  api<BankStatementRow>(`/banking/rows/${rowId}/match`, { method: 'POST', body: { expenseId } });

export const unmatchBankRow = (rowId: number) =>
  api<BankStatementRow>(`/banking/rows/${rowId}/unmatch`, { method: 'POST', body: {} });

export const autoMatchBankRows = () =>
  api<{ autoMatchedCount: number }>('/banking/auto-match', { method: 'POST', body: {} });

export const fetchReportCatalog = () => api<ReportMetadata[]>('/reports/catalog');

export const submitReportExport = (data: { reportId: string; format: string; filterParams?: Record<string, unknown> }) =>
  api<ExportJobStatus>('/reports/export', { method: 'POST', body: data });

export const fetchReportJobStatus = (jobId: string) =>
  api<ExportJobStatus>(`/reports/export/${jobId}/status`);

