import type { Bill } from '../features/bills/types';
import type { SaveOrderPayload } from '../features/pos/api';

/** An order taken while the server could not be reached. It is kept on this device and sent, once, when the connection returns. */
export interface OutboxItem { id: string; key: string; createdAt: string; payload: SaveOrderPayload; label: string; status: 'WAITING' | 'ATTENTION'; error?: string;
  /** Which cafe and branch the order was taken in. Only a person signed in there may send it: a device that moves to another cafe never sends it there. */
  scope?: string }

export const OUTBOX_KEY = 'arvi_outbox_v1';
export const MAX_WAITING = 30;

const rnd = () => Math.random().toString(36).slice(2, 10);
/** Matches what the server accepts: 8 to 80 letters, digits, dots, dashes, colons, underscores. */
export const newKey = (now = Date.now()) => `offline-${now.toString(36)}-${rnd()}`;

export const labelOf = (p: SaveOrderPayload) =>
  p.orderType === 'TABLE' ? `Table ${p.tableNumber ?? ''}`.trim()
    : p.orderType === 'OUTDOOR' ? `Outdoor ${p.customerName || p.outdoorToken || ''}`.trim()
      : `Takeaway ${p.takeawayToken || p.customerName || ''}`.trim();

/** Only a brand-new order with something in it can wait. Changing an order that already exists needs the live record. */
export const canQueue = (p: SaveOrderPayload) => p.orderId === null && p.items.length > 0;

export function enqueue(list: OutboxItem[], payload: SaveOrderPayload, now = new Date(), key = newKey(now.getTime()), scope?: string): OutboxItem[] {
  if (list.filter((i) => i.status === 'WAITING').length >= MAX_WAITING) throw new Error(`${MAX_WAITING} orders are already waiting on this device. Reconnect before taking more.`);
  return [...list, { id: key, key, createdAt: now.toISOString(), payload, label: labelOf(payload), status: 'WAITING', scope }];
}

export const itemCount = (i: OutboxItem) => i.payload.items.reduce((s, x) => s + x.quantity, 0);
export const waitingCount = (list: OutboxItem[]) => list.filter((i) => i.status === 'WAITING').length;
export const attentionCount = (list: OutboxItem[]) => list.filter((i) => i.status === 'ATTENTION').length;

/** A table order must not overwrite an order someone else started on that table while this screen was offline. Null = safe to send. */
export function conflictFor(item: OutboxItem, active: Bill[]): string | null {
  if (item.payload.orderType !== 'TABLE' || !item.payload.tableNumber) return null;
  const busy = active.find((b) => (b.tableNumber ?? '').toLowerCase() === (item.payload.tableNumber ?? '').toLowerCase() && !['PAID', 'CANCELLED', 'VOIDED', 'REFUNDED'].includes(b.status));
  return busy ? `${item.label} has an order now (${busy.billNumber || 'open'}). It was not sent so nothing is overwritten. Add these items to that order by hand, then discard this one.` : null;
}

export function load(storage: Pick<Storage, 'getItem'> = localStorage): OutboxItem[] {
  try {
    const raw = JSON.parse(storage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.key === 'string' && i.payload && Array.isArray(i.payload.items)) : [];
  } catch { return []; }
}
export function save(list: OutboxItem[], storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): void {
  try { if (list.length === 0) storage.removeItem(OUTBOX_KEY); else storage.setItem(OUTBOX_KEY, JSON.stringify(list)); } catch { /* storage full or blocked: the list still works until the page is closed */ }
}

export interface FlushDeps {
  send: (payload: SaveOrderPayload, key: string) => Promise<Bill>;
  fetchActive: () => Promise<Bill[]>;
  isDown: (e: unknown) => boolean;
}
export interface FlushResult { items: OutboxItem[]; sent: { label: string; ref: string }[]; stoppedOffline: boolean }

/**
 * Sends waiting orders oldest first. An order the server refuses is marked "needs attention" with the server's reason and is not retried
 * on its own. If the server cannot be reached the rest stay waiting.
 */
export async function flush(list: OutboxItem[], deps: FlushDeps, scope?: string): Promise<FlushResult> {
  const out = list.map((i) => ({ ...i }));
  const sent: FlushResult['sent'] = [];
  let active: Bill[] | null = null;
  for (const item of out) {
    if (item.status !== 'WAITING') continue;
    if (scope !== undefined && item.scope !== scope) continue;   // another cafe's or branch's order: left alone
    try {
      if (item.payload.orderType === 'TABLE') {
        active = active ?? await deps.fetchActive();
        const c = conflictFor(item, active);
        if (c) { item.status = 'ATTENTION'; item.error = c; continue; }
      }
      const bill = await deps.send(item.payload, item.key);
      sent.push({ label: item.label, ref: bill.billNumber });
      item.status = 'WAITING'; item.id = `sent:${item.key}`;
    } catch (e) {
      if (deps.isDown(e)) return { items: out.filter((i) => !i.id.startsWith('sent:')), sent, stoppedOffline: true };
      item.status = 'ATTENTION'; item.error = e instanceof Error ? e.message : 'The server refused this order.';
    }
  }
  return { items: out.filter((i) => !i.id.startsWith('sent:')), sent, stoppedOffline: false };
}
