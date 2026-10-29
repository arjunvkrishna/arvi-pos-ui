import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { fetchPayouts, fetchStaffReport, payTips, type Period, type StaffRow } from './api';
import { rupee0, rupee2 } from './money';

const PERIODS: [Period, string][] = [['TODAY', 'Today'], ['YESTERDAY', 'Yesterday'], ['THIS_WEEK', 'This week'], ['LAST_WEEK', 'Last week'], ['THIS_MONTH', 'This month'], ['LAST_MONTH', 'Last month']];

function PayDialog({ row, onClose }: { row: StaffRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(row.tipsOwed));
  const [note, setNote] = useState('');
  const v = Number(amount);
  const bad = !Number.isFinite(v) || v <= 0 || v > row.tipsOwed + 0.004;
  const pay = useMutation({
    mutationFn: () => payTips(row.staffId, v, note.trim()),
    onSuccess: () => { showToast(`Tips of ${rupee2(v)} marked as handed to ${row.staff}`, 'success'); void qc.invalidateQueries({ queryKey: ['reports'] }); onClose(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  return (
    <Dialog id="tipPayoutModal" open onClose={onClose} size="sm" title={`Hand over tips to ${row.staff}`} description={`${rupee2(row.tipsOwed)} is owed from tips received on their orders.`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!bad) pay.mutate(); }}>
        <Field id="tipPayAmount" label="Amount handed over (₹)"><input id="tipPayAmount" type="number" min={0} step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`input ${bad ? 'border-danger' : ''}`} autoFocus /></Field>
        <Field id="tipPayNote" label="Note (optional)"><input id="tipPayNote" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="input" /></Field>
        {bad && <p className="text-xs text-danger">Enter an amount above zero and not more than {rupee2(row.tipsOwed)}.</p>}
        <p className="text-xs text-muted">This records that the money was given. It does not move money in the cash drawer.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" id="btnConfirmTipPayout" disabled={bad || pay.isPending} className="btn btn-primary">Mark as handed over</button></div>
      </form>
    </Dialog>
  );
}

/** How each person is doing, and the tips they received and were handed. */
export function StaffTab() {
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  const [pay, setPay] = useState<StaffRow | null>(null);
  const q = useQuery({ queryKey: ['reports', 'staff', period], queryFn: () => fetchStaffReport({ period, start: '', end: '' }) });
  const payouts = useQuery({ queryKey: ['reports', 'payouts'], queryFn: fetchPayouts });
  const r = q.data;
  return (
    <div id="analytics-sub-staff" className="space-y-4">
      <div className="card p-3"><div className="max-w-full overflow-x-auto no-scrollbar"><SegmentedTabs label="Period" value={period} onChange={setPeriod} options={PERIODS.map(([v, l]) => ({ value: v, label: l, id: `staff-pill-${v}` }))} /></div></div>
      {q.isPending ? <div className="card"><Skeleton rows={5} /></div> : q.isError || !r ? <p className="card p-6 text-center text-sm text-danger">Failed to load staff figures: {q.error?.message}</p> : (<>
        <p id="staffPeriod" className="text-sm text-muted">{r.start} to {r.end}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4"><p className="text-xs text-muted">Sales taken</p><p id="staffTotalSales" className="text-2xl font-semibold mt-1 text-ok">{rupee0(r.totalSales)}</p><p className="text-xs text-muted mt-1">{r.totalOrders} orders</p></div>
          <div className="card p-4"><p className="text-xs text-muted">Tips received</p><p id="staffTotalTips" className="text-2xl font-semibold mt-1">{rupee0(r.totalTips)}</p>{r.totalTips > 0 && r.equalShare > 0 && <p className="text-xs text-muted mt-1">Equal share {rupee0(r.equalShare)} each</p>}</div>
          <div className="card p-4"><p className="text-xs text-muted">Tips still owed to staff</p><p id="staffTotalOwed" className={`text-2xl font-semibold mt-1 ${r.totalTipsOwed > 0 ? 'text-warn' : ''}`}>{rupee0(r.totalTipsOwed)}</p><p className="text-xs text-muted mt-1">all time, not just this period</p></div>
        </div>
        <div className="card overflow-hidden">
          {r.staff.length === 0 ? <EmptyState icon="fa-user-group" title="No orders in this period" /> : (
            <table className="rtable"><thead><tr><th>Staff</th><th className="text-right">Orders</th><th className="text-right">Sales</th><th className="text-right">Avg bill</th><th className="text-right">Dishes / order</th><th className="text-right">Discounts</th><th className="text-right">Refunds</th><th className="text-right">Tips</th><th className="text-right">Owed</th><th /></tr></thead>
              <tbody id="staffBody">{r.staff.map((s) => (
                <tr key={s.staffId} data-staff-row={s.staff}>
                  <td data-label="" className="cell-title font-medium text-fg">{s.staff} <span className="text-xs text-muted font-normal">{s.salesShare}%</span></td>
                  <td data-label="Orders" className="md:text-right">{s.orders}</td><td data-label="Sales" className="md:text-right font-semibold text-brand-text">{rupee0(s.sales)}</td>
                  <td data-label="Avg bill" className="md:text-right">{rupee0(s.avgOrder)}</td><td data-label="Dishes / order" className="md:text-right text-muted">{s.itemsPerOrder}</td>
                  <td data-label="Discounts" className="md:text-right text-muted">{rupee0(s.discounts)}</td><td data-label="Refunds" className={`md:text-right ${s.refunds > 0 ? 'text-danger' : 'text-muted'}`}>{rupee0(s.refunds)}</td>
                  <td data-label="Tips" className="md:text-right">{rupee0(s.tips)}</td>
                  <td data-label="Owed" className="md:text-right">{s.tipsOwed > 0 ? <Badge tone="warn">{rupee2(s.tipsOwed)}</Badge> : <span className="text-muted">-</span>}</td>
                  <td className="md:text-right">{s.tipsOwed > 0 && <button type="button" className="btn btn-secondary btn-sm" data-pay={s.staff} onClick={() => setPay(s)}>Hand over</button>}</td>
                </tr>))}</tbody></table>)}
        </div>
      </>)}
      <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Tips handed over</p>
        <table className="rtable"><thead><tr><th>Date</th><th>Staff</th><th className="text-right">Amount</th><th>Note</th><th>By</th></tr></thead>
          <tbody id="payoutBody">{(payouts.data ?? []).length === 0 ? <tr><td colSpan={5} className="text-center text-sm text-muted py-6">No tips handed over yet</td></tr> : (payouts.data ?? []).map((p) => (
            <tr key={p.id}><td data-label="" className="cell-title text-xs">{p.paidOn}</td><td data-label="Staff" className="font-medium text-fg">{p.staffName}</td><td data-label="Amount" className="md:text-right font-semibold">{rupee2(p.amount)}</td><td data-label="Note" className="text-muted text-xs">{p.note || '-'}</td><td data-label="By" className="text-muted text-xs">{p.createdBy || '-'}</td></tr>))}</tbody></table></div>
      {pay && <PayDialog key={pay.staffId} row={pay} onClose={() => setPay(null)} />}
    </div>
  );
}
