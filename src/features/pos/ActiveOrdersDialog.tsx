import { useEffect, useState, type CSSProperties } from 'react';
import { Dialog } from '../../components/Dialog';
import { useBump } from '../../components/useBump';
import type { Bill } from '../bills/types';
import { countsByMode, orderChip, orderItems, orderTitle, timeAgo, waitTone, type ChipTone } from './activeOrders';
import { matchesFilter, transferBlocked, type Mode } from './rules';

const inr = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;

const CHIP: Record<ChipTone, string> = {
  info: 'bg-info/10 text-info border-info/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  violet: 'bg-violet-500/10 text-violet-500 border-violet-500/30',
  neutral: 'bg-subtle text-muted border-line',
};
const MODE_ICON: Record<Mode, string> = { TABLE: 'fa-chair', OUTDOOR: 'fa-tree', TAKEAWAY: 'fa-bag-shopping' };
const WAIT_CLASS = { calm: 'text-muted', late: 'text-warn', overdue: 'text-danger font-semibold' } as const;
const FILTERS: { v: 'ALL' | Mode; label: string }[] = [
  { v: 'ALL', label: 'All Orders' }, { v: 'TABLE', label: 'Tables' }, { v: 'OUTDOOR', label: 'Outdoor' }, { v: 'TAKEAWAY', label: 'Takeaway' },
];

/** Every live order at a glance: where it is, who it is for, what was ordered, how long it has waited, and what can be done next. */
export function ActiveOrdersDialog({ orders, isManager, onClose, onOpen, onPay, onReprint, onTransfer }: {
  orders: Bill[]; isManager: boolean; onClose: () => void;
  onOpen: (o: Bill) => void; onPay: (o: Bill) => void; onReprint: (o: Bill) => void; onTransfer: (o: Bill) => void;
}) {
  const [filter, setFilter] = useState<'ALL' | Mode>('ALL');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const counts = countsByMode(orders);
  const list = orders.filter((o) => matchesFilter(o, filter, query));
  const liveRef = useBump<HTMLSpanElement>(orders.length);

  return (
    <Dialog
      id="activeOrdersModal" open onClose={onClose} size="xl" title="Active Orders"
      icon={<i className="fa-solid fa-bolt" />}
      badge={<span ref={liveRef} id="activeOrdersLive" className="inline-flex items-center gap-1.5 rounded-full bg-brand text-gray-950 px-2.5 py-0.5 text-xs font-bold"><span className="live-dot" aria-hidden="true" />{orders.length} Live</span>}
      description={<span className="uppercase tracking-wider text-[11px] text-brand-text/80">Realtime kitchen &amp; table orders</span>}
    >
      <div className="space-y-3">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text/70 pointer-events-none" aria-hidden="true" />
          <input id="activeOrdersSearchInput" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, token, bill no, table..." className="input pl-10 h-11 rounded-xl" aria-label="Search active orders" />
        </div>
        <div role="group" aria-label="Filter orders" className="flex flex-wrap gap-2 pb-0.5">
          {FILTERS.map((f) => (
            <button key={f.v} type="button" aria-pressed={filter === f.v} onClick={() => setFilter(f.v)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition active:scale-95 ${filter === f.v ? 'bg-brand text-gray-950 border-brand shadow-card' : 'bg-surface text-fg border-line-strong hover:border-brand'}`}>
              {f.label}<span className={filter === f.v ? 'opacity-80' : 'text-muted'}>({counts[f.v]})</span>
            </button>
          ))}
        </div>

        <div id="activeOrdersCardsContainer" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.length === 0 && (
            <div className="col-span-full flex flex-col items-center text-center py-12 gap-2 anim-rise-in">
              <div className="w-14 h-14 rounded-full bg-subtle text-faint flex items-center justify-center text-xl"><i className="fa-solid fa-mug-hot" /></div>
              <p className="text-sm font-medium text-fg">No active orders matching criteria</p>
              <p className="text-xs text-muted">New orders appear here the moment they are saved.</p>
            </div>
          )}
          {list.map((o, i) => {
            const { title, sub, mode } = orderTitle(o);
            const chip = orderChip(o, mode);
            const { lines, more } = orderItems(o, 4);
            const blocked = transferBlocked(o, false);
            const placed = timeAgo(o.createdAt, now);
            return (
              <article key={o.id} data-order-id={o.id} style={{ '--i': i } as CSSProperties} className="stagger-item lift rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-fg text-lg leading-6 flex items-center gap-2 min-w-0">
                      <i className={`fa-solid ${MODE_ICON[mode]} text-brand-text text-sm shrink-0`} aria-hidden="true" />
                      <span className="truncate">{title}</span>
                    </h3>
                    <p className="text-sm text-muted truncate">{sub}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-wide ${CHIP[chip.tone]} ${chip.pulse ? 'animate-pulse' : ''}`}>{chip.text}</span>
                </div>
                <p className="text-xs text-muted -mt-1.5">
                  <span className="font-mono">#{o.billNumber}</span>
                  {placed && <> • <span className={WAIT_CLASS[waitTone(o.createdAt, now)]}>Placed {placed}</span></>}
                  {o.createdByName && <> • {o.createdByName}</>}
                </p>
                <ul className="space-y-1.5 text-sm" aria-label="Dishes">
                  {lines.length === 0 && <li className="text-muted text-xs">No dishes yet</li>}
                  {lines.map((l, k) => (
                    <li key={k} className="flex items-start gap-2 text-fg/90">
                      <i className="fa-solid fa-caret-right text-brand text-xs mt-1.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0"><span className="font-medium">{l.qty}×</span> {l.name}{l.note && <span className="block text-xs italic text-muted truncate">{l.note}</span>}</span>
                    </li>
                  ))}
                  {more > 0 && <li className="text-xs text-muted pl-5">+{more} more {more === 1 ? 'dish' : 'dishes'}</li>}
                </ul>
                <div className="flex flex-wrap items-center gap-2 mt-auto pt-3 border-t border-line">
                  <span className="font-bold text-brand-text text-xl mr-1">{inr(o.netAmount)}</span>
                  <button type="button" onClick={() => onTransfer(o)} disabled={!!blocked} title={blocked || 'Move this order to another table, outdoor or takeaway'}
                    className="btn btn-sm border border-brand/50 text-brand-text bg-brand/10 hover:bg-brand/20 disabled:opacity-40"><i className="fa-solid fa-right-left" />Transfer</button>
                  {o.status === 'KOT_PRINTED' && <button type="button" onClick={() => onReprint(o)} title="Print the last kitchen ticket again" className="btn btn-secondary btn-sm border-warn/50 text-warn"><i className="fa-solid fa-print" />Reprint KOT</button>}
                  {o.status === 'BILL_PRINTED' && isManager && <button type="button" onClick={() => onPay(o)} className="btn btn-soft-ok btn-sm"><i className="fa-solid fa-cash-register" />Confirm pay</button>}
                  <button type="button" onClick={() => onOpen(o)} className="btn btn-secondary btn-sm">{mode === 'TABLE' ? 'Open Table' : 'Open Order'}<i className="fa-solid fa-arrow-right text-[10px]" /></button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
