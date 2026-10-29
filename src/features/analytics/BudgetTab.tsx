import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Badge, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchBudget, saveBudget, type BudgetRow } from './api';
import { STATUS_TEXT, STATUS_TONE, barColor, barWidth, isFutureMonth, monthLabel, parseBudget, rupee0, shiftMonth } from './money';

/** Planned monthly spending for each category against what was actually spent, with where the month will end. */
export function BudgetTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const q = useQuery({ queryKey: ['reports', 'budget', ym], queryFn: () => fetchBudget(ym.year, ym.month) });
  const [typed, setTyped] = useState<Record<string, string>>({});
  const dirty = Object.keys(typed).length > 0;
  const save = useMutation({
    mutationFn: () => {
      const updates: { category: string; monthlyAmount: number | null }[] = [];
      for (const [category, t] of Object.entries(typed)) { const v = parseBudget(t); if (v === undefined) throw new Error(`Check the amount for ${q.data?.rows.find((r) => r.category === category)?.label ?? category}.`); updates.push({ category, monthlyAmount: v }); }
      return saveBudget(updates);
    },
    onSuccess: () => { setTyped({}); showToast('Budget saved', 'success'); void qc.invalidateQueries({ queryKey: ['reports', 'budget'] }); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const b = q.data;
  const row = (r: BudgetRow, total = false) => (
    <tr key={r.category} data-budget-row={r.category} className={total ? 'font-semibold' : ''}>
      <td data-label="" className="cell-title font-medium text-fg">{r.label}</td>
      <td data-label="Budget" className="md:text-right">{total ? (r.budget != null ? rupee0(r.budget) : '-') : (
        <input type="number" min={0} step="any" inputMode="decimal" aria-label={`Monthly budget for ${r.label}`} placeholder="none" value={typed[r.category] ?? (r.budget ?? '')} onChange={(e) => setTyped({ ...typed, [r.category]: e.target.value })} className={`input w-28 text-right ${typed[r.category] !== undefined && parseBudget(typed[r.category]) === undefined ? 'border-danger' : ''}`} />)}</td>
      <td data-label="Spent" className="md:text-right">{rupee0(r.actual)}</td>
      <td data-label="Left" className={`md:text-right ${r.remaining != null && r.remaining < 0 ? 'text-danger font-semibold' : 'text-muted'}`}>{r.remaining != null ? rupee0(r.remaining) : '-'}</td>
      <td data-label="Used" className="md:min-w-36">{r.usedPercent != null ? <div><div className="h-2 rounded-full bg-subtle overflow-hidden"><div className={`h-full rounded-full ${barColor(r.status)}`} style={{ width: `${barWidth(r.usedPercent)}%` }} /></div><span className="text-xs text-muted">{r.usedPercent}% used</span></div> : <span className="text-xs text-muted">-</span>}</td>
      <td data-label="Month end" className="md:text-right text-muted">{r.budget != null ? rupee0(r.projected) : '-'}</td>
      <td data-label="Status"><Badge tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status]}</Badge></td>
    </tr>
  );
  return (
    <div id="analytics-sub-budget" className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Previous month" onClick={() => setYm(shiftMonth(ym.year, ym.month, -1))} className="btn btn-secondary w-10 h-10 p-0"><i className="fa-solid fa-chevron-left" /></button>
        <strong id="budgetMonth" className="text-fg min-w-36 text-center">{monthLabel(ym.year, ym.month)}</strong>
        <button type="button" aria-label="Next month" disabled={isFutureMonth(ym.year, ym.month + 1)} onClick={() => setYm(shiftMonth(ym.year, ym.month, 1))} className="btn btn-secondary w-10 h-10 p-0"><i className="fa-solid fa-chevron-right" /></button>
        <button type="button" id="btnSaveBudget" disabled={!dirty || save.isPending} onClick={() => save.mutate()} className="btn btn-primary h-10 ml-auto"><i className="fa-solid fa-floppy-disk" />Save budget</button>
      </div>
      <p className="text-sm text-muted">Type the amount you plan to spend each month. The same budget applies to every month until you change it. Leave a box empty for no budget. Month end shows where spending will land at the current pace.</p>
      {q.isPending ? <div className="card"><Skeleton rows={6} /></div> : q.isError || !b ? <p className="card p-6 text-center text-sm text-danger">Failed to load the budget: {q.error?.message}</p> : (
        <div className="card overflow-hidden">
          <table className="rtable"><thead><tr><th>Category</th><th className="text-right">Budget / month</th><th className="text-right">Spent</th><th className="text-right">Left</th><th>Used</th><th className="text-right">Month end</th><th>Status</th></tr></thead>
            <tbody id="budgetBody">{b.rows.map((r) => row(r))}{row(b.total, true)}</tbody></table>
        </div>)}
    </div>
  );
}
