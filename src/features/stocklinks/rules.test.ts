import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../inventory/api';
import type { MenuItem } from '../menu/api';
import { buildGraph, coverage, dishState, filterDishes, filterItems, groupByCategory, itemsToCreate, linkIssue, saleEffect, suggestLinks, unitsCompatible, type Link } from './rules';

const dish = (id: number, name: string, categoryName = 'Burgers', active = true): MenuItem => ({ id, name, categoryId: 1, categoryName, price: 100, isVeg: false, active });
const item = (id: number, name: string, unit = 'piece', o: Partial<InventoryItem> = {}): InventoryItem => ({ id, name, unit, quantity: 8, minQuantity: 2, itemCategory: 'Stock', ...o });
const link = (id: number, menuItemId: number, inventoryItemId: number, quantityPerServing = 1, unit = 'piece', o: Partial<Link> = {}): Link => ({ id, menuItemId, inventoryItemId, quantityPerServing, unit, active: true, ...o });

describe('units', () => {
  it('compatible like the server: same unit, weight with weight, volume with volume', () => {
    expect(unitsCompatible('piece', 'piece')).toBe(true);
    expect(unitsCompatible('g', 'kg')).toBe(true);
    expect(unitsCompatible('ml', 'litre')).toBe(true);
    expect(unitsCompatible('piece', 'box')).toBe(false);
    expect(unitsCompatible('g', 'ml')).toBe(false);
    expect(unitsCompatible('', 'piece')).toBe(false);
  });
  it('explains a link that cannot take stock', () => {
    expect(linkIssue({ unit: 'piece' }, item(1, 'Bun'))).toBeNull();
    expect(linkIssue({ unit: 'bottle' }, item(1, 'Water box', 'box'))).toMatch(/Counted in box but the recipe is in bottle/);
    expect(linkIssue({ unit: 'piece' }, undefined)).toMatch(/no longer exists/);
  });
});

describe('dish state and coverage', () => {
  const items = [item(1, 'Burger Bun'), item(2, 'Milk', 'packet', { autoDeduct: false }), item(3, 'Water box', 'box')];
  const dishes = [dish(10, 'Burger'), dish(11, 'Tea', 'Hot'), dish(12, 'Water', 'Mineral water'), dish(13, 'Plain'), dish(14, 'Old', 'Hot', false)];
  const links = [link(1, 10, 1), link(2, 11, 2, 1, 'packet'), link(3, 12, 3, 1, 'bottle'), link(4, 14, 1, 1, 'piece', { active: false })];
  const g = buildGraph(dishes, items, links);
  it('live, cost only, problem and none', () => {
    expect(dishState(g.byDish.get(10) ?? [], g.itemsById)).toBe('live');
    expect(dishState(g.byDish.get(11) ?? [], g.itemsById)).toBe('cost-only');
    expect(dishState(g.byDish.get(12) ?? [], g.itemsById)).toBe('problem');
    expect(dishState(g.byDish.get(13) ?? [], g.itemsById)).toBe('none');
  });
  it('inactive links are ignored; the graph is both ways', () => {
    expect(g.byItem.get(1)?.map((l) => l.menuItemId)).toEqual([10]);
    expect(g.byDish.get(14)).toBeUndefined();
  });
  it('counts only active dishes', () => {
    expect(coverage(dishes, items, g)).toEqual({ dishes: 4, linked: 3, unlinked: 1, manualOnly: 1, problems: 1, items: 3, used: 3 });
  });
  it('filters by state, search and item flags', () => {
    expect(filterDishes(dishes, g, '', 'none').map((d) => d.name)).toEqual(['Plain']);
    expect(filterDishes(dishes, g, 'hot', 'all').map((d) => d.name)).toEqual(['Tea']);
    expect(filterItems(items, g, '', 'manual').map((i) => i.name)).toEqual(['Milk']);
    expect(filterItems([...items, item(9, 'Spare')], g, '', 'unused').map((i) => i.name)).toEqual(['Spare']);
  });
  it('groups dishes by category in name order', () => {
    expect(groupByCategory(dishes.slice(0, 4)).map((x) => x.category)).toEqual(['Burgers', 'Hot', 'Mineral water']);
  });
  it('says what a sale does, and that a hand-issued item is cost only', () => {
    expect(saleEffect(1, 'piece', items[0], 3)).toBe('Selling 3 dishes takes 3 piece of Burger Bun.');
    expect(saleEffect(1, 'packet', items[1])).toMatch(/issued by hand/);
    expect(saleEffect(0, 'piece', items[0])).toBe('');
  });
});

