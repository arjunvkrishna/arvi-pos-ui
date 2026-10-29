import { useState } from 'react';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Skeleton } from '../../components/ui';
import { useReorder } from './hooks';
import { fmtNum } from './rules';
import { REASON_TEXT, REASON_TONE, estimateText, groupBySupplier, groupTotal, orderLabel, orderQty, orderText } from './stockops';

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; }
  }
}

/** What to buy now, grouped by supplier, with a message to send. */
export function ReorderView() {
  const q = useReorder();
  const [edited, setEdited] = useState<Record<number, number | undefined>>({});
  if (q.isPending) return <div className="card"><Skeleton rows={5} /></div>;
  if (q.isError) return <p className="card p-6 text-center text-sm text-danger">Failed to load the reorder list: {q.error.message}</p>;
  const groups = groupBySupplier(q.data.items);
  if (groups.length === 0) return <div id="reorderEmpty" className="card"><EmptyState icon="fa-circle-check" title="Nothing to order right now" hint={`Every item is above its minimum and will last at least ${q.data.coverDays} days at the recent pace.`} /></div>;
  const total = groups.reduce((s, g) => s + groupTotal(g, edited), 0);

  return (
    <div id="reorderView" className="space-y-4">
      <p className="text-sm text-muted">{q.data.items.length} item{q.data.items.length === 1 ? '' : 's'} to order, {estimateText(total)}. Suggested quantities cover about {q.data.coverDays} days of use (counted from the last {q.data.usageDays} days) and are rounded up to whole packs. You can change any quantity before sending.</p>
      {groups.map((g) => {
        const text = orderText(g, edited);
        return (
          <div key={g.supplier} className="card overflow-hidden" data-supplier={g.supplier}>
            <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-medium text-fg">{g.supplier}</h3><p className="text-xs text-muted">{g.rows.length} item{g.rows.length === 1 ? '' : 's'} · {estimateText(groupTotal(g, edited))}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" disabled={!text} data-copy={g.supplier} onClick={() => void copy(text).then((ok) => showToast(ok ? 'Order list copied. Paste it into WhatsApp or a message.' : 'Could not copy. Select the text and copy it by hand.', ok ? 'success' : 'warning'))}><i className="fa-solid fa-copy" />Copy order</button>
                <a className={`btn btn-secondary btn-sm ${text ? '' : 'pointer-events-none opacity-50'}`} href={text ? `https://wa.me/?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-whatsapp text-ok" />WhatsApp</a>
              </div>
            </div>
            <table className="rtable">
              <thead><tr><th>Item</th><th>Why</th><th className="text-right">In stock</th><th className="text-right">Lasts</th><th className="text-right">Order</th><th className="text-right">Cost</th></tr></thead>
              <tbody>{g.rows.map((r) => (
                <tr key={r.itemId} data-reorder-row={r.name}>
                  <td data-label="" className="cell-title font-medium text-fg">{r.name}</td>
                  <td data-label="Why"><Badge tone={REASON_TONE[r.reason]}>{REASON_TEXT[r.reason]}</Badge></td>
                  <td data-label="In stock" className={`md:text-right ${r.quantity <= 0 ? 'text-danger font-semibold' : ''}`}>{fmtNum(r.quantity)} {r.unit} <span className="text-xs text-muted">(min {fmtNum(r.minQuantity)})</span></td>
                  <td data-label="Lasts" className="md:text-right text-muted">{r.daysLeft == null ? 'no recent use' : r.daysLeft < 1 ? 'under a day' : `${fmtNum(r.daysLeft)} days`}</td>
                  <td data-label="Order" className="md:text-right">
                    <span className="inline-flex items-center gap-1.5"><input type="number" min={0} step="any" inputMode="decimal" aria-label={`Order quantity for ${r.name} in ${r.unit}`} value={edited[r.itemId] ?? r.suggestedUnits} onChange={(e) => setEdited({ ...edited, [r.itemId]: e.target.value === '' ? undefined : Number(e.target.value) })} className="input w-24 text-right" /><span className="text-xs text-muted">{r.unit}</span></span>
                    <span className="block text-xs text-muted mt-0.5">{orderLabel(r, orderQty(r, edited))}</span>
                  </td>
                  <td data-label="Cost" className="md:text-right text-muted">{r.lastUnitCost > 0 ? `₹${Math.round(orderQty(r, edited) * r.lastUnitCost).toLocaleString('en-IN')}` : '-'}</td>
                </tr>))}</tbody>
            </table>
          </div>);
      })}
    </div>
  );
}
