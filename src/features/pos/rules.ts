import type { Bill } from '../bills/types';

/** The pure rules of the POS screen: which buttons are live, what the cart adds up to, when an order has unsaved changes. */
export type Mode = 'TABLE' | 'OUTDOOR' | 'TAKEAWAY';

export interface DishRef { id: number; name: string; price: number; isVeg?: boolean }
export interface CartLine {
  item: DishRef;
  quantity: number;
  customization: string;
  isTakeaway: boolean;
  modifiersSnapshot?: string;
  comboSnapshot?: string;
  modifiersDescription?: string;
}

export const DEFAULT_TABLES = ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08'];

export const orderMode = (o: Pick<Bill, 'orderType' | 'takeawayToken' | 'outdoorToken'>): Mode =>
  o.orderType === 'TAKEAWAY' || o.takeawayToken ? 'TAKEAWAY' : o.orderType === 'OUTDOOR' || o.outdoorToken ? 'OUTDOOR' : 'TABLE';

const NOTE_PREFIX = /^(Takeaway Order|Outdoor Order|Table Order|Outdoor POS Order|POS Order|Outdoor Kitchen Order|Kitchen Order Ticket)(:\s*)?/i;
/** The server stores "Table Order: less sugar"; the screen only shows the part the staff typed. */
export const stripNotePrefix = (notes?: string | null) => (notes || '').replace(NOTE_PREFIX, '').trim();
export const noteWithPrefix = (mode: Mode, custom: string) => {
  const base = mode === 'TAKEAWAY' ? 'Takeaway Order' : mode === 'OUTDOOR' ? 'Outdoor Order' : 'Table Order';
  return custom.trim() ? `${base}: ${custom.trim()}` : base;
};

export function cartFromOrder(order: Bill, menu: DishRef[]): CartLine[] {
  return (order.items || []).map((it) => ({
    item: menu.find((m) => m.id === it.menuItemId) ?? { id: it.menuItemId ?? 0, name: it.itemName, price: it.price, isVeg: true },
    quantity: it.quantity,
    customization: it.customization || '',
    isTakeaway: Boolean(it.isTakeaway),
    modifiersSnapshot: it.modifiersSnapshot || undefined,
    comboSnapshot: it.comboSnapshot || undefined,
  }));
}

/** Short key of what the server holds, so a refresh that changes nothing does not disturb the cart being typed. */
export const orderKey = (o: Bill | null | undefined) =>
  o ? `${o.id}|${o.status}|${o.discountPercent ?? ''}|${(o.items || []).map((i) => `${i.menuItemId}:${i.quantity}:${i.price}:${i.printedQuantity ?? ''}:${i.isTakeaway ? 1 : 0}:${i.customization ?? ''}:${i.modifiersSnapshot ?? ''}:${i.comboSnapshot ?? ''}`).join(',')}|${o.kotLastChanges ?? ''}` : 'none';

export interface Draft {
  cart: CartLine[]; customer: string; /** The loyalty phone number the customer gave when ordering (digits only). */ phone: string; notes: string; parcel: string; discount: string; /** What was typed in the discount box; it becomes `discount` (the applied one) only when Save is pressed. */ discountInput: string; gstSel: string; gstCustom: string;
  /** The staff changed something not yet saved: server refreshes must not replace it. */
  touched: boolean;
  /** Which server order (and state of it) this draft was built from. */
  key: string; orderId: number | null; status: string;
}

export interface GstLite { enabled: boolean; totalGstPercent?: number; cgstPercent?: number; sgstPercent?: number }
export const configuredGst = (cfg?: GstLite | null) => (cfg?.enabled && (cfg.totalGstPercent ?? 5) > 0 ? String(cfg.totalGstPercent ?? 5) : '0');

export function draftFromOrder(order: Bill | null, menu: DishRef[], ctx: { defaultParcel: number; cfg?: GstLite | null; key: string }): Draft {
  const parcelDefault = (ctx.defaultParcel || 10).toFixed(2);
  if (!order) return { cart: [], customer: '', phone: '', notes: '', parcel: parcelDefault, discount: '0', discountInput: '0', gstSel: configuredGst(ctx.cfg), gstCustom: '0', touched: false, key: ctx.key, orderId: null, status: '' };
  const printed = order.status === 'BILL_PRINTED';
  return {
    cart: printed ? [] : cartFromOrder(order, menu), customer: order.customerName || '', phone: phoneDigits(order.customerPhone), notes: stripNotePrefix(order.notes),
    parcel: order.parcelCharge != null && !Number.isNaN(Number(order.parcelCharge)) ? Number(order.parcelCharge).toFixed(2) : parcelDefault,
    discount: String(order.discountPercent ?? 0), discountInput: String(order.discountPercent ?? 0), gstSel: configuredGst(ctx.cfg), gstCustom: '0', touched: false, key: ctx.key, orderId: order.id, status: order.status,
  };
}

