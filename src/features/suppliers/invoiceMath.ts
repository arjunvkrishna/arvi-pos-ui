import type { Invoice, InvoiceBody, InvoiceItem } from './api';
import { fmtNum, hasSize, isCountableUnit, packNameOf, packSizeOf } from '../inventory/rules';
import type { InventoryItem } from '../inventory/api';

export const GST_RATES = [0, 5, 12, 18, 28];
export type GstMode = 'AUTO' | 'CUSTOM' | string;     // AUTO = sum of the rows, CUSTOM = typed amount, otherwise a flat rate

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One editable row of the invoice; numeric fields are kept as typed so the inputs do not fight the user. */
export interface Row {
  key: string;
  inventoryItemId: number | null;
  productName: string;
  itemCategory: string;
  purchaseMode: 'UNIT' | 'PACK';
  packName: string;
  packSize: number | null;
  unit: string;
  unitVolume: number;
  volumeUnit: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  /** optional expiry date of the goods (yyyy-mm-dd), empty = none */
  expiryDate: string;
}

let seq = 0;
const key = () => `r${++seq}`;

/** Stock units one purchased unit stands for: the pack size when bought by pack, else 1. 0 = a pack row without its size. */
export function rowFactor(r: Pick<Row, 'purchaseMode' | 'packSize'>): number {
  if (r.purchaseMode !== 'PACK') return 1;
  const ps = Number(r.packSize);
  return ps > 1 ? ps : 0;
}

export const lineSubtotal = (r: Row) => r2((Number(r.quantity) || 0) * (Number(r.unitPrice) || 0));
export const lineGst = (r: Row) => (Number(r.gstRate) > 0 ? r2((lineSubtotal(r) * Number(r.gstRate)) / 100) : 0);
export const lineNet = (r: Row) => r2(lineSubtotal(r) + lineGst(r));

/** The "you get" chip: stock units added and cost per stock unit (and per volume when a size is set). */
export function rowResult(r: Row): { stock: string; cost: string } {
  const qty = Number(r.quantity) || 0;
  const rate = Number(r.unitPrice) || 0;
  const unit = r.unit || 'unit';
  const f = rowFactor(r);
  if (!f) return { stock: `Enter how many ${unit} in a pack`, cost: '' };
  const stockQty = Math.round(qty * f * 1000) / 1000;
  const perUnit = rate / f;
  const probe = { unit, volumeUnit: r.volumeUnit, unitVolume: Number(r.unitVolume) || 1 };
  let cost = `₹${perUnit.toFixed(2)} / ${unit}`;
  let stock = `${fmtNum(stockQty)} ${unit}`;
  if (hasSize(probe)) {
    cost += ` · ₹${(perUnit / probe.unitVolume).toFixed(2)} / ${probe.volumeUnit}`;
    stock += ` (${fmtNum(stockQty * probe.unitVolume)} ${probe.volumeUnit})`;
  }
  return { stock, cost };
}

export function rowFromInventory(item: InventoryItem, defaultGst: number): Row {
  const unitVol = item.unitVolume ?? item.volume ?? 1;
  const volUnit = item.volumeUnit || item.unit || 'kg';
  const rate = item.costPerUnit || 0;
  const countable = isCountableUnit(item.unit, volUnit);
  const byPack = packSizeOf(item) > 0;   // items that come in packs are normally bought by the pack
  return {
    key: key(), inventoryItemId: item.id, productName: item.name, itemCategory: item.itemCategory || 'Stock',
    purchaseMode: byPack ? 'PACK' : 'UNIT', packName: byPack ? packNameOf(item) : '', packSize: byPack ? Number(item.packSize) : null,
    unit: item.unit || 'packet', unitVolume: countable ? 1 : unitVol, volumeUnit: volUnit,
    quantity: 1, unitPrice: byPack ? r2(rate * packSizeOf(item)) : rate, gstRate: defaultGst, expiryDate: '',
  };
}

