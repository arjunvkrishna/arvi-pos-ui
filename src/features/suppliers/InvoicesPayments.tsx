import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import { deleteInvoice, fetchInvoicePayments, reversePayment, savePayment, type Invoice, type PaymentBody, type Supplier } from './api';
import { useInvoices, usePayments, useSupplierAction } from './hooks';
import { PAYMENT_MODES, fmtDate, fmtINR, invoiceLabel, invoiceTone } from './rules';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const supplierSelect = (id: string, value: string, set: (v: string) => void, suppliers: Supplier[]) => (
  <select id={id} value={value} onChange={(e) => set(e.target.value)} className="input w-full sm:w-64" aria-label="Supplier">
    <option value="">All suppliers</option>{suppliers.filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
  </select>
);

/** Invoices list: filters, edit, pay, payment history, delete (admin). */
export function InvoicesTab({ suppliers, onNew, onEdit, onPay }: { suppliers: Supplier[]; onNew: () => void; onEdit: (id: number) => void; onPay: (id: number) => void }) {
  const isAdmin = useSession((s) => s.user?.role) === 'ADMIN';
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');
  const [historyOf, setHistoryOf] = useState<Invoice | null>(null);
  const q = useInvoices(supplier);
  const remove = useSupplierAction(deleteInvoice, 'Invoice deleted');
  const rows = (q.data ?? []).filter((i) => !status || i.status === status);
  const onDelete = (i: Invoice) => { if (window.confirm('Delete this invoice? This cannot be undone if no payments exist.')) remove.mutate(i.id); };
  return (
    <div id="supplier-sub-invoices" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {supplierSelect('invoiceSupplierFilter', supplier, setSupplier, suppliers)}
          <select id="invoiceStatusFilter" value={status} onChange={(e) => setStatus(e.target.value)} className="input w-full sm:w-40" aria-label="Status">
            <option value="">All status</option><option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option>
          </select>
        </div>
        <button type="button" id="btnAddInvoice" onClick={onNew} className="btn btn-primary"><i className="fa-solid fa-plus" />Add invoice</button>
      </div>
      <div className="card overflow-hidden">
        {q.isPending ? <Skeleton rows={5} /> : q.isError ? <p className="p-6 text-center text-sm text-danger">{q.error.message}</p> : rows.length === 0 ? <EmptyState icon="fa-file-invoice" title="No invoices found" /> : (
          <table className="rtable">
            <thead><tr><th>Invoice #</th><th>Supplier</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Outstanding</th><th className="text-center">Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="invoiceTableBody">{rows.map((i) => (
              <tr key={i.id}>
                <td data-label="" className="cell-title font-mono text-brand-text">{i.invoiceNumber}</td>
                <td data-label="Supplier">{i.supplierName || '-'}</td><td data-label="Date" className="text-muted">{fmtDate(i.invoiceDate)}</td>
                <td data-label="Due" className={i.isOverdue ? 'text-danger font-semibold' : 'text-muted'}>{fmtDate(i.dueDate)}</td>
                <td data-label="Total" className="md:text-right">{fmtINR(i.totalAmount)}</td><td data-label="Paid" className="md:text-right text-ok">{fmtINR(i.paidAmount)}</td>
                <td data-label="Outstanding" className={`md:text-right font-semibold ${i.outstandingAmount > 0 ? 'text-danger' : 'text-muted'}`}>{fmtINR(i.outstandingAmount)}</td>
                <td data-label="Status" className="md:text-center"><Badge tone={invoiceTone(invoiceLabel(i))}>{invoiceLabel(i)}</Badge></td>
                <td className="cell-actions"><div className="flex flex-wrap justify-end gap-1.5 w-full md:w-auto">
                  <button type="button" onClick={() => onEdit(i.id)} className="btn btn-secondary btn-sm" title="Edit / update invoice">Edit</button>
                  {i.status !== 'PAID' && <button type="button" onClick={() => onPay(i.id)} className="btn btn-soft-ok btn-sm">Pay</button>}
                  <button type="button" onClick={() => setHistoryOf(i)} className="btn btn-secondary btn-sm">History</button>
                  {isAdmin && <button type="button" onClick={() => onDelete(i)} className="btn btn-soft-danger btn-sm">Del</button>}
                </div></td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
      {historyOf && <InvoicePaymentsDialog invoice={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}

/** Payment history of one invoice (the classic app showed this in a browser alert). */
function InvoicePaymentsDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const q = useQuery({ queryKey: ['invoice-payments', invoice.id], queryFn: () => fetchInvoicePayments(invoice.id) });
  return (
    <Dialog id="invoicePaymentsModal" open onClose={onClose} size="lg" title={`Invoice ${invoice.invoiceNumber}`} description={`${fmtINR(invoice.totalAmount)} total · ${fmtINR(invoice.outstandingAmount)} outstanding`}>
      {q.isPending ? <Skeleton rows={3} /> : q.isError ? <p className="text-sm text-danger text-center py-4">{q.error.message}</p> : q.data.length === 0 ? <EmptyState icon="fa-money-bill-wave" title="No payments recorded yet" /> : (
        <table className="rtable"><thead><tr><th>Date</th><th className="text-right">Amount</th><th>Mode</th><th>Reference</th></tr></thead>
          <tbody>{q.data.map((p) => <tr key={p.id}><td data-label="Date">{fmtDate(p.paymentDate)}</td><td data-label="Amount" className="md:text-right font-semibold text-ok">{fmtINR(p.amount)}</td><td data-label="Mode"><Badge tone="info">{p.paymentMode}</Badge></td><td data-label="Reference" className="text-muted">{p.referenceNumber || '-'}</td></tr>)}</tbody></table>
      )}
    </Dialog>
  );
}

/** All payments, with a supplier filter, "record payment" and reverse (admin). */
export function PaymentsTab({ suppliers, onNew }: { suppliers: Supplier[]; onNew: () => void }) {
  const isAdmin = useSession((s) => s.user?.role) === 'ADMIN';
  const [supplier, setSupplier] = useState('');
  const q = usePayments(supplier);
  const reverse = useSupplierAction(reversePayment, 'Payment reversed');
  const onReverse = (id: number) => { if (window.confirm('Reverse this payment? The outstanding balance will be restored.')) reverse.mutate(id); };
  const rows = q.data ?? [];
  return (
    <div id="supplier-sub-payments" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {supplierSelect('paymentSupplierFilter', supplier, setSupplier, suppliers)}
        <button type="button" id="btnRecordPayment" onClick={onNew} className="btn btn-primary"><i className="fa-solid fa-plus" />Record payment</button>
      </div>
      <div className="card overflow-hidden">
        {q.isPending ? <Skeleton rows={5} /> : q.isError ? <p className="p-6 text-center text-sm text-danger">{q.error.message}</p> : rows.length === 0 ? <EmptyState icon="fa-money-bill-wave" title="No payments recorded" /> : (
          <table className="rtable">
            <thead><tr><th>Date</th><th>Supplier</th><th>Invoice #</th><th className="text-right">Amount</th><th>Mode</th><th>Reference</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="paymentTableBody">{rows.map((p) => (
              <tr key={p.id}><td data-label="Date">{fmtDate(p.paymentDate)}</td><td data-label="" className="cell-title font-medium text-fg">{p.supplierName || '-'}</td><td data-label="Invoice" className="font-mono text-brand-text">{p.invoiceNumber || '-'}</td>
                <td data-label="Amount" className="md:text-right font-semibold text-ok">{fmtINR(p.amount)}</td><td data-label="Mode"><Badge tone="info">{p.paymentMode}</Badge></td><td data-label="Reference" className="text-muted">{p.referenceNumber || '-'}</td>
                <td className="cell-actions"><div className="flex justify-end w-full md:w-auto">{isAdmin && <button type="button" onClick={() => onReverse(p.id)} className="btn btn-soft-danger btn-sm">Reverse</button>}</div></td></tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Record a payment against an unpaid invoice; the amount starts at what is still owed. */
export function PaymentDialog({ presetInvoiceId, onClose }: { presetInvoiceId: number | null; onClose: () => void }) {
  const invoices = useInvoices('');
  const open = (invoices.data ?? []).filter((i) => i.status !== 'PAID');
  const [invoiceId, setInvoiceId] = useState(presetInvoiceId ? String(presetInvoiceId) : '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState('CASH');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [seeded, setSeeded] = useState(false);
  const pay = useSupplierAction((b: PaymentBody) => savePayment(b), 'Payment recorded successfully!');
  const inv = open.find((i) => String(i.id) === invoiceId);
  // Preselected invoice: fill the amount once the list has arrived.
  if (presetInvoiceId && !seeded && inv) { setSeeded(true); setAmount(inv.outstandingAmount.toFixed(2)); }
  const choose = (v: string) => { setInvoiceId(v); const i = open.find((x) => String(x.id) === v); setAmount(i ? i.outstandingAmount.toFixed(2) : ''); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    pay.mutate({ invoiceId: parseInt(invoiceId, 10), paymentDate: date, amount: parseFloat(amount), paymentMode: mode, referenceNumber: ref.trim(), notes: notes.trim() },
      { onSuccess: onClose, onError: (err) => setError(err.message) });
  };
  return (
    <Dialog id="paymentModal" open onClose={onClose} size="md" title="Record supplier payment">
      <form id="paymentForm" onSubmit={submit} className="space-y-4">
        <Field id="paymentInvoiceId" label="Invoice *">
          <select id="paymentInvoiceId" required value={invoiceId} onChange={(e) => choose(e.target.value)} className="input"><option value="">Select invoice</option>
            {open.map((i) => <option key={i.id} value={i.id}>[{i.supplierName}] {i.invoiceNumber} — {fmtINR(i.outstandingAmount)} outstanding</option>)}</select>
        </Field>
        {inv && (
          <div id="paymentInvoiceInfo" className="grid grid-cols-3 gap-2 rounded-lg bg-subtle p-3 text-center text-sm">
            <p><span className="block text-xs text-muted">Total</span><span id="piTotal" className="font-semibold text-fg">{fmtINR(inv.totalAmount)}</span></p>
            <p><span className="block text-xs text-muted">Paid</span><span id="piPaid" className="font-semibold text-ok">{fmtINR(inv.paidAmount)}</span></p>
            <p><span className="block text-xs text-muted">Outstanding</span><span id="piOutstanding" className="font-semibold text-danger">{fmtINR(inv.outstandingAmount)}</span></p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id="paymentDate" label="Payment date *"><input id="paymentDate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
          <Field id="paymentAmount" label="Amount (₹) *"><input id="paymentAmount" type="number" required step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="Amount paying now" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="paymentMode" label="Payment mode *"><select id="paymentMode" value={mode} onChange={(e) => setMode(e.target.value)} className="input">{PAYMENT_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field id="paymentRef" label="Reference #"><input id="paymentRef" value={ref} onChange={(e) => setRef(e.target.value)} className="input" placeholder="Transaction / cheque ref" /></Field>
        </div>
        <Field id="paymentNotes" label="Notes"><input id="paymentNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Optional notes" /></Field>
        {error && <p id="paymentFormError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={pay.isPending} className="btn btn-primary w-full h-10">{pay.isPending ? 'Saving…' : 'Record payment'}</button>
      </form>
    </Dialog>
  );
}
