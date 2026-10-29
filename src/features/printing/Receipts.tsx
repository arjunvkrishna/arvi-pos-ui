import { useEffect, useState } from 'react';
import { useSession } from '../../api/session';
import { canPrintBill } from '../../auth/tabs';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { printElementContent } from '../../lib/printHtml';
import { formatISTDateTime } from '../../lib/time';
import type { Bill } from '../bills/types';
import { markBillPrinted, printBill, printKot, type PrinterConfig } from './api';
import { usePrinterConfig } from './hooks';
import { trackPrintJob, warnIfPrinterOffline } from './jobs';
import { PaymentQr } from './PaymentQr';
import { usePaymentQr } from './usePaymentQr';
import { billTax, brandName, cafeLogo, isUpdatedKot, kotTicketTime, kotTotals, orderKind, totalQty } from './rules';
import { usePrintUi } from './store';

// Receipts use inline styles only: the same markup is shown on screen and copied into the print iframe, which has no site CSS.
const paper: React.CSSProperties = { background: '#fff', color: '#000', fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 11, fontWeight: 600, lineHeight: 1.25, padding: '8px 10px', width: '100%', maxWidth: 290, margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: 4 };
const center: React.CSSProperties = { textAlign: 'center' };
const rule: React.CSSProperties = { borderTop: '1.5px dashed #000', margin: '5px 0' };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 };
const inr = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;

