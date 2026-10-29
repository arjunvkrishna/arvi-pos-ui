import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { copyText } from '../../lib/clipboard';
import { Badge, Field } from '../../components/ui';
import { fetchSupplierDetails, saveSupplier, type Supplier, type SupplierDetails, type SupplierInput } from './api';
import { useSupplierAction } from './hooks';
import { fmtDate, fmtINR, invoiceLabel, invoiceTone } from './rules';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Skeleton } from '../../components/ui';

const blank = (s: Supplier | null): Record<keyof Omit<SupplierInput, 'paymentTerms'>, string> & { paymentTerms: string } => ({
  name: s?.name || '', contactPerson: s?.contactPerson || '', phone: s?.phone || '', email: s?.email || '', category: s?.category || '',
  paymentTerms: String(s?.paymentTerms || 30), gstNumber: s?.gstNumber || '', address: s?.address || '', upiId: s?.upiId || '',
  bankName: s?.bankName || '', bankAccount: s?.bankAccount || '', bankIfsc: s?.bankIfsc || '', notes: s?.notes || '',
});

/** Add (supplier = null) or edit a supplier. */
export function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const [f, setF] = useState(() => blank(supplier));
  const [error, setError] = useState('');
  const save = useSupplierAction((body: SupplierInput) => saveSupplier(supplier?.id ?? null, body), supplier ? 'Supplier updated' : 'Supplier added');
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const text = (id: string, k: keyof typeof f, label: string, placeholder = '', type = 'text', required = false) => (
    <Field id={id} label={label}><input id={id} type={type} required={required} value={f[k]} onChange={(e) => set(k, e.target.value)} className="input" placeholder={placeholder} /></Field>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const t = (v: string) => v.trim();
    save.mutate({
      name: t(f.name), contactPerson: t(f.contactPerson), phone: t(f.phone), email: t(f.email), category: t(f.category),
      paymentTerms: parseInt(f.paymentTerms, 10) || 30, gstNumber: t(f.gstNumber), address: t(f.address), upiId: t(f.upiId),
      bankName: t(f.bankName), bankAccount: t(f.bankAccount), bankIfsc: t(f.bankIfsc), notes: t(f.notes),
    }, { onSuccess: onClose, onError: (err) => setError(err.message) });
  };

  return (
    <Dialog id="supplierModal" open onClose={onClose} size="lg" title={supplier ? 'Edit supplier' : 'Add supplier'}>
      <form id="supplierForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">{text('supplierName', 'name', 'Supplier / company name *', 'e.g. Coorg Coffee Traders', 'text', true)}</div>
          {text('supplierCategory', 'category', 'Category', 'e.g. Dairy, Packaging, Vegetables')}
          {text('supplierContact', 'contactPerson', 'Contact person', 'Contact person name')}
          {text('supplierPhone', 'phone', 'Phone number', '+91 98765 43210', 'tel')}
          {text('supplierEmail', 'email', 'Email address', 'supplier@example.com', 'email')}
          <Field id="supplierTerms" label="Payment terms (days)"><input id="supplierTerms" type="number" min="0" value={f.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} className="input" /></Field>
          {text('supplierGst', 'gstNumber', 'GSTIN / tax ID', '29AAAAA0000A1Z5')}
          <div className="sm:col-span-2">{text('supplierUpi', 'upiId', 'UPI ID / VPA', 'supplier@upi')}</div>
          <div className="sm:col-span-2"><Field id="supplierAddress" label="Billing & delivery address"><textarea id="supplierAddress" rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} className="input h-auto py-2" placeholder="Plot no, street, city, state, pincode" /></Field></div>
          {text('supplierBank', 'bankName', 'Bank name', 'e.g. HDFC Bank, SBI')}
          {text('supplierAccNo', 'bankAccount', 'Account number', '50200012345678')}
          {text('supplierIfsc', 'bankIfsc', 'IFSC code', 'HDFC0001234')}
          <div className="sm:col-span-2"><Field id="supplierNotes" label="Internal notes"><textarea id="supplierNotes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} className="input h-auto py-2" placeholder="Delivery timings, minimum order value, credit agreement…" /></Field></div>
        </div>
        {error && <p id="supplierFormError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}</button>
      </form>
    </Dialog>
  );
}

