import { api } from '../../api/client';

export interface InventoryItem {
  id: number;
  name: string;
  itemCategory?: string | null;
  quantity: number;
  unit: string;
  unitVolume?: number | null;
  volume?: number | null;
  volumeUnit?: string | null;
  totalVolume?: number | null;
  costPerUnit?: number | null;
  costPerVolume?: number | null;
  minQuantity: number;
  supplier?: string | null;
  packName?: string | null;
  packSize?: number | null;
  lowStock?: boolean;
  active?: boolean;
  /** false = issued by hand: selling a dish with a recipe does not reduce this stock */
  autoDeduct?: boolean;
  shelfLifeDays?: number | null;
  expiryWarnDays?: number | null;
  /** earliest expiry that matters, its status (null = nothing tracked, OK, SOON, EXPIRED) and the quantity affected */
  nextExpiryDate?: string | null;
  expiryStatus?: 'OK' | 'SOON' | 'EXPIRED' | null;
  expiringQuantity?: number | null;
}

/** Stock still on hand from one delivery, with its expiry. */
export interface ExpiryBatch {
  itemId: number; itemName: string; unit: string; packName?: string | null; packSize?: number | null;
  expiryDate: string; quantity: number; daysLeft: number; status: 'OK' | 'SOON' | 'EXPIRED';
  invoiceId?: number | null; invoiceNumber?: string | null; receivedOn?: string | null;
}

export interface InventoryInput {
  name: string;
  quantity: number;
  unit: string;
  itemCategory: string;
  unitVolume: number;
  volume: number;
  volumeUnit: string;
  totalVolume: number;
  costPerVolume: number;
  minQuantity: number;
  costPerUnit: number;
  supplier: string;
  packName: string | null;
  packSize: number;
  active: true;
  autoDeduct: boolean;
  /** 0 clears the shelf life */
  shelfLifeDays: number;
  expiryWarnDays: number;
}

export interface StockTransaction {
  id?: number;
  createdAt?: string | null;
  itemName?: string | null;
  transactionType: string;
  quantity: number;
  unit?: string | null;
  previousStock: number;
  newStock: number;
  userName?: string | null;
  userRole?: string | null;
  supplierName?: string | null;
  invoiceReference?: string | null;
  unitPrice?: number | null;
  notes?: string | null;
  /** USAGE, EXPIRED, SPOILED, BREAKAGE, STAFF_MEAL or OTHER (empty on older rows) */
  reasonType?: string | null;
}

export interface HistoryFilters { startDate?: string; endDate?: string; transactionType?: string; itemId?: string; supplierId?: string }
export interface SupplierRef { id: number; name: string }

export interface Recipe { id: number; inventoryItemName: string; quantityPerServing: number; unit: string; costPerServing?: number | null; inventoryAutoDeduct?: boolean }

export const inventoryKey = ['inventory'] as const;
export const fetchInventory = () => api<InventoryItem[]>('/inventory');
export const saveInventoryItem = (id: number | null, item: InventoryInput) =>
  id ? api(`/inventory/${id}`, { method: 'PUT', body: item }) : api('/inventory', { method: 'POST', body: item });
export const deleteInventoryItem = (id: number) => api(`/inventory/${id}`, { method: 'DELETE' });
export const issueStock = (id: number, quantity: number, reason: string, inPacks: boolean, reasonType = 'USAGE', allowNegative = false) =>
  api(`/inventory/${id}/decrease`, { method: 'POST', body: { quantity, reason, inPacks, reasonType, allowNegative } });
/** Expired and soon-to-expire stock, earliest first (under the inventory key, so every stock change refreshes it). */
export const expiryKey = [...inventoryKey, 'expiry'] as const;
export const fetchExpiry = () => api<ExpiryBatch[]>('/inventory/expiry');
export const sendStockAlert = (item: InventoryItem, customMessage: string) =>
  api('/notifications/stock-alert', {
    method: 'POST',
    body: { inventoryItemId: item.id, itemName: item.name, currentQuantity: item.quantity, minQuantity: item.minQuantity, unit: item.unit, customMessage },
  });

