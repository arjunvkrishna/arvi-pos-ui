/** Which analytics sections are shown and in what order. Saved per user in this browser; everything is shown by default. */
export type WidgetId =
  | 'highlights' | 'kpis' | 'compare' | 'profit' | 'salesTrend' | 'expenses' | 'peakHours' | 'heatmap' | 'weekday' | 'orderType' | 'paymentMode' | 'category' | 'topDishes'
  | 'cashFlow' | 'staff' | 'tables' | 'dineIn' | 'menuMatrix' | 'dishProfit' | 'neverSold' | 'discounts' | 'tax' | 'stock' | 'suppliers' | 'purchased' | 'drill';

export type Span = 'full' | 'wide' | 'half' | 'third';
export type Group = 'Overview' | 'Money' | 'Sales' | 'Menu' | 'Stock' | 'Records';
export interface WidgetDef { id: WidgetId; title: string; group: Group; span: Span; /** needs the insights request */ insights: boolean; help: string }

export const WIDGETS: WidgetDef[] = [
  { id: 'highlights', title: 'Highlights in plain words', group: 'Overview', span: 'full', insights: true, help: 'A few sentences about the period: what changed, when it is busy and what needs a look.' },
  { id: 'kpis', title: 'Key numbers', group: 'Overview', span: 'full', insights: false, help: 'Sales, money going out, recorded profit and stock value for the period.' },
  { id: 'compare', title: 'Compared with the previous period', group: 'Overview', span: 'full', insights: true, help: 'The same numbers for the period just before this one, and how much they moved. A green arrow is good news.' },
  { id: 'profit', title: 'Accounting profit statement', group: 'Money', span: 'full', insights: false, help: 'Sales minus cost of goods gives gross profit; minus overheads and payroll gives net operating profit. Cash flow is shown separately.' },
  { id: 'salesTrend', title: 'Sales trend', group: 'Sales', span: 'wide', insights: false, help: 'Revenue and number of orders over time.' },
  { id: 'expenses', title: 'Expense breakdown', group: 'Money', span: 'third', insights: false, help: 'Where the operating money went, by category.' },
  { id: 'peakHours', title: 'Busy hours', group: 'Sales', span: 'wide', insights: true, help: 'Sales for each hour of the day. The three busiest hours are highlighted. Use it to plan staff and prep.' },
  { id: 'heatmap', title: 'Busy times: day and hour', group: 'Sales', span: 'full', insights: true, help: 'A darker square means more sales in that hour on that weekday.' },
  { id: 'weekday', title: 'Sales by weekday', group: 'Sales', span: 'half', insights: true, help: 'Average sales per day for each weekday, so a month with five Fridays is not unfairly favoured.' },
  { id: 'orderType', title: 'Dine-in, outdoor, takeaway', group: 'Sales', span: 'third', insights: true, help: 'How sales split by where the guest sat.' },
  { id: 'paymentMode', title: 'How guests paid', group: 'Sales', span: 'third', insights: true, help: 'Cash, UPI and card share of sales.' },
  { id: 'category', title: 'Sales by menu category', group: 'Menu', span: 'half', insights: true, help: 'Which parts of the menu bring the money.' },
  { id: 'topDishes', title: 'Top selling dishes', group: 'Menu', span: 'third', insights: false, help: 'The dishes sold most in the period.' },
  { id: 'cashFlow', title: 'Cash flow', group: 'Money', span: 'wide', insights: false, help: 'Money in (sales) against money out (expenses and supplier invoices) over time.' },
  { id: 'staff', title: 'Sales by staff', group: 'Sales', span: 'half', insights: true, help: 'Orders and sales taken by each person, and their average bill.' },
  { id: 'tables', title: 'Busiest tables', group: 'Sales', span: 'half', insights: true, help: 'Tables that earned the most (dine-in only).' },
  { id: 'dineIn', title: 'How long guests stay', group: 'Sales', span: 'half', insights: true, help: 'Dine-in only: the time from the kitchen ticket being printed to the payment being confirmed. See the café average or each table. A visit over 6 hours is left out (a bill left open after the guests left).' },
  { id: 'menuMatrix', title: 'Menu matrix: what to push, fix or drop', group: 'Menu', span: 'full', insights: true, help: 'Each dish with a recipe is placed by how much it sells and how much it earns per dish. Stars: keep. Popular but low profit: raise price or cut cost. Profitable but rare: promote. Weak: rework or remove.' },
  { id: 'dishProfit', title: 'Dish profit', group: 'Menu', span: 'full', insights: true, help: 'Revenue, cost (from the recipe) and profit per dish. Dishes without a recipe show no cost: link them in Stock Links.' },
  { id: 'neverSold', title: 'Dishes that did not sell', group: 'Menu', span: 'half', insights: true, help: 'Active dishes with no sale in the period: candidates to promote or remove.' },
  { id: 'discounts', title: 'Discounts and money lost', group: 'Money', span: 'half', insights: true, help: 'Discounts and promotions given, refunds, voided and cancelled orders, and the cost of wasted stock.' },
  { id: 'tax', title: 'GST collected', group: 'Money', span: 'third', insights: true, help: 'Taxable sales and the CGST and SGST on them, for the period.' },
  { id: 'stock', title: 'Stock health and waste', group: 'Stock', span: 'full', insights: true, help: 'Value of stock on hand, items that are low, below zero or expiring, and waste in the period by reason.' },
  { id: 'suppliers', title: 'Supplier spending', group: 'Money', span: 'half', insights: false, help: 'What was invoiced and paid to each supplier, and what is still owed.' },
  { id: 'purchased', title: 'Top purchased ingredients', group: 'Stock', span: 'half', insights: false, help: 'What was bought most in the period.' },
  { id: 'drill', title: 'Source records', group: 'Records', span: 'full', insights: false, help: 'Every bill, expense, invoice, payment and salary behind the totals.' },
];

