import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { attentionCount, itemCount, waitingCount } from './outbox';
import { useConnection } from './connection';
import { outboxScope, useOutbox } from './outboxStore';

/** Shown across the app while the server cannot be reached, or while orders taken offline are still waiting or need a look. */
export function OfflineBanner() {
  const online = useConnection((s) => s.online);
  const allItems = useOutbox((s) => s.items);
  const items = allItems.filter((i) => i.scope === outboxScope());   // only the orders taken in the cafe and branch this person is in
  const flushing = useOutbox((s) => s.flushing);
  const { remove, retry, flushNow } = useOutbox.getState();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const waiting = waitingCount(items); const stuck = attentionCount(items);
  if (online && items.length === 0) return null;
  const tone = !online ? 'bg-warn/15 border-warn/40 text-fg' : stuck > 0 ? 'bg-danger/10 border-danger/30 text-fg' : 'bg-info/10 border-info/30 text-fg';
  return (
    <div id="offlineBanner" role="status" aria-live="polite" className={`border-b px-3 sm:px-6 py-2 text-sm ${tone}`} data-online={online}>
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <i className={`fa-solid ${online ? 'fa-cloud-arrow-up' : 'fa-wifi'} ${online ? 'text-info' : 'text-warn'}`} />
        <span id="offlineBannerText" className="flex-1 min-w-48">
          {!online ? <><b>No connection to the server.</b> You can keep taking new orders: they are saved on this device and sent when the connection returns. Changing existing orders, printing and payments need the connection.</>
            : stuck > 0 ? <><b>{stuck} order{stuck === 1 ? '' : 's'} taken offline could not be sent.</b> {waiting > 0 ? `${waiting} more ${waiting === 1 ? 'is' : 'are'} waiting.` : ''}</>
              : <><b>Sending {waiting} order{waiting === 1 ? '' : 's'} taken offline…</b></>}
        </span>
        {items.length > 0 && <button type="button" id="btnOutboxToggle" onClick={() => setOpen(!open)} aria-expanded={open} className="btn btn-secondary btn-sm min-h-[36px]">{items.length} waiting {open ? '▴' : '▾'}</button>}
        {online && waiting > 0 && <button type="button" id="btnOutboxSend" disabled={flushing} onClick={() => void flushNow(qc)} className="btn btn-primary btn-sm min-h-[36px]">Send now</button>}
      </div>
      {open && items.length > 0 && (
        <ul id="outboxList" className="max-w-6xl mx-auto mt-2 space-y-1.5">
          {items.map((i) => (
            <li key={i.id} data-outbox-item={i.label} className="rounded-lg border border-line bg-surface p-2.5 flex flex-wrap items-start gap-2">
              <span className="flex-1 min-w-44"><b>{i.label}</b> <span className="text-muted">· {itemCount(i)} item{itemCount(i) === 1 ? '' : 's'} · {new Date(i.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="block text-xs text-muted">{i.payload.items.map((x) => `${x.itemName} x${x.quantity}`).join(', ')}</span>
                {i.status === 'ATTENTION' && <span className="block text-xs text-danger mt-0.5">{i.error}</span>}</span>
              {i.status === 'ATTENTION' && <button type="button" data-retry={i.label} onClick={() => { retry(i.id); void flushNow(qc); }} className="btn btn-secondary btn-sm min-h-[36px]">Try again</button>}
              <button type="button" data-discard={i.label} onClick={() => { if (window.confirm(`Discard the order for ${i.label}? It has not been sent.`)) remove(i.id); }} className="btn btn-secondary btn-sm min-h-[36px] text-danger">Discard</button>
            </li>))}
        </ul>)}
    </div>
  );
}
