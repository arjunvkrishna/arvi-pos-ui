import type { InventoryItem } from '../inventory/api';
import { fmtNum, packBreakdown } from '../inventory/rules';
import type { MenuItem } from '../menu/api';

/** A dish -> stock item link (a recipe row): selling one dish uses `quantityPerServing` `unit` of the item. */
export interface Link {
  id: number; menuItemId: number; menuItemName?: string; inventoryItemId: number; inventoryItemName?: string; inventoryItemUnit?: string;
  quantityPerServing: number; unit: string; active?: boolean; inventoryAutoDeduct?: boolean; costPerServing?: number | null;
}

const WEIGHT = ['g', 'kg'];
const VOLUME = ['ml', 'l', 'litre', 'liter'];
/** Same rule as the server: equal units, weight with weight, volume with volume. Anything else cannot be converted at billing. */
export function unitsCompatible(a: string, b: string): boolean {
  const x = a.trim().toLowerCase(); const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || (WEIGHT.includes(x) && WEIGHT.includes(y)) || (VOLUME.includes(x) && VOLUME.includes(y));
}

/** Why a link would not take stock at billing, or null when it is fine. */
export function linkIssue(link: Pick<Link, 'unit'>, item: InventoryItem | undefined): string | null {
  if (!item) return 'The stock item no longer exists.';
  if (!unitsCompatible(link.unit, item.unit)) return `Counted in ${item.unit} but the recipe is in ${link.unit}: this link is skipped at billing.`;
  return null;
}

export type DishState = 'none' | 'live' | 'cost-only' | 'problem';
/** none = no link; live = billing reduces stock; cost-only = every linked item is issued by hand; problem = a link that cannot convert. */
export function dishState(links: Link[], items: Map<number, InventoryItem>): DishState {
  const active = links.filter((l) => l.active !== false);
  if (active.length === 0) return 'none';
  if (active.some((l) => linkIssue(l, items.get(l.inventoryItemId)))) return 'problem';
  return active.some((l) => items.get(l.inventoryItemId)?.autoDeduct !== false) ? 'live' : 'cost-only';
}

export const DISH_STATE_LABEL: Record<DishState, string> = { live: 'Reduces stock', 'cost-only': 'Cost only', problem: 'Check units', none: 'Not linked' };
export const dishStateLabel = (s: DishState) => DISH_STATE_LABEL[s];

export interface Graph {
  byDish: Map<number, Link[]>;
  byItem: Map<number, Link[]>;
  itemsById: Map<number, InventoryItem>;
  dishesById: Map<number, MenuItem>;
}
export function buildGraph(dishes: MenuItem[], items: InventoryItem[], links: Link[]): Graph {
  const byDish = new Map<number, Link[]>(); const byItem = new Map<number, Link[]>();
  for (const l of links) {
    if (l.active === false) continue;
    (byDish.get(l.menuItemId) ?? byDish.set(l.menuItemId, []).get(l.menuItemId)!).push(l);
    (byItem.get(l.inventoryItemId) ?? byItem.set(l.inventoryItemId, []).get(l.inventoryItemId)!).push(l);
  }
  return { byDish, byItem, itemsById: new Map(items.map((i) => [i.id, i])), dishesById: new Map(dishes.map((d) => [d.id, d])) };
}

export interface Coverage { dishes: number; linked: number; items: number; used: number; manualOnly: number; problems: number; unlinked: number }
export function coverage(dishes: MenuItem[], items: InventoryItem[], g: Graph): Coverage {
  const live = dishes.filter((d) => d.active !== false);
  const states = live.map((d) => dishState(g.byDish.get(d.id) ?? [], g.itemsById));
  return {
    dishes: live.length, linked: states.filter((s) => s !== 'none').length, unlinked: states.filter((s) => s === 'none').length,
    manualOnly: states.filter((s) => s === 'cost-only').length, problems: states.filter((s) => s === 'problem').length,
    items: items.length, used: items.filter((i) => (g.byItem.get(i.id)?.length ?? 0) > 0).length,
  };
}

export type DishFilter = 'all' | 'none' | 'live' | 'cost-only' | 'problem';
export type ItemFilter = 'all' | 'unused' | 'manual' | 'low' | 'expiring';
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function filterDishes(dishes: MenuItem[], g: Graph, query: string, filter: DishFilter): MenuItem[] {
  const q = norm(query);
  return dishes.filter((d) => d.active !== false)
    .filter((d) => filter === 'all' || dishState(g.byDish.get(d.id) ?? [], g.itemsById) === filter)
    .filter((d) => !q || norm(d.name).includes(q) || norm(d.categoryName ?? '').includes(q));
}
export function filterItems(items: InventoryItem[], g: Graph, query: string, filter: ItemFilter): InventoryItem[] {
  const q = norm(query);
  return items.filter((i) => i.active !== false)
    .filter((i) => filter === 'all' || (filter === 'unused' && !(g.byItem.get(i.id)?.length))
      || (filter === 'manual' && i.autoDeduct === false) || (filter === 'low' && !!i.lowStock) || (filter === 'expiring' && (i.expiryStatus === 'EXPIRED' || i.expiryStatus === 'SOON')))
    .filter((i) => !q || norm(i.name).includes(q) || norm(i.itemCategory ?? '').includes(q));
}

