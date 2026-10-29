import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { hasFeature } from '../../api/roles';
import { showToast } from '../../components/toast';
import { Badge, Field, Skeleton, Switch } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchDailyClose, fetchDailyCloseSettings, saveDailyCloseSettings, sendDailyClose } from './api';
import { attentionList, cashStatus, isoDay, rupee0, shiftDay } from './money';

const Tile = ({ id, label, value, sub, tone = 'text-fg' }: { id: string; label: string; value: string; sub?: string; tone?: string }) => (
  <div className="card p-4"><p className="text-xs text-muted">{label}</p><p id={id} className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>{sub && <p className="text-xs text-muted mt-1">{sub}</p>}</div>
);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-');

function SettingsForm({ initial }: { initial: { enabled: boolean; time: string } }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [time, setTime] = useState(initial.time);
  const save = useMutation({
    mutationFn: () => saveDailyCloseSettings({ enabled, time }),
    onSuccess: () => { showToast(enabled ? `The report will be sent to Telegram every day at ${time}.` : 'Automatic sending is off.', 'success'); void qc.invalidateQueries({ queryKey: ['reports', 'daily-close-settings'] }); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  return (
    <form className="card p-4 flex flex-wrap items-end gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center gap-3"><Switch checked={enabled} onChange={() => setEnabled(!enabled)} label="Send the daily close report automatically" /><span className="text-sm text-fg">Send every day on Telegram</span></div>
      <Field id="dailyCloseTime" label="At what time"><input id="dailyCloseTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-32" /></Field>
      <button type="submit" id="btnSaveDailyClose" disabled={save.isPending} className="btn btn-primary h-10">Save</button>
      <p className="basis-full text-xs text-muted">Goes to the managers linked and selected in the Telegram screen. It is sent once per day, at the time you choose, after closing.</p>
    </form>
  );
}

function Settings() {
  const s = useQuery({ queryKey: ['reports', 'daily-close-settings'], queryFn: fetchDailyCloseSettings });
  if (s.isPending) return <div className="card"><Skeleton rows={2} /></div>;
  return <SettingsForm key={`${s.data?.enabled}-${s.data?.time}`} initial={s.data ?? { enabled: false, time: '23:30' }} />;
}

/** One page for the end of the day, with a button to send it to the managers on Telegram. */
export function DailyCloseTab() {
  const telegram = useSession((s) => (s.user ? hasFeature(s.user, 'TELEGRAM') : true));
  const [date, setDate] = useState(isoDay());
  const today = isoDay();
  const q = useQuery({ queryKey: ['reports', 'daily-close', date], queryFn: () => fetchDailyClose(date), enabled: !!date });
  const send = useMutation({
    mutationFn: () => sendDailyClose(date),
    onSuccess: (r) => showToast(r.message, r.sent > 0 ? 'success' : 'warning'),
    onError: (e: Error) => showToast(`Could not send: ${e.message}`, 'error'),
  });
  const d = q.data;
  return (
    <div id="analytics-sub-daily" className="space-y-4">
      <div className="card p-3 flex flex-wrap items-end gap-2">
        <button type="button" aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))} className="btn btn-secondary w-10 h-10 p-0"><i className="fa-solid fa-chevron-left" /></button>
        <Field id="dailyCloseDate" label="Day"><input id="dailyCloseDate" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input" /></Field>
        <button type="button" aria-label="Next day" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))} className="btn btn-secondary w-10 h-10 p-0"><i className="fa-solid fa-chevron-right" /></button>
        <button type="button" onClick={() => setDate(today)} disabled={date === today} className="btn btn-secondary h-10">Today</button>
        {telegram && <button type="button" id="btnSendDailyClose" disabled={send.isPending || !d} onClick={() => send.mutate()} className="btn btn-primary h-10 ml-auto"><i className="fa-brands fa-telegram" />{send.isPending ? 'Sending...' : 'Send to Telegram now'}</button>}
      </div>

      {q.isPending ? <div className="card"><Skeleton rows={6} /></div> : q.isError || !d ? <p className="card p-6 text-center text-sm text-danger">Failed to load the report: {q.error?.message}</p> : (<>
        {attentionList(d).length > 0 && (
          <div id="dailyAttention" className="card p-4 border-warn/40"><h3 className="text-sm font-medium text-fg mb-2"><i className="fa-solid fa-triangle-exclamation text-warn mr-1.5" />Needs a look</h3>
            <ul className="space-y-1 text-sm text-fg">{attentionList(d).map((t) => <li key={t}>{t}</li>)}</ul></div>)}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile id="dcSales" label="Sales" value={rupee0(d.sales)} tone="text-ok" sub={d.changePercent != null ? `${d.changePercent >= 0 ? 'Up' : 'Down'} ${Math.abs(d.changePercent)}% on the day before` : d.sales > 0 ? 'Nothing sold the day before' : undefined} />
          <Tile id="dcOrders" label="Orders" value={String(d.orders)} sub={d.orders > 0 ? `Average bill ${rupee0(d.avgBill)}` : undefined} />
          <Tile id="dcExpenses" label="Expenses" value={rupee0(d.expenses)} tone="text-danger" sub={d.topExpense ? `Most on ${d.topExpense}` : undefined} />
          <Tile id="dcTips" label="Tips received" value={rupee0(d.tips)} sub={d.gst > 0 ? `GST collected ${rupee0(d.gst)}` : undefined} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4"><h3 className="text-sm font-medium text-fg mb-2">How guests paid</h3>
            {d.payments.length === 0 ? <p className="text-sm text-muted py-4 text-center">No sales</p> : <ul id="dcPayments" className="space-y-1.5 text-sm">{d.payments.map((p) => <li key={p.name} className="flex justify-between"><span>{p.name} <span className="text-muted">({p.count})</span></span><b>{rupee0(p.amount)}</b></li>)}</ul>}
            {d.busiestHour && <p className="text-xs text-muted mt-3">Busiest hour: {d.busiestHour}</p>}
            {d.topDishes.length > 0 && <p className="text-xs text-muted mt-1">Top dishes: {d.topDishes.map((x) => `${x.name} x${x.count}`).join(', ')}</p>}</div>
          <div className="card p-4"><h3 className="text-sm font-medium text-fg mb-2">Losses</h3>
            <ul id="dcLosses" className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Discounts and promotions</span><b>{rupee0(d.discounts)}</b></li>
              <li className="flex justify-between"><span>Refunds ({d.refundCount})</span><b className={d.refunds > 0 ? 'text-danger' : ''}>{rupee0(d.refunds)}</b></li>
              <li className="flex justify-between"><span>Voided orders ({d.voidedCount})</span><b className={d.voidedCount > 0 ? 'text-danger' : ''}>{rupee0(d.voidedValue)}</b></li>
              <li className="flex justify-between"><span>Cancelled orders</span><b>{d.cancelledCount}</b></li>
              <li className="flex justify-between"><span>Stock wasted</span><b className={d.wasteCost > 0 ? 'text-danger' : ''}>{rupee0(d.wasteCost)}</b></li>
            </ul></div>
        </div>
        <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Cash drawer</p>
          <table className="rtable"><thead><tr><th>Cashier</th><th>Shift</th><th className="text-right">Cash sales</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th>Result</th></tr></thead>
            <tbody id="dcShifts">{d.shifts.length === 0 ? <tr><td colSpan={6} className="text-center text-sm text-muted py-6">No shift was opened on this day</td></tr> : d.shifts.map((s) => { const c = cashStatus(s); return (
              <tr key={s.id}><td data-label="" className="cell-title font-medium text-fg">{s.cashier}</td><td data-label="Shift" className="text-xs text-muted">{when(s.openedAt)} to {s.status === 'OPEN' ? 'now' : when(s.closedAt)}</td>
                <td data-label="Cash sales" className="md:text-right">{rupee0(s.cashSales)}</td><td data-label="Expected" className="md:text-right">{s.expectedCash != null ? rupee0(s.expectedCash) : '-'}</td><td data-label="Counted" className="md:text-right">{s.countedCash != null ? rupee0(s.countedCash) : '-'}</td>
                <td data-label="Result"><Badge tone={c.tone}>{c.text}</Badge></td></tr>); })}</tbody></table></div>
        <div className="card p-4"><h3 className="text-sm font-medium text-fg mb-2">Stock</h3>
          <div className="flex flex-wrap gap-2 text-sm" id="dcStock"><Badge tone={d.lowStock ? 'warn' : 'neutral'}>{d.lowStock} low</Badge><Badge tone={d.belowZero ? 'danger' : 'neutral'}>{d.belowZero} below zero</Badge><Badge tone={d.expiringSoon ? 'warn' : 'neutral'}>{d.expiringSoon} expiring soon</Badge><Badge tone={d.expired ? 'danger' : 'neutral'}>{d.expired} expired</Badge></div></div>
        {telegram && <details className="card p-4"><summary className="cursor-pointer text-sm font-medium text-fg">Message that is sent to Telegram</summary><pre id="dcText" className="mt-3 text-xs whitespace-pre-wrap text-muted font-sans">{d.text}</pre></details>}
      </>)}
      {telegram && <Settings />}
    </div>
  );
}
