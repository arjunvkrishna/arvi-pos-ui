import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { showToast } from '../components/toast';
import { fetchActive, saveOrder, type SaveOrderPayload } from '../features/pos/api';
import { getSession } from '../api/session';
import { isNetworkProblem } from './connection';
import { enqueue, flush, load, save, waitingCount, type OutboxItem } from './outbox';

interface OutboxState {
  items: OutboxItem[]; flushing: boolean;
  add: (p: SaveOrderPayload) => OutboxItem;
  remove: (id: string) => void;
  retry: (id: string) => void;
  flushNow: (qc: QueryClient) => Promise<void>;
}

const commit = (items: OutboxItem[]) => { save(items); return items; };

/** The cafe and branch the signed-in person is working in. */
export const outboxScope = (): string => {
  const s = getSession();
  return s ? `${s.tenantCode ?? ''}:${s.selectedOutletId ?? s.outletId ?? 0}` : '';
};

export const useOutbox = create<OutboxState>((set, get) => ({
  items: load(),
  flushing: false,
  add: (p) => { const items = commit(enqueue(get().items, p, new Date(), undefined, outboxScope())); set({ items }); return items[items.length - 1]; },
  remove: (id) => set({ items: commit(get().items.filter((i) => i.id !== id)) }),
  retry: (id) => set({ items: commit(get().items.map((i) => (i.id === id ? { ...i, status: 'WAITING', error: undefined } : i))) }),
  flushNow: async (qc) => {
    const scope = outboxScope();
    if (get().flushing || waitingCount(get().items.filter((i) => i.scope === scope)) === 0) return;
    set({ flushing: true });
    try {
      const r = await flush(get().items, { send: saveOrder, fetchActive, isDown: isNetworkProblem }, scope);
      set({ items: commit(r.items) });
      for (const s of r.sent) showToast(`${s.label} was sent to the kitchen screen (Ref #${s.ref}). Print the KOT when ready.`, 'success');
      if (r.sent.length > 0) void qc.invalidateQueries();
      const stuck = r.items.filter((i) => i.scope === scope && i.status === 'ATTENTION').length;
      if (stuck > 0) showToast(`${stuck} order${stuck === 1 ? '' : 's'} saved offline could not be sent. Open the banner at the top to see why.`, 'warning');
    } finally { set({ flushing: false }); }
  },
}));