/** Dishes grouped by menu category, categories and dishes in name order. */
export function groupByCategory(dishes: MenuItem[]): { category: string; dishes: MenuItem[] }[] {
  const m = new Map<string, MenuItem[]>();
  for (const d of dishes) { const c = d.categoryName || 'Other'; (m.get(c) ?? m.set(c, []).get(c)!).push(d); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([category, list]) => ({ category, dishes: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export const usesText = (qty: number, unit: string) => `${fmtNum(qty)} ${unit}`;

/** "8 piece (2 packet)" for the card of a stock item. */
export const stockText = (i: InventoryItem) => { const brk = packBreakdown(i, i.quantity); return `${fmtNum(i.quantity)} ${i.unit}${brk ? ` · ${brk}` : ''}`; };

/** What one sale does to the stock, in words: "Selling 3 takes 3 piece (8 → 5)". */
export function saleEffect(qty: number, unit: string, item: InventoryItem, sold = 1): string {
  if (!(qty > 0)) return '';
  const taken = qty * sold;
  if (item.autoDeduct === false) return `${item.name} is issued by hand: selling this dish does not change its stock (the link is used for cost).`;
  if (!unitsCompatible(unit, item.unit)) return '';
  return `Selling ${sold} ${sold === 1 ? 'dish' : 'dishes'} takes ${fmtNum(taken)} ${unit} of ${item.name}.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Suggestions: fixed-count products map to one stock item (a burger takes a bun, a sandwich two slices, a bottle itself).
// ---------------------------------------------------------------------------------------------------------------------
export interface SuggestTarget { name: string; unit: string }
export interface SuggestRule { id: string; label: string; target: (dish: MenuItem) => SuggestTarget; perServing: (dish: MenuItem) => number; unit: string; match: (dish: MenuItem) => boolean; note?: string }

const has = (d: MenuItem, re: RegExp) => re.test(d.name) || re.test(d.categoryName ?? '');
export const SUGGEST_RULES: SuggestRule[] = [
  { id: 'mini-burger', label: 'Mini burger -> mini bun', match: (d) => /mini\s*burger/i.test(d.name), target: () => ({ name: 'Mini Burger Bun', unit: 'piece' }), perServing: () => 1, unit: 'piece', note: 'A mini burger takes a mini bun, which is a different stock item from the normal burger bun.' },
  { id: 'burger', label: 'Burger -> burger bun', match: (d) => has(d, /burger/i) && !/loaded|fries|sauce/i.test(d.name), target: () => ({ name: 'Burger Bun', unit: 'piece' }), perServing: () => 1, unit: 'piece' },
  { id: 'club-sandwich', label: 'Club sandwich -> 3 slices of bread', match: (d) => /club/i.test(d.name) && has(d, /sandwich/i), target: () => ({ name: 'Sandwich Bread', unit: 'piece' }), perServing: () => 3, unit: 'piece' },
  { id: 'sandwich', label: 'Sandwich -> 2 slices of bread', match: (d) => has(d, /sandwich/i), target: () => ({ name: 'Sandwich Bread', unit: 'piece' }), perServing: () => 2, unit: 'piece' },
  { id: 'wrap', label: 'Wrap / quesadilla -> 1 tortilla', match: (d) => has(d, /\bwrap|wrapper|quesadilla/i), target: () => ({ name: 'Wrap Tortilla', unit: 'piece' }), perServing: () => 1, unit: 'piece' },
  { id: 'water', label: 'Water -> water bottle', match: (d) => /^(mineral\s+)?water$/i.test(d.name.trim()) || /mineral water/i.test(d.categoryName ?? ''), target: () => ({ name: 'Mineral Water Bottle', unit: 'bottle' }), perServing: () => 1, unit: 'bottle', note: 'Counted in bottles (a box can be set up as a pack of bottles on the item).' },
  { id: 'bottle-drink', label: 'Bottled soft drink -> the bottle itself', match: (d) => /coca[\s-]?cola|pepsi|sprite|fanta|7\s?up|thums\s?up|soda\b|soft drink/i.test(d.name), target: (d) => ({ name: d.name.trim(), unit: 'bottle' }), perServing: () => 1, unit: 'bottle' },
];

/** Combos and platters hold several products (2 burgers + 2 sandwiches + wraps...): no single rule fits, so they are linked by hand. */
const isCombo = (d: MenuItem) => /combo|platter|family|bucket/i.test(d.name) || /combo|platter|family/i.test(d.categoryName ?? '');

export interface Suggestion {
  dishId: number; dishName: string; category: string; ruleId: string; ruleLabel: string; qty: number; unit: string; note?: string;
  /** an existing stock item that fits, or the item to create */
  existingId: number | null; create: SuggestTarget | null;
}

/** For dishes that have no link yet: the stock item each would take. An existing item with the same name and a usable unit is reused. */
export function suggestLinks(dishes: MenuItem[], items: InventoryItem[], g: Graph, rules: SuggestRule[] = SUGGEST_RULES): Suggestion[] {
  const out: Suggestion[] = [];
  for (const d of dishes) {
    if (d.active === false || isCombo(d) || (g.byDish.get(d.id)?.length ?? 0) > 0) continue;
    const rule = rules.find((r) => r.match(d));
    if (!rule) continue;
    const t = rule.target(d);
    const found = items.find((i) => i.active !== false && norm(i.name) === norm(t.name) && unitsCompatible(rule.unit, i.unit));
    out.push({ dishId: d.id, dishName: d.name, category: d.categoryName || 'Other', ruleId: rule.id, ruleLabel: rule.label, qty: rule.perServing(d), unit: rule.unit, note: rule.note,
      existingId: found?.id ?? null, create: found ? null : t });
  }
  return out;
}

/** The stock items the applied suggestions would have to create (one per name). */
export function itemsToCreate(sel: Suggestion[]): SuggestTarget[] {
  const seen = new Map<string, SuggestTarget>();
  for (const s of sel) if (s.create && !seen.has(norm(s.create.name))) seen.set(norm(s.create.name), s.create);
  return [...seen.values()];
}
