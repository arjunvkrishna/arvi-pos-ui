import type { HistoryFilters, InventoryInput, InventoryItem } from './api';

// Stock is counted in ONE stock unit (bottle, packet, kg...). An item may come in a pack (case = 12 bottles).
// "Size of one" (e.g. 1 L per bottle) is optional extra information.

export const CATEGORIES = ['Stock', 'Consumable', 'Small equipment', 'Fixed asset'] as const;
export type CategoryFilter = (typeof CATEGORIES)[number] | 'ALL';
export const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  Stock: 'Stock (food & raw)', Consumable: 'Consumables', 'Small equipment': 'Small equipment', 'Fixed asset': 'Fixed assets', ALL: 'All items',
};
export const CATEGORY_HELP: Record<(typeof CATEGORIES)[number], string> = {
  Stock: 'Stock (Food products, Raw ingredients)',
  Consumable: 'Consumable (Napkins, Cups, Straws, Cleaning)',
  'Small equipment': 'Small equipment (Cutlery, Blender jars, Utensils)',
  'Fixed asset': 'Fixed asset (Espresso machine, Grinder, Fridge)',
};
export const STOCK_UNITS = ['packet', 'bag', 'box', 'bottle', 'can', 'tin', 'jar', 'piece', 'pieces', 'crate', 'bundle', 'kg', 'ltr', 'meter', 'cm', 'mm', 'inch'];
export const VOLUME_UNITS = ['kg', 'g', 'mg', 'ltr', 'ml', 'meter', 'cm', 'mm', 'inch', 'pieces', 'piece', 'na'];

export const fmtNum = (n: number | null | undefined) =>
  (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 });

type PackInfo = Pick<InventoryItem, 'unit' | 'volumeUnit' | 'unitVolume' | 'packName' | 'packSize'>;

export const packSizeOf = (i: Pick<PackInfo, 'packSize'>) => (Number(i.packSize) > 1 ? Number(i.packSize) : 0);
export const packNameOf = (i: Pick<PackInfo, 'packName'>) => i.packName || 'pack';

export function hasSize(i: Pick<PackInfo, 'unit' | 'volumeUnit' | 'unitVolume'>): boolean {
  const vu = String(i.volumeUnit ?? '').toLowerCase();
  const u = String(i.unit ?? '').toLowerCase();
  return !!vu && vu !== u && !['na', 'none', 'n/a', 'piece', 'pieces', 'pcs'].includes(vu) && Number(i.unitVolume) > 0;
}

/** "9 case + 7 bottle" for a stock quantity; '' when the item has no pack or less than one pack. */
export function packBreakdown(i: PackInfo, qty: number): string {
  const ps = packSizeOf(i);
  if (!ps) return '';
  const whole = Math.floor(qty / ps + 1e-9);
  if (whole <= 0) return '';
  const rem = Math.round((qty - whole * ps) * 1000) / 1000;
  return rem === 0 ? `${fmtNum(whole)} ${packNameOf(i)}` : `${fmtNum(whole)} ${packNameOf(i)} + ${fmtNum(rem)} ${i.unit}`;
}

export function isCountableUnit(unit: string, volUnit: string): boolean {
  const set = ['piece', 'pieces', 'pcs', 'na', 'none', 'n/a', 'no volume'];
  return set.includes(unit.toLowerCase().trim()) || set.includes(volUnit.toLowerCase().trim());
}

export const categoryOf = (i: InventoryItem) => i.itemCategory || 'Stock';
export const categoryCounts = (items: InventoryItem[]): Record<CategoryFilter, number> => ({
  Stock: items.filter((i) => categoryOf(i).toLowerCase() === 'stock').length,
  Consumable: items.filter((i) => categoryOf(i).toLowerCase() === 'consumable').length,
  'Small equipment': items.filter((i) => categoryOf(i).toLowerCase() === 'small equipment').length,
  'Fixed asset': items.filter((i) => categoryOf(i).toLowerCase() === 'fixed asset').length,
  ALL: items.length,
});

