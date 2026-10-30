import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, PageHeader, Skeleton } from '../../components/ui';
import { useNotifications } from '../notifications/hooks';
import { fetchEmployees, employeesKey, reviewLeave, type Leave } from '../staff/api';
import { EmployeeDossier } from '../staff/EmployeeDossier';
import { MONTHS, todayISO } from '../staff/rules';
import { applyLeave, checkIn, checkOut, fetchDay, fetchPunchStatus, fetchLeaves, fetchMonthly, fetchSummary, markAttendance, type Summary } from './api';
import { attendanceTone, joinedNote, percentTone, punchButtons, punchText, summaryYears } from './rules';

const leaveTone = (s: string) => (s === 'APPROVED' ? 'ok' : s === 'REJECTED' ? 'danger' : 'warn') as 'ok' | 'danger' | 'warn';

function SummaryKpis({ s, staff }: { s: Summary; staff: boolean }) {
  const pct = Math.min(100, Math.max(0, s.attendancePercentage));
  const bar = pct >= 80 ? 'bg-ok' : pct >= 50 ? 'bg-warn' : 'bg-danger';
  // Staff do not see joined date, eligible days, days present or attendance %; managers and admins see everything.
  const cards = [
    { id: 'kpiJoinedDate', label: 'Joined', value: s.joinedDate || 'Not set', noteId: 'kpiJoinedNote', note: joinedNote(s), hideForStaff: true },
    { id: 'kpiTotalMonthDays', label: 'Days in month', value: String(s.totalDaysInMonth) },
    { id: 'kpiEligibleDays', label: 'Eligible days', value: `${s.eligibleDays} days`, hideForStaff: true },
    { id: 'kpiPresentDays', label: 'Days present', value: `${s.effectivePresentDays} days`, noteId: 'kpiHalfDaysNote', note: `${s.halfDays} half-day, ${s.presentDays} full-day`, hideForStaff: true },
    { id: 'kpiAbsentLeaveDays', label: 'Absent / leave', value: `${s.absentDays + s.leaveDays} days`, noteId: 'kpiLeaveNote', note: `${s.absentDays} absent, ${s.leaveDays} on leave` },
  ].filter((c) => !(staff && c.hideForStaff));
  return (
    <div id="singleEmployeeSummaryView" className="space-y-3">
      <div className={`grid grid-cols-2 gap-3 ${staff ? '' : 'lg:grid-cols-5'}`}>
        {cards.map((c) => <div key={c.id} className="card p-4"><p className="text-xs text-muted">{c.label}</p><p id={c.id} className="text-lg font-semibold text-fg mt-1">{c.value}</p>{c.note && <p id={c.noteId} className="text-xs text-muted mt-0.5">{c.note}</p>}</div>)}
      </div>
      {!staff && <div className="card p-4"><div className="flex items-center justify-between text-sm mb-2"><span className="text-muted">Attendance</span><span id="kpiAttendancePercent" className="font-semibold text-fg">{s.attendancePercentage}%</span></div>
        <div className="h-2 rounded-full bg-subtle"><div id="kpiProgressBar" className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div></div>}
    </div>
  );
}

