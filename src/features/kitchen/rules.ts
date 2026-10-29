import type { KitchenLine, KitchenTicket } from './api';

/** Where the dish goes: "Table T1", "Outdoor 14", "Takeaway 7". */
export function ticketLabel(t: KitchenTicket): string {
  if (t.orderType === 'TABLE') return `Table ${t.tableNumber ?? ''}`.trim();
  if (t.orderType === 'OUTDOOR') return `Outdoor ${t.outdoorToken ?? ''}`.trim();
  if (t.orderType === 'TAKEAWAY') return `Takeaway ${t.takeawayToken ?? ''}`.trim();
  return t.billNumber;
}

/** Minutes the order has been open. The server sends local cafe time without a zone, so it is compared as such. */
export function minutesOpen(createdAt: string, now: number = Date.now()): number {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

export type Urgency = 'fresh' | 'slow' | 'late';
export const urgencyOf = (minutes: number): Urgency => (minutes >= 20 ? 'late' : minutes >= 10 ? 'slow' : 'fresh');

/** Dishes added in a later round (not on an earlier ticket yet): how many are new. */
export const newQuantity = (l: KitchenLine): number => Math.max(0, l.quantity - (l.printedQuantity ?? 0));

/** Oldest first, so the order that has waited longest is on the left. */
export const oldestFirst = (list: KitchenTicket[]): KitchenTicket[] => [...list].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
