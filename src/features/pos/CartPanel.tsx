import { canCancelOrder, hasFeature } from '../../api/roles';
import { useSession } from '../../api/session';
import type { Bill } from '../bills/types';
import { Badge } from '../../components/ui';
import { useBump } from '../../components/useBump';
import { BillLines } from './BillLines';
import { dishCount, formatModifiersSnapshot } from './billText';
import { VegDot } from './DishGrid';
import { discountPending, statusLabel, type CartLine, type Draft, type Gates, type Mode, type Totals } from './rules';

const inr = (n: number) => `₹${n.toFixed(2)}`;

const MODES: { mode: Mode; id: string; label: string; icon: string }[] = [
  { mode: 'TABLE', id: 'btnOrderLocTable', label: 'Table', icon: 'fa-chair' },
  { mode: 'OUTDOOR', id: 'btnOrderLocOutdoor', label: 'Outdoor', icon: 'fa-tree' },
  { mode: 'TAKEAWAY', id: 'btnOrderLocTakeaway', label: 'Takeaway', icon: 'fa-bag-shopping' },
];

export interface CartVm {
  mode: Mode; table: string; tables: string[]; order: Bill | null; draft: Draft; totals: Totals; gates: Gates; token: string;
  isManager: boolean; canPrintBill: boolean; gstOptions: string[]; busy: { save: boolean; kot: boolean };
  patch: (p: Partial<Draft>) => void; setLine: (i: number, p: Partial<CartLine>) => void; removeLine: (i: number) => void;
  onMode: (m: Mode) => void; onTable: (t: string) => void; onClear: () => void; onAddTable: () => void; onDeleteTable: () => void; onMove: () => void; onReprint: () => void; reprinting: boolean;
  onApplyDiscount: () => void;
  onSave: () => void; onKot: () => void; onRequest: () => void; onPrint: () => void; onConfirm: () => void; onClose: () => void;
}