export interface NewProduct { name: string; category: string; unit: string; volume: string; volumeUnit: string }
export function rowFromNewProduct(p: NewProduct, defaultGst: number): Row {
  const unit = p.unit.trim() || 'packet';
  const volUnit = p.volumeUnit.trim() || 'kg';
  const raw = parseFloat(p.volume);
  const countable = isCountableUnit(unit, volUnit);
  const unitVol = countable ? (raw > 0 ? raw : 1) : raw || 1;
  return {
    key: key(), inventoryItemId: null, productName: p.name.trim(), itemCategory: p.category || 'Stock', purchaseMode: 'UNIT', packName: '', packSize: null,
    unit, unitVolume: countable ? 1 : unitVol, volumeUnit: volUnit, quantity: 1, unitPrice: 0, gstRate: defaultGst, expiryDate: '',
  };
}

export function rowFromInvoiceItem(it: InvoiceItem, inv: Invoice): Row {
  return {
    key: key(), inventoryItemId: it.inventoryItemId, productName: it.productName, itemCategory: it.itemCategory || 'Stock',
    purchaseMode: it.purchaseMode === 'PACK' ? 'PACK' : 'UNIT', packName: it.packName || '', packSize: it.packSize || null,
    unit: it.unit || 'packet', unitVolume: it.unitVolume ?? it.volume ?? 1, volumeUnit: it.volumeUnit || it.unit || 'kg',
    quantity: it.quantity ?? 0, unitPrice: it.unitPrice ?? 0, gstRate: it.gstRate ?? inv.gstRate ?? 0, expiryDate: it.expiryDate || '',
  };
}

/** Switch "bought as" between the stock unit and the pack, keeping the money the same per stock unit. */
export function withMode(r: Row, mode: 'UNIT' | 'PACK', inventory: InventoryItem[]): Row {
  const wasPack = r.purchaseMode === 'PACK';
  const next: Row = { ...r, purchaseMode: mode };
  if (mode === 'PACK' && !next.packSize) {
    const inv = inventory.find((i) => i.id === r.inventoryItemId);
    if (inv && packSizeOf(inv)) { next.packSize = Number(inv.packSize); next.packName = packNameOf(inv); }
  }
  const rate = Number(r.unitPrice) || 0;
  if (wasPack !== (mode === 'PACK') && rate > 0 && (next.packSize ?? 0) > 1) {
    next.unitPrice = r2(mode === 'PACK' ? rate * (next.packSize as number) : rate / (next.packSize as number));
  }
  return next;
}

export interface Totals {
  subtotal: number;
  itemGst: number;
  breakdown: { rate: number; base: number; gst: number }[];
  gst: number;            // the GST that goes into the total
  calculated: number;     // subtotal + GST + other charges - discount
}

export function computeTotals(rows: Row[], mode: GstMode, customGst: number, otherCharges: number, discount: number): Totals {
  const by = new Map<number, { base: number; gst: number }>();
  let subtotal = 0;
  let itemGst = 0;
  for (const r of rows) {
    const base = lineSubtotal(r);
    const g = lineGst(r);
    subtotal += base; itemGst += g;
    const rate = Number(r.gstRate) || 0;
    const cur = by.get(rate) ?? { base: 0, gst: 0 };
    cur.base += base; cur.gst += g;
    by.set(rate, cur);
  }
  subtotal = r2(subtotal); itemGst = r2(itemGst);
  const gst = mode === 'CUSTOM' ? customGst : itemGst;
  return {
    subtotal, itemGst, gst,
    breakdown: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, base: v.base, gst: v.gst })),
    calculated: r2(subtotal + gst + otherCharges - discount),
  };
}

/** Difference between the typed total and the calculated one; null when they agree (within 5 paise). */
export function totalMismatch(entered: number, expected: number): number | null {
  const diff = r2(entered - expected);
  return entered > 0 && Math.abs(diff) > 0.05 ? diff : null;
}

