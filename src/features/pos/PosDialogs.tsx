import { useState, useEffect, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { SegmentedTabs } from '../../components/ui';
import { useSession } from '../../api/session';
import { hasFeature } from '../../api/roles';
import type { Bill } from '../bills/types';
import { floorsIn } from './floors';
import { FloorFilter, OrderChip } from './Places';
import { BillLines } from './BillLines';
import { dishCount } from './billText';
import { balanceTwo, fillLast, parseTip, partsPayload, partsProblem, partsRemaining, partsText, splitEqually, type PayPart, moveState, orderLocationLabel, orderLocationText, orderMode, statusLabel, tableOccupant, type Mode, type MoveTarget } from './rules';
import type { ChangeLocationBody, DiningTable } from './api';
import { BillReceipt, CancelledKotReceipt } from '../printing/Receipts';
import { SplitBillDialog } from '../bills/SplitBillDialog';
import { printBill } from '../printing/api';
import { trackPrintJob, warnIfPrinterOffline } from '../printing/jobs';
import { printElementContent } from '../../lib/printHtml';
import { usePrinterConfig } from '../printing/hooks';
import { fetchCustomer, type Customer } from '../customers/api';
import { useLoyaltySettings } from '../customers/LoyaltyRules';
import { businessToday, expiryInfo, pointsEarnedFor, redeemLimits, redeemProblem } from '../customers/loyalty';
import { LoyaltyMember } from './LoyaltyMember';

const inr = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;
/** Settle a printed bill: pick how it was paid and add an optional reference. */
export function ConfirmPaymentDialog({
  order,
  busy,
  onClose,
  onConfirm,
}: {
  order: Bill;
  busy: boolean;
  onClose: () => void;
  onConfirm: (
    mode: string,
    notes: string,
    tip: number,
    payments?: { mode: string; amount: number }[],
    customerId?: number | null,
    redeemLoyaltyPoints?: number
  ) => void;
}) {
  // loyalty points come with the customers module; a plan without it pays by cash, UPI or card only
  const crm = useSession((s) => (s.user ? hasFeature(s.user, 'CRM') : true));
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [notes, setNotes] = useState('');
  const [tipText, setTipText] = useState('');
  const tip = parseTip(tipText);
  const net = Number(order.netAmount || 0);
  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState<PayPart[]>([]);
  const [guests, setGuests] = useState('2');
  const problem = split ? partsProblem(net, parts) : null;
  const left = split ? partsRemaining(net, parts) : 0;

  // The loyalty member (found by phone number) and the points being used on this bill
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [usePts, setUsePts] = useState('');
  const [detached, setDetached] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const cfg = usePrinterConfig().data ?? null;
  const { minRedeem } = useLoyaltySettings(crm);
  const pointsLapsed = customer ? expiryInfo(customer.pointsBalance, customer.pointsExpireAt, businessToday()).tone === 'lapsed' : false;
  const limits = customer ? redeemLimits(customer.pointsBalance, net, minRedeem, pointsLapsed) : null;
  const billCustomerId = customer?.id ?? (detached ? null : order.customerId);

  // Points used on this bill come off the amount due; the rest is paid in the chosen way.
  const typed = Math.max(0, Math.floor(Number(usePts) || 0));
  const pointsProblem = !split && typed > 0 ? (limits ? redeemProblem(typed, limits) : 'Find the customer by phone number first to use their points.') : null;
  const used = !split && typed > 0 && !pointsProblem ? typed : 0;
  const coversAll = used > 0 && used >= Math.floor(net);
  const due = used > 0 ? Math.max(0, Math.round((net - used) * 100) / 100) : net;
  const earns = customer ? pointsEarnedFor(coversAll ? 0 : due) : 0;
  const memberView = customer ? { name: customer.name, points: pointsLapsed ? 0 : customer.pointsBalance, expireAt: customer.pointsExpireAt } : null;

  const startSplit = (on: boolean) => {
    setSplit(on);
    if (on && parts.length < 2) {
      if (used > 0 && !coversAll) setParts([{ mode: 'LOYALTY_POINTS', amount: String(used) }, { mode, amount: due.toFixed(2) }]);
      else setParts([{ mode, amount: '' }, { mode: mode === 'CASH' ? 'UPI' : 'CASH', amount: '' }]);
    }
    if (on) setUsePts('');
  };
  const setPart = (i: number, p: Partial<PayPart>) => setParts(parts.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const tenders = [
    { v: 'CASH', icon: 'fa-money-bill-wave', t: 'Cash' },
    { v: 'UPI', icon: 'fa-qrcode', t: 'UPI' },
    { v: 'CARD', icon: 'fa-credit-card', t: 'Card' },
  ] as const;
  /** The guests' separate bills are known: collect each one's amount on its own (cash for one, UPI for another, ...). */
  const collectSeparately = (nets: number[]) => {
    setSplit(true);
    setUsePts('');
    setParts(nets.map((amount) => ({ mode, amount: amount.toFixed(2) })));
  };
  const toggleLoyalty = () => {
    if (used > 0) { setUsePts(''); return; }
    if (!customer) {
      if (order.customerId && !detached) { showToast("Loading the customer's points. Try again in a moment.", 'info'); return; }
      showToast('Find the customer by phone number first to use their points.', 'warning'); document.getElementById('loyaltyPhone')?.focus(); return;
    }
    if (!limits?.canRedeem) { showToast(limits?.reason || 'These points cannot be used on this bill.', 'warning'); return; }
    setUsePts(String(limits.max));
  };

  useEffect(() => {
    if (order.customerId) {
      fetchCustomer(order.customerId)
        .then((c) => setCustomer(c))
        .catch(() => undefined);
    }
  }, [order.customerId]);

  const printUpdated = async () => {
    setPrinting(true);
    try {
      const res = await printBill(order.id, used);
      if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `Bill #${order.billNumber} (points used)`); }
      else if (res?.success) showToast(`Updated bill #${order.billNumber} sent to the printer.`, 'success');
      else showToast(`Print warning: ${res?.message || 'Check printer connection'}`, 'warning');
    } catch (e) { showToast(`Could not print the bill: ${e instanceof Error ? e.message : e}`, 'error'); } finally { setPrinting(false); }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tip === null) {
      showToast('Tip must be zero or more.', 'warning');
      return;
    }
    if (split) {
      if (problem) {
        showToast(problem, 'warning');
        return;
      }
      const loyaltyParts = parts.filter((p) => p.mode === 'LOYALTY_POINTS');
      if (loyaltyParts.length) {
        if (!customer || !limits) {
          showToast('Find the customer by phone number first to pay part of the bill with points.', 'warning');
          return;
        }
        const partsPointsProblem = redeemProblem(Math.round(loyaltyParts.reduce((sum, p) => sum + Number(p.amount || 0), 0)), limits);
        if (partsPointsProblem) {
          showToast(partsPointsProblem, 'warning');
          return;
        }
      }
      onConfirm(parts[0].mode, notes.trim(), tip, partsPayload(parts), billCustomerId);
      return;
    }
    if (typed > 0) {
      if (pointsProblem) {
        showToast(pointsProblem, 'warning');
        return;
      }
      if (coversAll) {
        onConfirm('LOYALTY_POINTS', notes.trim(), tip, undefined, billCustomerId, used);
        return;
      }
      onConfirm(mode, notes.trim(), tip, partsPayload([{ mode: 'LOYALTY_POINTS', amount: String(used) }, { mode, amount: due.toFixed(2) }]), billCustomerId);
      return;
    }
    onConfirm(mode, notes.trim(), tip, undefined, billCustomerId);
  };

  return (
    <>
    <Dialog id="confirmPaymentModal" open onClose={onClose} dismissible={!splitOpen} size="md" title="Confirm payment" description="Complete the transaction and free the table">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <dl className="rounded-xl bg-subtle p-3.5 space-y-1.5 text-sm">
          <Row k="Order ref"><span id="confirmPayOrderRef" className="font-mono font-semibold">#{order.billNumber || order.id}</span></Row>
          <Row k="Location"><span id="confirmPayLocation" className="font-medium">{orderLocationLabel(order)}</span></Row>
          <Row k="Order staff"><span id="confirmPayStaff">{order.createdByName || 'Staff'}</span></Row>
        </dl>

        <section id="confirmPayItems" aria-label="What was ordered" className="rounded-xl border border-line">
          <h3 className="flex items-center justify-between px-3.5 pt-3 text-xs font-semibold uppercase tracking-wide text-muted"><span>What was ordered</span><span>{dishCount(order.items)} items</span></h3>
          <BillLines items={order.items} id="confirmPayItemsList" className="max-h-52 overflow-y-auto px-3.5 py-1" />
          <dl className="space-y-1 border-t border-line px-3.5 py-2.5 text-sm">
            <Row k="Sub total"><span id="confirmPaySubtotal">{inr(order.subtotal)}</span></Row>
            {Number(order.discountAmount) > 0 && <Row k={`Discount${order.discountPercent ? ` (${order.discountPercent}%)` : ''}`}><span>-{inr(order.discountAmount)}</span></Row>}
            {Number(order.promotionDiscountAmount) > 0 && <Row k={`Promotion${order.promotionName ? `: ${order.promotionName}` : ''}`}><span>-{inr(order.promotionDiscountAmount)}</span></Row>}
            {Number(order.taxAmount) > 0 && <Row k="GST"><span>{inr(order.taxAmount)}</span></Row>}
            {Number(order.parcelCharge) > 0 && <Row k="Parcel charge"><span>{inr(order.parcelCharge)}</span></Row>}
            {Math.abs(Number(order.roundOff)) > 0.001 && <Row k="Round off"><span>{Number(order.roundOff) > 0 ? '+' : ''}{Number(order.roundOff).toFixed(2)}</span></Row>}
            {used > 0 ? (
              <>
                <div className="flex items-center justify-between border-t border-line pt-2 mt-1"><dt className="font-semibold">Bill total</dt><dd id="confirmPayTotal" className="font-semibold">{inr(order.netAmount)}</dd></div>
                <Row k={`Loyalty points used (${used} pts)`}><span id="confirmPayPointsUsed" className="text-ok font-medium">-{inr(used)}</span></Row>
                <div className="flex items-center justify-between border-t border-line pt-2 mt-1"><dt className="font-semibold">Balance to pay</dt><dd id="confirmPayAmount" className="text-xl font-bold text-brand-text">{inr(due)}</dd></div>
              </>
            ) : (
              <div className="flex items-center justify-between border-t border-line pt-2 mt-1"><dt className="font-semibold">Net amount due</dt><dd id="confirmPayAmount" className="text-xl font-bold text-brand-text">{inr(order.netAmount)}</dd></div>
            )}
          </dl>
        </section>

        {crm && <LoyaltyMember customer={customer} onChange={(c) => { setCustomer(c); setDetached(c === null); setUsePts(''); setPreviewing(false); }} />}
        {!split && <fieldset>
          <legend className="label">{used > 0 && !coversAll ? `Pay the balance (${inr(due)}) by` : 'Payment mode'}</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tenders.map((m) => (
              <label key={m.v} className={`cursor-pointer rounded-lg border py-2.5 text-center text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${coversAll ? 'border-line text-faint opacity-60' : mode === m.v ? 'border-ok bg-ok/10 text-ok' : 'border-line text-muted hover:border-line-strong'}`}>
                <input type="radio" name="confirmPayMode" value={m.v} checked={mode === m.v} onChange={() => setMode(m.v)} className="sr-only" />
                <i className={`fa-solid ${m.icon} block mb-1 text-sm`} />{m.t}
              </label>
            ))}
            {crm && (
              <label className={`cursor-pointer rounded-lg border py-2.5 text-center text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${used > 0 ? 'border-ok bg-ok/10 text-ok' : 'border-line text-muted hover:border-line-strong'}`}>
                <input type="checkbox" name="confirmPayMode" value="LOYALTY_POINTS" checked={used > 0} onChange={toggleLoyalty} className="sr-only" />
                <i className="fa-solid fa-star block mb-1 text-sm" />Loyalty
              </label>
            )}
          </div>
        </fieldset>}
        <label htmlFor="confirmPaySplit" className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition ${split ? 'border-ok bg-ok/5' : 'border-line hover:border-line-strong'}`}>
          <input id="confirmPaySplit" type="checkbox" checked={split} onChange={(e) => startSplit(e.target.checked)} className="h-4 w-4 mt-0.5 shrink-0 accent-[rgb(var(--brand))]" />
          <span><span className="font-medium text-fg">Customer pays in two or more ways</span><span className="block text-xs text-muted">Tick to enter each amount, for example part cash and part UPI.</span></span>
        </label>
        {split && (
          <div id="splitPayBox" className="rounded-lg border border-line p-3 space-y-2.5">
            <p className="text-sm font-medium text-fg">How much is paid each way?</p>
            {parts.map((p, i) => (
              <div key={i} data-pay-part={i} className="flex items-center gap-2">
                <select aria-label={`Payment ${i + 1} mode`} value={p.mode} onChange={(e) => setPart(i, { mode: e.target.value as PayPart['mode'] })} className="input w-28"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>{(customer || p.mode === 'LOYALTY_POINTS') && <option value="LOYALTY_POINTS">Points</option>}</select>
                <input type="number" min={0} step="any" inputMode="decimal" aria-label={`Payment ${i + 1} amount`} placeholder="₹" value={p.amount} onChange={(e) => setParts(balanceTwo(net, parts, i, e.target.value))} className="input flex-1 min-w-0 text-right" />
                {parts.length > 2 && <button type="button" aria-label={`Remove payment ${i + 1}`} onClick={() => setParts(parts.filter((_, k) => k !== i))} className="btn btn-ghost btn-icon w-10 h-10 shrink-0"><i className="fa-solid fa-xmark" /></button>}
              </div>))}
            {parts.length === 2 && <p className="text-xs text-muted">Type one amount and the other fills in with what is left of {inr(net)}.</p>}
            <p id="splitSummary" className="text-sm font-semibold text-fg">{partsText(parts) || `Bill ${inr(net)}`}</p>
            <p id="splitRemaining" className={`text-sm font-medium ${Math.abs(left) < 0.01 ? 'text-ok' : 'text-danger'}`}>{Math.abs(left) < 0.01 ? 'The payments add up to the bill.' : left > 0 ? `${inr(left)} still to collect` : `${inr(Math.abs(left))} too much`}</p>
            <div className="flex flex-wrap items-center gap-2">
              {parts.length < 6 && <button type="button" id="btnAddPayPart" onClick={() => setParts(fillLast(net, [...parts, { mode: 'CASH', amount: '' }]))} className="btn btn-secondary btn-sm min-h-[36px]"><i className="fa-solid fa-plus" />Add another payment</button>}
              {parts.length > 2 && <button type="button" id="btnFillLast" onClick={() => setParts(fillLast(net, parts))} className="btn btn-secondary btn-sm min-h-[36px]">Put the rest in the last one</button>}
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-2.5">
              <div><label htmlFor="splitGuests" className="label">Guests sharing the bill equally?</label><input id="splitGuests" type="number" min={2} max={6} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} className="input w-20" /></div>
              <button type="button" id="btnSplitEqually" onClick={() => setParts(splitEqually(net, Number(guests)).map((amount, i) => ({ mode: parts[i]?.mode ?? 'CASH', amount })))} className="btn btn-secondary h-10">Split equally</button>
            </div>
          </div>)}

        {!split && customer && (
          <div id="loyaltyUseBox" className="rounded-xl border border-line bg-subtle/50 p-3 space-y-2">
            <label htmlFor="confirmRedeemPoints" className="label">Use loyalty points (1 pt = ₹1.00)</label>
            <div className="flex items-center gap-2">
              <input id="confirmRedeemPoints" type="number" min={1} max={limits ? limits.max : net} inputMode="numeric" value={usePts} onChange={(e) => setUsePts(e.target.value)}
                placeholder={`Available: ${pointsLapsed ? 0 : customer.pointsBalance} pts`} className="input flex-1" />
              {limits?.canRedeem && (
                <>
                  <button type="button" id="btnUseMinPoints" onClick={() => setUsePts(String(limits.min))} className="btn btn-secondary btn-sm shrink-0">{limits.min}</button>
                  <button type="button" id="btnUseMaxPoints" onClick={() => setUsePts(String(limits.max))} className="btn btn-secondary btn-sm shrink-0">Max (₹{limits.max})</button>
                </>
              )}
            </div>
            <p id="redeemHint" className={`text-xs ${pointsProblem ? 'text-danger' : 'text-muted'}`}>
              {pointsProblem
                ? pointsProblem
                : used > 0
                  ? coversAll
                    ? `${used} points pay the whole bill.`
                    : `${used} points off. Pay ${inr(due)} by ${mode === 'CASH' ? 'cash' : mode === 'UPI' ? 'UPI' : 'card'}${earns > 0 ? `; ${earns} point${earns === 1 ? '' : 's'} will be added.` : '.'}`
                  : limits?.canRedeem
                    ? `Balance ${customer.pointsBalance} pts. Use ${limits.min} to ${limits.max} points on this bill.${earns > 0 ? ` Paying in full earns ${earns} point${earns === 1 ? '' : 's'}.` : ''}`
                    : limits?.reason}
            </p>
            {used > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" id="btnPrintUpdatedBill" onClick={() => void printUpdated()} disabled={printing} className="btn btn-secondary btn-sm"><i className="fa-solid fa-print" />{printing ? 'Printing...' : 'Print updated bill'}</button>
                <button type="button" id="btnPreviewUpdatedBill" onClick={() => setPreviewing((v) => !v)} className="btn btn-ghost btn-sm" aria-expanded={previewing}><i className="fa-regular fa-eye" />{previewing ? 'Hide bill' : 'Show bill'}</button>
              </div>
            )}
            {used > 0 && previewing && (
              <div className="space-y-2">
                <BillReceipt id="updatedBillReceipt" bill={order} cfg={cfg} redeemPoints={used} member={memberView} />
                <button type="button" id="btnBrowserPrintUpdatedBill" onClick={() => printElementContent('updatedBillReceipt', 'Customer bill (points used)')} className="btn btn-secondary btn-sm w-full"><i className="fa-solid fa-print" />Browser print</button>
              </div>
            )}
          </div>
        )}

        <button type="button" id="btnSplitBillByItems" onClick={() => setSplitOpen(true)} className="btn btn-secondary btn-sm w-full sm:w-auto"><i className="fa-solid fa-people-arrows" />Split bill by items (separate bill for each guest)</button>
        <div>
          <label htmlFor="confirmPayTip" className="label">Tip (optional)</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="confirmPayTip" type="number" min={0} step="any" inputMode="decimal" value={tipText} onChange={(e) => setTipText(e.target.value)} placeholder="0" className={`input w-28 ${tip === null ? 'border-danger' : ''}`} />
            {[10, 20, 50, 100].map((v) => <button key={v} type="button" data-tip={v} onClick={() => setTipText(String(v))} className="btn btn-secondary btn-sm min-h-[36px]">₹{v}</button>)}
            {tipText && <button type="button" onClick={() => setTipText('')} className="btn btn-secondary btn-sm min-h-[36px]">No tip</button>}
          </div>
          <p className="text-xs text-muted mt-1">{tip ? `Guest pays ${inr(due + tip)} in total. The tip is kept separate from sales, GST and the cash drawer.` : 'A tip is kept separate from sales, GST and the cash drawer.'}</p>
        </div>
        <div><label htmlFor="confirmPayNotes" className="label">Payment reference / notes (optional)</label><input id="confirmPayNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. UPI Ref #, customer note" className="input" autoComplete="off" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" id="btnExecuteConfirmPayment" disabled={busy || (split && problem !== null)} className="btn btn-primary"><i className="fa-solid fa-circle-check" />{busy ? 'Processing...' : 'Confirm payment'}</button>
        </div>
      </form>
    </Dialog>
    {splitOpen && <SplitBillDialog bill={order} onClose={() => setSplitOpen(false)} onCollect={collectSeparately} />}
    </>
  );
}
const Row = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-3"><dt className="text-muted">{k}</dt><dd>{children}</dd></div>;


/** Add a dining table (managers). */
export function AddTableDialog({ busy, floors = [], onClose, onAdd }: { busy: boolean; floors?: string[]; onClose: () => void; onAdd: (name: string, floor?: string) => void }) {
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  return (
    <Dialog id="addTableModal" open onClose={onClose} size="sm" title="Add table" description="e.g. T-09, VIP-01, Patio-1">
      <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); if (name.trim()) onAdd(name.trim(), floor.trim() || undefined); }}>
        <div><label htmlFor="newTableName" className="label">Table name</label><input id="newTableName" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="off" /></div>
        <div><label htmlFor="newTableFloor" className="label">Floor or section <span className="text-faint font-normal">(optional)</span></label><input id="newTableFloor" list="tableFloorOptions" value={floor} onChange={(e) => setFloor(e.target.value)} className="input" autoComplete="off" placeholder="e.g. Ground, First floor, Terrace" maxLength={50} /><datalist id="tableFloorOptions">{floors.map((f) => <option key={f} value={f} />)}</datalist></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">{busy ? 'Adding...' : 'Add table'}</button></div>
      </form>
    </Dialog>
  );
}

/** Add or delete tables; a table with a live order cannot be deleted. */
export function ManageTablesDialog({ tables, orders, busy, onClose, onAdd, onDelete }: { tables: DiningTable[]; orders: Bill[]; busy: boolean; onClose: () => void; onAdd: (name: string, floor?: string) => void; onDelete: (t: DiningTable) => void }) {
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const knownFloors = [...new Set(tables.map((t) => t.floor).filter((f): f is string => !!f))];
  return (
    <Dialog id="manageTablesModal" open onClose={onClose} size="md" title="Manage tables" description="Changes apply to staff and managers on every device">
      <div className="space-y-4">
        <form className="flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim(), floor.trim() || undefined); setName(''); } }}>
          <input id="modalNewTableName" value={name} onChange={(e) => setName(e.target.value)} placeholder="New table name" aria-label="New table name" className="input" autoComplete="off" />
          <input id="modalNewTableFloor" list="manageFloorOptions" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Floor (optional)" aria-label="Floor of the new table" className="input sm:max-w-[10rem]" autoComplete="off" maxLength={50} />
          <datalist id="manageFloorOptions">{knownFloors.map((f) => <option key={f} value={f} />)}</datalist>
          <button type="submit" id="btnModalAddTable" disabled={busy || !name.trim()} className="btn btn-primary shrink-0"><i className="fa-solid fa-plus" />Add</button>
        </form>
        <ul id="modalTablesList" className="space-y-1.5">
          {tables.length === 0 && <li className="text-sm text-muted text-center py-3">No tables loaded</li>}
          {tables.map((t) => {
            const live = orders.find((o) => o.tableNumber === t.name);
            return (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <span className="flex items-center gap-2 text-sm min-w-0"><i className="fa-solid fa-chair text-faint" /><span className="font-medium truncate">{t.name}</span>{t.floor && <span className="badge badge-neutral">{t.floor}</span>}{live && <span className="badge badge-warn">Active #{live.billNumber}</span>}</span>
                <button type="button" onClick={() => onDelete(t)} className="btn btn-soft-danger btn-sm"><i className="fa-solid fa-trash-can" />Delete</button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}

/** Pick a table, an outdoor order or a takeaway order (the phone-first way to change place; also asks for a table when a dish is tapped with none chosen). */
export function PlacePickerDialog({ initial, subtitle, tables: allTables, floorOf = {}, orders, current, isManager, onClose, onTable, onOrder, onNew, onAddTable, onManage }: {
  initial: Mode; subtitle: string; tables: string[]; floorOf?: Record<string, string>; orders: Bill[]; current: { mode: Mode; table: string; orderId: number | null }; isManager: boolean;
  onClose: () => void; onTable: (t: string) => void; onOrder: (o: Bill) => void; onNew: (m: 'OUTDOOR' | 'TAKEAWAY') => void; onAddTable: () => void; onManage: () => void;
}) {
  const [tab, setTab] = useState<Mode>(initial);
  const [floor, setFloor] = useState('');
  const tables = floor ? allTables.filter((t) => floorOf[t] === floor) : allTables;
  const list = orders.filter((o) => orderMode(o) === tab);
  return (
    <Dialog id="mobileTablePickerModal" open onClose={onClose} size="md" title="Select table" description={subtitle}>
      <div className="space-y-3">
        <SegmentedTabs label="Order type" value={tab} onChange={setTab} options={[{ value: 'TABLE', label: 'Table' }, { value: 'OUTDOOR', label: 'Outdoor' }, { value: 'TAKEAWAY', label: 'Takeaway' }]} />
        {tab === 'TABLE' ? (
          <>
            <FloorFilter floors={floorsIn(floorOf)} value={floor} onChange={setFloor} />
            <div id="mobileTablePickerGrid" className="grid grid-cols-3 gap-2">
              {tables.map((t) => {
                const o = orders.find((x) => x.tableNumber === t);
                const st = statusLabel(o, 'TABLE', 'picker');
                const sel = current.mode === 'TABLE' && current.table === t;
                return (
                  <button type="button" key={t} onClick={() => onTable(t)} className={`rounded-xl border p-2.5 min-h-16 flex flex-col items-center justify-between gap-1 transition active:scale-95 ${sel ? 'ring-2 ring-brand border-brand' : 'border-line'}`}>
                    <span className="font-semibold text-sm flex items-center gap-1"><i className="fa-solid fa-chair text-[11px] text-faint" />{t}</span>
                    <span className={`badge badge-${o ? st.tone : 'neutral'} ${st.pulse ? 'animate-pulse' : ''}`}>{st.text}</span>
                  </button>
                );
              })}
            </div>
            {isManager && <button type="button" id="btnPickerAddNewTable" onClick={onAddTable} className="btn btn-secondary w-full"><i className="fa-solid fa-plus" />Add new table</button>}
            {isManager && <button type="button" id="btnPickerManageTables" onClick={onManage} className="btn btn-soft-danger w-full"><i className="fa-solid fa-trash-can" />Delete a table</button>}
          </>
        ) : (
          <>
            <button type="button" onClick={() => onNew(tab as 'OUTDOOR' | 'TAKEAWAY')} className="btn btn-primary w-full"><i className="fa-solid fa-plus" />{tab === 'OUTDOOR' ? 'New outdoor order' : 'New takeaway order'}</button>
            <div className="space-y-2">
              {list.length === 0 && <p className="text-center text-sm text-muted py-4">No active {tab === 'OUTDOOR' ? 'outdoor' : 'takeaway'} orders. Tap above to create one.</p>}
              {list.map((o) => (
                <OrderChip key={o.id} icon={tab === 'OUTDOOR' ? 'fa-tree' : 'fa-bag-shopping'} label={o.customerName || 'Guest'} mono={(tab === 'OUTDOOR' ? o.outdoorToken : o.takeawayToken) || undefined} order={o} mode={tab} selected={current.mode === tab && current.orderId === o.id} onClick={() => onOrder(o)} />
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Transfer a saved order the way restaurant POS apps do: a grid of table tiles (vacant, occupied = merge, current), plus outdoor and takeaway.
 * The kitchen is told when its ticket was already printed; an occupied table is merged after a confirmation.
 */
export function MoveOrderDialog({ order, tables, orders, busy, onClose, onMove }: { order: Bill; tables: string[]; orders: Bill[]; busy: boolean; onClose: () => void; onMove: (body: ChangeLocationBody) => void }) {
  const kind = orderMode(order);
  const [target, setTarget] = useState<MoveTarget>({ type: 'TABLE', table: null });
  const [customer, setCustomer] = useState(order.customerName && order.customerName !== 'Guest' ? order.customerName : '');
  const [reason, setReason] = useState('');
  const state = moveState(order, orders, target);
  const TABS: [Mode, string, string][] = [['TABLE', 'Table', 'fa-chair'], ['OUTDOOR', 'Outdoor', 'fa-tree'], ['TAKEAWAY', 'Takeaway', 'fa-bag-shopping']];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!state.canSubmit || busy) return;
    const body: ChangeLocationBody = { orderType: target.type, reason: reason.trim() || null };
    if (target.type === 'TABLE') {
      if (!target.table) return;
      body.tableNumber = target.table;
      if (state.occupant) {
        if (!window.confirm(`Merge this order into ${state.occupant.billNumber} on ${target.table}? This cannot be undone.`)) return;
        body.mergeIfOccupied = true;
      }
    } else if (target.type === 'OUTDOOR') {
      if (!customer.trim()) { showToast('Customer name is required for outdoor orders.', 'warning'); return; }
      body.customerName = customer.trim();
    } else if (customer.trim()) body.customerName = customer.trim();
    onMove(body);
  };

  return (
    <Dialog id="moveOrderModal" open onClose={onClose} size="md" title="Transfer order" description="Move this order to another table, outdoor or takeaway. Items and total stay the same.">
      <form className="space-y-4" onSubmit={submit}>
        <p id="moveOrderFrom" className="rounded-lg bg-subtle px-3 py-2 text-sm text-fg">{orderLocationText(order)}  (Ref {order.billNumber})</p>
        <div id="moveOrderTypeTabs" role="tablist" aria-label="Move to" className="grid grid-cols-3 gap-1 rounded-lg bg-subtle p-1">
          {TABS.map(([t, label, icon]) => {
            const disabled = t === kind && t !== 'TABLE';
            const active = t === target.type;
            return <button key={t} type="button" role="tab" aria-selected={active} disabled={disabled} onClick={() => setTarget({ type: t, table: null })}
              className={`h-9 rounded-md text-sm font-medium transition ${active ? 'bg-brand text-gray-950 font-semibold' : disabled ? 'text-faint cursor-not-allowed' : 'text-muted hover:text-fg'}`}><i className={`fa-solid ${icon} mr-1.5`} />{label}</button>;
          })}
        </div>
        {target.type === 'TABLE' ? (
          <div id="moveOrderTableSection">
            <p className="label">Move to table</p>
            <div id="moveOrderTableGrid" className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-0.5">
              {tables.map((t) => {
                const current = kind === 'TABLE' && (order.tableNumber || '').toLowerCase() === t.toLowerCase();
                const occ = current ? null : tableOccupant(orders, order, t);
                const picked = target.table === t;
                return (
                  <button type="button" key={t} data-move-table={t} disabled={current} onClick={() => setTarget({ type: 'TABLE', table: t })} aria-pressed={picked}
                    className={`rounded-xl border p-2 min-h-16 flex flex-col items-center justify-center gap-0.5 transition ${current ? 'border-line bg-subtle opacity-60 cursor-not-allowed' : occ ? 'border-warn/50 bg-warn/10' : 'border-ok/40 bg-ok/10'} ${picked ? 'ring-2 ring-brand' : ''} ${current ? '' : 'active:scale-95'}`}>
                    <span className="font-semibold text-sm flex items-center gap-1"><i className="fa-solid fa-chair text-[11px] text-faint" />{t}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${current ? 'text-muted' : occ ? 'text-warn' : 'text-ok'}`}>{current ? 'Current' : occ ? 'Occupied' : 'Vacant'}</span>
                    {occ && <span className="text-[10px] text-muted truncate max-w-full">{occ.customerName || `#${occ.billNumber}`}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div id="moveOrderCustomerSection">
            <label htmlFor="moveOrderCustomer" id="moveOrderCustomerLabel" className="label">{target.type === 'OUTDOOR' ? 'Customer name (required)' : 'Customer (optional)'}</label>
            <input id="moveOrderCustomer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="input" autoComplete="off" />
          </div>
        )}
        <div><label htmlFor="moveOrderReason" className="label">Reason (optional)</label><input id="moveOrderReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="input" placeholder="e.g. AC not working" autoComplete="off" /></div>
        <p id="moveOrderNote" className="text-xs text-muted">{state.note}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" id="moveOrderSubmitBtn" disabled={busy || !state.canSubmit} className="btn btn-primary"><i className="fa-solid fa-right-left" /><span id="moveOrderSubmitText">{busy ? 'Transferring...' : state.submitText}</span></button>
        </div>
      </form>
    </Dialog>
  );
}

/** Preview of the CANCELLED kitchen ticket before an order whose KOT is already printed is cancelled. */
export function CancelOrderDialog({ order, busy, onClose, onConfirm }: { order: Bill; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const cfg = usePrinterConfig().data ?? null;
  return (
    <Dialog id="cancelOrderModal" open onClose={onClose} size="md" title="Cancel this order?" description="Every dish is cancelled and this ticket is printed for the kitchen. The order is removed permanently.">
      <div className="space-y-4">
        <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-line bg-subtle p-3 flex justify-center"><div style={{ width: 302 }}><CancelledKotReceipt bill={order} cfg={cfg} reason="Cancelled by user/staff" /></div></div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1 h-10">Keep order</button>
          <button type="button" id="btnConfirmCancelOrder" disabled={busy} onClick={onConfirm} className="btn btn-danger flex-1 h-10"><i className="fa-solid fa-ban" />Cancel order &amp; print</button>
        </div>
      </div>
    </Dialog>
  );
}