export function categoryTone(category?: string | null): 'brand' | 'info' | 'ok' | 'neutral' {
  const c = (category || 'Stock').toLowerCase();
  if (c.includes('fixed')) return 'neutral';
  if (c.includes('consumable')) return 'info';
  if (c.includes('small') || c.includes('equipment')) return 'ok';
  return 'brand';
}

export function matchesSearch(i: InventoryItem, term: string): boolean {
  if (!term) return true;
  return [i.name, categoryOf(i), i.supplier, i.unit, i.volumeUnit, i.packName].some((v) => v && String(v).toLowerCase().includes(term));
}

export function visibleItems(items: InventoryItem[], category: CategoryFilter, term: string, lowOnly: boolean, expiringOnly = false, negativeOnly = false): InventoryItem[] {
  const t = term.trim().toLowerCase();
  return items
    .filter((i) => category === 'ALL' || categoryOf(i).toLowerCase() === category.toLowerCase())
    .filter((i) => (!lowOnly || i.lowStock) && (!expiringOnly || isExpiring(i)) && (!negativeOnly || isNegative(i)) && matchesSearch(i, t));
}

export interface ItemForm {
  name: string; category: string; unit: string; quantity: string; hasPack: boolean; packName: string; packSize: string;
  unitVolume: string; volumeUnit: string; costPerUnit: string; minQuantity: string; supplier: string;
  autoDeduct: boolean; shelfLifeDays: string; expiryWarnDays: string;
}

export function formFromItem(i: InventoryItem | null, defaultCategory: string): ItemForm {
  if (!i) return { name: '', category: defaultCategory, unit: 'packet', quantity: '', hasPack: false, packName: '', packSize: '', unitVolume: '1', volumeUnit: 'na', costPerUnit: '', minQuantity: '', supplier: '', autoDeduct: true, shelfLifeDays: '', expiryWarnDays: '2' };
  const pack = packSizeOf(i) > 0;
  return {
    name: i.name || '', category: i.itemCategory || 'Stock', unit: (i.unit || 'packet').toLowerCase(),
    quantity: String(i.quantity ?? 0), hasPack: pack, packName: pack ? packNameOf(i) : '', packSize: pack ? String(i.packSize) : '',
    unitVolume: String(i.unitVolume ?? i.volume ?? 1), volumeUnit: (i.volumeUnit || i.unit || 'kg').toLowerCase(),
    costPerUnit: String(i.costPerUnit ?? 0), minQuantity: String(i.minQuantity ?? 0), supplier: i.supplier || '',
    autoDeduct: i.autoDeduct !== false, shelfLifeDays: i.shelfLifeDays ? String(i.shelfLifeDays) : '', expiryWarnDays: String(i.expiryWarnDays ?? 2),
  };
}

/** Builds the server payload; returns an error message instead when the form is not valid. */
export function payloadFromForm(f: ItemForm): InventoryInput | string {
  const unit = f.unit.trim() || 'packet';
  const volUnit = f.volumeUnit || 'kg';
  const countable = isCountableUnit(unit, volUnit);
  const unitVol = parseFloat(f.unitVolume) || 1;
  const qty = parseFloat(f.quantity) || 0;
  const cost = parseFloat(f.costPerUnit) || 0;
  const packSize = f.hasPack ? parseFloat(f.packSize) || 0 : 0;
  if (f.hasPack && !(packSize > 1)) return `Enter how many ${unit} are in one pack (more than 1), or untick "Comes in packs".`;
  const shelf = f.shelfLifeDays.trim() === '' ? 0 : Number(f.shelfLifeDays);
  if (!Number.isInteger(shelf) || shelf < 0 || shelf > 3650) return 'Shelf life must be a whole number of days (leave it empty if the item does not expire).';
  const warn = f.expiryWarnDays.trim() === '' ? 2 : Number(f.expiryWarnDays);
  if (!Number.isInteger(warn) || warn < 0 || warn > 365) return 'Warn before expiry must be a whole number of days (0 to 365).';
  return {
    name: f.name.trim(), quantity: qty, unit, itemCategory: f.category || 'Stock',
    unitVolume: countable ? 1 : unitVol, volume: countable ? 1 : unitVol, volumeUnit: volUnit,
    totalVolume: countable ? qty : Math.round(qty * unitVol * 1000) / 1000,
    costPerVolume: countable ? cost : unitVol > 0 ? cost / unitVol : cost,
    minQuantity: parseFloat(f.minQuantity) || 0, costPerUnit: cost, supplier: f.supplier.trim(),
    packName: f.hasPack ? f.packName.trim() || 'pack' : null, packSize: f.hasPack ? packSize : 0, active: true,
    autoDeduct: f.autoDeduct, shelfLifeDays: shelf, expiryWarnDays: warn,
  };
}

