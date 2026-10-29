import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/ui';
import { saveExpense, saveTemplate, type Expense, type ExpenseInput, type Template, type TemplateInput } from './api';
import { useExpenseAction } from './hooks';
import { EXPENSE_TYPES, FREQUENCIES, PAYMENT_METHODS } from './rules';
import { todayISO } from '../staff/rules';

const typeOptions = EXPENSE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>);
const methodOptions = PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>);

/** Record a new expense, or edit one. */
export function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const src = expense ?? null;
  const [type, setType] = useState<string>(src?.type ?? 'RENT');
  const [desc, setDesc] = useState(src?.description ?? '');
  const [vendor, setVendor] = useState(src?.vendorOrPayee ?? '');
  const [amount, setAmount] = useState(src ? String(src.amount) : '');
  const [date, setDate] = useState(src?.expenseDate ?? todayISO());
  const [due, setDue] = useState(src?.dueDate ?? '');
  const [method, setMethod] = useState(src?.paymentMethod ?? src?.paidBy ?? 'Bank Transfer');
  const [status, setStatus] = useState<string>(src?.status ?? 'PAID');
  const [ref, setRef] = useState(src?.receiptRef ?? '');
  const [notes, setNotes] = useState(src?.notes ?? '');
  const [asTemplate, setAsTemplate] = useState(false);
  const templateId = src?.templateId ?? null;
  const save = useExpenseAction(async (v: { e: ExpenseInput; asTemplate: boolean }) => {
    await saveExpense(src?.id ?? null, v.e);
    if (v.asTemplate && !src) {
      await saveTemplate(null, { title: v.e.description, type: v.e.type, amount: v.e.amount, frequency: 'MONTHLY', dueDay: new Date(v.e.expenseDate).getDate() || 1, vendorOrPayee: v.e.vendorOrPayee, paymentMethod: v.e.paymentMethod, notes: v.e.notes, isActive: true });
    }
  }, src ? 'Expense updated successfully' : 'Expense recorded successfully', 'Failed to save expense');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ asTemplate, e: { type, description: desc.trim(), vendorOrPayee: vendor.trim(), amount: parseFloat(amount), expenseDate: date, dueDate: due || null, paymentMethod: method, paidBy: method, status, receiptRef: ref.trim(), notes: notes.trim(), templateId, isRecurring: Boolean(templateId) } }, { onSuccess: onClose });
  };
  return (
    <Dialog id="expenseModal" open onClose={onClose} size="lg" title={src ? 'Edit expense / EMI' : 'Record expense / EMI'}>
      <form id="expenseForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="expType" label="Expense category *"><select id="expType" value={type} onChange={(e) => setType(e.target.value)} className="input">{typeOptions}</select></Field>
          <Field id="expStatus" label="Status *"><select id="expStatus" value={status} onChange={(e) => setStatus(e.target.value)} className="input"><option value="PAID">Paid</option><option value="PENDING">Pending / due</option></select></Field>
          <div className="sm:col-span-2"><Field id="expDesc" label="Description / title *"><input id="expDesc" required value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="e.g. Shop monthly rent / Espresso machine EMI" /></Field></div>
          <div className="sm:col-span-2"><Field id="expVendor" label="Vendor / payee / landlord / bank"><input id="expVendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="input" placeholder="e.g. Building landlord / HDFC Bank" /></Field></div>
          <Field id="expAmount" label="Amount (₹) *"><input id="expAmount" required type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="e.g. 35000" /></Field>
          <Field id="expDate" label="Payment date *"><input id="expDate" required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
          <Field id="expDueDate" label="Due date (optional)"><input id="expDueDate" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" /></Field>
          <Field id="expPaymentMethod" label="Payment method"><select id="expPaymentMethod" value={method} onChange={(e) => setMethod(e.target.value)} className="input">{methodOptions}</select></Field>
          <Field id="expReceiptRef" label="Receipt / ref no."><input id="expReceiptRef" value={ref} onChange={(e) => setRef(e.target.value)} className="input" placeholder="e.g. TXN-99823 / Chq-1002" /></Field>
          <div className="sm:col-span-2"><Field id="expNotes" label="Notes / remarks"><textarea id="expNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-auto py-2" placeholder="Additional details or payment notes…" /></Field></div>
        </div>
        {!src && (
          <label id="expSaveAsTemplateBox" htmlFor="expSaveAsTemplate" className="flex items-start gap-2 text-sm text-fg cursor-pointer">
            <input id="expSaveAsTemplate" type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span>Also save as a monthly recurring template<span className="block text-xs text-muted">Next month you can post it with one click.</span></span>
          </label>
        )}
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : src ? 'Save changes' : 'Record expense'}</button>
      </form>
    </Dialog>
  );
}