/** The order being built: where it is for, its dishes, the totals and the action buttons for the next step of the flow. */
export function CartPanel(v: CartVm) {
  const user = useSession((s) => s.user);
  // Cancelling a saved order is a right of its own (managers always have it); clearing a cart that is not saved yet is for everyone.
  const mayCancel = !v.order || (!!user && canCancelOrder(user));
  // loyalty members belong to the customers module: a plan without it takes no phone number with the order
  const loyaltyInPlan = !user || hasFeature(user, 'CRM');
  const { order, draft, totals, gates, mode, isManager, canPrintBill } = v;
  const pendingDiscount = discountPending(draft);
  const printed = order?.status === 'BILL_PRINTED';
  const totalRef = useBump<HTMLSpanElement>(printed ? order?.netAmount ?? 0 : totals.net);
  const st = order ? statusLabel(order, mode, 'badge') : null;
  const place = mode === 'TABLE' ? 'TABLE SEATING' : mode === 'OUTDOOR' ? 'OUTDOOR SEATING' : 'TAKEAWAY / PARCEL';
  return (
    <div className="card flex flex-col max-h-full lg:max-h-[calc(100vh-6.5rem)] min-h-0">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <h2 className="font-semibold text-fg flex items-center gap-2"><i className="fa-solid fa-receipt text-brand-text" />Current order</h2>
          <p id="currentOrderLocationLabel" className="text-[11px] font-semibold text-muted tracking-wide">{place}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {st && st.text && <span id="orderStatusBadge" className={`badge badge-${st.tone} ${st.pulse ? 'animate-pulse' : ''}`}>{st.text}</span>}
            {order && <span id="currentBillRefNo" className="text-xs text-muted font-mono">Ref: {order.billNumber}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" id="btnMoveOrder" onClick={v.onMove} className="btn btn-ghost btn-sm" title="Transfer this order to another table, outdoor or takeaway"><i className="fa-solid fa-right-left" />Transfer</button>
          {mayCancel && <button type="button" id="btnClearCart" onClick={v.onClear} className="btn btn-soft-danger btn-sm" title={order ? 'Cancel this order' : 'Clear the cart'}><i className="fa-regular fa-trash-can" />{order ? 'Cancel' : 'Clear'}</button>}
          <button type="button" onClick={v.onClose} aria-label="Close order" className="btn btn-ghost btn-icon btn-sm lg:hidden"><i className="fa-solid fa-xmark" /></button>
        </div>
      </div>

      <div className="px-4 pb-2 space-y-2.5 overflow-y-auto min-h-0">
        <div id="orderLocationToggle" role="group" aria-label="Order type" className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-subtle">
          {MODES.map((m) => (
            <button type="button" key={m.mode} id={m.id} onClick={() => v.onMode(m.mode)} aria-pressed={mode === m.mode}
              className={`h-8 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition ${mode === m.mode ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}>
              <i className={`fa-solid ${m.icon} text-[10px]`} />{m.label}
            </button>
          ))}
        </div>

        {mode === 'TABLE' && (
          <div id="cartTableSelectSection" className="flex items-center gap-1.5">
            <select id="cartTableNo" aria-label="Table" value={v.table} onChange={(e) => v.onTable(e.target.value)} className="input flex-1 min-w-0">
              <option value="">-- Select Table (Required) --</option>
              {v.tables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {isManager && <button type="button" id="btnAddTableCart" onClick={v.onAddTable} className="btn btn-secondary btn-icon" title="Add table" aria-label="Add table"><i className="fa-solid fa-plus" /></button>}
            {isManager && v.table && <button type="button" id="btnDeleteTableCart" onClick={v.onDeleteTable} className="btn btn-soft-danger btn-icon" title="Delete this table" aria-label="Delete this table"><i className="fa-solid fa-trash-can" /></button>}
          </div>
        )}
        {mode === 'OUTDOOR' && <TokenBanner id="cartOutdoorTokenSection" display="cartOutdoorTokenDisplay" icon="fa-tree" value={v.token} />}
        {mode === 'TAKEAWAY' && <TokenBanner id="cartTakeawayTokenSection" display="cartTakeawayTokenDisplay" icon="fa-bag-shopping" value={v.token} />}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label id="cartCustomerLabel" htmlFor="cartCustomer" className="label">{mode === 'OUTDOOR' ? <>Customer name <span className="text-danger">*</span></> : 'Customer (optional)'}</label>
            <input id="cartCustomer" value={draft.customer} onChange={(e) => v.patch({ customer: e.target.value })} placeholder={mode === 'OUTDOOR' ? 'Mandatory customer name' : mode === 'TAKEAWAY' ? 'Guest / customer name' : 'Optional'} className="input" autoComplete="off" disabled={printed} />
          </div>
          <div>
            <label htmlFor="cartOrderNotes" className="label">Order note</label>
            <input id="cartOrderNotes" value={draft.notes} onChange={(e) => v.patch({ notes: e.target.value })} placeholder="Optional" className="input" autoComplete="off" disabled={printed} />
          </div>
        </div>
        {loyaltyInPlan && (
          <div>
            <label htmlFor="cartCustomerPhone" className="label"><i className="fa-solid fa-star text-amber-500 mr-1" />Phone for loyalty points (optional)</label>
            <input id="cartCustomerPhone" type="tel" inputMode="numeric" autoComplete="off" maxLength={13} value={draft.phone} onChange={(e) => v.patch({ phone: e.target.value.replace(/[^\d+ ]/g, '') })}
              placeholder="Customer's 10-digit number" className="input font-mono" disabled={printed} />
            {order?.customerId && order.customerPoints != null && (
              <p id="cartMemberChip" className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span className="font-semibold text-fg">{order.customerName || 'Member'}</span>
                <Badge tone="ok">{order.customerPoints} pts</Badge>
                {order.customerPoints > 0 && order.customerPointsExpireAt && <span>valid till {order.customerPointsExpireAt}</span>}
              </p>
            )}
          </div>
        )}
        {order?.createdByName && <p id="orderStaffContainer" className="text-xs text-muted"><i className="fa-solid fa-user-tag mr-1.5" />Staff: <strong id="orderStaffName" className="text-fg">{order.createdByName}</strong></p>}

        <div id="cartItemsList" className="space-y-2">
          {printed ? (
            <>
              <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-warn/10 text-warn text-sm font-medium"><i className="fa-solid fa-receipt" />Bill #{order?.billNumber} printed • awaiting payment</div>
              <section id="cartPrintedItems" aria-label="What was ordered" className="rounded-lg border border-line">
                <h3 className="flex items-center justify-between px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted"><span>What was ordered</span><span id="cartPrintedItemCount">{dishCount(order?.items)} item{dishCount(order?.items) === 1 ? '' : 's'}</span></h3>
                <BillLines items={order?.items} id="cartPrintedItemsList" className="px-3 pb-1" />
              </section>
            </>
          ) : draft.cart.length === 0 ? (
            <p className="text-center py-4 text-sm text-muted"><i className="fa-solid fa-basket-shopping mr-2 text-faint" />No items added to order</p>
          ) : draft.cart.map((c, i) => {
            const parcel = mode === 'TAKEAWAY' || c.isTakeaway;
            return (
              <div key={`${c.item.id}-${c.isTakeaway ? 'p' : 'd'}-${c.modifiersSnapshot || ''}-${c.comboSnapshot || ''}`} className="rounded-lg border border-line p-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-fg flex items-center gap-1.5 flex-wrap"><VegDot veg={c.item.isVeg} /><span className="truncate">{c.item.name}</span>{parcel && <Badge tone="brand">PARCEL</Badge>}</p>
                    {(c.modifiersDescription || c.modifiersSnapshot || c.comboSnapshot) && (
                      <p className="text-[11px] text-brand-text font-medium bg-brand/10 rounded px-1.5 py-0.5 inline-block my-0.5">
                        {c.modifiersDescription || formatModifiersSnapshot(c.modifiersSnapshot, c.comboSnapshot)}
                      </p>
                    )}
                    <p className="text-xs text-muted">{inr(c.item.price)} each</p>
                  </div>
                  <span className="font-semibold text-sm text-fg shrink-0">{inr(c.item.price * c.quantity)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-line-strong">
                    <button type="button" aria-label={`Decrease ${c.item.name}`} onClick={() => v.setLine(i, { quantity: c.quantity - 1 })} className="w-9 h-9 sm:w-8 sm:h-8 text-lg leading-none text-muted hover:text-fg">−</button>
                    <span className="w-7 text-center text-sm font-semibold" aria-label={`Quantity ${c.quantity}`}>{c.quantity}</span>
                    <button type="button" aria-label={`Increase ${c.item.name}`} onClick={() => v.setLine(i, { quantity: c.quantity + 1 })} className="w-9 h-9 sm:w-8 sm:h-8 text-lg leading-none text-muted hover:text-fg">+</button>
                  </div>
                  <input value={c.customization} onChange={(e) => v.setLine(i, { customization: e.target.value })} placeholder="Note (e.g. less sugar)" aria-label={`Note for ${c.item.name}`} className="input h-9 text-sm flex-1 min-w-0" />
                  {mode !== 'TAKEAWAY' && (
                    <button type="button" onClick={() => v.setLine(i, { isTakeaway: !c.isTakeaway })} className={`btn btn-sm shrink-0 ${c.isTakeaway ? 'btn-soft-brand' : 'btn-secondary'}`} title="Switch between dine-in and parcel"><i className={`fa-solid ${c.isTakeaway ? 'fa-box' : 'fa-utensils'}`} />{c.isTakeaway ? 'Parcel' : 'Dine-in'}</button>
                  )}
                  <button type="button" aria-label={`Remove ${c.item.name}`} title="Remove item" onClick={() => v.removeLine(i)} className="btn btn-ghost btn-icon btn-sm text-danger shrink-0"><i className="fa-regular fa-trash-can" /></button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={v.onClose} className="lg:hidden btn btn-secondary w-full"><i className="fa-solid fa-plus text-brand-text" />Add more menu items</button>

      </div>

      <div className="px-4 pt-2 pb-4 shrink-0 border-t border-line safe-bottom">
        <div className="space-y-1.5 text-sm pb-3">
          <Line label="Subtotal"><span id="cartSubtotal">{inr(printed ? order?.subtotal ?? 0 : totals.subtotal)}</span></Line>
          {printed && Number(order?.discountAmount) > 0 && <Line label={`Discount${order?.discountPercent ? ` (${order.discountPercent}%)` : ''}`}><span id="cartPrintedDiscount">-{inr(Number(order?.discountAmount))}</span></Line>}
          {printed && Number(order?.promotionDiscountAmount) > 0 && <Line label={`Promotion${order?.promotionName ? `: ${order.promotionName}` : ''}`}><span id="cartPrintedPromotion">-{inr(Number(order?.promotionDiscountAmount))}</span></Line>}
          {!printed && (isManager || canPrintBill) && (
            <>
              <Line label="Discount">
                <span className="inline-flex items-center gap-1.5">
                  <input id="cartDiscountPct" type="number" min={0} max={100} value={draft.discountInput} onChange={(e) => v.patch({ discountInput: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); v.onApplyDiscount(); } }} aria-label="Discount percent" aria-invalid={pendingDiscount} className={`input h-8 w-16 text-right px-2 ${pendingDiscount ? 'border-warn' : ''}`} />%
                  <button type="button" id="btnSaveDiscount" onClick={v.onApplyDiscount} disabled={!pendingDiscount} title={pendingDiscount ? 'Apply this discount to the bill' : 'Discount applied'} className="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"><i className="fa-solid fa-check" />Save</button>
                </span>
              </Line>
              {pendingDiscount && <p id="cartDiscountPending" role="alert" className="text-xs text-warn text-right -mt-0.5">Discount not applied yet. Click Save to apply it.</p>}
            </>
          )}
          {!printed && !isManager && !canPrintBill && order && (order.discountPercent ?? 0) > 0 && <Line label="Discount"><span id="cartStaffDiscount" className="text-ok">{order.discountPercent}%</span></Line>}
          {!printed && isManager ? (
            <Line label="GST">
              <span className="inline-flex items-center gap-1.5">
                <select id="cartGstSelect" value={draft.gstSel} onChange={(e) => v.patch({ gstSel: e.target.value })} aria-label="GST rate" className="input h-8 w-auto px-2 py-0">
                  {v.gstOptions.map((o) => <option key={o} value={o}>{o}%</option>)}<option value="custom">Custom</option>
                </select>
                {draft.gstSel === 'custom' && <input id="cartGstCustom" type="number" min={0} max={100} step={0.5} value={draft.gstCustom} onChange={(e) => v.patch({ gstCustom: e.target.value })} aria-label="Custom GST percent" className="input h-8 w-16 text-right px-2" placeholder="%" />}
                <span id="cartTax" className="font-medium w-16 text-right">{inr(totals.tax)}</span>
              </span>
            </Line>
          ) : (
            <Line label="Tax"><span id={printed ? 'cartTax' : 'cartStaffTax'}>{printed ? inr(order?.taxAmount ?? 0) : totals.gstPct > 0 ? `(${totals.gstPct}%) ${inr(totals.tax)}` : inr(0)}</span></Line>
          )}
          {(printed ? Number(order?.parcelCharge) > 0 : totals.hasParcel) && (
            <Line label={<span className="inline-flex items-center gap-1.5 text-brand-text font-medium"><i className="fa-solid fa-box-open" />Parcel charge</span>}>
              {printed ? <span id="cartParcelChargeRow">{inr(Number(order?.parcelCharge))}</span> : (
                <span id="cartParcelChargeRow" className="inline-flex items-center gap-1">₹<input id="cartParcelChargeInput" type="number" min={0} step={1} value={draft.parcel} onChange={(e) => v.patch({ parcel: e.target.value })} aria-label="Parcel charge" className="input h-8 w-20 text-right px-2" /></span>
              )}
            </Line>
          )}
          {printed && Math.abs(Number(order?.roundOff)) > 0.001 && <Line label="Round off"><span id="cartPrintedRoundOff">{Number(order?.roundOff) > 0 ? '+' : ''}{Number(order?.roundOff).toFixed(2)}</span></Line>}
          <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold text-fg">
            <span>Total payable</span><span id="cartTotal" ref={totalRef} className="text-brand-text text-lg inline-block origin-right">{inr(printed ? order?.netAmount ?? 0 : totals.net)}</span>
          </div>
        </div>
        {printed ? (
          <div id="posPendingPaymentContainer" className="space-y-2">
            {isManager ? (
              <div id="pendingPaymentManagerActions"><button type="button" id="btnConfirmPayment" onClick={v.onConfirm} className="btn btn-primary w-full h-11"><i className="fa-solid fa-circle-check" />CONFIRM PAYMENT</button></div>
            ) : (
              <p id="pendingPaymentStaffNotice" className="text-center text-xs text-muted bg-subtle rounded-lg p-2.5"><i className="fa-solid fa-circle-info mr-1.5" />Waiting for a manager or admin to confirm payment before new orders can be taken here.</p>
            )}
            <p className="flex items-center justify-between text-xs text-warn font-semibold gap-2"><span><i className="fa-solid fa-clock-rotate-left mr-1" />PENDING PAYMENT</span><span id="pendingPaymentOrderDetails" className="text-muted font-normal truncate">{mode === 'OUTDOOR' ? `Outdoor • ${order?.customerName || 'Guest'} (${order?.outdoorToken || 'OUT'}) • Bill #${order?.billNumber}` : mode === 'TAKEAWAY' ? `Takeaway • ${order?.takeawayToken || 'TAK'} • Bill #${order?.billNumber}` : `Table ${order?.tableNumber} • Bill #${order?.billNumber}`}</span><span id="pendingPaymentAmount" className="hidden">{inr(order?.netAmount ?? 0)}</span></p>
          </div>
        ) : (
          <div id="posStandardActionButtons" className="grid grid-cols-2 gap-2">
            <button type="button" id="btnSaveTableOrder" onClick={v.onSave} disabled={gates.save.disabled} title={gates.save.title} className="btn h-11 bg-info text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed">
              {v.busy.save ? <><i className="fa-solid fa-spinner fa-spin" />SAVING...</> : <><i className="fa-solid fa-floppy-disk" />SAVE ORDER</>}
            </button>
            <button type="button" id="btnSendToKitchen" onClick={v.onKot} disabled={gates.kot.disabled} title={gates.kot.title} className="btn h-11 bg-warn text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed">
              {v.busy.kot ? <><i className="fa-solid fa-spinner fa-spin" />PRINTING KOT...</> : <><i className="fa-solid fa-print" />PRINT KOT</>}
            </button>
            {order?.status === 'KOT_PRINTED' && (
              <button type="button" id="btnReprintKot" onClick={v.onReprint} disabled={v.reprinting} title="The kitchen did not get the ticket? Print the last ticket again (marked REPRINT)" className="btn btn-secondary btn-sm col-span-2 w-full border-warn/50 text-warn"><i className="fa-solid fa-print" />REPRINT KOT</button>
            )}
            <div id="posBillActionRow" className="grid gap-2 col-span-2 grid-cols-2">
              <button type="button" id="btnRequestBill" onClick={v.onRequest} disabled={gates.request.disabled} title={gates.request.title} className="btn h-11 bg-fg text-surface hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"><i className="fa-solid fa-bell" />REQUEST BILL</button>
              <button type="button" id="btnPayAndPrint" onClick={v.onPrint} disabled={gates.print.disabled || !canPrintBill} title={canPrintBill ? gates.print.title : 'Print bill access is off for your account. Ask a manager or admin to switch it on.'} className="btn btn-primary h-11 disabled:opacity-40 disabled:cursor-not-allowed"><i className="fa-solid fa-print" />PRINT BILL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 text-muted"><span>{label}</span><span className="text-fg font-medium">{children}</span></div>;
}

function TokenBanner({ id, display, icon, value }: { id: string; display: string; icon: string; value: string }) {
  return (
    <div id={id} className="flex items-center justify-between rounded-lg bg-brand/10 border border-brand/30 px-3 py-2 text-sm">
      <span className="text-muted"><i className={`fa-solid ${icon} mr-1.5 text-brand-text`} />Token</span>
      <span id={display} className="font-mono font-bold text-brand-text">{value}</span>
    </div>
  );
}
