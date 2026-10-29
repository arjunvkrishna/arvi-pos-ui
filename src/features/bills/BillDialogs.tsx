import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, Field } from '../../components/ui';
import { formatISTDateTime } from '../../lib/time';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchMenuItems, menuItemsKey } from '../menu/api';
import { billsKey, editBill, fetchBill, fetchBillByNumber, refundBill, searchBills, softDeleteBill, voidBill } from './api';
import { diffText, editTotals, refundProblem, refundState } from './rules';
import type { Bill } from './types';

const inr = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;
const refresh = (qc: ReturnType<typeof useQueryClient>) => { void qc.invalidateQueries({ queryKey: billsKey }); void qc.invalidateQueries({ queryKey: ['shift'] }); void qc.invalidateQueries({ queryKey: ['active-orders'] }); };

/** Correct a bill: details, items and discount / tax. A reason is required (it goes to the audit log). */
export function EditBillDialog({ billId, onClose }: { billId: number; onClose: () => void }) {
  const q = useQuery({ queryKey: [...billsKey, 'one', billId], queryFn: () => fetchBill(billId), staleTime: 0, gcTime: 0 });
  const dishes = useQuery({ queryKey: menuItemsKey, queryFn: fetchMenuItems });
  if (q.isPending) return <Dialog id="editBillModal" open onClose={onClose} size="lg" title="Edit bill"><p className="text-sm text-muted py-6 text-center">Loading bill…</p></Dialog>;
  if (q.isError) return <Dialog id="editBillModal" open onClose={onClose} size="lg" title="Edit bill"><p className="text-sm text-danger py-4">Failed to load bill for editing: {q.error.message}</p></Dialog>;
  return <EditForm bill={q.data} dishes={(dishes.data ?? []).filter((m) => m.isAvailable !== false && m.active !== false).sort((a, b) => a.name.localeCompare(b.name))} onClose={onClose} />;
}

