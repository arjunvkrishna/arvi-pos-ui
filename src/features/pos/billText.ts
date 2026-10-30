import type { BillItem } from '../bills/types';

/** Chosen modifiers and combo picks, as one line of text ("Extra cheese (+₹30), Large"). */
export function formatModifiersSnapshot(modJson?: string | null, comboJson?: string | null): string {
  const parts: string[] = [];
  if (modJson) {
    try {
      const parsed = JSON.parse(modJson);
      if (Array.isArray(parsed)) {
        parsed.forEach((m: { name?: string; priceAdjustment?: number; price?: number }) => {
          const p = m.priceAdjustment ?? m.price ?? 0;
          parts.push(p > 0 ? `${m.name} (+₹${p})` : `${m.name}`);
        });
      }
    } catch { /* best effort */ }
  }
  if (comboJson) {
    try {
      const parsed = JSON.parse(comboJson);
      if (Array.isArray(parsed)) {
        parsed.forEach((cg: { selectedItems?: { dishName?: string; additionalPrice?: number }[] }) => {
          cg.selectedItems?.forEach((it) => {
            const p = it.additionalPrice ?? 0;
            parts.push(p > 0 ? `${it.dishName} (+₹${p})` : `${it.dishName}`);
          });
        });
      }
    } catch { /* best effort */ }
  }
  return parts.join(', ');
}

/** How many dishes (not lines) a bill has. */
export const dishCount = (items?: BillItem[]) => (items || []).reduce((n, i) => n + Math.max(0, Number(i.quantity || 0)), 0);
