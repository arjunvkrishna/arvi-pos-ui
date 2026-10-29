import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui';
import { useEventStream } from '../../lib/useEventStream';
import { fetchTickets, kitchenKey, type KitchenTicket } from './api';
import { minutesOpen, newQuantity, oldestFirst, ticketLabel, urgencyOf, type Urgency } from './rules';

const TONE: Record<Urgency, 'ok' | 'warn' | 'danger'> = { fresh: 'ok', slow: 'warn', late: 'danger' };
const EDGE: Record<Urgency, string> = { fresh: 'border-line', slow: 'border-warn', late: 'border-danger' };

/**
 * Kitchen display: the orders that have gone to the kitchen, oldest first. It refreshes when the server says orders changed (a live
 * connection), not on a timer, so an idle screen costs the database nothing. No prices or customer details are shown or sent.
 */
export function KitchenPage() {
  const qc = useQueryClient();
  const tickets = useQuery({ queryKey: kitchenKey, queryFn: fetchTickets, refetchOnWindowFocus: true });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);   // only moves the "minutes" on screen
  useEventStream({
    path: '/bills/stream', event: 'orders-changed', enabled: true,
    onSignal: () => { void qc.invalidateQueries({ queryKey: kitchenKey }); },
    onConnected: () => { void qc.invalidateQueries({ queryKey: kitchenKey }); },
  });

  const list = oldestFirst(tickets.data ?? []);
  return (
    <section id="tab-kds" data-testid="tab-kds" className="space-y-5">
      <PageHeader title="Kitchen display" description="Orders sent to the kitchen, oldest first. It updates by itself when an order is added or changed."
        actions={<Badge tone="brand" icon="fa-fire-burner"><span data-testid="kds-count">{list.length} open</span></Badge>} />
      {tickets.isPending && <div className="card"><Skeleton rows={4} /></div>}
      {tickets.isError && <div role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">Could not load the kitchen orders: {tickets.error.message}</div>}
      {tickets.isSuccess && list.length === 0 && <EmptyState icon="fa-kitchen-set" title="No orders in the kitchen" hint="New orders show up here the moment they are sent." />}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {list.map((t) => <Ticket key={t.id} ticket={t} now={now} />)}
      </div>
    </section>
  );
}

function Ticket({ ticket, now }: { ticket: KitchenTicket; now: number }) {
  const minutes = minutesOpen(ticket.createdAt, now);
  const urgency = urgencyOf(minutes);
  return (
    <article data-testid="kds-ticket" className={`card p-4 space-y-3 border-2 ${EDGE[urgency]}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-fg truncate">{ticketLabel(ticket)}</h2>
          <p className="text-xs text-muted font-mono">#{ticket.billNumber}</p>
        </div>
        <Badge tone={TONE[urgency]} icon="fa-clock">{minutes} min</Badge>
      </header>
      <ul className="space-y-2">
        {ticket.items.map((l, i) => {
          const fresh = newQuantity(l);
          return (
            <li key={`${l.name}-${i}`} className="flex gap-3">
              <span className="w-8 shrink-0 text-center text-base font-semibold text-fg">{l.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{l.name}{l.takeaway ? <span className="ml-1.5 text-xs text-muted">(parcel)</span> : null}</span>
                {l.extras && l.extras.length > 0 && <span className="block text-xs text-muted">+ {l.extras.join(', ')}</span>}
                {l.note && <span className="block text-xs text-warn italic">{l.note}</span>}
                {fresh > 0 && fresh < l.quantity && <span className="block text-xs text-brand-text font-medium">{fresh} new</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
