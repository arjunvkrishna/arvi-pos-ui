import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { formatISTDateTime } from '../../lib/time';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { closeShift, fetchCurrent, fetchHistory, fetchSettings, openShift, recordMovement, setModuleEnabled, shiftKey, type Shift } from './api';
import { durationText, historyTotals, isMultipleOpenError, varianceOf, varianceText, varianceTone } from './rules';

const fmt = (n?: number | null) => `₹${Number(n || 0).toFixed(2)}`;

/** Cashier shift: open, record drawer cash in / out, close with a count (managers and admins). History tab for audit. */
export function ShiftDialog({ onClose }: { onClose: () => void }) {
  const isAdmin = useSession((s) => s.user?.role) === 'ADMIN';
  const qc = useQueryClient();
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const refresh = () => { void qc.invalidateQueries({ queryKey: shiftKey }); void qc.invalidateQueries({ queryKey: ['drawer-analysis'] }); };
  const settings = useQuery({ queryKey: [...shiftKey, 'settings'], queryFn: fetchSettings });
  const toggle = useMutation({ mutationFn: setModuleEnabled, onSuccess: (u) => { showToast(`Cashier Shift feature has been ${u.enabled ? 'ENABLED' : 'DISABLED'}`, 'success'); refresh(); }, onError: (e: Error) => showToast(`Failed to update shift feature status: ${e.message}`, 'error') });
  const enabled = settings.data?.enabled !== false;

  return (
    <Dialog id="cashierShiftModal" open onClose={onClose} size="lg" title="Cashier shift & drawer" description="Open the drawer, record cash in and out, and hand over with a counted total.">
      <div className="space-y-4">
        {isAdmin && (
          <div id="shiftAdminControlCard" className="rounded-lg border border-line p-3 flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium text-fg">Shift module</p><p className="text-xs text-muted">When disabled, managers no longer see shifts. Status: <b id="shiftSettingStatusLabel" className={enabled ? 'text-ok' : 'text-danger'}>{enabled ? 'ENABLED' : 'DISABLED'}</b></p></div>
            <input id="shiftModuleToggle" type="checkbox" checked={enabled} disabled={toggle.isPending || settings.isPending} onChange={(e) => toggle.mutate(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" aria-label="Shift module enabled" />
          </div>)}
        <SegmentedTabs label="Shift sections" value={tab} onChange={setTab} options={[{ value: 'current', label: 'Current shift', id: 'shiftSubTabCurrent' }, { value: 'history', label: 'Shift history', id: 'shiftSubTabHistory' }]} />
        {tab === 'current' ? <Current onRefresh={refresh} onHistory={() => setTab('history')} /> : <History />}
      </div>
    </Dialog>
  );
}

function Current({ onRefresh, onHistory }: { onRefresh: () => void; onHistory: () => void }) {
  const q = useQuery({ queryKey: [...shiftKey, 'current-dialog'], queryFn: fetchCurrent, retry: false, staleTime: 0 });
  const after = () => { void q.refetch(); onRefresh(); };
  if (q.isPending) return <div id="shiftModalContent"><Skeleton rows={3} /></div>;
  if (q.isError) {
    if (isMultipleOpenError(q.error.message)) return (
      <div id="shiftModalContent" className="rounded-xl border border-danger/40 bg-danger/5 p-6 text-center space-y-3"><div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto text-xl"><i className="fa-solid fa-triangle-exclamation" /></div>
        <h4 className="font-medium text-fg">More than one shift is open</h4><p className="text-sm text-muted">Bill payments cannot be assigned safely. Open Shift history, close the extra shift, then continue with the single active drawer.</p>
        <button type="button" onClick={onHistory} className="btn btn-primary">Review open shifts</button></div>);
    return <div id="shiftModalContent"><OpenForm onDone={after} /></div>;
  }
  return <div id="shiftModalContent"><Open shift={q.data} onDone={after} /></div>;
}

function OpenForm({ onDone }: { onDone: () => void }) {
  const [reg, setReg] = useState('REG-01');
  const [float, setFloat] = useState('');
  const [notes, setNotes] = useState('');
  const open = useMutation({ mutationFn: () => openShift(reg.trim(), parseFloat(float), notes.trim()), onSuccess: (s) => { showToast(`Shift #${s.id} opened with ₹${parseFloat(float).toFixed(2)} opening cash`, 'success'); onDone(); }, onError: (e: Error) => showToast(`Failed to open shift: ${e.message}`, 'error') });
  return (
    <div className="rounded-xl border border-line p-6 space-y-4 text-center"><div className="w-12 h-12 rounded-full bg-brand/15 text-brand-text flex items-center justify-center mx-auto text-xl"><i className="fa-solid fa-cash-register" /></div>
      <div><h4 className="font-medium text-fg">No shift currently open</h4><p className="text-sm text-muted">Open a shift to start recording bill payments and drawer cash movements.</p></div>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); open.mutate(undefined); }} className="text-left max-w-sm mx-auto space-y-3">
        <Field id="openShiftRegister" label="Register / drawer name *" hint="Only one drawer shift can be open at a time so bill payments reconcile to the right shift."><input id="openShiftRegister" required value={reg} onChange={(e) => setReg(e.target.value)} className="input" /></Field>
        <Field id="openShiftFloat" label="Opening cash float (₹) *"><input id="openShiftFloat" required type="number" step="0.01" min="0" value={float} onChange={(e) => setFloat(e.target.value)} className="input font-semibold" placeholder="e.g. 10000" /></Field>
        <Field id="openShiftNotes" label="Opening notes"><input id="openShiftNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Optional notes…" /></Field>
        <button type="submit" id="btnOpenShift" disabled={open.isPending} className="btn btn-primary w-full h-10"><i className="fa-solid fa-play" />{open.isPending ? 'Opening…' : 'Open cashier shift'}</button>
      </form>
    </div>
  );
}

