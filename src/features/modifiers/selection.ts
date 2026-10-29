import type { ComboGroup, ModifierGroup } from './api';

export type Selection = Record<number, number[]>;

/** What is ticked before the cashier touches anything: defaults, else the first option of a required group. */
export function defaultModifierSelection(groups: ModifierGroup[]): Selection {
  const init: Selection = {};
  groups.forEach((g) => {
    if (!g.id) return;
    const defaults = g.modifiers.filter((m) => m.isDefault && m.id).map((m) => m.id!);
    if (defaults.length > 0) init[g.id] = defaults;
    else if (g.minSelections > 0 && g.modifiers.length > 0 && g.modifiers[0].id) init[g.id] = [g.modifiers[0].id];
    else init[g.id] = [];
  });
  return init;
}

export function defaultComboSelection(groups: ComboGroup[]): Selection {
  const init: Selection = {};
  groups.forEach((cg) => {
    if (!cg.id) return;
    if (cg.minChoices > 0 && cg.items.length > 0) init[cg.id] = [cg.items[0].menuItemId];
    else init[cg.id] = [];
  });
  return init;
}

/** The new choice list after tapping `id`, or `current` unchanged when the group is already at its maximum. */
export function toggleChoice(current: number[], id: number, single: boolean, max: number): number[] {
  if (single) return [id];
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (max > 0 && current.length >= max) return current;
  return [...current, id];
}

export function isSelectionValid(groups: ModifierGroup[], comboGroups: ComboGroup[], mods: Selection, combos: Selection): boolean {
  for (const g of groups) {
    if (!g.id) continue;
    const count = (mods[g.id] || []).length;
    if (count < g.minSelections) return false;
    if (g.maxSelections > 0 && count > g.maxSelections) return false;
  }
  for (const cg of comboGroups) {
    if (!cg.id) continue;
    const count = (combos[cg.id] || []).length;
    if (cg.minChoices > 0 && count < cg.minChoices) return false;
    if (cg.maxChoices > 0 && count > cg.maxChoices) return false;
  }
  return true;
}

export interface SelectionSummary {
  totalPrice: number;
  modifiersSnapshot?: string;
  comboSnapshot?: string;
  summaryList: string[];
}

/** Price and the snapshots stored on the bill line. The server re-reads modifier ids, so ids must be exact. */
export function summariseSelection(basePrice: number, groups: ModifierGroup[], comboGroups: ComboGroup[], mods: Selection, combos: Selection): SelectionSummary {
  let extra = 0;
  const modList: Record<string, unknown>[] = [];
  const comboList: Record<string, unknown>[] = [];
  const summaries: string[] = [];

  groups.forEach((g) => {
    if (!g.id) return;
    const chosen = mods[g.id] || [];
    g.modifiers.forEach((m) => {
      if (m.id && chosen.includes(m.id)) {
        const adj = Number(m.priceAdjustment || 0);
        extra += adj;
        modList.push({
          group_name: g.name,
          modifier_id: m.id,
          name: m.name,
          price: adj,
          inventory_item_id: m.inventoryItemId,
          inventory_quantity: m.inventoryQuantity,
        });
        summaries.push(m.name + (adj > 0 ? ` (+₹${adj.toFixed(2)})` : ''));
      }
    });
  });

  comboGroups.forEach((cg) => {
    if (!cg.id) return;
    const chosen = combos[cg.id] || [];
    cg.items.forEach((item) => {
      if (chosen.includes(item.menuItemId)) {
        const addPrice = Number(item.additionalPrice || 0);
        extra += addPrice;
        comboList.push({
          group_name: cg.name,
          menu_item_id: item.menuItemId,
          dish_name: item.menuItemName || 'Combo Item',
          extra_price: addPrice,
        });
        summaries.push((item.menuItemName || 'Item') + (addPrice > 0 ? ` (+₹${addPrice.toFixed(2)})` : ''));
      }
    });
  });

  return {
    totalPrice: Number(basePrice || 0) + extra,
    modifiersSnapshot: modList.length > 0 ? JSON.stringify(modList) : undefined,
    comboSnapshot: comboList.length > 0 ? JSON.stringify(comboList) : undefined,
    summaryList: summaries,
  };
}