/** The 10 digits of a phone number typed by hand or stored with +91. */
export const phoneDigits = (v?: string | null) => { const d = (v || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };

export const num = (v: string, fallback = 0) => { const n = parseFloat(v); return Number.isNaN(n) ? fallback : n; };

export function gstPercent(sel: string, custom: string) { const p = sel === 'custom' ? num(custom) : num(sel); return p < 0 ? 0 : p; }

export interface Totals { subtotal: number; discountPct: number; tax: number; gstPct: number; hasParcel: boolean; parcel: number; net: number; count: number }

/** What the cart adds up to. Managers type discount and GST; staff see the order's own (or the configured) rates. */
export function cartTotals(a: { cart: CartLine[]; mode: Mode; isManager: boolean; canDiscount?: boolean; discount: string; gstSel: string; gstCustom: string; parcel: string; defaultParcel: number; order: Bill | null; cfg?: GstLite | null }): Totals {
  const subtotal = a.cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
  const count = a.cart.reduce((s, c) => s + c.quantity, 0);
  let discountPct = a.isManager || a.canDiscount ? num(a.discount) : Number(a.order?.discountPercent || 0);
  if (discountPct < 0) discountPct = 0;
  const taxable = Math.max(0, subtotal - (subtotal * discountPct) / 100);
  const gstPct = a.isManager ? gstPercent(a.gstSel, a.gstCustom)
    : a.order?.taxPercent != null ? a.order.taxPercent : a.cfg?.enabled ? (a.cfg.totalGstPercent ?? 0) : 0;
  const tax = Math.round(((taxable * Math.max(0, gstPct)) / 100) * 100) / 100;
  const hasParcel = a.mode === 'TAKEAWAY' || a.cart.some((c) => c.isTakeaway);
  let parcel = 0;
  if (hasParcel) { parcel = num(a.parcel, NaN); if (Number.isNaN(parcel) || parcel < 0) parcel = a.defaultParcel || 10; }
  return { subtotal, discountPct, tax, gstPct: Math.max(0, gstPct), hasParcel, parcel, net: Math.round((taxable + tax + parcel) * 100) / 100, count };
}

export const locationReady = (mode: Mode, table: string, customer: string) => mode === 'OUTDOOR' ? customer.trim().length > 0 : mode === 'TAKEAWAY' ? true : table.trim().length > 0;

export function hasOrderChanges(a: { ready: boolean; cart: CartLine[]; order: Bill | null; mode: Mode; customer: string; phone?: string; notes: string; parcelVisible: boolean; parcel: string }): boolean {
  if (!a.ready || a.cart.length === 0) return false;
  const o = a.order;
  if (!o || !o.id) return true;
  if (o.status === 'PAID' || o.status === 'CANCELLED') return false;
  const saved = o.items || [];
  if (a.cart.length !== saved.length) return true;
  const takeawayOrder = a.mode === 'TAKEAWAY' || o.orderType === 'TAKEAWAY';
  for (const c of a.cart) {
    const flag = takeawayOrder ? true : Boolean(c.isTakeaway);
    const s = saved.find((it) =>
      Number(it.menuItemId) === Number(c.item.id) &&
      (takeawayOrder ? true : Boolean(it.isTakeaway) === flag) &&
      (it.modifiersSnapshot || '') === (c.modifiersSnapshot || '') &&
      (it.comboSnapshot || '') === (c.comboSnapshot || '')
    );
    if (!s) return true;
    if (Number(s.quantity) !== Number(c.quantity)) return true;
    if ((s.customization || '').trim() !== (c.customization || '').trim()) return true;
    if (!takeawayOrder && Boolean(s.isTakeaway) !== flag) return true;
  }
  const cur = a.customer.trim(); const was = (o.customerName || '').trim();
  const guest = (v: string) => !v || v.toLowerCase() === 'guest' || v.toLowerCase() === 'takeaway guest';
  if (!(takeawayOrder && guest(cur) && guest(was)) && cur !== was) return true;
  if (a.notes.trim() !== stripNotePrefix(o.notes)) return true;
  if (a.phone !== undefined && phoneDigits(a.phone) !== phoneDigits(o.customerPhone)) return true;
  if (a.parcelVisible) {
    const input = parseFloat(a.parcel); const savedCharge = Number(o.parcelCharge ?? 0);
    if (!Number.isNaN(input) && Math.abs(input - savedCharge) > 0.001) return true;
  }
  return false;
}

export const hasUnprinted = (o?: Bill | null) => (o?.items || []).some((it) => (it.quantity || 0) > (it.printedQuantity || 0));
export const hasKotChanges = (o?: Bill | null) => Boolean(o?.kotLastChanges && o.kotLastChanges.trim());

export interface Gate { disabled: boolean; title: string }
export interface Gates { save: Gate; kot: Gate; request: Gate; print: Gate }

/** The state of the four order buttons, with the reason a disabled one gives on hover. */
export function orderGates(a: { ready: boolean; mode: Mode; cartCount: number; order: Bill | null; changed: boolean; saving: boolean; sendingKot: boolean }): Gates {
  const { order, mode } = a;
  const off = (title: string): Gate => ({ disabled: true, title });
  const on = (title: string): Gate => ({ disabled: false, title });
  const place = mode === 'OUTDOOR' ? 'outdoor order' : mode === 'TAKEAWAY' ? 'takeaway order' : 'table order';
  const saved = Boolean(order && order.id);
  const hasItems = a.cartCount > 0;

  let save: Gate;
  if (!a.ready || !hasItems) save = off(!a.ready ? (mode === 'OUTDOOR' ? 'Enter customer name first to save outdoor order' : 'Select a table first to save order') : 'Add dishes to cart before saving order');
  else if (a.saving) save = off('Saving order...');
  else if (a.sendingKot) save = off('Printing KOT...');
  else if (!a.changed) save = off('Order is already saved. Add or modify dishes to enable saving.');
  else save = on(saved ? `Save updated dishes to ${place}` : `Save new ${place}`);

  let kot: Gate;
  if (!a.ready || !hasItems) kot = off(mode === 'TAKEAWAY' ? 'Add dishes to cart to print the KOT' : mode === 'OUTDOOR' ? 'Enter customer name and add dishes to enable' : 'Select a table and add dishes to enable');
  else if (a.saving) kot = off('Saving order in progress...');
  else if (a.sendingKot) kot = off('Printing KOT...');
  else if (!saved) kot = off('Click SAVE ORDER first before printing the KOT');
  else if (a.changed) kot = off('Click SAVE ORDER first before printing the KOT for new dishes');
  else if (order!.status === 'KOT_REQUESTED') kot = off('Kitchen ticket already requested');
  else if (order!.status === 'BILL_REQUESTED') kot = off(`Final bill requested for ${place}`);
  else if (order!.status === 'BILL_PRINTED') kot = off('Bill already printed. Awaiting payment.');
  else if (order!.status === 'PAID' || order!.status === 'CANCELLED') kot = off('Order is completed or cancelled');
  else if (!hasUnprinted(order) && !hasKotChanges(order)) kot = off('All items already on a printed KOT. Add or modify dishes and click SAVE ORDER to print more.');
  else kot = on('Print kitchen order ticket (KOT)');

  let request: Gate;
  if (!a.ready || !hasItems || !order) request = off('Save the order and print the KOT first');
  else if (order.status === 'BILL_REQUESTED') request = off('Bill has already been requested from manager');
  else if (order.status === 'KOT_REQUESTED') request = off('Kitchen ticket requested. Order needs its KOT printed before bill can be requested.');
  else if (order.status !== 'KOT_PRINTED' || !order.kotPrintedAt) request = off('Order needs its KOT printed before requesting bill.');
  else if (hasUnprinted(order) || a.changed) request = off('New dishes added to order. Save and print the KOT first.');
  else request = on('Customer is ready for final bill');

  let print: Gate;
  if (!a.ready || !hasItems || !order) print = off(mode === 'OUTDOOR' ? 'Select an outdoor order with a requested bill' : 'Select a table with a requested bill');
  else if (order.status !== 'BILL_REQUESTED') print = off(order.status === 'BILL_PRINTED' ? 'Bill already printed. Awaiting payment confirmation.' : order.status === 'KOT_PRINTED' ? 'Request bill must be clicked first before print bill is enabled' : order.status === 'KOT_REQUESTED' ? 'KOT must be printed and bill must be requested first' : 'Print the KOT and request the bill first');
  else print = on('Customer bill requested! Click to print bill');

  return { save, kot, request, print };
}

export type StatusTone = 'ok' | 'warn' | 'info' | 'brand' | 'neutral';
/** Wording for the order-state chips; `variant` is the shorter wording used on chips next to a table / token. */
export function statusLabel(order: Pick<Bill, 'status' | 'netAmount'> | null | undefined, mode: Mode, variant: 'badge' | 'chip' | 'picker' = 'badge'): { text: string; tone: StatusTone; pulse: boolean } {
  if (!order) return { text: variant === 'picker' ? 'Vacant' : '', tone: 'neutral', pulse: false };
  const amount = `₹${Number(order.netAmount || 0).toFixed(variant === 'badge' ? 2 : 0)}`;
  switch (order.status) {
    case 'KOT_REQUESTED': return { text: variant === 'badge' ? 'KOT REQUESTED' : 'KOT Req', tone: 'warn', pulse: true };
    case 'KOT_PRINTED': return { text: variant === 'badge' ? (mode === 'TAKEAWAY' ? 'PACKING' : 'KOT PRINTED (PREPARING)') : variant === 'picker' ? 'Preparing' : mode === 'TABLE' ? 'KOT Printed' : mode === 'OUTDOOR' ? 'Preparing' : 'Packing', tone: 'info', pulse: false };
    case 'BILL_REQUESTED': return { text: variant === 'badge' ? 'BILL REQUESTED' : 'Bill Req', tone: 'brand', pulse: true };
    case 'BILL_PRINTED': return { text: variant === 'badge' ? 'PENDING PAYMENT' : 'Pending Pay', tone: 'warn', pulse: true };
    default: return { text: variant === 'badge' ? 'OCCUPIED' : amount, tone: 'ok', pulse: false };
  }
}

export const isManagerRole = (role?: string | null) => role === 'ADMIN' || role === 'MANAGER';

/** Insert or replace an order in a list of active orders (used right after the server answers, before the refetch). */
export function upsertOrder(list: Bill[] | undefined, order: Bill): Bill[] {
  const rest = (list ?? []).filter((o) => o.id !== order.id);
  return order.status === 'PAID' || order.status === 'CANCELLED' ? rest : [...rest, order];
}

export function matchesFilter(o: Bill, filter: 'ALL' | Mode, query: string): boolean {
  const m = orderMode(o);
  if (filter !== 'ALL' && m !== filter) return false;
  if (filter === 'TABLE' && !o.tableNumber) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [o.customerName, o.outdoorToken || o.takeawayToken, String(o.billNumber ?? ''), o.tableNumber].some((v) => (v || '').toLowerCase().includes(q));
}

export const orderLocationLabel = (o: Bill) => {
  const m = orderMode(o);
  return m === 'TAKEAWAY' ? `Takeaway (${o.customerName || 'Guest'} • ${o.takeawayToken || 'TAK'})` : m === 'OUTDOOR' ? `Outdoor (${o.customerName || 'Guest'} • ${o.outdoorToken || 'OUT'})` : `Table ${o.tableNumber || '-'}`;
};

/** Add one of a dish: a repeat of the same dish (same dine-in / parcel kind and same modifiers/combos) raises the quantity. */
export function addLine(
  cart: CartLine[],
  dish: DishRef,
  parcelByDefault: boolean,
  extra?: { modifiersSnapshot?: string; comboSnapshot?: string; modifiersDescription?: string; price?: number }
): CartLine[] {
  const modSnap = extra?.modifiersSnapshot || undefined;
  const comboSnap = extra?.comboSnapshot || undefined;
  const modDesc = extra?.modifiersDescription || undefined;
  const unitPrice = extra?.price != null ? extra.price : dish.price;
  const effectiveDish: DishRef = extra?.price != null ? { ...dish, price: unitPrice } : dish;

  const i = cart.findIndex((c) =>
    c.item.id === dish.id &&
    Boolean(c.isTakeaway) === parcelByDefault &&
    (c.modifiersSnapshot || undefined) === modSnap &&
    (c.comboSnapshot || undefined) === comboSnap
  );
  if (i >= 0) return cart.map((c, k) => (k === i ? { ...c, quantity: c.quantity + 1 } : c));
  return [...cart, {
    item: effectiveDish,
    quantity: 1,
    customization: '',
    isTakeaway: parcelByDefault,
    modifiersSnapshot: modSnap,
    comboSnapshot: comboSnap,
    modifiersDescription: modDesc
  }];
}

/** An order that has gone through these states and then vanished from the active list was settled elsewhere. */
export const IN_BILL_FLOW = ['KOT_REQUESTED', 'KOT_PRINTED', 'BILL_REQUESTED'];

/**
 * CGST / SGST for a chosen GST rate. The configured rate keeps the configured split; any other rate the manager picks
 * for one order is split evenly (the server adds the two halves, so sending the configured halves would silently bill 5%).
 */
export function gstSplit(pct: number, cfg?: GstLite | null): { cgst: number; sgst: number } {
  const configured = (cfg?.cgstPercent ?? pct / 2) + (cfg?.sgstPercent ?? pct / 2);
  if (cfg?.cgstPercent != null && cfg?.sgstPercent != null && Math.abs(configured - pct) < 0.001) return { cgst: cfg.cgstPercent, sgst: cfg.sgstPercent };
  return { cgst: pct / 2, sgst: pct / 2 };
}

/** "Outdoor • OUT-003 • Ravi", "Takeaway • TAK-002 • Guest" or "Table T-04": where an order is now. */
export const orderLocationText = (o: Bill) => {
  const m = orderMode(o);
  return m === 'OUTDOOR' ? `Outdoor • ${o.outdoorToken || ''} • ${o.customerName || ''}` : m === 'TAKEAWAY' ? `Takeaway • ${o.takeawayToken || ''} • ${o.customerName || ''}` : `Table ${o.tableNumber || '-'}`;
};

/** The order sitting on a table (other than the one being moved), if any. */
export const tableOccupant = (orders: Bill[], order: Bill, table: string) =>
  orders.find((o) => orderMode(o) === 'TABLE' && (o.tableNumber || '').toLowerCase() === table.toLowerCase() && o.id !== order.id) ?? null;

export interface MoveTarget { type: Mode; table: string | null }
export interface MoveState { note: string; submitText: 'Transfer Order' | 'Merge Orders'; canSubmit: boolean; occupant: Bill | null }

/** What the Transfer dialog says and allows for the chosen destination (merge into an occupied table, kitchen notice, guards). */
export function moveState(order: Bill, orders: Bill[], target: MoveTarget): MoveState {
  let note: string;
  let canSubmit = true;
  let submitText: MoveState['submitText'] = 'Transfer Order';
  let occupant: Bill | null = null;
  if (target.type === 'TABLE') {
    if (!target.table) {
      canSubmit = false;
      note = 'Tap the table the guests are moving to. Green tables are free; amber tables already have an order (they will be merged).';
    } else {
      occupant = tableOccupant(orders, order, target.table);
      if (occupant) {
        submitText = 'Merge Orders';
        const blocked = ['KOT_REQUESTED', 'BILL_REQUESTED', 'BILL_PRINTED'].includes(occupant.status) || order.status === 'KOT_REQUESTED';
        if (blocked) {
          canSubmit = false;
          note = `${target.table} already has order ${occupant.billNumber} and it cannot be merged right now (a kitchen ticket is waiting to print, or its bill was requested/printed).`;
        } else {
          note = `${target.table} already has order ${occupant.billNumber}. Both orders will be combined into ${occupant.billNumber} and this order (${order.billNumber}) will be closed.`;
        }
      } else {
        note = `${orderLocationText(order)} will become Table ${target.table}.`;
      }
    }
  } else if (target.type === 'OUTDOOR') {
    note = 'The order gets an outdoor token. A customer name is required.';
  } else {
    note = 'The order becomes a takeaway; the parcel charge is applied to the bill.';
  }
  if (order.kotPrintedAt || order.status === 'KOT_PRINTED') note += ' The kitchen ticket was already printed - staff will get a notification to tell the kitchen.';
  return { note, submitText, canSubmit, occupant };
}

/** The Transfer button works for a saved order that has no unsaved changes and whose bill has not been asked for. Returns why not, or null. */
export function transferBlocked(order: Bill | null, dirty: boolean): string | null {
  if (!order || !order.id) return 'Save the order first, then you can transfer it to another table or place.';
  if (dirty) return 'You have unsaved changes. Save the order first, then transfer it.';
  if (['BILL_REQUESTED', 'BILL_PRINTED'].includes(order.status)) return 'The bill is already requested/printed, so this order can no longer be transferred.';
  return null;
}

/** The tip box: empty is no tip, a negative or unreadable number is refused (null). */
export function parseTip(text: string): number | null {
  const t = text.trim();
  if (t === '') return 0;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 && v <= 100000 ? Math.round(v * 100) / 100 : null;
}

/** One part of a bill paid in more than one way. The amount is text so a half-typed number is kept as typed. */
export interface PayPart { mode: 'CASH' | 'UPI' | 'CARD' | 'LOYALTY_POINTS'; amount: string }
const paise = (n: number) => Math.round(n * 100);
const rupees = (p: number) => p / 100;

/** The bill shared equally between guests; the last guest takes the odd paise so the parts always add up. */
export function splitEqually(net: number, guests: number): string[] {
  const n = Math.max(1, Math.min(6, Math.floor(guests) || 1));
  const total = paise(net); const each = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => rupees(i === n - 1 ? total - each * (n - 1) : each).toFixed(2));
}
/** What is still to be collected (negative when the parts add up to too much). Unreadable amounts count as zero. */
export const partsRemaining = (net: number, parts: PayPart[]) => rupees(paise(net) - parts.reduce((s, p) => s + (Number.isFinite(Number(p.amount)) ? paise(Number(p.amount)) : 0), 0));
/** Why the parts cannot be confirmed yet (null = fine). */
export function partsProblem(net: number, parts: PayPart[]): string | null {
  if (parts.length < 2) return 'Add at least two payments, or turn split payment off.';
  if (parts.length > 6) return 'A bill can be paid in at most 6 parts.';
  if (parts.some((p) => !(Number(p.amount) > 0))) return 'Every payment needs an amount above zero.';
  const left = partsRemaining(net, parts);
  if (Math.abs(left) >= 0.01) return left > 0 ? `₹${left.toFixed(2)} is still to collect.` : `The payments are ₹${Math.abs(left).toFixed(2)} too much.`;
  return null;
}
export const partsPayload = (parts: PayPart[]) => parts.map((p) => ({ mode: p.mode, amount: Math.round(Number(p.amount) * 100) / 100 }));
/** Makes the last part cover whatever is left, handy after the first parts were typed. */
export function fillLast(net: number, parts: PayPart[]): PayPart[] {
  if (parts.length === 0) return parts;
  const others = parts.slice(0, -1);
  const left = partsRemaining(net, others);
  return [...others, { ...parts[parts.length - 1], amount: left > 0 ? left.toFixed(2) : '' }];
}

