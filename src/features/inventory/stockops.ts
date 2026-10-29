import type { CountLine, ReorderRow } from './api';

export const REASON_TEXT: Record<ReorderRow['reason'], string> = { OUT: 'Out of stock', BELOW_MIN: 'Below minimum', RUNS_OUT_SOON: 'Running out soon' };
export const REASON_TONE: Record<ReorderRow['reason'], 'danger' | 'warn' | 'info'> = { OUT: 'danger', BELOW_MIN: 'warn', RUNS_OUT_SOON: 'info' };

const NUM = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const RUPEE = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const NO_SUPPLIER = 'No supplier yet';

/** Quantity to order for a row: what the user typed, else the suggestion. */
export const orderQty = (r: ReorderRow, edited: Record<number, number | undefined>) => {
  const v = edited[r.itemId];
  return v !== undefined && Number.isFinite(v) && v >= 0 ? v : r.suggestedUnits;
};

/** "2 case (24 bottle)" for packed items, "6 kg" otherwise. */
export function orderLabel(r: ReorderRow, units: number): string {
  const ps = r.packSize && r.packSize > 1 ? r.packSize : 0;
  if (!ps) return `${NUM(units)} ${r.unit}`;
  const packs = units / ps;
  return Number.isInteger(Math.round(packs * 1000) / 1000) ? `${NUM(packs)} ${r.packName || 'pack'} (${NUM(units)} ${r.unit})` : `${NUM(units)} ${r.unit}`;
}

export interface SupplierGroup { supplier: string; rows: ReorderRow[] }
/** Rows grouped by the supplier they were last bought from; items with no supplier come last. */
export function groupBySupplier(rows: ReorderRow[]): SupplierGroup[] {
  const map = new Map<string, ReorderRow[]>();
  for (const r of rows) { const k = r.supplier?.trim() || NO_SUPPLIER; map.set(k, [...(map.get(k) ?? []), r]); }
  return [...map.entries()].map(([supplier, list]) => ({ supplier, rows: list }))
    .sort((a, b) => (a.supplier === NO_SUPPLIER ? 1 : b.supplier === NO_SUPPLIER ? -1 : a.supplier.localeCompare(b.supplier)));
}

export const groupTotal = (g: SupplierGroup, edited: Record<number, number | undefined>) => g.rows.reduce((s, r) => s + orderQty(r, edited) * r.lastUnitCost, 0);

/** Plain text to paste into WhatsApp or a message to the supplier. Rows with a zero quantity are left out. */
export function orderText(g: SupplierGroup, edited: Record<number, number | undefined>, date = new Date()): string {
  const lines = g.rows.filter((r) => orderQty(r, edited) > 0).map((r, k) => `${k + 1}. ${r.name} - ${orderLabel(r, orderQty(r, edited))}`);
  if (lines.length === 0) return '';
  const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `Order for ${g.supplier === NO_SUPPLIER ? 'supplier' : g.supplier} (${d})\n${lines.join('\n')}\nPlease confirm availability and delivery time. Thank you.`;
}

export const estimateText = (n: number) => (n > 0 ? `about ${RUPEE(n)}` : 'price unknown');

/** The number typed in a count box: '' means not counted, anything invalid is refused (null). */
export function parseCounted(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 1000) / 1000 : undefined;
}

export interface CountSummary { counted: number; total: number; differences: number; value: number }
/** Live totals for a count sheet; typed holds the text boxes by line id (missing = unchanged from the saved figure). */
export function summarize(lines: CountLine[], typed: Record<number, string>, cost: (l: CountLine) => number = () => 0): CountSummary {
  let counted = 0, differences = 0, value = 0;
  for (const l of lines) {
    const t = typed[l.id];
    const c = t === undefined ? l.countedQty ?? null : parseCounted(t);
    if (c === null || c === undefined) continue;
    counted++;
    const diff = c - l.bookQty;
    if (Math.abs(diff) >= 0.0005) { differences++; value += diff * cost(l); }
  }
  return { counted, total: lines.length, differences, value: Math.round(value * 100) / 100 };
}

export const varianceText = (v: number | null | undefined, unit?: string | null) => {
  if (v === null || v === undefined) return '';
  if (Math.abs(v) < 0.0005) return 'matches';
  return `${v > 0 ? '+' : '−'}${NUM(Math.abs(v))} ${unit ?? ''}`.trim();
};

export const changeText = (pct: number) => `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