export function BillReceipt({ bill, cfg }: { bill: Bill; cfg: PrinterConfig | null }) {
  const kind = orderKind(bill);
  const tax = billTax(bill);
  const sub1 = cfg?.subheader?.trim();
  const sub2 = cfg?.subheader2?.trim();
  const user = useSession((s) => s.user);
  return (
    <div id="thermalReceiptContent" style={paper}>
      <div style={center}>
        {cfg?.logoEnabled !== false && <img id="rcptLogoImg" className="receipt-logo" src={cafeLogo()} alt="" style={{ maxHeight: cfg?.logoSize || 48, marginBottom: cfg?.logoGap ?? 0, display: 'block', margin: '0 auto' }} />}
        <div id="rcptStoreName" style={{ fontWeight: 900, fontSize: cfg?.fontSize === 'DOUBLE_W_H' ? 18 : 16, textTransform: 'uppercase' }}>{cfg?.headerTitle || brandName()}</div>
        {sub1 && <div id="rcptSubHeader" style={{ fontSize: 10 }}>{sub1}</div>}
        {sub2 && <div id="rcptSubHeader2" style={{ fontSize: 9.5 }}>{sub2}</div>}
        <div id="rcptDocTitle" style={{ fontWeight: 800, marginTop: 3 }}>{tax.title}</div>
        {tax.active && <div id="rcptGstinRow" style={{ fontSize: 10 }}>GSTIN: <span id="rcptGstin">{tax.gstin}</span></div>}
      </div>
      <div style={rule} />
      <div style={row}><span id="rcptBillNo">Bill: {bill.billNumber}</span><span id="rcptDate">Date: {formatISTDateTime(bill.createdAt || new Date().toISOString())}</span></div>
      <div id="rcptTableNo">
        {kind === 'TAKEAWAY' ? <>Order: <b>Takeaway</b><br />Customer: <b>{bill.customerName || 'Guest'}</b><br />Token: <b>{bill.takeawayToken}</b></>
          : kind === 'OUTDOOR' ? <>Location: <b>Outdoor</b><br />Customer: <b>{bill.customerName || 'Guest'}</b><br />Token: <b>{bill.outdoorToken}</b></>
          : <>Table: {bill.tableNumber || '-'}</>}
      </div>
      <div id="rcptCashier">Cashier: {bill.printedByName || user?.username}</div>
      <div id="rcptStaff">Staff Attended: {bill.createdByName || 'Staff'}</div>
      <div style={rule} />
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #000' }}><th style={{ textAlign: 'left', width: '44%' }}>ITEM</th><th style={{ width: '14%' }}>QTY</th><th style={{ textAlign: 'right', width: '20%' }}>RATE</th><th style={{ textAlign: 'right', width: '22%' }}>AMT</th></tr></thead>
        <tbody id="rcptItemsBody">{bill.items.map((it, i) => (
          <tr key={i} style={{ borderBottom: '1px dashed #9ca3af' }}>
            <td style={{ textAlign: 'left', wordBreak: 'break-word', fontWeight: 700 }}>{it.itemName}{it.isTakeaway && <span style={{ display: 'block', fontSize: 9 }}>(Parcel)</span>}</td>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>₹{it.price.toFixed(2)}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>₹{it.subtotal.toFixed(2)}</td>
          </tr>))}</tbody>
      </table>
      <div style={rule} />
      <div style={row}><span>Total Qty: <b id="rcptTotalQty">{totalQty(bill)}</b></span></div>
      <div style={row}><span>Subtotal</span><span id="rcptSubtotal">{inr(bill.subtotal)}</span></div>
      {(bill.discountAmount ?? 0) > 0 && <div id="rcptDiscountRow" style={row}><span>Discount</span><span id="rcptDiscount">-{inr(bill.discountAmount)}</span></div>}
      {(bill.promotionDiscountAmount ?? 0) > 0 && <div id="rcptPromotionRow" style={row}><span id="rcptPromotionLabel">Promo ({bill.promotionName || 'Promotion'} {bill.promotionPercentage || 0}%):</span><span id="rcptPromotionDiscount">-{inr(bill.promotionDiscountAmount)}</span></div>}
      {(bill.parcelCharge ?? 0) > 0 && <div id="rcptParcelChargeRow" style={row}><span>Parcel charge</span><span id="rcptParcelCharge">{inr(bill.parcelCharge)}</span></div>}
      {tax.active && <>
        <div id="rcptCgstRow" style={row}><span>CGST (<span id="rcptCgstRate">{tax.cgstRate.toFixed(1)}</span>%)</span><span id="rcptCgst">{inr(tax.cgstAmt)}</span></div>
        <div id="rcptSgstRow" style={row}><span>SGST (<span id="rcptSgstRate">{tax.sgstRate.toFixed(1)}</span>%)</span><span id="rcptSgst">{inr(tax.sgstAmt)}</span></div>
        {tax.roundOff !== null && <div id="rcptRoundOffRow" style={row}><span>Round off</span><span id="rcptRoundOff">{tax.roundOff >= 0 ? '+' : ''}{inr(tax.roundOff)}</span></div>}
      </>}
      <div style={{ ...rule, borderTopStyle: 'solid' }} />
      <div style={{ ...row, fontWeight: 900, fontSize: 14 }}><span>GRAND TOTAL</span><span id="rcptGrandTotal">{inr(bill.netAmount)}</span></div>
      <div style={row}><span>Payment</span><span id="rcptPayMode">{bill.payments && bill.payments.length > 1 ? 'SPLIT' : bill.paymentMode || 'CASH'}</span></div>
      {bill.payments && bill.payments.length > 1 && bill.payments.map((p, i) => <div key={i} style={row}><span>&nbsp;&nbsp;{p.mode}</span><span>Rs. {Number(p.amount).toFixed(2)}</span></div>)}
      <div style={rule} />
      {cfg?.paymentQrEnabled !== false && <PaymentQr />}
      <div id="rcptFooterMsg" style={{ ...center, fontWeight: 800, paddingBottom: (cfg?.footerSpacing ?? 1) * 4 }}>{cfg?.footerMessage || 'THANK YOU! VISIT AGAIN'}</div>
    </div>
  );
}