function Open({ shift, onDone }: { shift: Shift; onDone: () => void }) {
  const expected = Number(shift.expectedCash || 0);
  const [type, setType] = useState('CASH_IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const move = useMutation({ mutationFn: () => recordMovement(shift.id, type, parseFloat(amount), reason.trim()), onSuccess: () => { showToast(`${type} of ₹${parseFloat(amount).toFixed(2)} recorded successfully`, 'success'); setAmount(''); setReason(''); onDone(); }, onError: (e: Error) => showToast(`Failed to record movement: ${e.message}`, 'error') });
  const close = useMutation({ mutationFn: () => closeShift(shift.id, parseFloat(counted), notes.trim()), onSuccess: (c) => { showToast(`Shift closed! Expected: ₹${Number(c.expectedCash).toFixed(2)}, Variance: ${varianceText(Number(c.variance || 0))}`, 'success'); onDone(); }, onError: (e: Error) => showToast(`Failed to close shift: ${e.message}`, 'error') });
  const v = counted === '' ? 0 : varianceOf(parseFloat(counted) || 0, expected);
  const onClose = (e: FormEvent) => { e.preventDefault(); const c = parseFloat(counted); if (isNaN(c) || c < 0) { showToast('Enter the physical cash count', 'warning'); return; } if (!window.confirm(`Are you sure you want to close this shift with ₹${c.toFixed(2)} counted cash?`)) return; close.mutate(undefined); };
  const stat = (label: string, value: string, tone = 'text-fg') => <div className="rounded-lg bg-subtle p-2.5"><p className="text-[11px] text-muted">{label}</p><p className={`text-sm font-semibold ${tone}`}>{value}</p></div>;
  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-fg">Shift #{shift.id} — {shift.registerId || 'REG-01'}</p><p className="text-xs text-muted">On-duty manager: <b className="text-brand-text">{shift.cashierName || shift.cashierUsername}</b> | Started: {shift.openedAt ? formatISTDateTime(shift.openedAt) : '-'}</p></div><Badge tone="ok" icon="fa-circle">ACTIVE ON DUTY</Badge></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{stat('Opening float', fmt(shift.openingFloat))}{stat('Cash sales', `+${fmt(shift.cashSales)}`, 'text-ok')}{stat('Cash in / out', `+${fmt(shift.cashInTotal)} / -${fmt(shift.cashOutTotal)}`, 'text-info')}{stat('Cash refunds', `-${fmt(shift.cashRefunds)}`, 'text-danger')}</div>
        <div className="rounded-lg bg-brand/10 p-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-fg">System expected cash in drawer</p><p className="text-xs text-muted">Opening float + cash sales + cash added − cash refunds − cash removed</p></div><p id="shiftExpectedCash" className="text-lg font-semibold text-brand-text">{fmt(expected)}</p></div>
        <p className="text-xs text-muted flex gap-4">UPI sales: <b className="text-fg">{fmt(shift.upiSales)}</b> Card sales: <b className="text-fg">{fmt(shift.cardSales)}</b></p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); move.mutate(undefined); }} className="card p-4 space-y-2"><h4 className="text-sm font-medium text-fg"><i className="fa-solid fa-arrows-up-down text-info mr-1.5" />Record drawer cash in / out</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2"><select id="cashMovementType" value={type} onChange={(e) => setType(e.target.value)} className="input" aria-label="Type"><option value="CASH_IN">Add cash to drawer</option><option value="CASH_OUT">Remove cash (petty cash / payout)</option></select>
          <input id="cashMovementAmount" required type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="Amount (₹)" aria-label="Amount" />
          <input id="cashMovementReason" required value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Reason (e.g. change, milk)" aria-label="Reason" />
          <button type="submit" id="btnRecordMovement" disabled={move.isPending} className="btn btn-primary">Record</button></div></form>
      <form onSubmit={onClose} className="card p-4 space-y-3"><div><h4 className="text-sm font-medium text-fg"><i className="fa-solid fa-people-arrows text-brand-text mr-1.5" />Close shift & manager handover</h4><p className="text-xs text-muted mt-1">Count the drawer cash before handing over. The count and any shortage or surplus are recorded permanently in the audit log.</p></div>
        <div className="grid sm:grid-cols-2 gap-3"><Field id="closeShiftCountedCash" label="Physical counted cash in drawer (₹) *"><input id="closeShiftCountedCash" required type="number" step="0.01" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} className="input font-semibold" placeholder="e.g. 12800" /></Field>
          <div><span className="label">Drawer variance (counted − expected)</span><div id="closeShiftVarianceDisplay" className={`h-10 rounded-lg border border-line px-3 flex items-center font-semibold ${v === 0 ? 'text-ok' : v > 0 ? 'text-info' : 'text-danger'}`}>{varianceText(v)}</div></div></div>
        <Field id="closeShiftNotes" label="Handover notes / safe drop / discrepancy reason"><input id="closeShiftNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="e.g. Handed over to manager B, ₹15,000 dropped in safe" /></Field>
        <button type="submit" id="btnCloseShift" disabled={close.isPending} className="btn btn-danger w-full h-10"><i className="fa-solid fa-check-double" />{close.isPending ? 'Closing…' : 'Submit & close shift (hand over to next manager)'}</button></form>
    </div>
  );
}