/** With exactly two payments, typing one amount sets the other to what is left of the bill (never below zero): 100 cash on a 300 bill makes the UPI 200. */
export function balanceTwo(net: number, parts: PayPart[], edited: number, text: string): PayPart[] {
  const next = parts.map((p, k) => (k === edited ? { ...p, amount: text } : p));
  if (parts.length !== 2) return next;
  const other = 1 - edited;
  const typed = Number(text);
  if (text.trim() === '' || !Number.isFinite(typed) || typed < 0) return next.map((p, k) => (k === other ? { ...p, amount: '' } : p));
  const rest = Math.max(0, rupees(paise(net) - paise(typed)));
  return next.map((p, k) => (k === other ? { ...p, amount: rest > 0 ? rest.toFixed(2) : '' } : p));
}
const MODE_WORD: Record<PayPart['mode'], string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', LOYALTY_POINTS: 'Points' };
/** "Cash ₹100.00 + UPI ₹200.00": what was typed so far, for the line under the payment rows. */
export const partsText = (parts: PayPart[]) => parts.filter((p) => Number(p.amount) > 0).map((p) => `${MODE_WORD[p.mode]} ₹${Number(p.amount).toFixed(2)}`).join(' + ');

/** The discount box holds a value that was not saved yet (so it is not part of the totals). */
export const discountPending = (d: Pick<Draft, 'discount' | 'discountInput'>) => num(d.discountInput) !== num(d.discount);
/** Why a typed discount cannot be applied, or null. */
export const discountProblem = (input: string): string | null => {
  const n = parseFloat(input);
  if (input.trim() !== '' && Number.isNaN(n)) return 'Enter the discount as a number.';
  if (n < 0 || n > 100) return 'Discount must be between 0 and 100%.';
  return null;
};