export const WIDGET_IDS = WIDGETS.map((w) => w.id);
export interface Layout { order: WidgetId[]; hidden: WidgetId[] }
export const DEFAULT_LAYOUT: Layout = { order: [...WIDGET_IDS], hidden: [] };

const show = (...ids: WidgetId[]): Layout => ({ order: [...ids, ...WIDGET_IDS.filter((x) => !ids.includes(x))], hidden: WIDGET_IDS.filter((x) => !ids.includes(x)) });
export const PRESETS: { id: string; label: string; description: string; layout: Layout }[] = [
  { id: 'all', label: 'Everything', description: 'Every section, in the usual order.', layout: DEFAULT_LAYOUT },
  { id: 'owner', label: 'Owner: money', description: 'Sales, profit, cash and what is lost.', layout: show('highlights', 'kpis', 'compare', 'profit', 'salesTrend', 'expenses', 'cashFlow', 'discounts', 'menuMatrix', 'stock') },
  { id: 'floor', label: 'Floor: sales and staff', description: 'Busy times, how guests pay, staff and tables.', layout: show('highlights', 'kpis', 'peakHours', 'heatmap', 'weekday', 'orderType', 'paymentMode', 'staff', 'tables', 'dineIn', 'topDishes') },
  { id: 'kitchen', label: 'Kitchen and stock', description: 'Dishes, margins, waste and stock health.', layout: show('highlights', 'topDishes', 'category', 'dishProfit', 'menuMatrix', 'neverSold', 'stock', 'purchased') },
];

/** Reads a saved layout, dropping sections that no longer exist and adding new ones at the end, so an old saved layout never hides a new section by accident. */
export function normalizeLayout(raw: unknown): Layout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { order?: unknown; hidden?: unknown };
  const known = new Set<string>(WIDGET_IDS);
  const order = Array.isArray(r.order) ? (r.order.filter((x): x is WidgetId => typeof x === 'string' && known.has(x))) : [];
  const unique = [...new Set(order)];
  for (const id of WIDGET_IDS) if (!unique.includes(id)) unique.push(id);
  const hidden = Array.isArray(r.hidden) ? [...new Set(r.hidden.filter((x): x is WidgetId => typeof x === 'string' && known.has(x)))] : [];
  return { order: unique, hidden };
}

export const isShown = (l: Layout, id: WidgetId) => !l.hidden.includes(id);
export const shownOrder = (l: Layout): WidgetId[] => l.order.filter((id) => isShown(l, id));
export const toggleWidget = (l: Layout, id: WidgetId): Layout => ({ ...l, hidden: isShown(l, id) ? [...l.hidden, id] : l.hidden.filter((x) => x !== id) });
/** Moves a section one place up (-1) or down (+1) among ALL sections (hidden ones keep their place). */
export function moveWidget(l: Layout, id: WidgetId, dir: -1 | 1): Layout {
  const i = l.order.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= l.order.length) return l;
  const order = [...l.order]; [order[i], order[j]] = [order[j], order[i]];
  return { ...l, order };
}
export const sameLayout = (a: Layout, b: Layout) => a.order.join() === b.order.join() && [...a.hidden].sort().join() === [...b.hidden].sort().join();

export const layoutKey = (username: string) => `arvi_analytics_layout_v1:${username}`;
export function loadLayout(username: string, storage: Pick<Storage, 'getItem'> = localStorage): Layout {
  try { const v = storage.getItem(layoutKey(username)); return v ? normalizeLayout(JSON.parse(v)) : DEFAULT_LAYOUT; } catch { return DEFAULT_LAYOUT; }
}
export function saveLayout(username: string, l: Layout, storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): void {
  try { if (sameLayout(l, DEFAULT_LAYOUT)) storage.removeItem(layoutKey(username)); else storage.setItem(layoutKey(username), JSON.stringify(l)); } catch { /* storage unavailable: the layout lasts until the page is closed */ }
}