export function KotReceipt({ bill, cfg }: { bill: Bill; cfg: PrinterConfig | null }) {
  const kind = orderKind(bill);
  const updated = isUpdatedKot(bill);
  const { items, count, qty } = kotTotals(bill);
  const ref = bill.kotNumber || bill.billNumber || 'NRM-0000';
  const parts = ref.split('-');
  const short = parts.length > 1 ? `#${parts[parts.length - 1]}` : '';
  const user = useSession((s) => s.user);
  return (
    <div id="thermalKotReceiptContent" style={paper}>
      <div style={center}>
        <div id="kotRcptTitle" style={{ fontWeight: 900, fontSize: 14 }}>{updated ? `*** KITCHEN ORDER (UPDATE #${bill.kotUpdateCount || 1}) ***` : cfg?.kotHeaderTitle || '*** KITCHEN ORDER ***'}</div>
        <div id="kotRcptSubTitle" style={{ fontSize: 10 }}>{cfg?.kotSubheader || `${brandName()} - MAIN KITCHEN`}</div>
      </div>
      {updated && <div id="kotRcptNoticeBanner" style={{ ...center, background: '#000', color: '#fff', fontWeight: 900, padding: '3px 0', margin: '4px 0' }}>ORDER UPDATED – CHANGES ONLY</div>}
      <div className="kot-table-banner" style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '4px 6px', borderRadius: 4, margin: '4px 0 3px' }}>
        <div id="kotRcptTableBanner">{kind === 'TAKEAWAY' ? <><b>TAKEAWAY • TOKEN: {bill.takeawayToken || 'TAK'}</b><div style={{ fontSize: 10 }}>Guest: {bill.customerName || 'Takeaway Guest'}</div></>
          : kind === 'OUTDOOR' ? <><b>OUTDOOR • TOKEN: {bill.outdoorToken || 'OUT'}</b><div style={{ fontSize: 10 }}>Guest: {bill.customerName || 'Guest'}</div></>
          : <b id="kotRcptTableNo" style={{ fontSize: 15, letterSpacing: 1 }}>TABLE: {bill.tableNumber || 'Takeaway'}</b>}</div>
      </div>
      <div style={row}><span id="kotRcptBillNo">REF: {ref}</span><span id="kotRcptOrderRef">{short ? `Order ${short}` : ''}</span></div>
      <div id="kotRcptDate">{formatISTDateTime(kotTicketTime(bill) as string)}</div>
      <div id="kotRcptServer">Server: {bill.createdByName || user?.username || 'Staff'}</div>
      <div style={rule} />
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #000' }}><th id="kotRcptColDesc" style={{ textAlign: 'left', width: '74%' }}>{updated ? 'UPDATED ITEM' : 'ITEM DESCRIPTION'}</th><th id="kotRcptColQty" style={{ textAlign: 'right', width: '26%' }}>{updated ? 'CHANGE' : 'QTY'}</th></tr></thead>
        <tbody id="kotRcptItemsBody">{items.map((it, i) => {
          const q = it.quantity || 1;
          const t = it.updateType;
          const removed = t === 'REMOVED';
          const badge = t === 'ADDED' || t === 'INCREASED' ? `+${it.deltaQuantity || q}` : t === 'DECREASED' ? `${it.deltaQuantity || q}` : removed ? 'CANCEL' : t === 'NOTE_UPDATED' ? 'NOTE' : `${q}`;
          const note = it.customization?.trim();
          return (
            <tr key={i} style={{ borderBottom: '1px dashed #9ca3af' }}>
              <td style={{ textAlign: 'left', fontWeight: 800, fontSize: 13, wordBreak: 'break-word', textDecoration: removed ? 'line-through' : undefined, color: removed ? '#b91c1c' : '#000' }}>
                {it.itemName}
                {(it.isTakeaway || kind === 'TAKEAWAY') && <div style={{ fontSize: 10, fontWeight: 900 }}>*** [PARCEL / TAKEAWAY] ***</div>}
                {it.updateMessage && <div style={{ fontSize: 10.5, fontWeight: 900 }}>{it.updateMessage}</div>}
                {note && <div style={{ fontSize: 10, fontStyle: 'italic', borderLeft: '2px solid #000', paddingLeft: 4 }}>Note: {note}</div>}
              </td>
              <td style={{ textAlign: 'right', verticalAlign: 'middle', paddingRight: 6 }}><span className="kot-badge" style={{ background: '#000', color: '#fff', padding: '1px 7px', borderRadius: 4, fontWeight: 900, fontSize: 11 }}>{badge}</span></td>
            </tr>);
        })}</tbody>
      </table>
      <div style={rule} />
      <div style={row}><span id="kotRcptTotalLabel">{updated ? 'TOTAL UPDATED ITEMS:' : 'TOTAL ITEMS / QTY:'}</span><b id="kotRcptTotalQty">{updated ? `${count} Item${count === 1 ? '' : 's'}` : `${count} Item${count === 1 ? '' : 's'} (Qty: ${qty})`}</b></div>
      <div>Notes: <span id="kotRcptNotes">{bill.notes || 'None'}</span></div>
      <div style={rule} />
      <div id="kotRcptFooterMsg" style={{ ...center, fontWeight: 800, paddingBottom: (cfg?.footerSpacing ?? 1) * 4 }}>{cfg?.kotFooterMessage || '--- END OF KOT ---'}</div>
    </div>
  );
}


