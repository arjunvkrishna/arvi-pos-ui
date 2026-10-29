import { api } from '../../api/client';

export interface LowStockAlert {
  id: number;
  name: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
}

export interface TopSellingDish {
  itemName: string;
  quantitySold: number;
  totalSales: number;
}

export interface OwnerDashboardData {
  businessDate: string;
  grossSalesToday: number;
  netSalesToday: number;
  totalDiscountsToday: number;
  totalTaxToday: number;
  billsCountToday: number;
  avgOrderValueToday: number;
  grossSalesYesterday: number;
  netSalesYesterday: number;
  billsCountYesterday: number;
  avgOrderValueYesterday: number;
  netSalesGrowthPercent: number;
  billsCountGrowthPercent: number;
  tenderBreakdown: Record<string, number>;
  activeTablesOccupied: number;
  totalTables: number;
  tableOccupancyPercent: number;
  lowStockItemsCount: number;
  lowStockAlerts: LowStockAlert[];
  topSellingDishes: TopSellingDish[];
}

export const fetchOwnerDashboard = (date?: string) =>
  api<OwnerDashboardData>(date ? `/analytics/owner-dashboard?date=${encodeURIComponent(date)}` : '/analytics/owner-dashboard');

export interface SoldDish { menuItemId: number | null; itemName: string; categoryName: string; quantity: number; revenue: number; bills: number; sharePercent: number }
export interface SoldPeriodDish { itemName: string; quantity: number; revenue: number }
export interface SoldPeriod { start: string; end: string; quantity: number; revenue: number; items: SoldPeriodDish[] }
export interface ItemsSold {
  from: string; to: string; groupBy: 'DAY' | 'WEEK'; query: string;
  totalQuantity: number; totalRevenue: number; dishCount: number;
  items: SoldDish[]; periods: SoldPeriod[];
}
export interface ItemsSoldQuery { from: string; to: string; groupBy: 'DAY' | 'WEEK'; q: string; categoryIds: number[]; orderTypes: string[] }

export const itemsSoldKey = ['items-sold'] as const;
export function fetchItemsSold(f: ItemsSoldQuery) {
  const p = new URLSearchParams({ from: f.from, to: f.to, groupBy: f.groupBy });
  if (f.q.trim()) p.set('q', f.q.trim());
  for (const id of f.categoryIds) p.append('categoryIds', String(id));
  for (const t of f.orderTypes) p.append('orderTypes', t);
  return api<ItemsSold>(`/analytics/items-sold?${p.toString()}`);
}