/** Initial GST mode of an existing invoice: a single flat rate on every row, else Auto. */
export function modeForInvoice(inv: Invoice | null): GstMode {
  if (!inv) return 'AUTO';
  const rates = [...new Set((inv.items ?? []).map((it) => String(it.gstRate ?? inv.gstRate ?? 0)))];
  return rates.length === 1 && GST_RATES.map(String).includes(rates[0]) ? rates[0] : 'AUTO';
}

export interface InvoiceForm {
  supplierId: string; invoiceNumber: string; invoiceDate: string; dueDate: string; description: string;
  rows: Row[]; mode: GstMode; customGst: number; otherCharges: number; discount: number; total: number;
}

/** Validates and builds the request; a string is the message to show the user. */
export function buildInvoiceBody(f: InvoiceForm): InvoiceBody | string {
  const supplierId = parseInt(f.supplierId, 10);
  if (!supplierId) return 'Please select a supplier.';
  if (!f.invoiceNumber.trim()) return 'Invoice number is required.';
  if (f.rows.length === 0) return 'Please add at least one product to the invoice.';
  for (const r of f.rows) {
    if (!r.quantity || r.quantity <= 0) return `Invalid quantity for "${r.productName}". Must be greater than 0.`;
    if (r.unitPrice == null || r.unitPrice < 0) return `Invalid price for "${r.productName}". Cannot be negative.`;
  }
  const t = computeTotals(f.rows, f.mode, f.customGst, f.otherCharges, f.discount);
  let gstRate = 0;
  if (f.mode !== 'CUSTOM' && f.mode !== 'AUTO' && f.mode !== '0') gstRate = parseFloat(f.mode) || 0;
  else if (t.subtotal > 0 && t.gst > 0) gstRate = Math.round((t.gst / t.subtotal) * 10000) / 100;
  if (Math.abs(f.total - t.calculated) > 0.05) {
    return `Invoice total does not match calculation: entered ₹${f.total.toFixed(2)}, but subtotal + GST + charges - discount is ₹${t.calculated.toFixed(2)}.`;
  }
  const early = f.rows.find((r) => r.expiryDate && f.invoiceDate && r.expiryDate < f.invoiceDate);
  if (early) return `The expiry date of "${early.productName}" cannot be before the invoice date.`;
  const badPack = f.rows.find((r) => r.purchaseMode === 'PACK' && !(Number(r.packSize) > 1));
  if (badPack) return `Enter how many ${badPack.unit} are in one pack for "${badPack.productName}" (or buy it by ${badPack.unit}).`;

  const items: InvoiceItem[] = f.rows.map((r) => {
    const f2 = rowFactor(r) || 1;
    const unitVol = Number(r.unitVolume) || 1;
    return {
      inventoryItemId: r.inventoryItemId, productName: r.productName, itemCategory: r.itemCategory, purchaseMode: r.purchaseMode,
      packName: r.purchaseMode === 'PACK' ? r.packName || 'pack' : r.packName, packSize: r.packSize, unit: r.unit,
      unitVolume: unitVol, volume: unitVol, volumeUnit: r.volumeUnit, quantity: r.quantity, unitPrice: r.unitPrice,
      gstRate: r.gstRate, expiryDate: r.expiryDate || null, gstAmount: lineGst(r), totalVolume: Math.round(r.quantity * f2 * unitVol * 1000) / 1000,
      costPerVolume: Math.round((unitVol > 0 ? r.unitPrice / f2 / unitVol : 0) * 100) / 100, totalPrice: lineSubtotal(r),
    };
  });
  return {
    supplierId, invoiceNumber: f.invoiceNumber.trim(), invoiceDate: f.invoiceDate, dueDate: f.dueDate || null,
    subtotal: t.subtotal, gstRate, gstAmount: t.gst, otherCharges: f.otherCharges, discount: f.discount, totalAmount: f.total,
    description: f.description.trim(), itemsReceived: f.rows.map((r) => `${r.productName} x${r.quantity} ${r.purchaseMode === 'PACK' ? r.packName || 'pack' : r.unit} (${r.gstRate || 0}% GST)`).join(', '),
    items,
  };
}
