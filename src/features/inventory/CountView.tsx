import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SearchInput, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { applyCount, cancelCount, countsKey, inventoryKey, saveCountLines, startCount, type StockCount } from './api';
import { useCount, useCounts } from './hooks';
import { CATEGORIES } from './rules';
import { parseCounted, summarize, varianceText } from './stockops';

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const rupee = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const STATUS_TONE = { DRAFT: 'warn', APPLIED: 'ok', CANCELLED: 'neutral' } as const;

function Sheet({ count, canApply, onDone }: { count: StockCount; canApply: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const lines = useMemo(() => count.lines ?? [], [count.lines]);
  const open = count.status === 'DRAFT';
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [term, setTerm] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: countsKey }); void qc.invalidateQueries({ queryKey: inventoryKey }); };
  const sum = summarize(lines, typed, (l) => l.costPerUnit ?? 0);

  const entries = () => {
    const out: { lineId: number; countedQty: number | null }[] = [];
    for (const [id, t] of Object.entries(typed)) { const v = parseCounted(t); if (v === undefined) return `Check the number for ${lines.find((l) => l.id === Number(id))?.name ?? 'an item'}.`; out.push({ lineId: Number(id), countedQty: v }); }
    return out;
  };
  const save = useMutation({
    mutationFn: async () => { const e = entries(); if (typeof e === 'string') throw new Error(e); return e.length ? saveCountLines(count.id, e) : count; },
    onSuccess: () => { setTyped({}); refresh(); showToast('Count saved', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const apply = useMutation({
    mutationFn: async () => { const e = entries(); if (typeof e === 'string') throw new Error(e); if (e.length) await saveCountLines(count.id, e); return applyCount(count.id); },
    onSuccess: (c) => { setTyped({}); refresh(); showToast(`Stock updated: ${c.differenceCount} item${c.differenceCount === 1 ? '' : 's'} adjusted`, 'success'); onDone(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const cancel = useMutation({ mutationFn: () => cancelCount(count.id), onSuccess: () => { refresh(); showToast('Count cancelled. Stock was not changed.', 'info'); onDone(); }, onError: (e: Error) => showToast(e.message, 'error') });
  const onApply = () => {
    if (sum.counted === 0) { showToast('Enter at least one counted quantity first.', 'warning'); return; }
    if (window.confirm(`Update the stock? ${sum.differences} item${sum.differences === 1 ? '' : 's'} differ (${rupee(sum.value)}). Items you did not count stay as they are. This cannot be undone.`)) apply.mutate();
  };

  const shown = lines.filter((l) => (!term || l.name.toLowerCase().includes(term.toLowerCase())) && (!onlyOpen || (typed[l.id] === undefined ? l.countedQty == null : parseCounted(typed[l.id]) == null)));
  return (
    <div id="countSheet" className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h3 className="font-medium text-fg">Count #{count.id} <Badge tone={STATUS_TONE[count.status]}>{count.status}</Badge></h3>
          <p className="text-xs text-muted">{count.scope} · started {when(count.createdAt)} by {count.createdBy || '-'}{count.note ? ` · ${count.note}` : ''}{!open && count.appliedAt ? ` · booked ${when(count.appliedAt)} by ${count.appliedBy}` : ''}</p></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" id="countSummary">
          <span><b>{open ? sum.counted : count.countedCount}</b> of {count.itemCount} counted</span>
          <span><b>{open ? sum.differences : count.differenceCount}</b> differ</span>
          <span className={(open ? sum.value : count.varianceValue) < 0 ? 'text-danger font-semibold' : 'text-fg font-semibold'}>{rupee(open ? sum.value : count.varianceValue)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput id="countSearch" value={term} onChange={setTerm} placeholder="Search items to count..." />
        <label className="flex items-center gap-2 text-sm text-muted min-h-[40px]"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="w-5 h-5" />Not counted yet</label>
        {open && <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" id="btnCountSave" disabled={save.isPending || apply.isPending} onClick={() => save.mutate()} className="btn btn-secondary"><i className="fa-solid fa-floppy-disk" />Save progress</button>
          {canApply && <button type="button" id="btnCountApply" disabled={apply.isPending} onClick={onApply} className="btn btn-primary"><i className="fa-solid fa-check" />Update stock</button>}
          <button type="button" id="btnCountCancel" disabled={cancel.isPending} onClick={() => { if (window.confirm('Cancel this count? Nothing will change in stock.')) cancel.mutate(); }} className="btn btn-secondary text-danger">Cancel count</button>
        </span>}
        {!open && <button type="button" onClick={onDone} className="btn btn-secondary ml-auto">Back</button>}
      </div>
      {open && !canApply && <p className="text-xs text-muted">You can enter counts. A manager or admin books the differences into stock.</p>}
      <div className="card overflow-hidden">
        <table className="rtable">
          <thead><tr><th>Item</th><th className="text-right">In the system</th><th className="text-right">Counted</th><th className="text-right">Difference</th></tr></thead>
          <tbody id="countBody">{shown.length === 0 ? <tr><td colSpan={4} className="text-center text-sm text-muted py-6">Nothing matches</td></tr> : shown.map((l) => {
            const t = typed[l.id]; const c = t === undefined ? l.countedQty ?? null : parseCounted(t);
            const diff = c === null || c === undefined ? null : Math.round((c - l.bookQty) * 1000) / 1000;
            return (
              <tr key={l.id} data-count-line={l.name}>
                <td data-label="" className="cell-title font-medium text-fg">{l.name}</td>
                <td data-label="In the system" className="md:text-right text-muted">{l.bookQty} {l.unit}</td>
                <td data-label="Counted" className="md:text-right">{open
                  ? <input type="number" min={0} step="any" inputMode="decimal" aria-label={`Counted quantity of ${l.name}`} placeholder="-" value={t ?? (l.countedQty ?? '')} onChange={(e) => setTyped({ ...typed, [l.id]: e.target.value })} className={`input w-28 text-right ${t !== undefined && parseCounted(t) === undefined ? 'border-danger' : ''}`} />
                  : l.countedQty ?? '-'}</td>
                <td data-label="Difference" className={`md:text-right font-medium ${diff ? (diff < 0 ? 'text-danger' : 'text-ok') : 'text-muted'}`}>{varianceText(diff, l.unit)}</td>
              </tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Count what is really on the shelf, see the difference with the system, and book it. */
export function CountView({ canApply }: { canApply: boolean }) {
  const counts = useCounts();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [category, setCategory] = useState('ALL');
  const [note, setNote] = useState('');
  const draft = counts.data?.find((c) => c.status === 'DRAFT') ?? null;
  const activeId = openId ?? draft?.id ?? null;
  const detail = useCount(activeId);
  const start = useMutation({
    mutationFn: () => startCount(category, note),
    onSuccess: (c) => { setNote(''); setOpenId(c.id); void qc.invalidateQueries({ queryKey: countsKey }); showToast('Count started. Enter what you find on the shelf.', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  if (counts.isPending) return <div className="card"><Skeleton rows={4} /></div>;
  if (counts.isError) return <p className="card p-6 text-center text-sm text-danger">Failed to load stock counts: {counts.error.message}</p>;
  if (activeId !== null) {
    if (detail.isPending) return <div className="card"><Skeleton rows={6} /></div>;
    if (detail.isError || !detail.data) return <p className="card p-6 text-center text-sm text-danger">Failed to load the count: {detail.error?.message}</p>;
    return <Sheet key={`${detail.data.id}-${detail.data.status}-${detail.dataUpdatedAt}`} count={detail.data} canApply={canApply} onDone={() => setOpenId(null)} />;
  }
  const past = counts.data ?? [];
  return (
    <div id="countHome" className="space-y-4">
      <form className="card p-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); start.mutate(); }}>
        <Field id="countCategory" label="What to count">
          <select id="countCategory" value={category} onChange={(e) => setCategory(e.target.value)} className="input"><option value="ALL">All items</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </Field>
        <Field id="countNote" label="Note (optional)"><input id="countNote" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. month end" className="input w-64 max-w-full" /></Field>
        <button type="submit" id="btnStartCount" disabled={start.isPending} className="btn btn-primary h-10"><i className="fa-solid fa-clipboard-check" />Start a stock count</button>
        <p className="basis-full text-xs text-muted">The system quantities are frozen when you start. Sales made while you count are kept: only the difference between your count and the frozen figure is booked.</p>
      </form>
      <div className="card overflow-hidden">
        <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Past counts</p>
        {past.length === 0 ? <EmptyState icon="fa-clipboard-list" title="No stock count yet" /> : (
          <table className="rtable">
            <thead><tr><th>#</th><th>Started</th><th>What</th><th>Status</th><th className="text-right">Differences</th><th className="text-right">Value</th><th /></tr></thead>
            <tbody id="countHistoryBody">{past.map((c) => (
              <tr key={c.id}><td data-label="" className="cell-title font-mono">#{c.id}</td><td data-label="Started" className="text-xs text-muted">{when(c.createdAt)} · {c.createdBy}</td><td data-label="What">{c.scope}</td>
                <td data-label="Status"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td><td data-label="Differences" className="md:text-right">{c.differenceCount} of {c.countedCount}</td>
                <td data-label="Value" className={`md:text-right font-medium ${c.varianceValue < 0 ? 'text-danger' : ''}`}>{rupee(c.varianceValue)}</td>
                <td className="md:text-right"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(c.id)}>View</button></td></tr>))}</tbody>
          </table>)}
      </div>
    </div>
  );
}