function Info({ label, value, id, copy }: { label: string; value?: string | null; id: string; copy?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm text-fg break-words"><span id={id}>{value || '-'}</span>
        {copy && value && <button type="button" onClick={() => copyText(value, copy)} title={`Copy ${copy}`} aria-label={`Copy ${copy}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-regular fa-copy text-xs" /></button>}
      </dd>
    </div>
  );
}

/** Everything about one supplier: contact, tax and bank details, balance, recent invoices and payments. */
export function DossierDialog({ supplierId, onClose, onInvoice, onEdit }: { supplierId: number; onClose: () => void; onInvoice: (id: number) => void; onEdit: (id: number) => void }) {
  const q = useQuery<SupplierDetails>({ queryKey: ['supplier-details', supplierId], queryFn: () => fetchSupplierDetails(supplierId) });
  const s = q.data?.supplier;
  const invoices = q.data?.recentInvoices ?? [];
  const payments = q.data?.recentPayments ?? [];
  const out = s?.totalOutstanding ?? 0;

  return (
    <Dialog id="supplierDossierModal" open onClose={onClose} size="xl" title={s?.name || 'Supplier dossier'}
      description={s ? <><span id="dossierSupplierCategory">Category: {s.category || 'General'} · Payment terms: {s.paymentTerms || 30} days</span> <Badge tone={s.active !== false ? 'ok' : 'neutral'} className="ml-1">{s.active !== false ? 'Active' : 'Inactive'}</Badge></> : undefined}>
      {q.isPending ? <Skeleton rows={5} /> : q.isError ? <p className="text-sm text-danger text-center py-6">Failed to open dossier: {q.error.message}</p> : s && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <dl className="card p-4 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Contact</p>
              <Info id="dossierContactPerson" label="Contact person" value={s.contactPerson} />
              <Info id="dossierPhone" label="Phone" value={s.phone} copy="Phone" />
              <Info id="dossierEmail" label="Email" value={s.email} />
              <Info id="dossierAddress" label="Address" value={s.address} /></dl>
            <dl className="card p-4 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Tax & banking</p>
              <Info id="dossierGst" label="GSTIN" value={s.gstNumber} copy="GSTIN" />
              <Info id="dossierUpi" label="UPI ID" value={s.upiId} copy="UPI ID" />
              <Info id="dossierBankName" label="Bank" value={s.bankName} />
              <Info id="dossierBankAcc" label="Account number" value={s.bankAccount} copy="Account number" />
              <Info id="dossierBankIfsc" label="IFSC" value={s.bankIfsc} /></dl>
            <dl className="card p-4 space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
              <Info id="dossierTerms" label="Payment terms" value={`${s.paymentTerms || 30} days`} />
              <Info id="dossierTotalInvoiced" label="Total invoiced" value={fmtINR(s.totalInvoiced)} />
              <Info id="dossierTotalPaid" label="Total paid" value={fmtINR(s.totalPaid)} />
              <div><dt className="text-xs text-muted">Outstanding</dt><dd id="dossierOutstanding" className={`text-sm font-semibold ${out > 0 ? 'text-danger' : 'text-muted'}`}>{fmtINR(out)}</dd></div>
              <Info id="dossierNotes" label="Notes" value={s.notes || 'None'} /></dl>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Invoices <span id="dossierInvoiceCountBadge" className="text-muted font-normal">· {invoices.length} invoices</span></p>
              {invoices.length === 0 ? <EmptyState icon="fa-file-invoice" title="No invoices on file" /> : (
                <table className="rtable"><thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody id="dossierInvoicesTableBody">{invoices.map((i) => (
                    <tr key={i.id}><td data-label="" className="cell-title font-mono font-medium text-fg">{i.invoiceNumber}</td><td data-label="Date" className="text-muted">{fmtDate(i.invoiceDate)}</td>
                      <td data-label="Total">{fmtINR(i.totalAmount)}</td><td data-label="Paid" className="text-ok">{fmtINR(i.paidAmount)}</td>
                      <td data-label="Outstanding" className={i.outstandingAmount > 0 ? 'font-semibold text-danger' : 'text-muted'}>{fmtINR(i.outstandingAmount)}</td>
                      <td data-label="Status"><Badge tone={invoiceTone(invoiceLabel(i))}>{invoiceLabel(i)}</Badge></td></tr>))}</tbody></table>)}
            </div>
            <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Payments <span id="dossierPaymentCountBadge" className="text-muted font-normal">· {payments.length} payments</span></p>
              {payments.length === 0 ? <EmptyState icon="fa-money-bill-wave" title="No payments recorded" /> : (
                <table className="rtable"><thead><tr><th>Receipt</th><th>Date</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                  <tbody id="dossierPaymentsTableBody">{payments.map((p) => (
                    <tr key={p.id}><td data-label="" className="cell-title font-mono font-medium text-fg">{p.paymentReceiptNumber || `#${p.id}`}</td><td data-label="Date" className="text-muted">{fmtDate(p.paymentDate)}</td>
                      <td data-label="Mode"><Badge tone="info">{p.paymentMode}</Badge></td><td data-label="Reference" className="text-muted truncate max-w-xs">{p.referenceNumber || p.notes || '-'}</td>
                      <td data-label="Amount" className="md:text-right font-semibold text-ok">{fmtINR(p.amount)}</td></tr>))}</tbody></table>)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" id="btnDossierCreateInvoice" onClick={() => onInvoice(supplierId)} className="btn btn-primary"><i className="fa-solid fa-file-invoice" />Create invoice</button>
            <button type="button" id="btnDossierEditSupplier" onClick={() => onEdit(supplierId)} className="btn btn-secondary"><i className="fa-solid fa-pen" />Edit supplier</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