export function TemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const t = template;
  const [title, setTitle] = useState(t?.title ?? '');
  const [type, setType] = useState<string>(t?.type ?? 'RENT');
  const [amount, setAmount] = useState(t ? String(t.amount ?? '') : '');
  const [freq, setFreq] = useState(t?.frequency ?? 'MONTHLY');
  const [dueDay, setDueDay] = useState(String(t?.dueDay ?? 1));
  const [vendor, setVendor] = useState(t?.vendorOrPayee ?? '');
  const [method, setMethod] = useState(t?.paymentMethod ?? 'Bank Transfer');
  const [notes, setNotes] = useState(t?.notes ?? '');
  const [active, setActive] = useState(t?.isActive !== false);
  const save = useExpenseAction((b: TemplateInput) => saveTemplate(t?.id ?? null, b), t ? 'Recurring template updated successfully' : 'Recurring template created successfully', 'Failed to save template');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ title: title.trim(), type, amount: parseFloat(amount), frequency: freq, dueDay: parseInt(dueDay, 10) || 1, vendorOrPayee: vendor.trim(), paymentMethod: method, notes: notes.trim(), isActive: active }, { onSuccess: onClose });
  };
  return (
    <Dialog id="expenseTemplateModal" open onClose={onClose} size="lg" title={t ? 'Edit recurring template' : 'New recurring expense & EMI template'}>
      <form id="expenseTemplateForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Field id="tplTitle" label="Template name / obligation *"><input id="tplTitle" required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Main cafe shop monthly rent / Espresso machine EMI" /></Field></div>
          <Field id="tplType" label="Expense category *"><select id="tplType" value={type} onChange={(e) => setType(e.target.value)} className="input">{typeOptions}</select></Field>
          <Field id="tplAmount" label="Default amount (₹) *"><input id="tplAmount" required type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="e.g. 25000" /></Field>
          <Field id="tplFrequency" label="Frequency *"><select id="tplFrequency" value={freq} onChange={(e) => setFreq(e.target.value)} className="input">{FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field id="tplDueDay" label="Due day of month (1–31) *"><input id="tplDueDay" required type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="input" placeholder="e.g. 5" /></Field>
          <Field id="tplVendor" label="Payee / vendor / landlord / bank"><input id="tplVendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="input" placeholder="e.g. Building landlord / HDFC loan A/C" /></Field>
          <Field id="tplPaymentMethod" label="Default payment method"><select id="tplPaymentMethod" value={method} onChange={(e) => setMethod(e.target.value)} className="input">{methodOptions}</select></Field>
          <div className="sm:col-span-2"><Field id="tplNotes" label="Notes / instructions"><textarea id="tplNotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-auto py-2" placeholder="Account number, landlord phone, agreement expiry, loan details…" /></Field></div>
        </div>
        <label htmlFor="tplIsActive" className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id="tplIsActive" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Active (included in the monthly checklist)</label>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : t ? 'Save changes' : 'Create template'}</button>
      </form>
    </Dialog>
  );
}
