import { describe, expect, it, vi } from 'vitest';
import type { Bill } from '../features/bills/types';
import type { SaveOrderPayload } from '../features/pos/api';
import { enqueue, flush, type FlushDeps } from './outbox';

const payload = (table: string): SaveOrderPayload => ({
  orderId: null, orderType: 'TABLE', tableNumber: table, customerName: '', outdoorToken: null, takeawayToken: null, notes: '', parcelCharge: null,
  items: [{ menuItemId: 1, itemName: 'Tea', quantity: 1, price: 10, customization: '', isTakeaway: false }],
});

const deps = (): FlushDeps & { send: ReturnType<typeof vi.fn> } => ({
  send: vi.fn(async () => ({ billNumber: 'B-1' }) as Bill),
  fetchActive: async () => [],
  isDown: () => false,
});

describe('orders waiting offline belong to the cafe and branch they were taken in', () => {
  it('only the signed-in cafe and branch\'s orders are sent; another cafe\'s stay waiting', async () => {
    let list = enqueue([], payload('T1'), new Date(), undefined, 'bluedoor:1');
    list = enqueue(list, payload('T2'), new Date(), undefined, 'greenleaf:9');
    const d = deps();
    const result = await flush(list, d, 'greenleaf:9');
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.send.mock.calls[0][0].tableNumber).toBe('T2');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ scope: 'bluedoor:1', status: 'WAITING' });
  });
  it('the same cafe\'s other branch is a different scope too', async () => {
    const list = enqueue([], payload('T1'), new Date(), undefined, 'bluedoor:1');
    const d = deps();
    const result = await flush(list, d, 'bluedoor:2');
    expect(d.send).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });
  it('without a scope (older callers) everything still goes, as before', async () => {
    const list = enqueue([], payload('T1'));
    const d = deps();
    await flush(list, d);
    expect(d.send).toHaveBeenCalledTimes(1);
  });
});