export const fetchTransactions = (f: HistoryFilters) => {
  const q = new URLSearchParams();
  (Object.entries(f) as [string, string | undefined][]).forEach(([k, v]) => { if (v) q.append(k, v); });
  return api<StockTransaction[]>(`/inventory/transactions?${q.toString()}`);
};
export const fetchSuppliers = () => api<SupplierRef[]>('/suppliers?activeOnly=false');

export const fetchRecipe = (menuItemId: number) => api<Recipe[]>(`/recipes/menu-item/${menuItemId}`);
export const addRecipeIngredient = (menuItemId: number, inventoryItemId: number, quantityPerServing: number, unit: string) =>
  api('/recipes', { method: 'POST', body: { menuItemId, inventoryItemId, quantityPerServing, unit, active: true } });
export const deleteRecipeIngredient = (id: number) => api(`/recipes/${id}`, { method: 'DELETE' });

// ---- reorder list, cost alerts, stock counts ----
export interface ReorderRow {
  itemId: number; name: string; unit: string; category?: string | null; quantity: number; minQuantity: number;
  reason: 'OUT' | 'BELOW_MIN' | 'RUNS_OUT_SOON'; avgDailyUse?: number | null; daysLeft?: number | null;
  suggestedUnits: number; suggestedPacks?: number | null; packName?: string | null; packSize?: number | null;
  supplierId?: number | null; supplier?: string | null; lastUnitCost: number; estimatedCost: number;
}
export interface Reorder { usageDays: number; coverDays: number; items: ReorderRow[]; estimatedTotal: number }
export interface CostChange { itemId: number; name: string; unit: string; supplier?: string | null; previousCost: number; latestCost: number; changePercent: number; direction: 'UP' | 'DOWN'; previousDate?: string | null; latestDate?: string | null; dishes: string[] }
export interface DishMargin { menuItemId: number; name: string; price: number; cost: number; profit: number; marginPercent: number; status: 'NEGATIVE' | 'LOW'; affectedBy: string[] }
export interface CostAlerts { changeThresholdPercent: number; marginFloorPercent: number; changes: CostChange[]; lowMargin: DishMargin[] }
export interface CostAlertSettings { changeThresholdPercent: number; marginFloorPercent: number }
export interface CountLine { id: number; itemId: number; name: string; unit?: string | null; bookQty: number; countedQty?: number | null; variance?: number | null; varianceValue?: number | null; costPerUnit?: number | null }
export interface StockCount {
  id: number; status: 'DRAFT' | 'APPLIED' | 'CANCELLED'; scope?: string | null; note?: string | null; createdBy?: string | null; createdAt?: string; appliedBy?: string | null; appliedAt?: string | null;
  itemCount: number; countedCount: number; differenceCount: number; varianceValue: number; lines?: CountLine[] | null;
}

export const reorderKey = [...inventoryKey, 'reorder'] as const;
export const costAlertsKey = [...inventoryKey, 'cost-alerts'] as const;
export const countsKey = [...inventoryKey, 'counts'] as const;
export const fetchReorder = () => api<Reorder>('/inventory/reorder');
export const fetchCostAlerts = () => api<CostAlerts>('/inventory/cost-alerts');
export const saveCostAlertSettings = (s: CostAlertSettings) => api<CostAlertSettings>('/inventory/cost-alerts/settings', { method: 'PUT', body: s });
export const fetchCounts = () => api<StockCount[]>('/inventory/counts');
export const fetchCount = (id: number) => api<StockCount>(`/inventory/counts/${id}`);
export const startCount = (category: string, note: string) => api<StockCount>('/inventory/counts', { method: 'POST', body: { category, note } });
export const saveCountLines = (id: number, lines: { lineId: number; countedQty: number | null }[]) => api<StockCount>(`/inventory/counts/${id}/lines`, { method: 'PUT', body: { lines } });
export const applyCount = (id: number) => api<StockCount>(`/inventory/counts/${id}/apply`, { method: 'POST', body: {} });
export const cancelCount = (id: number) => api<StockCount>(`/inventory/counts/${id}/cancel`, { method: 'POST', body: {} });