export function AttendancePage() {
  const me = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const isStaff = me.role === 'EMPLOYEE';
  const canReview = !isStaff;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [who, setWho] = useState('ALL');
  const [date, setDate] = useState(todayISO());
  const [dialog, setDialog] = useState<'apply' | { review: number } | { dossier: number } | null>(null);
  const close = () => setDialog(null);

  const pending = useNotifications().data?.pendingLeavesCount ?? 0;
  const employees = useQuery({ queryKey: employeesKey, queryFn: fetchEmployees, enabled: !isStaff });
  const targetId = isStaff ? me.employeeId : who === 'ALL' ? null : who;
  const single = isStaff || who !== 'ALL';
  const summary = useQuery({ queryKey: ['attendance-summary', targetId, year, month], queryFn: () => fetchSummary(targetId, year, month), enabled: single });
  const all = useQuery({ queryKey: ['monthly-summary', year, month], queryFn: () => fetchMonthly(year, month), enabled: !single });
  const day = useQuery({ queryKey: ['attendance-day', date], queryFn: () => fetchDay(date), enabled: !isStaff });
  const leaves = useQuery({ queryKey: ['leaves', isStaff, me.employeeId], queryFn: () => fetchLeaves(me.employeeId, isStaff) });

  const punchState = useQuery({ queryKey: ['punch-status', me.employeeId], queryFn: () => fetchPunchStatus(me.employeeId) });
  const refresh = () => { for (const k of [['punch-status'], ['attendance-day'], ['attendance-summary'], ['monthly-summary'], ['leaves'], ['employee-attendance']]) void qc.invalidateQueries({ queryKey: k }); };
  const punch = useMutation({
    mutationFn: (kind: 'in' | 'out') => (kind === 'in' ? checkIn(me.employeeId) : checkOut(me.employeeId)).then((r) => ({ kind, r })),
    onSuccess: ({ kind, r }) => { showToast(kind === 'in' ? `Shift Started! Checked in at ${r.checkIn}` : `Shift Ended! Checked out at ${r.checkOut}${r.date ? ` (Shift Date: ${r.date})` : ''}`, 'success'); refresh(); },
    onError: (e: Error, kind) => { showToast(`Check ${kind} failed: ${e.message}`, 'error'); void qc.invalidateQueries({ queryKey: ['punch-status'] }); },
  });
  const buttons = punchButtons(punchState.data, punch.isPending || punchState.isFetching);
  const mark = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => markAttendance(id, date, status),
    onSuccess: refresh, onError: (e: Error) => showToast(`Failed to mark attendance: ${e.message}`, 'error'),
  });

  const err = [summary, all, day, leaves].find((q) => q.isError)?.error?.message ?? '';
  useEffect(() => { if (err) showToast(`Failed to load attendance: ${err}`, 'error'); }, [err]);

  return (
    <section id="tab-attendance" data-testid="tab-attendance" className="space-y-5">
      <PageHeader title="Attendance & leaves" description="Punch your shift, apply for leave and review the team's attendance." />

      {canReview && pending > 0 && (
        <div id="leavePendingActionBanner" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-warn/15 text-warn flex items-center justify-center"><i className="fa-solid fa-bell" /></div>
            <div><p id="leavePendingBannerTitle" className="text-sm font-medium text-fg">{pending} leave application(s) pending action</p>
              <p id="leavePendingBannerDesc" className="text-xs text-muted">Staff members have applied for leaves that need manager or admin approval.</p></div></div>
          <button type="button" onClick={() => document.getElementById('leaveTableBody')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-primary btn-sm">View & review</button>
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium text-fg">Shift attendance & leave request</p><p id="empAttendanceStatusText" className="text-sm text-muted">{punchText(punchState.data, todayISO(), 'Punch your daily shift time or submit a leave application.')}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" id="btnCheckIn" disabled={buttons.checkInDisabled} onClick={() => punch.mutate('in')} className="btn bg-ok text-white hover:brightness-95"><i className="fa-solid fa-fingerprint" />Check in</button>
          <button type="button" id="btnCheckOut" disabled={buttons.checkOutDisabled} onClick={() => punch.mutate('out')} className="btn btn-danger"><i className="fa-solid fa-person-walking-arrow-right" />Check out</button>
          <button type="button" id="btnApplyLeave" onClick={() => setDialog('apply')} className="btn btn-primary"><i className="fa-solid fa-calendar-plus" />Apply leave</button>
        </div>
      </div>

      <div id="monthlyAttendanceSummarySection" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-medium text-fg">Monthly attendance & working days</h2><p className="text-sm text-muted">{isStaff ? 'Your days this month and your absences and leave.' : 'Eligible days run from the join date to month end.'}</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <select id="attendanceSummaryYear" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="input w-28" aria-label="Year">{summaryYears().map((y) => <option key={y}>{y}</option>)}</select>
            <select id="attendanceSummaryMonth" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="input w-36" aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            {!isStaff && (
              <div id="summaryEmployeeSelectorContainer"><select id="attendanceSummaryEmployee" value={who} onChange={(e) => setWho(e.target.value)} className="input w-48" aria-label="User">
                <option value="ALL">All staff overview</option>{(employees.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}</select></div>
            )}
          </div>
        </div>
        {single ? (summary.data ? <SummaryKpis s={summary.data} staff={isStaff} /> : <div className="card"><Skeleton rows={2} /></div>) : (
          <div id="allStaffSummaryView" className="card overflow-hidden">
            {all.isPending ? <Skeleton rows={4} /> : (all.data ?? []).length === 0 ? <EmptyState icon="fa-chart-pie" title="No staff attendance summaries found for this month" /> : (
              <table className="rtable">
                <thead><tr><th>Staff name</th><th>Role</th><th>Join date</th><th>Month days</th><th>Eligible</th><th>Present</th><th>Absent / leave</th><th>Attendance</th><th className="text-right">Action</th></tr></thead>
                <tbody id="allStaffSummaryTableBody">{(all.data ?? []).map((s) => (
                  <tr key={s.employeeId}>
                    <td data-label="" className="cell-title"><button type="button" onClick={() => setDialog({ dossier: s.employeeId! })} title="View full employee dossier" className="font-medium text-brand-text hover:underline text-left inline-flex items-center min-h-9">{s.employeeName}</button></td>
                    <td data-label="Role"><Badge>{s.role}</Badge></td><td data-label="Joined" className="font-mono text-xs">{s.joinedDate || '-'}</td><td data-label="Month days">{s.totalDaysInMonth}</td>
                    <td data-label="Eligible" className="font-semibold text-info">{s.eligibleDays} days</td>
                    <td data-label="Present" className="font-semibold text-ok">{s.effectivePresentDays} days <span className="text-xs text-muted font-normal">({s.presentDays} full, {s.halfDays} half)</span></td>
                    <td data-label="Absent / leave" className="font-semibold text-danger">{s.absentDays + s.leaveDays} <span className="text-xs text-muted font-normal">({s.absentDays} abs, {s.leaveDays} lve)</span></td>
                    <td data-label="Attendance"><Badge tone={percentTone(s.attendancePercentage)}>{s.attendancePercentage}%</Badge></td>
                    <td className="cell-actions"><div className="flex justify-end gap-1.5 w-full md:w-auto"><button type="button" onClick={() => setDialog({ dossier: s.employeeId! })} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-id-card" />Dossier</button>
                      <button type="button" onClick={() => setWho(String(s.employeeId))} className="btn btn-secondary btn-sm"><i className="fa-solid fa-chart-pie" />Month</button></div></td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {!isStaff && (
        <div id="adminAttendanceSection" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-medium text-fg">Daily attendance register</h2>
            <Field id="attendanceFilterDate" label="Date"><input id="attendanceFilterDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field></div>
          <div className="card overflow-hidden">
            {day.isPending ? <Skeleton rows={4} /> : (day.data ?? []).length === 0 ? <EmptyState icon="fa-calendar-day" title="No attendance records for this date" /> : (
              <table className="rtable"><thead><tr><th>Staff name</th><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th><th className="text-right">Quick mark</th></tr></thead>
                <tbody id="attendanceTableBody">{(day.data ?? []).map((r) => (
                  <tr key={r.employeeId}>
                    <td data-label="" className="cell-title"><button type="button" onClick={() => setDialog({ dossier: r.employeeId })} title="View full employee dossier" className="font-medium text-brand-text hover:underline text-left inline-flex items-center min-h-9">{r.employeeName}</button></td>
                    <td data-label="Date">{r.date}</td><td data-label="In" className="text-ok">{r.checkIn || '-'}</td><td data-label="Out" className="text-danger">{r.checkOut || '-'}</td>
                    <td data-label="Status"><Badge tone={attendanceTone(r.status)}>{r.status}</Badge></td>
                    <td className="cell-actions"><div className="flex justify-end gap-1.5 w-full md:w-auto">
                      <button type="button" onClick={() => mark.mutate({ id: r.employeeId, status: 'PRESENT' })} title="Mark present" className="btn btn-soft-ok btn-sm">P</button>
                      <button type="button" onClick={() => mark.mutate({ id: r.employeeId, status: 'ABSENT' })} title="Mark absent" className="btn btn-soft-danger btn-sm">A</button>
                      <button type="button" onClick={() => mark.mutate({ id: r.employeeId, status: 'HALF_DAY' })} title="Mark half day" className="btn btn-soft-brand btn-sm">HD</button></div></td>
                  </tr>))}</tbody></table>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-medium text-fg"><i className="fa-solid fa-calendar-check mr-1.5 text-faint" />Leave applications & audit</h2>
        <div className="card overflow-hidden">
          {leaves.isPending ? <Skeleton rows={3} /> : (leaves.data ?? []).length === 0 ? <EmptyState icon="fa-calendar-xmark" title="No leave requests found" /> : (
            <table className="rtable"><thead><tr><th>Employee</th><th>Period</th><th>Type</th><th>Reason</th><th>Status</th><th>Reviewed by</th><th className="text-right">Actions</th></tr></thead>
              <tbody id="leaveTableBody">{(leaves.data ?? []).map((l: Leave) => (
                <tr key={l.id}>
                  <td data-label="" className="cell-title font-medium text-fg">{l.employeeName}</td><td data-label="Period">{l.fromDate} to {l.toDate}</td><td data-label="Type" className="font-semibold text-info">{l.leaveType}</td>
                  <td data-label="Reason" className="text-muted max-w-xs truncate">{l.reason}</td><td data-label="Status"><Badge tone={leaveTone(l.status)}>{l.status}</Badge></td><td data-label="Reviewed by" className="text-muted">{l.reviewedByName || '-'}</td>
                  <td className="cell-actions"><div className="flex justify-end w-full md:w-auto">{canReview && l.status === 'PENDING' && <button type="button" onClick={() => setDialog({ review: l.id })} className="btn btn-soft-brand btn-sm">Review</button>}</div></td>
                </tr>))}</tbody></table>
          )}
        </div>
      </div>

      {dialog === 'apply' && <ApplyLeaveDialog employeeId={me.employeeId} onClose={close} />}
      {typeof dialog === 'object' && dialog && 'review' in dialog && <ReviewLeaveDialog id={dialog.review} onClose={close} />}
      {typeof dialog === 'object' && dialog && 'dossier' in dialog && <EmployeeDossier key={dialog.dossier} employeeId={dialog.dossier} onClose={close} />}
    </section>
  );
}

function ApplyLeaveDialog({ employeeId, onClose }: { employeeId?: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState('PAID');
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => applyLeave({ employeeId, fromDate: from, toDate: to, leaveType: type, reason: reason.trim() }),
    onSuccess: () => { showToast('Leave request submitted', 'success'); for (const k of [['leaves'], ['notifications']]) void qc.invalidateQueries({ queryKey: k }); onClose(); },
    onError: (e: Error) => showToast(`Failed to apply leave: ${e.message}`, 'error'),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Dialog id="leaveModal" open onClose={onClose} size="sm" title="Apply for leave">
      <form id="leaveForm" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="leaveFromDate" label="From date"><input id="leaveFromDate" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></Field>
          <Field id="leaveToDate" label="To date"><input id="leaveToDate" type="date" required value={to} onChange={(e) => setTo(e.target.value)} className="input" /></Field>
        </div>
        <Field id="leaveType" label="Leave type *"><select id="leaveType" value={type} onChange={(e) => setType(e.target.value)} className="input"><option value="PAID">Paid leave</option><option value="CASUAL">Casual leave</option></select></Field>
        <Field id="leaveReason" label="Reason"><textarea id="leaveReason" rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} className="input h-auto py-2" placeholder="Reason for leave…" /></Field>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Submitting…' : 'Submit request'}</button>
      </form>
    </Dialog>
  );
}

function ReviewLeaveDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('APPROVED');
  const [notes, setNotes] = useState('');
  const save = useMutation({
    mutationFn: () => reviewLeave(id, status, notes.trim()),
    onSuccess: () => { showToast('Leave status updated', 'success'); for (const k of [['leaves'], ['notifications'], ['employee-leaves']]) void qc.invalidateQueries({ queryKey: k }); onClose(); },
    onError: (e: Error) => showToast(`Failed to review leave: ${e.message}`, 'error'),
  });
  return (
    <Dialog id="reviewLeaveModal" open onClose={onClose} size="sm" title="Review leave request">
      <form id="reviewLeaveForm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field id="reviewStatus" label="Decision"><select id="reviewStatus" value={status} onChange={(e) => setStatus(e.target.value)} className="input"><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></select></Field>
        <Field id="reviewNotes" label="Review notes"><textarea id="reviewNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-auto py-2" placeholder="Optional notes for the employee" /></Field>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Save decision'}</button>
      </form>
    </Dialog>
  );
}
