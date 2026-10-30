import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Skeleton } from '../../components/ui';
import { printElementContent } from '../../lib/printHtml';
import { printBillSplit } from '../printing/api';
import { usePrinterConfig } from '../printing/hooks';
import { trackPrintJob, warnIfPrinterOffline } from '../printing/jobs';
import { BillReceipt } from '../printing/Receipts';
import { previewSplit, type SplitPortion } from './api';
import { everyBillHasItems, initialAssignment, MAX_BILLS, MIN_BILLS, moveWhole, resize, setUnits, splittable, toRequest, unitsOn, type Assignment } from './split';
import type { Bill } from './types';

const inr = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;

/** One bill's worth of the order, shaped like a bill so the normal receipt can show it. */
const portionBill = (bill: Bill, p: SplitPortion): Bill => ({
  ...bill,
  items: p.items.map((i) => ({ id: i.billItemId, itemName: i.itemName, quantity: i.quantity, price: i.unitPrice, subtotal: i.subtotal, isTakeaway: i.takeaway })),
  subtotal: p.subtotal, discountAmount: p.discountAmount, promotionDiscountAmount: p.promotionDiscountAmount, parcelCharge: p.parcelCharge,
  cgstAmount: p.cgstAmount, sgstAmount: p.sgstAmount, taxAmount: p.taxAmount, roundOff: p.roundOff, netAmount: p.netAmount,
  payments: undefined, paymentSummary: null,
});

/**
 * Give a group separate bills. The cashier puts each dish on the bill of the guest who had it (what is left stays on the last
 * bill), checks what each bill says, and prints them all. Printing changes nothing on the bill: it is paid, or still to be
 * paid, as one bill. `onCollect` hands the amounts to the payment dialog so each guest's share can be collected on its own.
 */
