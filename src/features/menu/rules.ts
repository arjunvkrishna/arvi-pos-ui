import type { MenuItem } from './api';

export type MenuFilter = 'all' | 'available' | 'unavailable';

export const isAvailable = (i: MenuItem) => i.isAvailable !== false && i.active !== false;

export function menuCounts(items: MenuItem[]) {
  const available = items.filter(isAvailable).length;
  return { all: items.length, available, unavailable: items.length - available };
}

/** Sub-tab first, then the search box (name, category, description, veg / non-veg). */
export function filterMenu(items: MenuItem[], filter: MenuFilter, query: string): MenuItem[] {
  let list = items;
  if (filter === 'available') list = list.filter(isAvailable);
  else if (filter === 'unavailable') list = list.filter((i) => !isAvailable(i));
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((i) => {
    const diet = i.isVeg ? 'veg' : 'non-veg nonveg';
    return [i.name, i.categoryName, i.description].some((v) => (v || '').toLowerCase().includes(q)) || diet.includes(q);
  });
}

export const rupees = (v: number | string) => `₹${Number(v).toFixed(2)}`;

export const CATEGORY_ICONS: [string, string][] = [
  ['fa-utensils', 'Food'], ['fa-burger', 'Burger'], ['fa-pizza-slice', 'Pizza'], ['fa-hotdog', 'Hot dog'],
  ['fa-bowl-food', 'Bowl'], ['fa-bowl-rice', 'Rice'], ['fa-drumstick-bite', 'Chicken'], ['fa-fish', 'Fish'],
  ['fa-egg', 'Egg'], ['fa-bread-slice', 'Bread'], ['fa-cheese', 'Cheese'], ['fa-carrot', 'Veg'],
  ['fa-leaf', 'Salad'], ['fa-pepper-hot', 'Spicy'], ['fa-mug-hot', 'Hot drinks'], ['fa-mug-saucer', 'Tea / Coffee'],
  ['fa-glass-water', 'Water'], ['fa-martini-glass-citrus', 'Juice'], ['fa-wine-glass', 'Drinks'], ['fa-blender', 'Shakes'],
  ['fa-ice-cream', 'Ice cream'], ['fa-cake-candles', 'Cake'], ['fa-cookie-bite', 'Snacks'], ['fa-lemon', 'Fruit'],
];

/** Only plain Font Awesome class names are ever put into a class attribute. */
export const safeIcon = (icon?: string | null) => (/^fa-[a-z0-9-]+$/.test(icon || '') ? (icon as string) : 'fa-utensils');
