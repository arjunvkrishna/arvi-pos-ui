import { describe, expect, it } from 'vitest';
import type { ComboGroup, ModifierGroup } from './api';
import {
  defaultComboSelection,
  defaultModifierSelection,
  isSelectionValid,
  summariseSelection,
  toggleChoice,
} from './selection';

const milk: ModifierGroup = {
  id: 1, name: 'Milk', minSelections: 1, maxSelections: 1,
  modifiers: [
    { id: 11, name: 'Whole', priceAdjustment: 0 },
    { id: 12, name: 'Oat', priceAdjustment: 30, inventoryItemId: 5, inventoryQuantity: 0.2 },
  ],
};
const extras: ModifierGroup = {
  id: 2, name: 'Extras', minSelections: 0, maxSelections: 2,
  modifiers: [
    { id: 21, name: 'Extra shot', priceAdjustment: 25, isDefault: true },
    { id: 22, name: 'Caramel', priceAdjustment: 15 },
    { id: 23, name: 'Whip', priceAdjustment: 10 },
  ],
};
const combo: ComboGroup = {
  id: 9, comboMenuItemId: 1, name: 'Side', minChoices: 1, maxChoices: 1,
  items: [
    { menuItemId: 101, menuItemName: 'Fries', additionalPrice: 0 },
    { menuItemId: 102, menuItemName: 'Salad', additionalPrice: 20 },
  ],
};

describe('default selection', () => {
  it('ticks defaults, and the first option of a required group with none', () => {
    expect(defaultModifierSelection([milk, extras])).toEqual({ 1: [11], 2: [21] });
  });
  it('picks the first combo item when a choice is required', () => {
    expect(defaultComboSelection([combo])).toEqual({ 9: [101] });
  });
});

describe('toggleChoice', () => {
  it('a single-choice group swaps the option', () => {
    expect(toggleChoice([11], 12, true, 1)).toEqual([12]);
  });
  it('untoggles a ticked option and adds an unticked one', () => {
    expect(toggleChoice([21, 22], 21, false, 2)).toEqual([22]);
    expect(toggleChoice([21], 22, false, 2)).toEqual([21, 22]);
  });
  it('refuses to go past the maximum', () => {
    expect(toggleChoice([21, 22], 23, false, 2)).toEqual([21, 22]);
  });
  it('a maximum of 0 means no limit', () => {
    expect(toggleChoice([1, 2, 3], 4, false, 0)).toEqual([1, 2, 3, 4]);
  });
});

describe('validation', () => {
  it('a required group needs its minimum', () => {
    expect(isSelectionValid([milk], [], { 1: [] }, {})).toBe(false);
    expect(isSelectionValid([milk], [], { 1: [11] }, {})).toBe(true);
  });
  it('a combo needs its minimum choices', () => {
    expect(isSelectionValid([], [combo], {}, { 9: [] })).toBe(false);
    expect(isSelectionValid([], [combo], {}, { 9: [102] })).toBe(true);
  });
  it('more than the maximum is invalid', () => {
    expect(isSelectionValid([extras], [], { 2: [21, 22, 23] }, {})).toBe(false);
  });
});

describe('summariseSelection', () => {
  it('adds modifier and combo extras to the dish price', () => {
    const s = summariseSelection(200, [milk, extras], [combo], { 1: [12], 2: [21, 22] }, { 9: [102] });
    expect(s.totalPrice).toBe(200 + 30 + 25 + 15 + 20);
    expect(s.summaryList).toEqual(['Oat (+₹30.00)', 'Extra shot (+₹25.00)', 'Caramel (+₹15.00)', 'Salad (+₹20.00)']);
  });
  it('the modifier snapshot carries the id the server re-reads for stock and price', () => {
    const s = summariseSelection(100, [milk], [], { 1: [12] }, {});
    const snap = JSON.parse(s.modifiersSnapshot!);
    expect(snap).toEqual([
      { group_name: 'Milk', modifier_id: 12, name: 'Oat', price: 30, inventory_item_id: 5, inventory_quantity: 0.2 },
    ]);
    expect(s.comboSnapshot).toBeUndefined();
  });
  it('the combo snapshot lists the chosen child dishes', () => {
    const s = summariseSelection(300, [], [combo], {}, { 9: [101] });
    expect(JSON.parse(s.comboSnapshot!)).toEqual([{ group_name: 'Side', menu_item_id: 101, dish_name: 'Fries', extra_price: 0 }]);
    expect(s.totalPrice).toBe(300);
  });
  it('nothing chosen leaves the plain price and no snapshots', () => {
    const s = summariseSelection(150, [extras], [], { 2: [] }, {});
    expect(s).toEqual({ totalPrice: 150, modifiersSnapshot: undefined, comboSnapshot: undefined, summaryList: [] });
  });
});
