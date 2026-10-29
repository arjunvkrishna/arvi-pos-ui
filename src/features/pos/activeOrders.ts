import type { Bill } from '../bills/types';
import { orderMode, type Mode } from './rules';

/** The pure rules behind the Active Orders list: what each card says and how it is counted. */

export type ChipTone = 'info' | 'warn' | 'violet' | 'neutral';
export interface OrderChip { text: string; tone: ChipTone; pulse: boolean }

/** The short status on a card: where the order is between the guest and the till. */
export function orderChip(o: Pick<Bill, 'status'>, mode: Mode): OrderChip {
  switch (o.status) {
    case 'ACTIVE': return { text: 'NEW', tone: 'info', pulse: false };
    case 'KOT_REQUESTED': return { text: 'SENDING', tone: 'warn', pulse: true };
    case 'KOT_PRINTED': return { text: mode === 'TAKEAWAY' ? 'PACKING' : 'PREP', tone: 'warn', pulse: false };
    case 'BILL_REQUESTED': return { text: 'BILL ASKED', tone: 'violet', pulse: true };
    case 'BILL_PRINTED': return { text: 'BILLED', tone: 'violet', pulse: false };
    default: return { text: String(o.status || '').replace(/_/g, ' '), tone: 'neutral', pulse: false };
  }
}

export const MODE_LABEL: Record<Mode, string> = { TABLE: 'Dine-In', OUTDOOR: 'Outdoor', TAKEAWAY: 'Takeaway' };

const isRealName = (n?: string | null) => !!n && n.trim() !== '' && n.trim().toLowerCase() !== 'guest';

/** "Table T-01 · Elena R." for a table, "Takeaway TAK-4 · Marco" for takeaway: where it is, then who it is for. */
export function orderTitle(o: Pick<Bill, 'orderType' | 'tableNumber' | 'outdoorToken' | 'takeawayToken' | 'customerName'>): { title: string; sub: string; mode: Mode } {
  const mode = orderMode(o);
  const who = isRealName(o.customerName) ? o.customerName!.trim() : '';
  if (mode === 'TABLE') return { mode, title: `Table ${o.tableNumber || ''}`.trim(), sub: who || MODE_LABEL.TABLE };
  if (mode === 'OUTDOOR') return { mode, title: `Outdoor ${o.outdoorToken || 'OUT'}`, sub: who || 'Guest' };
  return { mode, title: `Takeaway ${o.takeawayToken || 'TAK'}`, sub: who || 'Guest' };
}

export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60_000));
}

/** "just now", "12m ago", "1h 05m ago", "2d ago". */
export function timeAgo(iso: string | null | undefined, now: number): string {
  const m = minutesSince(iso, now);
  if (m === null) return '';
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** An order that has waited a long time is shown in amber, then red, so it is noticed. */
export function waitTone(iso: string | null | undefined, now: number): 'calm' | 'late' | 'overdue' {
  const m = minutesSince(iso, now);
  if (m === null) return 'calm';
  return m >= 90 ? 'overdue' : m >= 45 ? 'late' : 'calm';
}

export interface ItemLine { qty: number; name: string; note: string }

/** The dishes on a card: "2× Crispy Corn", at most `max` of them, and how many more there are. */
export function orderItems(o: Pick<Bill, 'items'>, max = 4): { lines: ItemLine[]; more: number } {
  const all = (o.items || []).filter((i) => Number(i.quantity) > 0).map((i) => ({
    qty: Number(i.quantity),
    name: i.itemName || i.menuItemName || 'Item',
    note: (i.customization || '').trim(),
  }));
  return { lines: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/** How many orders each filter pill would show. */
export function countsByMode(orders: Pick<Bill, 'orderType' | 'tableNumber' | 'outdoorToken' | 'takeawayToken'>[]): Record<'ALL' | Mode, number> {
  const c = { ALL: orders.length, TABLE: 0, OUTDOOR: 0, TAKEAWAY: 0 };
  for (const o of orders) c[orderMode(o)] += 1;
  return c;
}
