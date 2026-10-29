import { describe, expect, it, vi } from 'vitest';
import type { Bill } from '../features/bills/types';
import type { SaveOrderPayload } from '../features/pos/api';
import { forgetAll, recall, remember, withOfflineCopy } from './cache';
import { isNetworkProblem, serverReachable } from './connection';
import { attentionCount, canQueue, conflictFor, enqueue, flush, itemCount, labelOf, load, MAX_WAITING, newKey, OUTBOX_KEY, save, waitingCount, type FlushDeps, type OutboxItem } from './outbox';

const pay = (o: Partial<SaveOrderPayload> = {}): SaveOrderPayload => ({ orderId: null, orderType: 'TAKEAWAY', tableNumber: null, customerName: 'Asha', outdoorToken: null, takeawayToken: 'TAK-004', notes: '', parcelCharge: null, items: [{ menuItemId: 1, itemName: 'Fries', quantity: 2, price: 180, customization: '', isTakeaway: true }], ...o });
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), map: m }; };
const bill = (o: Partial<Bill> = {}): Bill => ({ id: 1, billNumber: 'NRM-1', status: 'ORDER_PLACED', items: [], subtotal: 0, netAmount: 0, tableNumber: 'T-03', ...o } as Bill);
const net = (status: number) => Object.assign(new Error('x'), { status });

describe('which orders can wait', () => {
  it('only a new order with items', () => {
    expect(canQueue(pay())).toBe(true);
    expect(canQueue(pay({ orderId: 12 }))).toBe(false);          // changing an existing order needs the live record
    expect(canQueue(pay({ items: [] }))).toBe(false);
  });
  it('labels the place', () => {
    expect(labelOf(pay({ orderType: 'TABLE', tableNumber: 'T-03' }))).toBe('Table T-03');
    expect(labelOf(pay({ orderType: 'OUTDOOR', customerName: 'Ravi', outdoorToken: 'OUT-002' }))).toBe('Outdoor Ravi');
    expect(labelOf(pay())).toBe('Takeaway TAK-004');
  });
  it('keys look like what the server accepts', () => { const k = newKey(); expect(k).toMatch(/^[A-Za-z0-9._:-]{8,80}$/); expect(newKey()).not.toBe(k); });
});

describe('the outbox list', () => {
  it('adds in order, counts, and refuses too many', () => {
    let l: OutboxItem[] = [];
    l = enqueue(l, pay(), new Date('2026-10-23T10:00:00Z')); l = enqueue(l, pay({ takeawayToken: 'TAK-005' }));
    expect(l).toHaveLength(2); expect(waitingCount(l)).toBe(2); expect(attentionCount(l)).toBe(0); expect(itemCount(l[0])).toBe(2);
    expect(l[0].label).toBe('Takeaway TAK-004');
    for (let i = 0; i < MAX_WAITING; i++) { try { l = enqueue(l, pay()); } catch { /* full */ } }
    expect(() => enqueue(l, pay())).toThrow(/already waiting/);
  });
  it('is kept across a reload and ignores a damaged copy', () => {
    const s = store(); const l = enqueue([], pay());
    save(l, s); expect(load(s)).toEqual(l);
    save([], s); expect(s.map.has(OUTBOX_KEY)).toBe(false);
    s.setItem(OUTBOX_KEY, '{not json'); expect(load(s)).toEqual([]);
    s.setItem(OUTBOX_KEY, JSON.stringify([{ nope: 1 }, l[0]])); expect(load(s)).toHaveLength(1);
  });
});

