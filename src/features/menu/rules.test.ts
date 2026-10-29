import { describe, expect, it } from 'vitest';
import type { MenuItem } from './api';
import { filterMenu, menuCounts, rupees, safeIcon } from './rules';

const dish = (over: Partial<MenuItem>): MenuItem => ({ id: 1, name: 'Paneer Tikka', categoryId: 1, categoryName: 'Starters', price: 150, isVeg: true, isAvailable: true, active: true, ...over });
const items = [
  dish({ id: 1 }),
  dish({ id: 2, name: 'Chicken 65', categoryName: 'Starters', isVeg: false }),
  dish({ id: 3, name: 'Mango Shake', categoryName: 'Juice', description: 'thick and cold', isAvailable: false }),
  dish({ id: 4, name: 'Old dish', active: false }),
];

describe('menu rules', () => {
  it('counts a dish unavailable when switched off or deactivated', () => {
    expect(menuCounts(items)).toEqual({ all: 4, available: 2, unavailable: 2 });
  });
  it('filters by sub-tab', () => {
    expect(filterMenu(items, 'available', '').map((i) => i.id)).toEqual([1, 2]);
    expect(filterMenu(items, 'unavailable', '').map((i) => i.id)).toEqual([3, 4]);
  });
  it('searches name, category, description and diet', () => {
    expect(filterMenu(items, 'all', 'juice').map((i) => i.id)).toEqual([3]);
    expect(filterMenu(items, 'all', 'COLD').map((i) => i.id)).toEqual([3]);
    expect(filterMenu(items, 'all', 'non-veg').map((i) => i.id)).toEqual([2]);
    expect(filterMenu(items, 'all', ' tikka ').map((i) => i.id)).toEqual([1]);
  });
  it('formats rupees and only accepts plain icon class names', () => {
    expect(rupees(150)).toBe('₹150.00');
    expect(safeIcon('fa-burger')).toBe('fa-burger');
    expect(safeIcon('x" onclick="boom')).toBe('fa-utensils');
    expect(safeIcon(null)).toBe('fa-utensils');
  });
});