function History() {
  const q = useQuery({ queryKey: [...shiftKey, 'history'], queryFn: fetchHistory });
  const [openId, setOpenId] = useState<number | null>(null);
  if (q.isPending) return <div id="shiftHistoryContent"><Skeleton rows={3} /></div>;
  if (q.isError) return <p id="shiftHistoryContent" className="text-sm text-danger text-center py-4">Failed to load shifts: {q.error.message}</p>;
  const shifts = q.data ?? [];
  if (shifts.length === 0) return <div id="shiftHistoryContent"><EmptyState icon="fa-receipt" title="No shift history recorded yet" /></div>;
  const t = historyTotals(shifts);
  return (
    <div id="shiftHistoryContent" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div className="rounded-lg bg-subtle p-3"><p className="text-[11px] text-muted">Total shifts audited</p><p className="text-sm font-semibold text-fg">{t.total} ({t.closed} closed)</p></div>
        <div className="rounded-lg bg-danger/5 border border-danger/30 p-3"><p className="text-[11px] text-danger font-medium">Cash shortages</p><p className="text-sm font-semibold text-danger">{t.shortages} shifts (-₹{t.shortage.toFixed(2)})</p></div>
        <div className="rounded-lg bg-info/5 border border-info/30 p-3"><p className="text-[11px] text-info font-medium">Cash surpluses</p><p className="text-sm font-semibold text-info">{t.surpluses} shifts (+₹{t.surplus.toFixed(2)})</p></div>
        <div className="rounded-lg bg-subtle p-3"><p className="text-[11px] text-muted">Net audit variance</p><p className={`text-sm font-semibold ${t.net < 0 ? 'text-danger' : t.net > 0 ? 'text-info' : 'text-ok'}`}>{varianceText(t.net)}</p></div></div>
      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">{shifts.map((s) => {
        const closed = s.status === 'CLOSED'; const v = Number(s.variance || 0); const d = durationText(s); const mv = s.movements ?? [];
        return (
          <div key={s.id} className="card p-3.5 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line"><div><p className="font-medium text-fg">Shift #{s.id} — Register: {s.registerId || 'MAIN'} {d.overnight && <Badge tone="info">🌙 OVERNIGHT</Badge>}</p>
              <p className="text-xs text-muted">Opened by: <b className="text-brand-text">{s.cashierName || 'Cashier'}</b>{s.closingUserName && <> | Closed by: <b className="text-fg">{s.closingUserName}</b></>}</p></div>
              {!closed ? <Badge tone="ok">CURRENTLY OPEN</Badge> : Math.abs(v) < 0.01 ? <Badge tone="ok" icon="fa-check">Balanced (₹0.00)</Badge> : v < 0 ? <Badge tone="danger" icon="fa-triangle-exclamation">Shortage anomaly: -₹{Math.abs(v).toFixed(2)}</Badge> : <Badge tone={varianceTone(v)} icon="fa-circle-info">Surplus: +₹{v.toFixed(2)}</Badge>}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"><div><p className="text-[11px] text-muted">Float + cash sales</p>{fmt(s.openingFloat)} + {fmt(s.cashSales)}</div><div><p className="text-[11px] text-muted">In / out / refunds</p>+{fmt(s.cashInTotal)} / -{fmt(s.cashOutTotal)} / -{fmt(s.cashRefunds)}</div><div><p className="text-[11px] text-muted">Expected cash</p><b className="text-brand-text">{fmt(s.expectedCash)}</b></div><div><p className="text-[11px] text-muted">Physical counted</p><b className={closed ? 'text-fg' : 'text-muted'}>{closed ? fmt(s.countedCash) : 'In progress'}</b></div></div>
            {s.notes && <p className="text-xs rounded-lg bg-subtle p-2"><b className="text-fg">Shift notes:</b> <span className="text-muted">{s.notes}</span></p>}
            <div className="flex items-center justify-between text-[11px] text-muted"><span>Opened: {formatISTDateTime(s.openedAt)} {s.closedAt && `• Closed: ${formatISTDateTime(s.closedAt)}${d.text}`}</span>
              {mv.length > 0 ? <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} className="text-info font-medium underline">View {mv.length} cash movement{mv.length > 1 ? 's' : ''}</button> : <span>No cash movements</span>}</div>
            {openId === s.id && <div className="space-y-1.5 pt-2 border-t border-line text-xs">{mv.map((m, i) => <div key={i} className="flex justify-between items-center rounded bg-subtle p-1.5 gap-2"><span className={`font-semibold ${m.movementType === 'CASH_IN' ? 'text-ok' : 'text-danger'}`}>{m.movementType === 'CASH_IN' ? 'Cash in' : 'Cash out'}: {fmt(m.amount)}</span><span className="text-fg">{m.reason || 'No reason'}</span><span className="text-[11px] text-muted">{formatISTDateTime(m.createdAt)}</span></div>)}</div>}
          </div>);
      })}</div>
    </div>
  );
}
