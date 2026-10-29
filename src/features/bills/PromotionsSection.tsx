import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import { formatISTDateTime } from '../../lib/time';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { deletePromotion, fetchPromotions, promotionsKey, savePromotion, togglePromotion, type Promotion } from './api';
import { WEEK_DAYS, activePromotion, defaultPromoRange, defaultRecurringRange, promotionProblem, promotionTone, toggleDay } from './rules';

/** Scheduled customer discounts (managers and admins). The active one is applied to bills after GST. */
export function PromotionsSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: promotionsKey, queryFn: fetchPromotions });
  const [edit, setEdit] = useState<Promotion | 'new' | null>(null);
  const done = () => void qc.invalidateQueries({ queryKey: promotionsKey });
  const toggle = useMutation({ mutationFn: togglePromotion, onSuccess: (r) => { showToast(`Promotion '${r.name}' is now ${r.isActive ? 'ACTIVE' : 'INACTIVE'}`, 'success'); done(); }, onError: (e: Error) => showToast(`Failed to toggle promotion: ${e.message}`, 'error') });
  const del = useMutation({ mutationFn: deletePromotion, onSuccess: () => { showToast('Promotion deleted successfully', 'success'); done(); }, onError: (e: Error) => showToast(`Failed to delete promotion: ${e.message}`, 'error') });
  const list = q.data ?? [];
  const active = activePromotion(list);
  return (
    <section id="promotionsManagementSection" className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-medium text-fg"><i className="fa-solid fa-tags mr-1.5 text-brand-text" />Promotions & discounts</h3><p className="text-xs text-muted">Discount applied automatically to customer bills after GST while a promotion is active.</p></div>
        <button type="button" id="btnNewPromotion" onClick={() => setEdit('new')} className="btn btn-primary btn-sm"><i className="fa-solid fa-plus" />New promotion</button>
      </div>
      {active && <p id="activePromotionBanner" className="px-4 py-2 bg-ok/10 text-sm text-ok"><i className="fa-solid fa-bolt mr-1.5" />Live now: <b id="activePromotionBannerText">{active.name} ({active.discountPercentage}%)</b></p>}
      {q.isPending ? <Skeleton rows={2} /> : list.length === 0 ? <EmptyState icon="fa-tags" title="No promotions created yet" hint='Click "New promotion" to schedule customer discounts.' /> : (
        <table className="rtable"><thead><tr><th>Promotion name</th><th className="text-center">Discount %</th><th>When (IST)</th><th className="text-center">Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody id="promotionsTableBody">{list.map((p) => (
            <tr key={p.id}><td data-label="" className="cell-title"><span className="font-medium text-fg block">{p.name}</span>{p.description && <span className="text-xs text-muted">{p.description}</span>}</td>
              <td data-label="Discount" className="md:text-center font-mono font-semibold text-brand-text">{p.discountPercentage}%</td><td data-label="When" className="font-mono text-xs">{p.recurring ? <><span className="block font-sans font-medium text-fg">{p.scheduleText}</span><span className="text-muted">from {formatISTDateTime(p.startDateTime)} to {formatISTDateTime(p.endDateTime)}</span></> : <>{formatISTDateTime(p.startDateTime)} to {formatISTDateTime(p.endDateTime)}</>}</td>
              <td data-label="Status" className="md:text-center"><Badge tone={promotionTone(p.status)}>{p.status}</Badge></td>
              <td className="cell-actions"><div className="flex flex-wrap justify-end gap-1.5 w-full md:w-auto">
                <button type="button" onClick={() => toggle.mutate(p.id)} className={`btn btn-sm ${p.isActive ? 'btn-soft-brand' : 'btn-soft-ok'}`}><i className={`fa-solid ${p.isActive ? 'fa-pause' : 'fa-play'}`} />{p.isActive ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => setEdit(p)} title="Edit promotion" aria-label={`Edit ${p.name}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>
                <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this promotion? This action is logged to the audit trail.')) del.mutate(p.id); }} title="Delete promotion" aria-label={`Delete ${p.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-solid fa-trash-can" /></button></div></td></tr>))}</tbody></table>)}
      {edit && <PromotionDialog key={edit === 'new' ? 'new' : edit.id} promo={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); done(); }} />}
    </section>
  );
}

function PromotionDialog({ promo, onClose, onSaved }: { promo: Promotion | null; onClose: () => void; onSaved: () => void }) {
  const range = defaultPromoRange();
  const [name, setName] = useState(promo?.name ?? '');
  const [pct, setPct] = useState(promo ? String(promo.discountPercentage) : '');
  const [start, setStart] = useState(promo?.startDateTime?.substring(0, 16) ?? range.start);
  const [end, setEnd] = useState(promo?.endDateTime?.substring(0, 16) ?? range.end);
  const [active, setActive] = useState(promo ? Boolean(promo.isActive) : true);
  const [desc, setDesc] = useState(promo?.description ?? '');
  const [recurring, setRecurring] = useState(Boolean(promo?.recurring));
  const [days, setDays] = useState<number[]>(promo?.daysOfWeek ?? [1, 2, 3, 4, 5]);
  const [dailyStart, setDailyStart] = useState(promo?.dailyStart?.substring(0, 5) ?? '16:00');
  const [dailyEnd, setDailyEnd] = useState(promo?.dailyEnd?.substring(0, 5) ?? '19:00');
  const [error, setError] = useState('');
  const onRecurring = (on: boolean) => { setRecurring(on); if (on && !promo?.recurring) { const r = defaultRecurringRange(); setStart(r.start); setEnd(r.end); } };
  const save = useMutation({ mutationFn: () => savePromotion(promo?.id ?? null, { name: name.trim(), discountPercentage: parseFloat(pct), startDateTime: start, endDateTime: end, isActive: active, description: desc.trim(), ...(recurring ? { recurring: true, daysOfWeek: days, dailyStart, dailyEnd } : { recurring: false }) }), onSuccess: () => { showToast(promo ? 'Promotion updated successfully' : 'Promotion created successfully', 'success'); onSaved(); }, onError: (e: Error) => setError(e.message || 'Failed to save promotion') });
  const submit = (e: FormEvent) => { e.preventDefault(); const p = promotionProblem({ name, pct: parseFloat(pct), start, end, recurring, days, dailyStart, dailyEnd }); if (p) { setError(p); return; } setError(''); save.mutate(undefined); };
  return (
    <Dialog id="promotionModal" open onClose={onClose} size="md" title={promo ? 'Edit promotion' : 'Create new promotion'} description="Discount automatically applied to customer bills after GST.">
      <form id="promotionForm" onSubmit={submit} className="space-y-4">
        <Field id="promoName" label="Promotion name *"><input id="promoName" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Happy Hour Special / Weekend Festive 10%" /></Field>
        <Field id="promoDiscountPct" label="Discount percentage (%) *" hint="Applied on the total after GST."><input id="promoDiscountPct" type="number" min="0" max="100" step="any" value={pct} onChange={(e) => setPct(e.target.value)} className="input" placeholder="e.g. 5 or 10" /></Field>
        <label htmlFor="promoRecurring" className="flex items-start gap-2 text-sm text-fg cursor-pointer"><input id="promoRecurring" type="checkbox" checked={recurring} onChange={(e) => onRecurring(e.target.checked)} className="h-4 w-4 mt-0.5 accent-[rgb(var(--brand))]" /><span><b>Happy hour: repeat every week</b><span className="block text-xs text-muted">Only applies on the chosen days between the daily start and end time, inside the date range below.</span></span></label>
        {recurring && (
          <div id="promoRecurringBox" className="rounded-lg border border-line p-3 space-y-3">
            <fieldset><legend className="label">Days</legend><div className="flex flex-wrap gap-1.5">{WEEK_DAYS.map(([n, l]) => <button key={n} type="button" data-day={n} aria-pressed={days.includes(n)} onClick={() => setDays(toggleDay(days, n))} className={`btn btn-sm min-h-[40px] min-w-[48px] ${days.includes(n) ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>)}</div></fieldset>
            <div className="grid grid-cols-2 gap-3"><Field id="promoDailyStart" label="From (every day)"><input id="promoDailyStart" type="time" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} className="input" /></Field><Field id="promoDailyEnd" label="Until" hint={dailyEnd < dailyStart ? 'Runs past midnight' : undefined}><input id="promoDailyEnd" type="time" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} className="input" /></Field></div>
          </div>)}
        <div className="grid sm:grid-cols-2 gap-3"><Field id="promoStartDateTime" label={recurring ? 'Valid from (IST) *' : 'Start date & time (IST) *'}><input id="promoStartDateTime" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="input" /></Field><Field id="promoEndDateTime" label={recurring ? 'Valid until (IST) *' : 'End date & time (IST) *'}><input id="promoEndDateTime" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="input" /></Field></div>
        <label htmlFor="promoIsActive" className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id="promoIsActive" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Active (applies automatically inside the time window)</label>
        <Field id="promoDescription" label="Description / notes"><textarea id="promoDescription" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className="input h-auto py-2" placeholder="Optional promotion terms or internal notes…" /></Field>
        {error && <p id="promotionFormError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" id="btnSavePromotion" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : promo ? 'Save changes' : 'Create promotion'}</button>
      </form>
    </Dialog>
  );
}