describe('sending', () => {
  const deps = (over: Partial<FlushDeps> = {}): FlushDeps & { sent: string[] } => {
    const sent: string[] = [];
    return { sent, send: vi.fn(async (p: SaveOrderPayload, key: string) => { sent.push(key); return bill({ billNumber: `REF-${sent.length}`, tableNumber: p.tableNumber }); }), fetchActive: vi.fn(async () => []), isDown: isNetworkProblem, ...over };
  };
  it('sends oldest first, once each, and empties the list', async () => {
    const l = enqueue(enqueue([], pay({ takeawayToken: 'TAK-001' })), pay({ takeawayToken: 'TAK-002' }));
    const d = deps(); const r = await flush(l, d);
    expect(d.sent).toEqual([l[0].key, l[1].key]);
    expect(r.items).toEqual([]); expect(r.sent.map((s) => s.label)).toEqual(['Takeaway TAK-001', 'Takeaway TAK-002']); expect(r.stoppedOffline).toBe(false);
  });
  it('each order carries its own key so a repeat can never save twice', async () => {
    const l = enqueue([], pay()); const d = deps();
    await flush(l, d); await flush(l, d);                      // the same list sent again (a reply was lost)
    expect(d.sent[0]).toBe(d.sent[1]);
  });
  it('stops when the server is still unreachable and keeps what is left waiting', async () => {
    const l = enqueue(enqueue([], pay({ takeawayToken: 'TAK-001' })), pay({ takeawayToken: 'TAK-002' }));
    let n = 0; const d = deps({ send: vi.fn(async () => { if (n++ === 1) throw net(0); return bill(); }) });
    const r = await flush(l, d);
    expect(r.stoppedOffline).toBe(true); expect(r.items).toHaveLength(1); expect(r.items[0].label).toBe('Takeaway TAK-002'); expect(r.items[0].status).toBe('WAITING');
    expect(r.sent).toHaveLength(1);
  });
  it('a gateway error means the server is not up yet, not that the order is bad', async () => {
    const r = await flush(enqueue([], pay()), deps({ send: vi.fn(async () => { throw net(503); }) }));
    expect(r.stoppedOffline).toBe(true); expect(r.items[0].status).toBe('WAITING');
  });
  it('an order the server refuses is marked for attention with the reason, and the others still go', async () => {
    const l = enqueue(enqueue([], pay({ takeawayToken: 'TAK-001' })), pay({ takeawayToken: 'TAK-002' }));
    let n = 0; const d = deps({ send: vi.fn(async () => { if (n++ === 0) throw Object.assign(new Error('Dish "Fries" is no longer available'), { status: 400 }); return bill(); }) });
    const r = await flush(l, d);
    expect(r.items).toHaveLength(1); expect(r.items[0].status).toBe('ATTENTION'); expect(r.items[0].error).toContain('no longer available'); expect(r.sent).toHaveLength(1);
    const again = await flush(r.items, d);                      // attention items are not retried on their own
    expect(again.items).toHaveLength(1); expect(d.send).toHaveBeenCalledTimes(2);
  });
  it('a table order is not sent over an order someone started on that table meanwhile', async () => {
    const l = enqueue([], pay({ orderType: 'TABLE', tableNumber: 'T-03', takeawayToken: null }));
    const d = deps({ fetchActive: vi.fn(async () => [bill({ tableNumber: 't-03', status: 'KOT_PRINTED' })]) });
    const r = await flush(l, d);
    expect(d.send).not.toHaveBeenCalled(); expect(r.items[0].status).toBe('ATTENTION'); expect(r.items[0].error).toMatch(/has an order now/);
  });
  it('a paid or cancelled earlier order on the table is not a conflict; takeaway never checks', async () => {
    const item = enqueue([], pay({ orderType: 'TABLE', tableNumber: 'T-03', takeawayToken: null }))[0];
    expect(conflictFor(item, [bill({ status: 'PAID' }), bill({ status: 'CANCELLED' })])).toBeNull();
    expect(conflictFor(enqueue([], pay())[0], [bill({ tableNumber: null })])).toBeNull();
    const d = deps(); await flush(enqueue([], pay()), d); expect(d.fetchActive).not.toHaveBeenCalled();
  });
});

describe('offline copies of the menu', () => {
  it('uses the last copy when the server cannot be reached, never for a real error', async () => {
    const s = store();
    remember('menu', [{ id: 1 }], s as unknown as Storage);
    expect(recall('menu', s)).toEqual([{ id: 1 }]);
    const original = globalThis.localStorage; Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true });
    try {
      expect(await withOfflineCopy('menu', async () => { throw net(0); })).toEqual([{ id: 1 }]);
      await expect(withOfflineCopy('menu', async () => { throw net(500); })).rejects.toThrow();            // a server error is shown, not hidden
      await expect(withOfflineCopy('never-seen', async () => { throw net(0); })).rejects.toThrow();        // nothing saved yet: the error stands
      expect(await withOfflineCopy('menu', async () => [{ id: 2 }])).toEqual([{ id: 2 }]);
      expect(recall('menu', s)).toEqual([{ id: 2 }]);                                                       // a good answer refreshes the copy
      forgetAll(Object.assign(s, { }) as unknown as Storage);
    } finally { Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true }); }
  });
});

describe('knowing the server is down', () => {
  it('network problems and gateway errors, nothing else', () => {
    for (const s of [0, 502, 503, 504]) expect(isNetworkProblem(net(s))).toBe(true);
    for (const s of [400, 401, 403, 404, 409, 500]) expect(isNetworkProblem(net(s))).toBe(false);
    expect(isNetworkProblem(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkProblem(null)).toBe(false);
  });
  it('the check treats any answer as up, silence and gateway errors as down', async () => {
    expect(await serverReachable((async () => new Response('{}', { status: 200 })) as typeof fetch)).toBe(true);
    expect(await serverReachable((async () => new Response('x', { status: 401 })) as typeof fetch)).toBe(true);
    expect(await serverReachable((async () => new Response('x', { status: 502 })) as typeof fetch)).toBe(false);
    expect(await serverReachable((async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch)).toBe(false);
  });
});
