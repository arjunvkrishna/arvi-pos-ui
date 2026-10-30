import { useEffect, useState } from 'react';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import { deleteExpense, deleteTemplate, generateAllDue, generateFromTemplate, markPaid, toggleTemplate, type Expense, type Template } from './api';
import { ExpenseDialog, TemplateDialog } from './ExpenseDialogs';
import { useChecklist, useExpenseAction, useExpenses, useTemplates } from './hooks';
import { EXPENSE_TYPES, filterExpenses, monthSummary, pendingCount, postingDate, rupees0, typeTone } from './rules';
import { MONTHS } from '../staff/rules';

type Sub = 'all' | 'templates' | 'checklist';
type Modal = { kind: 'expense'; expense: Expense | null } | { kind: 'template'; template: Template | null } | null;
const amount2 = (n: number) => `₹${(Number(n) || 0).toFixed(2)}`;

export function ExpensesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sub, setSub] = useState<Sub>('all');
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);

  const expenses = useExpenses();
  const templates = useTemplates();
  const checklist = useChecklist(month, year);
  const all = expenses.data ?? [];
  const rows = filterExpenses(all, { month, year, type, status, search });
  const sum = monthSummary(all, month, year);
  const pending = pendingCount(checklist.data ?? []);

  const pay = useExpenseAction(markPaid, 'Marked expense as PAID', 'Failed to update status');
  const del = useExpenseAction(deleteExpense, 'Expense deleted', 'Failed to delete expense');
  const delTpl = useExpenseAction(deleteTemplate, 'Template deleted successfully', 'Failed to delete template');
  const toggle = useExpenseAction(toggleTemplate, 'Template status updated', 'Failed to toggle status', 'info');
  const post = useExpenseAction((id: number) => generateFromTemplate(id, postingDate(month, year)), 'Expense recorded from recurring template!', 'Failed to record recurring expense');
  const postAll = useExpenseAction(() => generateAllDue(month, year), (r) => `Posted ${Array.isArray(r) ? r.length : 0} recurring expense(s) for ${month}/${year}`, 'Failed to batch post recurring expenses');

  const err = expenses.isError ? expenses.error.message : templates.isError ? templates.error.message : '';
  useEffect(() => { if (err) showToast(`Failed to load expenses: ${err}`, 'error'); }, [err]);

  const onPostAll = () => { if (window.confirm(`Post all due active recurring expenses (Rent, EMI, Utilities) for ${month}/${year}?`)) postAll.mutate(undefined); };
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];
  const kpis = [
    { id: 'expTotalRent', label: 'Rent (monthly)', value: sum.rent }, { id: 'expTotalEmi', label: 'EMI (loans & equipment)', value: sum.emi },
    { id: 'expTotalUtilities', label: 'Utilities (electricity / water)', value: sum.utilities }, { id: 'expTotalMisc', label: 'Misc / operations', value: sum.misc },
    { id: 'expTotalMonthOutflow', label: 'Total month outflow', value: sum.total, strong: true },
  ];

  return (
    <section id="tab-expenses" data-testid="tab-expenses" className="space-y-5">
      <PageHeader title="Cafe expenses & EMI" description="Daily operating costs, monthly rent, equipment EMIs and recurring templates."
        actions={<>
          <button type="button" id="btnRecordExpense" onClick={() => setModal({ kind: 'expense', expense: null })} className="btn btn-primary"><i className="fa-solid fa-plus" />Record expense</button>
          <button type="button" id="btnNewTemplate" onClick={() => setModal({ kind: 'template', template: null })} className="btn btn-secondary"><i className="fa-solid fa-calendar-plus" />New recurring template</button>
          <button type="button" id="btnExpGenerateAllDue" onClick={onPostAll} disabled={postAll.isPending} title="Auto-post all active recurring templates for this month" className="btn btn-secondary">
            <i className="fa-solid fa-bolt" />Post due recurring{pending > 0 && <span id="expPendingTemplatesBadge" className="badge badge-danger ml-1">{pending}</span>}
          </button>
        </>} />

      <SegmentedTabs label="Expense sections" value={sub} onChange={setSub} options={[
        { value: 'all', label: 'All expenses', id: 'expSubtab-all' }, { value: 'templates', label: 'Recurring templates & EMI', id: 'expSubtab-templates' }, { value: 'checklist', label: 'Monthly commitments', id: 'expSubtab-checklist' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => <div key={k.id} className="card p-4"><p className="text-xs text-muted">{k.label}</p><p id={k.id} className={`text-lg font-semibold mt-1 ${k.strong ? 'text-danger' : 'text-fg'}`}>{rupees0(k.value)}</p></div>)}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <select id="expFilterMonth" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="input w-36" aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select id="expFilterYear" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="input w-28" aria-label="Year">{years.map((y) => <option key={y}>{y}</option>)}</select>
        {sub === 'all' && (<>
          <select id="expFilterType" value={type} onChange={(e) => setType(e.target.value)} className="input w-40" aria-label="Type"><option value="ALL">All types</option>{EXPENSE_TYPES.map(([v, l]) => <option key={v} value={v}>{l.split(' (')[0]}</option>)}</select>
          <select id="expFilterStatus" value={status} onChange={(e) => setStatus(e.target.value)} className="input w-40" aria-label="Status"><option value="ALL">All status</option><option value="PAID">Paid</option><option value="PENDING">Pending / due</option></select>
          <div className="flex-1 min-w-[200px] flex sm:justify-end"><SearchInput id="expSearchInput" value={search} onChange={setSearch} placeholder="Search description, payee, ref" /></div>
        </>)}
      </div>

      {sub === 'all' && (
        <div id="expViewAll" className="card overflow-hidden">
          {expenses.isPending ? <Skeleton rows={5} /> : rows.length === 0 ? <EmptyState icon="fa-receipt" title="No expenses match the selected filters for this period" /> : (
            <table className="rtable">
              <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th><th className="text-right">Actions</th></tr></thead>
              <tbody id="expensesTableBody">{rows.map((e) => {
                const paid = (e.status || 'PAID') === 'PAID';
                return (
                  <tr key={e.id}>
                    <td data-label="Type"><Badge tone={typeTone(e.type)}>{e.type}</Badge>{e.isRecurring && <i className="fa-solid fa-arrows-rotate text-[10px] text-brand-text ml-1.5" title="Recurring obligation" />}</td>
                    <td data-label="" className="cell-title"><span className="font-medium text-fg block">{e.description}</span>{e.vendorOrPayee && <span className="text-xs text-muted"><i className="fa-regular fa-building mr-1" />{e.vendorOrPayee}</span>}</td>
                    <td data-label="Date" className="whitespace-nowrap"><span className="block">{e.expenseDate || '-'}</span>{e.dueDate && <span className="text-xs text-warn">Due: {e.dueDate}</span>}</td>
                    <td data-label="Amount" className="font-semibold text-danger whitespace-nowrap">{amount2(e.amount)}</td>
                    <td data-label="Method" className="text-muted">{e.paymentMethod || e.paidBy || '-'}</td>
                    <td data-label="Status"><Badge tone={paid ? 'ok' : 'warn'}>{paid ? 'Paid' : 'Pending'}</Badge></td>
                    <td data-label="Reference" className="font-mono text-xs text-muted">{e.receiptRef || '-'}</td>
                    <td className="cell-actions"><div className="flex items-center justify-end gap-1.5 w-full md:w-auto">
                      {!paid && <button type="button" onClick={() => pay.mutate(e.id)} title="Mark as paid" className="btn btn-soft-ok btn-sm"><i className="fa-solid fa-check" />Pay</button>}
                      <button type="button" onClick={() => setModal({ kind: 'expense', expense: e })} title="Edit" aria-label={`Edit ${e.description}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>
                      <button type="button" onClick={() => { if (window.confirm('Delete this expense record?')) del.mutate(e.id); }} title="Delete" aria-label={`Delete ${e.description}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>
                    </div></td>
                  </tr>);
              })}</tbody>
            </table>
          )}
        </div>
      )}

      {sub === 'templates' && (
        <div id="expViewTemplates" className="card overflow-hidden">
          {templates.isPending ? <Skeleton rows={4} /> : (templates.data ?? []).length === 0 ? <EmptyState icon="fa-calendar-plus" title="No recurring templates yet" hint="Add monthly rent, EMI or utilities with “New recurring template”." /> : (
            <table className="rtable">
              <thead><tr><th>Template</th><th>Type</th><th>Payee</th><th>Frequency</th><th>Amount</th><th>Method</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody id="expenseTemplatesTableBody">{(templates.data ?? []).map((t) => {
                const active = t.isActive !== false;
                return (
                  <tr key={t.id}>
                    <td data-label="" className="cell-title"><span className="font-medium text-fg block">{t.title}</span>{t.notes && <span className="text-xs text-muted truncate block max-w-xs">{t.notes}</span>}</td>
                    <td data-label="Type"><Badge tone={typeTone(t.type)}>{t.type}</Badge></td><td data-label="Payee" className="text-muted">{t.vendorOrPayee || '-'}</td>
                    <td data-label="Frequency" className="whitespace-nowrap"><span className="font-medium">{t.frequency || 'MONTHLY'}</span> (day {t.dueDay || 1})</td>
                    <td data-label="Amount" className="font-semibold whitespace-nowrap">{amount2(t.amount)}</td><td data-label="Method" className="text-muted">{t.paymentMethod || '-'}</td>
                    <td data-label="Status"><Badge tone={active ? 'ok' : 'neutral'}>{active ? 'Active' : 'Paused'}</Badge></td>
                    <td className="cell-actions"><div className="flex items-center justify-end gap-1.5 w-full md:w-auto">
                      <button type="button" onClick={() => post.mutate(t.id)} title="Post as expense for the selected month" className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-plus" />Post</button>
                      <button type="button" onClick={() => setModal({ kind: 'template', template: t })} title="Edit template" aria-label={`Edit ${t.title}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>
                      <button type="button" onClick={() => toggle.mutate(t.id)} title={active ? 'Pause template' : 'Activate template'} aria-label={active ? `Pause ${t.title}` : `Activate ${t.title}`} className="btn btn-ghost btn-icon btn-sm"><i className={`fa-solid ${active ? 'fa-pause' : 'fa-play'}`} /></button>
                      <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this recurring template?')) delTpl.mutate(t.id); }} title="Delete template" aria-label={`Delete ${t.title}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>
                    </div></td>
                  </tr>);
              })}</tbody>
            </table>
          )}
        </div>
      )}

      {sub === 'checklist' && (
        <div id="expViewChecklist" className="space-y-3">
          <p className="text-sm text-muted">Commitments for <strong id="expChecklistMonthLabel" className="text-fg">{MONTHS[month - 1]} {year}</strong></p>
          {checklist.isPending ? <div className="card"><Skeleton rows={3} /></div> : (checklist.data ?? []).length === 0 ? <div className="card"><EmptyState icon="fa-clipboard-check" title="No recurring templates set up yet" hint="Add your rent, water and EMI templates to see the monthly checklist." /></div> : (
            <div id="expChecklistGrid" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(checklist.data ?? []).map((i) => {
                const recorded = i.isRecorded === true;
                const border = i.status === 'PAID' ? 'border-ok/50' : i.status === 'PENDING' ? 'border-warn/50' : i.status === 'OVERDUE' ? 'border-danger/60 bg-danger/5' : '';
                return (
                  <div key={i.templateId} className={`card p-4 flex flex-col gap-3 ${border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div><Badge tone={typeTone(i.type)} className="mb-1.5">{i.type}</Badge><h4 className="font-semibold text-fg leading-tight">{i.title}</h4>{i.vendorOrPayee && <p className="text-xs text-muted mt-1"><i className="fa-regular fa-building mr-1" />{i.vendorOrPayee}</p>}</div>
                      {i.status === 'PAID' ? <Badge tone="ok" icon="fa-check">Recorded & paid</Badge> : i.status === 'PENDING' ? <Badge tone="warn" icon="fa-clock">Recorded (pending)</Badge> : i.status === 'OVERDUE' ? <Badge tone="danger" icon="fa-triangle-exclamation">Overdue (day {i.dueDay})</Badge> : <Badge icon="fa-calendar">Due day {i.dueDay}</Badge>}
                    </div>
                    <div className="pt-2 border-t border-line flex items-center justify-between">
                      <div><p className="text-[11px] uppercase tracking-wide text-muted">Amount due</p><p className="text-base font-semibold text-fg">{amount2(i.expectedAmount)}</p></div>
                      {!recorded ? <button type="button" onClick={() => post.mutate(i.templateId)} className="btn btn-primary btn-sm"><i className="fa-solid fa-receipt" />Record now</button>
                        : <span className="text-xs text-muted flex items-center gap-1 font-mono"><i className="fa-solid fa-circle-check text-ok" />{i.expenseDate || 'Logged'}</span>}
                    </div>
                  </div>);
              })}
            </div>
          )}
        </div>
      )}

      {modal?.kind === 'expense' && <ExpenseDialog key={modal.expense?.id ?? 'new'} expense={modal.expense} onClose={close} />}
      {modal?.kind === 'template' && <TemplateDialog key={modal.template?.id ?? 'new'} template={modal.template} onClose={close} />}
    </section>
  );
}