function EditForm({ bill, dishes, onClose }: { bill: Bill; dishes: { id: number; name: string; price: number }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [table, setTable] = useState(bill.tableNumber || '');
  const [customer, setCustomer] = useState(bill.customerName || '');
  const [mode, setMode] = useState(bill.paymentMode || 'CASH');
  const [discount, setDiscount] = useState(String(bill.discountPercent ?? 0));
  const [tax, setTax] = useState(String(bill.taxPercent ?? 0));
  const [notes, setNotes] = useState(bill.notes || '');
  const [items, setItems] = useState(bill.items.map((i) => ({ menuItemId: i.menuItemId, itemName: i.itemName, quantity: i.quantity || 1, price: i.price || 0 })));
  const [add, setAdd] = useState('');
  const t = editTotals(items, parseFloat(discount) || 0, parseFloat(tax) || 0, bill.netAmount || 0);
  const save = useMutation({ mutationFn: () => editBill(bill.id, { tableNumber: table.trim(), customerName: customer.trim(), paymentMode: mode, discountPercent: parseFloat(discount) || 0, taxPercent: parseFloat(tax) || 0, notes: notes.trim(), items }), onSuccess: () => { showToast('Bill & items updated successfully; audit log recorded', 'success'); void qc.invalidateQueries({ queryKey: ['audit-logs'] }); refresh(qc); onClose(); }, onError: (e: Error) => showToast(`Failed to update bill: ${e.message}`, 'error') });

  const setQty = (i: number, q: number) => setItems((xs) => (q <= 0 ? removeAt(xs, i) : xs.map((x, k) => (k === i ? { ...x, quantity: q } : x))));
  const removeAt = (xs: typeof items, i: number) => { if (xs.length <= 1 && !window.confirm('This is the only item in the bill. Removing it will leave the bill empty. Are you sure?')) return xs; return xs.filter((_, k) => k !== i); };
  const addDish = () => {
    const d = dishes.find((x) => String(x.id) === add);
    if (!d) { showToast('Please select a dish to add', 'warning'); return; }
    const ex = items.findIndex((x) => x.menuItemId === d.id || x.itemName.toLowerCase() === d.name.toLowerCase());
    if (ex >= 0) { setItems((xs) => xs.map((x, k) => (k === ex ? { ...x, quantity: x.quantity + 1 } : x))); showToast(`Increased quantity for ${d.name}`, 'info'); }
    else { setItems((xs) => [...xs, { menuItemId: d.id, itemName: d.name, quantity: 1, price: d.price }]); showToast(`Added ${d.name} to bill`, 'success'); }
    setAdd('');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { showToast('Bill must contain at least one item', 'error'); return; }
    if (!notes.trim()) { showToast('Please provide a reason for editing the bill (required for audit trail)', 'warning'); document.getElementById('editBillNotes')?.focus(); return; }
    save.mutate(undefined);
  };
  return (
    <Dialog id="editBillModal" open onClose={onClose} size="lg" title="Edit bill" description={<span id="editBillSubtitle">Editing Bill #{bill.billNumber} (original net: {inr(bill.netAmount)})</span>}>
      <form id="editBillForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field id="editBillTable" label="Table number"><input id="editBillTable" value={table} onChange={(e) => setTable(e.target.value)} className="input" placeholder="e.g. T-01, Takeaway" /></Field>
          <Field id="editBillCustomer" label="Customer name"><input id="editBillCustomer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="input" placeholder="Optional customer name" /></Field>
          <Field id="editBillPaymentMode" label="Payment mode"><select id="editBillPaymentMode" value={mode} onChange={(e) => setMode(e.target.value)} className="input"><option>CASH</option><option>UPI</option><option>CARD</option></select></Field>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-fg">Items <span id="editBillItemsCount" className="text-muted font-normal">· {items.length} {items.length === 1 ? 'item' : 'items'}</span></p></div>
          <div className="flex gap-2"><select id="editBillAddSelect" value={add} onChange={(e) => setAdd(e.target.value)} className="input flex-1" aria-label="Dish to add"><option value="">-- Select dish to add --</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name} (₹{d.price.toFixed(2)})</option>)}</select><button type="button" id="btnEditBillAddDish" onClick={addDish} className="btn btn-secondary"><i className="fa-solid fa-plus" />Add</button></div>
          <div id="editBillItemsList" className="space-y-2">{items.length === 0 ? <p className="text-center text-sm text-muted py-5 border border-dashed border-line rounded-lg">No dishes in this bill. Use the list above to add dishes.</p> : items.map((it, i) => (
            <div key={`${it.itemName}-${i}`} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-fg truncate">{it.itemName}</p><p className="text-xs text-muted font-mono">₹{it.price.toFixed(2)} each</p></div>
              <div className="flex items-center gap-1"><button type="button" onClick={() => setQty(i, it.quantity - 1)} aria-label={`Fewer ${it.itemName}`} className="btn btn-secondary btn-icon btn-sm"><i className="fa-solid fa-minus text-[10px]" /></button>
                <input type="number" min={1} max={99} value={it.quantity} onChange={(e) => setQty(i, parseInt(e.target.value, 10) || 0)} aria-label={`Quantity of ${it.itemName}`} className="input w-14 h-8 text-center font-mono px-1" />
                <button type="button" onClick={() => setQty(i, it.quantity + 1)} aria-label={`More ${it.itemName}`} className="btn btn-secondary btn-icon btn-sm"><i className="fa-solid fa-plus text-[10px]" /></button></div>
              <p className="w-20 text-right font-mono font-semibold text-brand-text text-sm">₹{(it.price * it.quantity).toFixed(2)}</p>
              <button type="button" onClick={() => setItems((xs) => removeAt(xs, i))} title="Remove item" aria-label={`Remove ${it.itemName}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-solid fa-trash-can text-xs" /></button>
            </div>))}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="editBillDiscount" label="Discount (%)"><input id="editBillDiscount" type="number" min="0" max="100" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" placeholder="0" /></Field>
          <Field id="editBillTax" label="Tax / GST (%)"><input id="editBillTax" type="number" min="0" step="any" value={tax} onChange={(e) => setTax(e.target.value)} className="input" placeholder="0" /></Field>
        </div>
        <div className="rounded-lg bg-brand/10 px-3 py-2.5 text-sm space-y-1"><p className="flex justify-between"><span className="text-muted">Subtotal</span><span id="editBillCalcSubtotal" className="font-semibold">{inr(t.subtotal)}</span></p>
          <p className="flex justify-between items-center"><span className="text-muted">New net amount</span><span><span id="editBillCalcNet" className="font-semibold text-fg">{inr(t.net)}</span> <span id="editBillDiffBadge" className={`text-xs font-mono font-semibold ${t.diff > 0 ? 'text-ok' : 'text-danger'}`}>{diffText(t.diff)}</span></span></p></div>
        <Field id="editBillNotes" label="Reason for the change (required, kept in the audit log)"><textarea id="editBillNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-auto py-2" placeholder="e.g. Corrected 3 coffees to 2; replaced dish as requested by guest" /></Field>
        <button type="submit" id="saveEditBillBtn" disabled={save.isPending} className="btn btn-primary w-full h-10"><i className="fa-solid fa-floppy-disk" />{save.isPending ? 'Saving changes…' : 'Save bill changes & record audit'}</button>
      </form>
    </Dialog>
  );
}

/** Refund a paid bill (full or part). Opened for one bill from the log, or empty with a lookup box. */
export function RefundDialog({ billId, onClose }: { billId: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone: string; list?: Bill[] } | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [reason, setReason] = useState('');

  const load = (b: Bill) => { setBill(b); const r = refundState(b); setAmount(r.remaining > 0 ? r.remaining.toFixed(2) : '0.00'); if (r.blocked === 'VOIDED') showToast('This bill was already voided and cannot be refunded.', 'warning'); };
  const initial = useQuery({ queryKey: [...billsKey, 'refund', billId], queryFn: () => fetchBill(billId!), enabled: billId != null && !loaded, staleTime: 0, gcTime: 0 });
  if (initial.data && !loaded) { setLoaded(true); load(initial.data); }

  const lookup = async () => {
    const q = search.trim();
    if (!q) { setFeedback({ text: 'Please enter a Bill Number or Customer Name to search.', tone: 'text-warn' }); return; }
    setFeedback({ text: 'Searching bill records...', tone: 'text-muted' });
    try {
      let found: Bill | null = null;
      try { found = await fetchBillByNumber(q); } catch { /* not an exact number */ }
      if (found) { load(found); setFeedback({ text: `Found Bill ${found.billNumber}!`, tone: 'text-ok' }); return; }
      const list = (await searchBills(q)) || [];
      if (list.length === 1) { load(list[0]); setFeedback({ text: `Found Bill ${list[0].billNumber}!`, tone: 'text-ok' }); }
      else if (list.length > 1) setFeedback({ text: `Found ${list.length} matching bills. Click one to select:`, tone: 'text-warn', list: list.slice(0, 5) });
      else setFeedback({ text: `No bill found matching "${q}". Check the number on the customer receipt.`, tone: 'text-danger' });
    } catch (e) { setFeedback({ text: `Error searching: ${e instanceof Error ? e.message : e}`, tone: 'text-danger' }); }
  };
  const state = bill ? refundState(bill) : null;
  const save = useMutation({ mutationFn: () => refundBill(bill!.id, parseFloat(amount), mode, reason.trim()), onSuccess: () => { showToast(`Refund of ₹${parseFloat(amount).toFixed(2)} processed successfully`, 'success'); refresh(qc); onClose(); }, onError: (e: Error) => showToast(`Refund failed: ${e.message}`, 'error') });
  const submit = (e: FormEvent) => { e.preventDefault(); if (!bill || !state) return; const p = refundProblem(parseFloat(amount), state.remaining, reason); if (p) { showToast(p, 'warning'); return; } save.mutate(undefined); };

  return (
    <Dialog id="billRefundModal" open onClose={onClose} size="md" title="Refund customer bill" description={<span id="refundBillRef">{bill ? bill.billNumber : 'Look up the bill or enter details'}</span>}>
      <form id="refundForm" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><label htmlFor="refundSearchInput" className="label">Quick bill lookup (bill # or customer name / phone)</label>
          <div className="flex gap-2"><input id="refundSearchInput" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookup(); } }} className="input flex-1" placeholder="e.g. NRM-2026... or customer name" /><button type="button" id="btnRefundSearch" onClick={() => void lookup()} className="btn btn-secondary"><i className="fa-solid fa-magnifying-glass" />Search</button></div>
          {feedback && <div id="refundSearchFeedback" className={`text-xs ${feedback.tone}`}>{feedback.text}{feedback.list && <div className="mt-1 space-y-1 max-h-28 overflow-y-auto">{feedback.list.map((b) => <button type="button" key={b.id} onClick={() => { load(b); setFeedback({ text: `Loaded ${b.billNumber}`, tone: 'text-ok' }); }} className="w-full flex justify-between gap-2 rounded bg-subtle hover:bg-line px-2 py-1.5 text-left text-xs text-fg"><span className="font-medium">{b.billNumber} ({b.customerName || b.orderType})</span><span className="font-mono text-brand-text">{inr(b.netAmount)} · {formatISTDateTime(b.createdAt)}</span></button>)}</div>}</div>}</div>
        <div className="rounded-lg border border-line p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2"><p id="refundBillDisplayNumber" className="font-semibold text-fg">{bill ? bill.billNumber : 'No bill selected'}</p>
            <Badge tone={!bill ? 'warn' : state?.blocked ? 'neutral' : 'ok'}><span id="refundOrderStatusBadge">{!bill ? 'LOOKUP BILL' : state?.blocked === 'VOIDED' ? 'VOIDED BILL' : state?.blocked === 'FULLY_REFUNDED' ? 'FULLY REFUNDED' : bill.paymentStatus || 'PAID'}</span></Badge></div>
          <p id="refundBillMeta" className="text-xs text-muted">{bill ? `${bill.orderType === 'TABLE' ? `Table ${bill.tableNumber || '-'}` : bill.orderType === 'OUTDOOR' ? `Outdoor token #${bill.outdoorToken || '-'}` : 'Takeaway / dine-out'}${bill.customerName ? ` (${bill.customerName})` : ''} • Billed: ${formatISTDateTime(bill.createdAt || bill.billedAt)}` : 'Type the bill number or customer name above to find any dine-in or takeaway receipt.'}</p>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded bg-subtle p-2"><p className="text-[11px] text-muted">Original</p><p id="refundOriginalNet" className="font-semibold">{inr(bill?.netAmount)}</p></div><div className="rounded bg-subtle p-2"><p className="text-[11px] text-muted">Refunded</p><p id="refundAlreadyRefunded" className="font-semibold text-danger">{inr(bill?.totalRefunded)}</p></div><div className="rounded bg-subtle p-2"><p className="text-[11px] text-muted">Remaining</p><p id="refundRemainingBalance" className="font-semibold text-ok">{inr(state?.remaining)}</p></div></div>
          {bill && bill.items.length > 0 && <div id="refundBillItemsList" className="text-xs text-muted space-y-0.5 pt-1">{bill.items.map((i, k) => <p key={k} className="flex justify-between"><span>{i.menuItemName || i.itemName || 'Item'} × {i.quantity}</span><span className="font-mono">{inr(i.totalPrice ?? i.subtotal)}</span></p>)}</div>}
        </div>
        <Field id="refundAmountInput" label="Refund amount (₹) *"><input id="refundAmountInput" type="number" step="0.01" min="0" max={state?.remaining} value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="Enter refund amount" /></Field>
        <Field id="refundPaymentModeSelect" label="Refund payment mode *"><select id="refundPaymentModeSelect" value={mode} onChange={(e) => setMode(e.target.value)} className="input"><option value="CASH">Cash (deducted from register drawer)</option><option value="UPI">UPI / online</option><option value="CARD">Card</option></select></Field>
        <Field id="refundReasonInput" label="Mandatory refund reason *"><textarea id="refundReasonInput" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input h-auto py-2" placeholder="Specify reason (e.g. customer returned takeaway order, incorrect item)…" /></Field>
        <button type="submit" id="refundSubmitBtn" disabled={!bill || !!state?.blocked || save.isPending} className="btn btn-danger w-full h-10"><i className="fa-solid fa-rotate-left" />{save.isPending ? 'Processing…' : 'Process refund'}</button>
      </form>
    </Dialog>
  );
}

/** Void an unpaid active order; the record is kept for audit. */
export function VoidOrderDialog({ bill, onClose }: { bill: { id: number; billNumber: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [prepared, setPrepared] = useState(false);
  const save = useMutation({ mutationFn: () => voidBill(bill.id, reason.trim(), prepared), onSuccess: () => { showToast('Order voided successfully with audit log', 'success'); refresh(qc); onClose(); }, onError: (e: Error) => showToast(`Failed to void order: ${e.message}`, 'error') });
  return (
    <Dialog id="voidOrderModal" open onClose={onClose} size="sm" title="Void active order" description={<>Voiding cancels an unpaid order and keeps the record for auditing. <span id="voidOrderRef" className="font-medium text-fg">{bill.billNumber}</span></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) { showToast('A void reason is required', 'warning'); return; } save.mutate(undefined); }} className="space-y-4">
        <Field id="voidReasonInput" label="Mandatory void reason *"><textarea id="voidReasonInput" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input h-auto py-2" placeholder="Specify reason for cancellation…" /></Field>
        <label htmlFor="voidFoodPreparedCheck" className="flex items-start gap-2 text-sm text-fg cursor-pointer"><input id="voidFoodPreparedCheck" type="checkbox" checked={prepared} onChange={(e) => setPrepared(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" /><span>The food was already prepared<span className="block text-xs text-muted">Recorded as wastage in the audit trail.</span></span></label>
        <button type="submit" id="btnConfirmVoid" disabled={save.isPending} className="btn btn-danger w-full h-10"><i className="fa-solid fa-ban" />{save.isPending ? 'Voiding…' : 'Void order'}</button>
      </form>
    </Dialog>
  );
}

/** Delete one of the 5 newest closed bills: it leaves the Bill Log and sales totals, and is kept in the audit log with the reason. */
export function DeleteBillDialog({ bill, onClose }: { bill: { id: number; billNumber: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const save = useMutation({ mutationFn: () => softDeleteBill(bill.id, reason.trim()), onSuccess: () => { showToast('Bill deleted and recorded in the audit log', 'success'); void qc.invalidateQueries({ queryKey: ['audit-logs'] }); refresh(qc); onClose(); }, onError: (e: Error) => showToast(`Failed to delete bill: ${e.message}`, 'error') });
  return (
    <Dialog id="deleteBillModal" open onClose={onClose} size="sm" title="Delete bill" description={<span id="deleteBillRef">Bill #{bill.billNumber}</span>}>
      <form id="deleteBillForm" onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) { showToast('A reason is required to delete a bill', 'error'); return; } save.mutate(undefined); }} className="space-y-4">
        <p className="text-xs text-muted">The bill is removed from the Bill Log and from sales totals. It is not erased: it is recorded in the Admin Audit with your name and the reason.</p>
        <Field id="deleteBillReason" label="Reason for deleting *"><textarea id="deleteBillReason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="input h-auto py-2" placeholder="Why is this bill being deleted?" /></Field>
        <div className="flex gap-2"><button type="button" onClick={onClose} className="btn btn-secondary flex-1 h-10">Cancel</button><button type="submit" id="deleteBillSubmitBtn" disabled={save.isPending} className="btn btn-danger flex-1 h-10"><i className="fa-solid fa-trash-can" />{save.isPending ? 'Deleting…' : 'Delete bill'}</button></div>
      </form>
    </Dialog>
  );
}
