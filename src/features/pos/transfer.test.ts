import { describe, expect, it } from 'vitest';
import type { Bill } from '../bills/types';
import { moveState, orderLocationText, tableOccupant, transferBlocked } from './rules';

const bill = (o: Partial<Bill> = {}): Bill => ({ id: 1, billNumber: 'NRM-0001', status: 'ACTIVE', orderType: 'TABLE', tableNumber: 'T-01', customerName: 'Guest', items: [], subtotal: 100, netAmount: 100, ...o });

describe('transfer (change seat)', () => {
  it('describes where an order is', () => {
    expect(orderLocationText(bill())).toBe('Table T-01');
    expect(orderLocationText(bill({ orderType: 'OUTDOOR', tableNumber: null, outdoorToken: 'OUT-003', customerName: 'Ravi' }))).toBe('Outdoor • OUT-003 • Ravi');
    expect(orderLocationText(bill({ orderType: 'TAKEAWAY', tableNumber: null, takeawayToken: 'TAK-002', customerName: 'Guest' }))).toBe('Takeaway • TAK-002 • Guest');
  });

  it('finds the order on a table, never the order being moved', () => {
    const mine = bill({ id: 1, tableNumber: 'T-01' });
    const other = bill({ id: 2, billNumber: 'NRM-0002', tableNumber: 'T-02' });
    expect(tableOccupant([mine, other], mine, 't-02')?.id).toBe(2);
    expect(tableOccupant([mine, other], mine, 'T-01')).toBeNull();
    expect(tableOccupant([mine, other], mine, 'T-09')).toBeNull();
  });

  it('a table must be picked first; a free table is a plain transfer', () => {
    const mine = bill();
    expect(moveState(mine, [mine], { type: 'TABLE', table: null }).canSubmit).toBe(false);
    const s = moveState(mine, [mine], { type: 'TABLE', table: 'T-03' });
    expect(s).toMatchObject({ canSubmit: true, submitText: 'Transfer Order', occupant: null });
    expect(s.note).toBe('Table T-01 will become Table T-03.');
  });

  it('an occupied table is a merge, unless a ticket is waiting or its bill was asked for', () => {
    const mine = bill();
    const there = bill({ id: 2, billNumber: 'NRM-0002', tableNumber: 'T-02' });
    const ok = moveState(mine, [mine, there], { type: 'TABLE', table: 'T-02' });
    expect(ok).toMatchObject({ canSubmit: true, submitText: 'Merge Orders' });
    expect(ok.note).toContain('NRM-0002');
    for (const status of ['KOT_REQUESTED', 'BILL_REQUESTED', 'BILL_PRINTED']) {
      expect(moveState(mine, [mine, { ...there, status }], { type: 'TABLE', table: 'T-02' }).canSubmit).toBe(false);
    }
    expect(moveState({ ...mine, status: 'KOT_REQUESTED' }, [mine, there], { type: 'TABLE', table: 'T-02' }).canSubmit).toBe(false);
  });

  it('outdoor and takeaway notes; the kitchen is told when its ticket was printed', () => {
    const mine = bill({ status: 'KOT_PRINTED', kotPrintedAt: '2026-10-23T10:00:00' });
    expect(moveState(mine, [mine], { type: 'OUTDOOR', table: null }).note).toMatch(/outdoor token/);
    expect(moveState(mine, [mine], { type: 'TAKEAWAY', table: null }).note).toMatch(/parcel charge/);
    expect(moveState(mine, [mine], { type: 'TAKEAWAY', table: null }).note).toMatch(/kitchen ticket was already printed/);
    expect(moveState(bill(), [bill()], { type: 'TAKEAWAY', table: null }).note).not.toMatch(/kitchen ticket/);
  });

  it('who may transfer: a saved, unchanged order whose bill was not asked for', () => {
    expect(transferBlocked(null, false)).toMatch(/Save the order first/);
    expect(transferBlocked(bill(), true)).toMatch(/unsaved changes/);
    expect(transferBlocked(bill({ status: 'BILL_REQUESTED' }), false)).toMatch(/no longer be transferred/);
    expect(transferBlocked(bill({ status: 'BILL_PRINTED' }), false)).toMatch(/no longer be transferred/);
    expect(transferBlocked(bill({ status: 'KOT_PRINTED' }), false)).toBeNull();
    expect(transferBlocked(bill(), false)).toBeNull();
  });
});