describe('suggestions from the menu', () => {
  const menu = [
    dish(1, 'Veg Burger'), dish(2, 'Mini Burger', 'Snacks'), dish(3, 'Chicken Club Sandwich', 'Sandwiches'), dish(4, 'Egg Mayo Sandwich', 'Sandwiches'),
    dish(5, 'Veg Fajita Wrap', 'Wrappers'), dish(6, 'Mexican Chicken Quesadilla', 'Wrappers'), dish(7, 'Water', 'Mineral water'), dish(8, 'Pepsi 500ml', 'Drinks'),
    dish(9, 'Mango Lassi', 'Lassi'), dish(10, 'Cheesy Bacon Loaded Fries', 'Loaded Fries'), dish(11, 'Veg Spring Roll', 'Starters'),
  ];
  const none = buildGraph(menu, [], []);
  const s = suggestLinks(menu, [], none);
  const byName = (n: string) => s.find((x) => x.dishName === n)!;
  it('burger takes a bun, a mini burger its own mini bun', () => {
    expect(byName('Veg Burger')).toMatchObject({ ruleId: 'burger', qty: 1, unit: 'piece', create: { name: 'Burger Bun', unit: 'piece' } });
    expect(byName('Mini Burger')).toMatchObject({ ruleId: 'mini-burger', create: { name: 'Mini Burger Bun' } });
  });
  it('a sandwich takes 2 slices, a club sandwich 3', () => {
    expect(byName('Egg Mayo Sandwich')).toMatchObject({ qty: 2, create: { name: 'Sandwich Bread' } });
    expect(byName('Chicken Club Sandwich')).toMatchObject({ qty: 3 });
  });
  it('wraps, water and bottled drinks', () => {
    expect(byName('Veg Fajita Wrap')).toMatchObject({ ruleId: 'wrap', create: { name: 'Wrap Tortilla' } });
    expect(byName('Mexican Chicken Quesadilla')).toMatchObject({ ruleId: 'wrap' });
    expect(byName('Water')).toMatchObject({ ruleId: 'water', unit: 'bottle', create: { name: 'Mineral Water Bottle', unit: 'bottle' } });
    expect(byName('Pepsi 500ml')).toMatchObject({ ruleId: 'bottle-drink', create: { name: 'Pepsi 500ml', unit: 'bottle' } });
  });
  it('a combo holds several products, so it is never suggested a single one', () => {
    const combo = [dish(20, 'Family Club Combo (2 Burgers + 2 Sandwiches + 2 Wraps + 1 L Pepsi)', 'Family Combo'), dish(21, 'Burger Platter', 'Snacks')];
    expect(suggestLinks(combo, [], buildGraph(combo, [], []))).toEqual([]);
  });
  it('made-to-order dishes get no suggestion', () => {
    for (const n of ['Mango Lassi', 'Cheesy Bacon Loaded Fries', 'Veg Spring Roll']) expect(s.find((x) => x.dishName === n)).toBeUndefined();
  });
  it('an existing item with the same name and a usable unit is reused; a box is not (units differ)', () => {
    const items = [item(5, 'burger bun'), item(6, 'Mineral Water Bottle', 'box')];
    const r = suggestLinks(menu, items, buildGraph(menu, items, []));
    expect(r.find((x) => x.dishName === 'Veg Burger')).toMatchObject({ existingId: 5, create: null });
    expect(r.find((x) => x.dishName === 'Water')).toMatchObject({ existingId: null, create: { name: 'Mineral Water Bottle' } });
  });
  it('dishes that already have a link are left alone; items to create are listed once', () => {
    const g = buildGraph(menu, [item(1, 'Burger Bun')], [link(1, 1, 1)]);
    expect(suggestLinks(menu, [item(1, 'Burger Bun')], g).find((x) => x.dishName === 'Veg Burger')).toBeUndefined();
    expect(itemsToCreate(s).map((t) => t.name).filter((n) => n === 'Sandwich Bread')).toHaveLength(1);
  });
});