/** What will be left after issuing `qty` (in packs when `inPacks`). `left < 0` means more than is in stock. */
export function issuePreview(item: InventoryItem, qty: number, inPacks: boolean) {
  const used = Math.round(qty * (inPacks ? packSizeOf(item) || 1 : 1) * 1000) / 1000;
  return { used, left: Math.round((item.quantity - used) * 1000) / 1000 };
}

/** Local calendar date (toISOString would use UTC and be a day off in India around midnight). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export type HistoryPreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

/** Date range for a preset (weeks start on Monday). */
export function presetRange(preset: HistoryPreset, from: string, to: string, now = new Date()): { startDate: string; endDate: string } {
  if (preset === 'today') return { startDate: iso(now), endDate: iso(now) };
  if (preset === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return { startDate: iso(y), endDate: iso(y) }; }
  if (preset === 'this_week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    return { startDate: iso(monday), endDate: iso(now) };
  }
  if (preset === 'this_month') return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(now) };
  if (preset === 'custom') return { startDate: from, endDate: to };
  return { startDate: '', endDate: '' };
}

export const toHistoryFilters = (preset: HistoryPreset, from: string, to: string, type: string, itemId: string, supplierId: string): HistoryFilters =>
  ({ ...presetRange(preset, from, to), transactionType: type, itemId, supplierId });

/** Why stock is issued; anything but USAGE shows in the history and feeds the waste view. */
export const REASON_TYPES = [
  { value: 'USAGE', label: 'Usage (kitchen / counter)' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'SPOILED', label: 'Spoiled' },
  { value: 'BREAKAGE', label: 'Broken / damaged' }, { value: 'STAFF_MEAL', label: 'Staff meal' }, { value: 'OTHER', label: 'Other' },
] as const;
export const reasonLabel = (v?: string | null) => (v === 'COUNT' ? 'Stock count' : REASON_TYPES.find((r) => r.value === v)?.label.replace(/ \(.*\)$/, '') ?? '');

/** "today", "tomorrow", "in 3 days", "yesterday", "5 days ago" from a day count (negative = past). */
export function daysText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
export const expiryTone = (status?: string | null) => (status === 'EXPIRED' ? 'danger' : status === 'SOON' ? 'warn' : 'neutral') as 'danger' | 'warn' | 'neutral';

/** Days from today (local) to a yyyy-mm-dd date; negative = already past. */
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

export const isExpiring = (i: Pick<InventoryItem, 'expiryStatus'>) => i.expiryStatus === 'EXPIRED' || i.expiryStatus === 'SOON';

/** Below zero: stock was used (a sale, an issue) before its purchase was entered. Entering the purchase puts the number right. */
export const isNegative = (i: Pick<InventoryItem, 'quantity'>) => (Number(i.quantity) || 0) < 0;
export const NEGATIVE_HINT = 'More was used than was ever added. Enter the purchase and this number corrects itself.';