/** What the kitchen gets when an order is cancelled after its KOT was printed: every dish is listed as cancelled. Shown as a preview before the order is cancelled. */
export function CancelledKotReceipt({ bill, cfg, reason }: { bill: Bill; cfg: PrinterConfig | null; reason: string }) {
  const kind = orderKind(bill);
  const ref = bill.kotNumber || bill.billNumber || 'NRM-0000';
  const user = useSession((s) => s.user);
  const qty = bill.items.reduce((a, i) => a + (i.quantity || 1), 0);
  return (
    <div id="cancelKotReceiptContent" style={{ ...paper, position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', pointerEvents: 'none', transform: 'rotate(-28deg) scale(1.3)', opacity: 0.14, fontWeight: 900, fontSize: 40, letterSpacing: 2, color: '#000' }}>{[0, 1, 2, 3].map((n) => <span key={n}>CANCELLED</span>)}</div>
      <div style={center}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>*** KOT CANCELLATION NOTICE ***</div>
        <div style={{ fontSize: 10 }}>{cfg?.kotSubheader || `${brandName()} - MAIN KITCHEN`}</div>
      </div>
      <div style={{ ...center, background: '#000', color: '#fff', fontWeight: 900, padding: '3px 0', margin: '4px 0' }}>ORDER CANCELLED – STOP PREPARING</div>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '4px 6px', borderRadius: 4, margin: '4px 0 3px' }}>
        {kind === 'TAKEAWAY' ? <b>TAKEAWAY • TOKEN: {bill.takeawayToken || 'TAK'}</b> : kind === 'OUTDOOR' ? <b>OUTDOOR • TOKEN: {bill.outdoorToken || 'OUT'}</b> : <b style={{ fontSize: 15, letterSpacing: 1 }}>TABLE: {bill.tableNumber || 'Takeaway'}</b>}
      </div>
      <div style={row}><span>REF: {ref}</span></div>
      <div>{formatISTDateTime(new Date().toISOString())}</div>
      <div>Server: {bill.createdByName || user?.username || 'Staff'}</div>
      <div style={rule} />
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #000' }}><th style={{ textAlign: 'left', width: '74%' }}>CANCELLED ITEM</th><th style={{ textAlign: 'right', width: '26%' }}>QTY</th></tr></thead>
        <tbody>{bill.items.map((it, i) => (
          <tr key={i} style={{ borderBottom: '1px dashed #9ca3af' }}>
            <td style={{ textAlign: 'left', fontWeight: 800, fontSize: 13, wordBreak: 'break-word', }}>{it.itemName}</td>
            <td style={{ textAlign: 'right', paddingRight: 6 }}><span style={{ background: '#000', color: '#fff', padding: '1px 7px', borderRadius: 4, fontWeight: 900, fontSize: 11 }}>{it.quantity || 1}</span></td>
          </tr>))}
        </tbody>
      </table>
      <div style={rule} />
      <div style={row}><span>TOTAL CANCELLED:</span><b>{bill.items.length} Item{bill.items.length === 1 ? '' : 's'} (Qty: {qty})</b></div>
      <div>Reason: <span>{reason}</span></div>
      <div style={rule} />
      <div style={{ ...center, fontWeight: 800 }}>--- END OF CANCELLATION ---</div>
    </div>
  );
}
export function PrintHost() {
  usePaymentQr();   // fetched ahead of time: the bill is printed straight away and must already have the QR
  const receipt = usePrintUi((s) => s.receipt);
  const kot = usePrintUi((s) => s.kot);
  const closeReceipt = usePrintUi((s) => s.closeReceipt);
  const closeKot = usePrintUi((s) => s.closeKot);
  const cfg = usePrinterConfig().data ?? null;
  const [busy, setBusy] = useState(false);
  const user = useSession((s) => s.user);
  const mayPrintBill = !!user && canPrintBill(user);

  // Showing a bill marks it as printed on the server (as the classic receipt did).
  useEffect(() => { if (receipt) void markBillPrinted(receipt.id).catch(() => undefined); }, [receipt]);

  const directBill = async () => {
    if (!receipt) return;
    setBusy(true);
    try {
      const res = await printBill(receipt.id);
      if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `Bill #${receipt.billNumber}`); }
      else if (res?.success) showToast(`Bill #${receipt.billNumber} printed directly to thermal printer (${res.host}:${res.port})!`, 'success');
      else showToast(`Print warning: ${res?.message || 'Check printer connection'}`, 'warning');
    } catch (e) { showToast(`Direct print failed: ${e instanceof Error ? e.message : e}`, 'error'); } finally { setBusy(false); }
  };
  const directKot = async () => {
    if (!kot) return;
    setBusy(true);
    try {
      const res = await printKot(kot.id, `KOT_${kot.id}_v${kot.kotUpdateCount || 0}`);
      if (res?.jobId) { warnIfPrinterOffline(res); trackPrintJob(res.jobId, res.status, `KOT #${kot.kotNumber || kot.billNumber}`); }
      else if (res?.success) showToast(`KOT printed directly to thermal printer (${res.host}:${res.port})!`, 'success');
      else showToast(`Print warning: ${res?.message || 'Check printer connection'}`, 'warning');
    } catch (e) { showToast(`Direct print failed: ${e instanceof Error ? e.message : e}`, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog id="receiptModal" open={!!receipt} onClose={closeReceipt} size="sm" title="Customer bill" description={receipt ? `Bill ${receipt.billNumber}` : undefined}>
        {receipt && <div className="space-y-4"><BillReceipt bill={receipt} cfg={cfg} />
          <div className="grid grid-cols-2 gap-2"><button type="button" id="btnPrintReceipt" onClick={() => printElementContent('thermalReceiptContent', 'Customer Bill Receipt')} className="btn btn-secondary h-10"><i className="fa-solid fa-print" />Browser print</button>
            <button type="button" id="btnDirectPrintReceipt" disabled={busy || !mayPrintBill} title={mayPrintBill ? undefined : 'Print bill access is not enabled for your account'} onClick={directBill} className="btn btn-primary h-10 disabled:opacity-40 disabled:cursor-not-allowed"><i className="fa-solid fa-receipt" /><span id="btnDirectPrintReceiptText">{busy ? 'PRINTING...' : 'DIRECT PRINT (THERMAL)'}</span></button></div></div>}
      </Dialog>
      <Dialog id="kotReceiptModal" open={!!kot} onClose={closeKot} size="sm" title="Kitchen order ticket" description={kot ? `Ref ${kot.kotNumber || kot.billNumber}` : undefined}>
        {kot && <div className="space-y-4"><KotReceipt bill={kot} cfg={cfg} />
          <div className="grid grid-cols-2 gap-2"><button type="button" id="btnPrintKot" onClick={() => printElementContent('thermalKotReceiptContent', 'Kitchen Order Ticket (KOT)')} className="btn btn-secondary h-10"><i className="fa-solid fa-print" />Browser print</button>
            <button type="button" id="btnDirectPrintKot" disabled={busy} onClick={directKot} className="btn btn-primary h-10"><i className="fa-solid fa-fire-burner" /><span id="btnDirectPrintKotText">{busy ? 'PRINTING...' : 'DIRECT PRINT KOT (THERMAL)'}</span></button></div></div>}
      </Dialog>
    </>
  );
}
