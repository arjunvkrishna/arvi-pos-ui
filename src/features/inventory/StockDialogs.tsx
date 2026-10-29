import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/ui';
import { issueStock, sendStockAlert, type InventoryItem } from './api';
import { useInventoryAction } from './hooks';
import { REASON_TYPES, fmtNum, issuePreview, packBreakdown, packNameOf, packSizeOf } from './rules';

/** "Issue stock": remove a quantity (units, or packs when the item has them) with an optional reason. */
export function IssueStockDialog({ item, initial, onClose }: { item: InventoryItem; initial?: { qty: number; reasonType: string }; onClose: () => void }) {
  const [qty, setQty] = useState(initial ? String(initial.qty) : '');
  const [reason, setReason] = useState('');
  const [reasonType, setReasonType] = useState(initial?.reasonType ?? 'USAGE');
  const [inPacks, setInPacks] = useState(false);
  const [allowShort, setAllowShort] = useState(false);
  const [error, setError] = useState('');
  const issue = useInventoryAction((v: { q: number }) => issueStock(item.id, v.q, reason.trim(), inPacks, reasonType, allowShort), 'Stock issued successfully', 'Failed to issue stock', false);
  const ps = packSizeOf(item);
  const brk = packBreakdown(item, item.quantity);

  const q = parseFloat(qty);
  let preview: { text: string; bad: boolean } | null = null;
  let shortBy = 0;
  if (q > 0) {
    const { used, left } = issuePreview(item, q, inPacks);
    shortBy = left < 0 ? left : 0;
    preview = left < 0
      ? { text: `Only ${fmtNum(item.quantity)} ${item.unit} in stock. Recording it anyway takes the stock to ${fmtNum(left)} ${item.unit} until the purchase is entered.`, bad: true }
      : { text: `Issuing ${fmtNum(used)} ${item.unit} → ${fmtNum(left)} ${item.unit} left${packBreakdown(item, left) ? ` (${packBreakdown(item, left)})` : ''}`, bad: false };
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (isNaN(q) || q <= 0) { setError('Please enter a valid quantity greater than zero.'); return; }
    if (shortBy < 0 && !allowShort) { setError('There is not that much in stock. Tick "Record it anyway" if the purchase was not entered yet.'); return; }
    issue.mutate({ q }, { onSuccess: onClose, onError: (err) => setError(err.message) });
  };

  return (
    <Dialog id="decreaseStockModal" open onClose={onClose} size="sm" title="Issue stock"
      description={<><span id="decreaseStockItemName" className="font-medium text-fg">{item.name}</span><br /><span id="decreaseStockAvailable">Available in stock: {fmtNum(item.quantity)} {item.unit}{brk ? ` (${brk})` : ''}</span></>}>
      <form id="decreaseStockForm" onSubmit={submit} className="space-y-4">
        <div className={ps ? 'grid grid-cols-2 gap-3' : ''}>
          <Field id="decreaseStockQty" label="Quantity to issue *">
            <input id="decreaseStockQty" required autoFocus type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="input" placeholder="e.g. 5" />
          </Field>
          {ps > 0 && (
            <Field id="decreaseStockUnit" label="Unit">
              <select id="decreaseStockUnit" value={inPacks ? 'PACK' : 'UNIT'} onChange={(e) => setInPacks(e.target.value === 'PACK')} className="input">
                <option value="UNIT">{item.unit}</option>
                <option value="PACK">{packNameOf(item)} (= {fmtNum(ps)} {item.unit})</option>
              </select>
            </Field>
          )}
        </div>
        <p id="decreaseStockPreview" className={`text-sm min-h-5 ${preview?.bad ? 'text-danger' : 'text-brand-text'}`}>{preview?.text}</p>
        <Field id="decreaseStockReasonType" label="Why">
          <select id="decreaseStockReasonType" value={reasonType} onChange={(e) => setReasonType(e.target.value)} className="input">
            {REASON_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field id="decreaseStockReason" label="Reason / notes">
          <input id="decreaseStockReason" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="e.g. Kitchen daily prep, Spoiled, Usage" />
        </Field>
        {shortBy < 0 && (
          <label htmlFor="decreaseStockAllowNegative" className="flex items-start gap-2.5 text-sm text-fg cursor-pointer select-none rounded-lg bg-warn/10 px-3 py-2.5">
            <input id="decreaseStockAllowNegative" type="checkbox" checked={allowShort} onChange={(e) => setAllowShort(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span><span className="font-medium">Record it anyway</span><span className="block text-xs text-muted">The purchase was not entered yet. The stock shows as a negative number until it is added.</span></span>
          </label>
        )}
        {error && <p id="decreaseStockError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={issue.isPending} className="btn btn-danger w-full h-10">{issue.isPending ? 'Issuing…' : 'Issue stock'}</button>
      </form>
    </Dialog>
  );
}

const DEFAULT_NOTE = 'Running very low on stock. Please order fresh supplies soon.';

/** "Alert manager": sends a low-stock notification for one item with an optional note. */
export function AlertManagerDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [note, setNote] = useState(DEFAULT_NOTE);
  const send = useInventoryAction(() => sendStockAlert(item, note.trim()), `Low stock alert sent to Manager for ${item.name}`, 'Failed to notify manager');
  return (
    <Dialog id="stockAlertModal" open onClose={onClose} size="sm" title="Notify the manager"
      description={`${item.name}: current ${fmtNum(item.quantity)} ${item.unit}, minimum ${fmtNum(item.minQuantity)} ${item.unit}.`}>
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(undefined, { onSuccess: onClose }); }} className="space-y-4">
        <Field id="stockAlertNote" label="Optional message to the manager">
          <textarea id="stockAlertNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input h-auto py-2" />
        </Field>
        <button type="submit" id="btnSendStockAlert" disabled={send.isPending} className="btn btn-primary w-full h-10"><i className="fa-solid fa-paper-plane" />{send.isPending ? 'Sending…' : 'Send alert'}</button>
      </form>
    </Dialog>
  );
}
