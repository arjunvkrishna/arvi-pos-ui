export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CAFE_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'KITCHEN';

export interface User {
  id: number;
  username: string;
  role: Role;
  employeeId?: number;
  employeeName?: string;
  canTakeOrders?: boolean;
  canManageInventory?: boolean;
  mustChangePassword?: boolean;
  tenantId?: number;
  tenantName?: string;
  tenantCode?: string;
  outletId?: number;
  outletName?: string;
  outletCode?: string;
  active?: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  subscriptionPlan: string;
  status: string;
  maxOutlets: number;
  outletsCount?: number;
  usersCount?: number;
  totalBillsCount?: number;
  totalGmv?: number;
  currency: string;
  currencySymbol: string;
  createdAt: string;
}

export interface Outlet {
  id: number;
  tenantId: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  active: boolean;
  tenantId?: number;
}

export interface MenuItem {
  id: number;
  name: string;
  categoryId: number;
  price: number;
  description?: string;
  imageUrl?: string;
  isVeg: boolean;
  isAvailable: boolean;
  active: boolean;
  tenantId?: number;
  outletId?: number;
}

export type OrderType = 'TABLE' | 'OUTDOOR' | 'TAKEAWAY';
export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
export type BillStatus = 'DRAFT' | 'ACTIVE' | 'KOT_REQUESTED' | 'KOT_PRINTED' | 'BILL_REQUESTED' | 'BILL_PRINTED' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'VOIDED';

export interface BillItem {
  id?: number;
  menuItemId?: number;
  itemName: string;
  quantity: number;
  price: number;
  subtotal: number;
  notes?: string;
  parcel?: boolean;
}

export interface Bill {
  id: number;
  billNumber: string;
  tableNumber?: string;
  customerName?: string;
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  netAmount: number;
  paymentMode: PaymentMode;
  status: BillStatus;
  notes?: string;
  orderType: OrderType;
  outdoorToken?: string;
  takeawayToken?: string;
  shiftId?: number;
  tenantId?: number;
  outletId?: number;
  createdAt: string;
  printedAt?: string;
  kotPrintedAt?: string;
  kotNumber?: string;
  items: BillItem[];
}

export interface DiningTable {
  id: number;
  name: string;
  active: boolean;
  displayOrder: number;
  tenantId?: number;
  outletId?: number;
  status?: 'VACANT' | 'OCCUPIED' | 'BILL_REQUESTED';
  activeBill?: Bill;
}

export interface CashierShift {
  id: number;
  registerId: string;
  cashierId: number;
  cashierName: string;
  openedAt: string;
  openingFloat: number;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  countedCash?: number;
  expectedCash?: number;
  variance?: number;
  cashSales?: number;
  upiSales?: number;
  cardSales?: number;
  totalSales?: number;
  billsCount?: number;
  notes?: string;
  tenantId?: number;
  outletId?: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  costPerUnit?: number;
  category?: string;
  tenantId?: number;
  outletId?: number;
}

export interface CafeExpense {
  id: number;
  title: string;
  category: string;
  amount: number;
  paymentMode: string;
  expenseDate: string;
  notes?: string;
  tenantId?: number;
  outletId?: number;
}

export interface Employee {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  designation?: string;
  basicSalary: number;
  joinedDate?: string;
  active: boolean;
  tenantId?: number;
  outletId?: number;
}

export interface PrinterSetting {
  id?: number;
  billPrinterHost?: string;
  billPrinterPort?: number;
  kotPrinterHost?: string;
  kotPrinterPort?: number;
  juiceKotPrinterHost?: string;
  juiceKotPrinterPort?: number;
  bridgeToken?: string;
  tenantId?: number;
  outletId?: number;
}

export interface GstSetting {
  gstEnabled: boolean;
  gstNumber?: string;
  cgstPercent: number;
  sgstPercent: number;
}
