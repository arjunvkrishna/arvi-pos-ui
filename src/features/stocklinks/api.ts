import { api } from '../../api/client';
import type { InventoryInput } from '../inventory/api';
import type { Link } from './rules';

/** Every dish -> stock link (recipe row). Under ['recipe'] so the per-dish recipe dialog refreshes with it. */
export const linksKey = ['recipe', 'all'] as const;
export const fetchLinks = () => api<Link[]>('/recipes').then((l) => l ?? []);
export const createLink = (menuItemId: number, inventoryItemId: number, quantityPerServing: number, unit: string) =>
  api<Link>('/recipes', { method: 'POST', body: { menuItemId, inventoryItemId, quantityPerServing, unit, active: true } });
export const updateLink = (id: number, quantityPerServing: number, unit: string) =>
  api<Link>(`/recipes/${id}`, { method: 'PUT', body: { quantityPerServing, unit } });
export const deleteLink = (id: number) => api(`/recipes/${id}`, { method: 'DELETE' });

export interface NewStockItem { name: string; unit: string; packName?: string | null; packSize?: number | null }
/** A stock item made on the spot (0 in stock, reduced automatically by sales); stock and cost are filled in later by purchases. */
export const createStockItem = (n: NewStockItem) => {
  const body: InventoryInput = {
    name: n.name.trim(), quantity: 0, unit: n.unit, itemCategory: 'Stock', unitVolume: 1, volume: 1, volumeUnit: 'na', totalVolume: 0, costPerVolume: 0,
    minQuantity: 0, costPerUnit: 0, supplier: '', packName: n.packSize && n.packSize > 1 ? n.packName?.trim() || 'pack' : null, packSize: n.packSize && n.packSize > 1 ? n.packSize : 0,
    active: true, autoDeduct: true, shelfLifeDays: 0, expiryWarnDays: 2,
  };
  return api<{ id: number; name: string; unit: string }>('/inventory', { method: 'POST', body });
};