export function SplitBillDialog({ bill, onClose, onCollect }: { bill: Bill; onClose: () => void; onCollect?: (nets: number[]) => void }) {
  const lines = useMemo(() => splittable(bill.items ?? []), [bill.items]);
  const [count, setCount] = useState(2);
  const [assign, setAssign] = useState<Assignment>(() => initialAssignment(bill.items ?? [], 2));
  const [slip, setSlip] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);
  const cfg = usePrinterConfig().data ?? null;
  const ready = lines.length > 0 && everyBillHasItems(assign, count);
  const request = useMemo(() => toRequest(assign, count), [assign, count]);
  const preview = useQuery({ queryKey: ['split-preview', bill.id, request], queryFn: () => previewSplit(bill.id, request), enabled: ready, staleTime: 0, retry: false });
  const portions = ready ? preview.data?.portions ?? [] : [];
  const total = portions.reduce((s, p) => s + Number(p.netAmount), 0);
  const paid = bill.status === 'PAID';

  const changeCount = (n: number) => { setCount(n); setAssign((a) => resize(a, bill.items ?? [], n)); setSlip(null); };

  const print = async () => {
    setPrinting(true);
    try {
      const res = await printBillSplit(bill.id, request);
      if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `Split bills of #${bill.billNumber}`); showToast(`${count} bills sent to the printer.`, 'success'); }
      else if (res?.success) showToast(`${count} bills sent to the printer (${res.host}).`, 'success');
      else showToast(`Print warning: ${res?.message || 'Check printer connection'}`, 'warning');
    } catch (e) { showToast(`Could not print the bills: ${e instanceof Error ? e.message : e}`, 'error'); } finally { setPrinting(false); }
  };

  return (
    <Dialog id="splitBillModal" open onClose={onClose} size="lg" title="Split bill by items" description={`Bill #${bill.billNumber} • ${inr(bill.netAmount)} • give each guest their own bill`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="splitBillCount" className="label !mb-0">Number of bills</label>
          <select id="splitBillCount" value={count} onChange={(e) => changeCount(Number(e.target.value))} className="input w-24">
            {Array.from({ length: MAX_BILLS - MIN_BILLS + 1 }, (_, k) => MIN_BILLS + k).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="text-xs text-muted basis-full sm:basis-auto">Put each dish on the bill of the guest who had it. What is not moved stays on bill {count}.</p>
        </div>

        {lines.length === 0 ? <p className="text-sm text-muted text-center py-4">This bill has no items to split.</p> : (
          <ul id="splitBillLines" className="rounded-xl border border-line divide-y divide-line">
            {lines.map((l) => {
              const row = assign[l.id] ?? [];
              return (
                <li key={l.id} data-testid={`split-line-${l.id}`} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold">{l.quantity}×</span> {l.itemName}</span>
                    <span className="shrink-0 text-muted">{inr(l.subtotal)}</span>
                  </div>
                  {l.quantity === 1 ? (
                    <div role="group" aria-label={`Which bill has ${l.itemName}`} className="flex flex-wrap gap-1.5">
                      {Array.from({ length: count }, (_, n) => (
                        <button key={n} type="button" aria-pressed={row[n] === 1} aria-label={`Put ${l.itemName} on bill ${n + 1}`} onClick={() => setAssign((a) => moveWhole(a, l, n, count))}
                          className={`min-h-[36px] min-w-[3.25rem] rounded-lg border px-2.5 text-xs font-semibold transition ${row[n] === 1 ? 'border-brand bg-brand/15 text-brand-text' : 'border-line text-muted hover:border-line-strong'}`}>Bill {n + 1}</button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: count }, (_, n) => (
                        <div key={n} className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <span>Bill {n + 1}</span>
                          {n === count - 1 ? <span className="w-[5.25rem] text-center font-semibold text-fg" aria-label={`Bill ${n + 1} gets the rest of ${l.itemName}`}>{row[n] ?? 0} (rest)</span> : (
                            <span className="inline-flex items-center rounded-lg border border-line-strong">
                              <button type="button" aria-label={`Fewer ${l.itemName} on bill ${n + 1}`} onClick={() => setAssign((a) => setUnits(a, l, n, (a[l.id]?.[n] ?? 0) - 1, count))} className="w-9 h-9 text-lg leading-none text-muted hover:text-fg">−</button>
                              <span className="w-6 text-center font-semibold text-fg" aria-label={`Bill ${n + 1} quantity of ${l.itemName}`}>{row[n] ?? 0}</span>
                              <button type="button" aria-label={`More ${l.itemName} on bill ${n + 1}`} onClick={() => setAssign((a) => setUnits(a, l, n, (a[l.id]?.[n] ?? 0) + 1, count))} className="w-9 h-9 text-lg leading-none text-muted hover:text-fg">+</button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!ready && lines.length > 0 && (
          <p id="splitBillHint" className="text-sm text-warn">Every bill needs at least one item: {Array.from({ length: count }, (_, n) => n).filter((n) => unitsOn(assign, n) === 0).map((n) => `bill ${n + 1}`).join(', ')} still empty.</p>
        )}

        {ready && (preview.isPending ? <Skeleton rows={3} /> : preview.isError ? (
          <p role="alert" className="text-sm text-danger">{preview.error.message}</p>
        ) : (
          <div className="space-y-3">
            <div className={`grid gap-3 ${count === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {portions.map((p, n) => (
                <section key={p.number} id={`splitBill${p.number}`} aria-label={`Bill ${p.number}`} className="rounded-xl border border-line p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-fg flex items-center justify-between"><span>Bill {p.number} of {count}</span><span id={`splitBillTotal${p.number}`} className="text-brand-text">{inr(p.netAmount)}</span></h3>
                  <ul className="text-xs divide-y divide-line">
                    {p.items.map((i) => <li key={i.billItemId} className="flex justify-between gap-2 py-1"><span className="min-w-0 [overflow-wrap:anywhere]">{i.quantity}× {i.itemName}</span><span className="shrink-0 text-muted">{inr(i.subtotal)}</span></li>)}
                  </ul>
                  <dl className="text-xs text-muted space-y-0.5">
                    <div className="flex justify-between"><dt>Sub total</dt><dd>{inr(p.subtotal)}</dd></div>
                    {Number(p.discountAmount) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{inr(p.discountAmount)}</dd></div>}
                    {Number(p.promotionDiscountAmount) > 0 && <div className="flex justify-between"><dt>Promotion</dt><dd>-{inr(p.promotionDiscountAmount)}</dd></div>}
                    {Number(p.parcelCharge) > 0 && <div className="flex justify-between"><dt>Parcel charge</dt><dd>{inr(p.parcelCharge)}</dd></div>}
                    {Number(p.taxAmount) > 0 && <div className="flex justify-between"><dt>GST</dt><dd>{inr(p.taxAmount)}</dd></div>}
                    {Math.abs(Number(p.roundOff)) > 0.001 && <div className="flex justify-between"><dt>Round off</dt><dd>{Number(p.roundOff) > 0 ? '+' : ''}{Number(p.roundOff).toFixed(2)}</dd></div>}
                  </dl>
                  <button type="button" id={`btnShowSplitSlip${p.number}`} onClick={() => setSlip(slip === n ? null : n)} aria-expanded={slip === n} className="btn btn-ghost btn-sm w-full"><i className="fa-regular fa-eye" />{slip === n ? 'Hide bill' : 'Show bill'}</button>
                </section>
              ))}
            </div>
            <p id="splitBillsSum" className={`text-sm font-medium ${Math.abs(total - Number(bill.netAmount)) < 0.005 ? 'text-ok' : 'text-danger'}`}>
              {Math.abs(total - Number(bill.netAmount)) < 0.005 ? `The ${count} bills add up to the bill: ${inr(total)}.` : `The bills add up to ${inr(total)} but the bill is ${inr(bill.netAmount)}.`}
            </p>
            {slip !== null && portions[slip] && (
              <div className="space-y-2">
                <BillReceipt id={`splitSlip${slip + 1}`} bill={portionBill(bill, portions[slip])} cfg={cfg} splitMarker={`SPLIT BILL ${slip + 1} OF ${count}`} paymentText={paid ? 'PAID' : 'PENDING'} />
                <button type="button" id="btnBrowserPrintSplit" onClick={() => printElementContent(`splitSlip${slip + 1}`, `Split bill ${slip + 1} of ${count}`)} className="btn btn-secondary btn-sm w-full"><i className="fa-solid fa-print" />Browser print bill {slip + 1}</button>
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
          {onCollect && <button type="button" id="btnCollectSplit" disabled={!ready || !preview.data} onClick={() => { onCollect(portions.map((p) => Number(p.netAmount))); onClose(); }} className="btn btn-secondary"><i className="fa-solid fa-hand-holding-dollar" />Collect each bill separately</button>}
          <button type="button" id="btnPrintSplitBills" disabled={!ready || !preview.data || printing} onClick={() => void print()} className="btn btn-primary"><i className="fa-solid fa-print" />{printing ? 'Printing...' : `Print ${count} bills`}</button>
        </div>
      </div>
    </Dialog>
  );
}
