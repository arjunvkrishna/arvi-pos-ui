import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { attendanceTone } from '../attendance/rules';
import { fetchEmployee, fetchEmployeeAttendance, fetchEmployeeLeaves, fetchEmployeeSalaries, reviewLeave, updateEmployee, employeesKey, type Leave } from './api';
import { roleName } from '../users/rules';
import { MONTHS_SHORT, lifetimePaid, money, roleTone } from './rules';

type Sub = 'overview' | 'salary' | 'attendance' | 'leaves';
const leaveTone = (s: string) => (s === 'APPROVED' ? 'ok' : s === 'REJECTED' ? 'danger' : 'warn') as 'ok' | 'danger' | 'warn';

function Kpi({ id, label, value }: { id: string; label: string; value: string }) {
  return <div className="card p-4"><p className="text-xs text-muted">{label}</p><p id={id} className="text-lg font-semibold text-fg mt-1">{value}</p></div>;
}

/** One employee: overview and leave quota, every salary slip, attendance hours and leave history. */
export function EmployeeDossier({ employeeId, onClose }: { employeeId: number; onClose: () => void }) {
  const me = useSession((s) => s.user)!;
  const canReview = me.role === 'ADMIN' || me.role === 'MANAGER';
  const qc = useQueryClient();
  const [sub, setSub] = useState<Sub>('overview');
  const emp = useQuery({ queryKey: ['employee', employeeId], queryFn: () => fetchEmployee(employeeId) });
  const salaries = useQuery({ queryKey: ['employee-salaries', employeeId], queryFn: () => fetchEmployeeSalaries(employeeId).catch(() => []) });
  const attendance = useQuery({ queryKey: ['employee-attendance', employeeId], queryFn: () => fetchEmployeeAttendance(employeeId).catch(() => []) });
  const leaves = useQuery({ queryKey: ['employee-leaves', employeeId], queryFn: () => fetchEmployeeLeaves(employeeId).catch(() => [] as Leave[]) });
  const e = emp.data;
  const slips = salaries.data ?? [];
  const records = attendance.data ?? [];
  const hours = records.reduce((s, a) => s + Number(a.workHours || 0), 0);
  const present = records.filter((a) => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: string }) => reviewLeave(id, decision, `Reviewed via employee dossier (${decision})`),
    onSuccess: (_d, v) => { showToast(`Leave request ${v.decision.toLowerCase()}`, 'success'); for (const k of [['employee-leaves', employeeId], ['leaves'], ['notifications']]) void qc.invalidateQueries({ queryKey: k }); },
    onError: (err: Error) => showToast(`Failed to update leave status: ${err.message}`, 'error'),
  });

  return (
    <Dialog id="employeeDetailsModal" open onClose={onClose} size="xl" title={e?.name || 'Staff member'}
      description={e ? <><Badge tone={roleTone(e.role)} className="mr-2"><span id="dossierEmployeeRole">{roleName(e.role)}</span></Badge><span id="dossierEmployeeMeta">{e.designation || 'Staff'} • Phone: {e.phone || '-'} • Joined: {e.joinedDate || 'N/A'}</span></> : undefined}>
      <div className="space-y-4">
        <SegmentedTabs label="Employee sections" value={sub} onChange={setSub} options={[
          { value: 'overview', label: 'Overview', id: 'dossierTabBtnOverview' }, { value: 'salary', label: 'Salary', id: 'dossierTabBtnSalary' },
          { value: 'attendance', label: 'Attendance', id: 'dossierTabBtnAttendance' }, { value: 'leaves', label: 'Leaves', id: 'dossierTabBtnLeaves' },
        ]} />
        {emp.isPending ? <Skeleton rows={4} /> : emp.isError ? <p className="text-sm text-danger text-center py-6">Failed to load employee dossier: {emp.error.message}</p> : e && (
          <>
            {sub === 'overview' && (
              <div id="dossierSubTab-overview" className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Kpi id="dossierKpiJoinedDate" label="Joined" value={e.joinedDate || 'N/A'} />
                  <Kpi id="dossierKpiBasicSalary" label="Basic salary" value={money(e.basicSalary)} />
                  <Kpi id="dossierLifetimeTotalPay" label="Lifetime pay (paid)" value={money(lifetimePaid(slips))} />
                  <Kpi id="dossierKpiTotalHours" label="Total hours" value={`${hours.toFixed(1)} hrs`} />
                  <Kpi id="dossierKpiDaysPresent" label="Days present" value={`${present} days`} />
                </div>
                <QuotaForm key={e.id} id={e.id} paid={e.paidLeavesQuota ?? 12} casual={e.casualLeavesQuota ?? 12} onSaved={() => { void qc.invalidateQueries({ queryKey: employeesKey }); void qc.invalidateQueries({ queryKey: ['employee', employeeId] }); }} />
              </div>
            )}
            {sub === 'salary' && (
              <div id="dossierSubTab-salary" className="card overflow-hidden">
                <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Salary slips <span id="dossierSalaryCount" className="text-muted font-normal">· {slips.length} records</span></p>
                {slips.length === 0 ? <EmptyState icon="fa-money-check-dollar" title="No salary disbursements recorded" /> : (
                  <table className="rtable"><thead><tr><th>Month</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net</th><th>Paid on</th><th>Status</th></tr></thead>
                    <tbody id="dossierSalaryTableBody">{slips.map((s) => (
                      <tr key={s.id}><td data-label="" className="cell-title font-medium text-fg">{MONTHS_SHORT[s.month - 1] || s.month} {s.year}</td><td data-label="Basic">{money(s.basic)}</td>
                        <td data-label="Allowances" className="text-ok">+{money(s.allowances)}</td><td data-label="Deductions" className="text-danger">-{money(s.deductions)}</td>
                        <td data-label="Net" className="font-semibold text-fg">{money(s.netSalary)}</td><td data-label="Paid on" className="text-muted">{s.paidDate || '-'}</td>
                        <td data-label="Status"><Badge tone={s.paid ? 'ok' : 'warn'}>{s.paid ? 'PAID' : 'PENDING'}</Badge></td></tr>))}</tbody></table>)}
              </div>
            )}
            {sub === 'attendance' && (
              <div id="dossierSubTab-attendance" className="card overflow-hidden">
                <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Attendance <span id="dossierAttendanceTotalHoursBadge" className="text-muted font-normal">· Total: {hours.toFixed(1)} hrs</span></p>
                {records.length === 0 ? <EmptyState icon="fa-calendar-check" title="No attendance records found" /> : (
                  <table className="rtable"><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Status</th></tr></thead>
                    <tbody id="dossierAttendanceTableBody">{records.map((a, i) => (
                      <tr key={a.id ?? i}><td data-label="" className="cell-title font-medium text-fg">{a.date}</td><td data-label="In" className="text-ok">{a.checkIn || '-'}</td><td data-label="Out" className="text-danger">{a.checkOut || '-'}</td>
                        <td data-label="Hours" className="font-semibold">{Number(a.workHours || 0).toFixed(1)} hrs</td><td data-label="Status"><Badge tone={attendanceTone(a.status)}>{a.status}</Badge></td></tr>))}</tbody></table>)}
              </div>
            )}
            {sub === 'leaves' && (
              <div id="dossierSubTab-leaves" className="card overflow-hidden">
                <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Leave history <span id="dossierLeaveCount" className="text-muted font-normal">· {(leaves.data ?? []).length} leaves</span></p>
                {(leaves.data ?? []).length === 0 ? <EmptyState icon="fa-calendar-xmark" title="No leave requests found" /> : (
                  <table className="rtable"><thead><tr><th>Period</th><th>Type</th><th>Reason</th><th>Status</th><th>Reviewed by</th><th className="text-right">Actions</th></tr></thead>
                    <tbody id="dossierLeavesTableBody">{(leaves.data ?? []).map((l) => (
                      <tr key={l.id}><td data-label="" className="cell-title font-mono text-xs text-fg">{l.fromDate} to {l.toDate}</td><td data-label="Type" className="font-semibold text-brand-text">{l.leaveType}</td>
                        <td data-label="Reason" className="text-muted max-w-xs truncate">{l.reason || '-'}</td><td data-label="Status"><Badge tone={leaveTone(l.status)}>{l.status}</Badge></td><td data-label="Reviewed by" className="text-muted">{l.reviewedByName || '-'}</td>
                        <td className="cell-actions"><div className="flex justify-end gap-1.5 w-full md:w-auto">{canReview && l.status === 'PENDING' && (<>
                          <button type="button" onClick={() => decide.mutate({ id: l.id, decision: 'APPROVED' })} className="btn btn-soft-ok btn-sm">Approve</button>
                          <button type="button" onClick={() => decide.mutate({ id: l.id, decision: 'REJECTED' })} className="btn btn-soft-danger btn-sm">Reject</button></>)}</div></td></tr>))}</tbody></table>)}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

function QuotaForm({ id, paid, casual, onSaved }: { id: number; paid: number; casual: number; onSaved: () => void }) {
  const [p, setP] = useState(String(paid));
  const [c, setC] = useState(String(casual));
  const save = useMutation({
    mutationFn: () => updateEmployee(id, { paidLeavesQuota: parseInt(p, 10), casualLeavesQuota: parseInt(c, 10) }),
    onSuccess: () => { showToast('Leave quotas successfully updated', 'success'); onSaved(); },
    onError: (err: Error) => showToast(`Failed to update leave quotas: ${err.message}`, 'error'),
  });
  const submit = (ev: FormEvent) => { ev.preventDefault(); if (isNaN(parseInt(p, 10)) || isNaN(parseInt(c, 10))) { showToast('Please enter valid numeric quota days', 'warning'); return; } save.mutate(); };
  return (
    <form onSubmit={submit} className="card p-4 flex flex-wrap items-end gap-3">
      <div className="mr-auto"><p className="text-sm font-medium text-fg">Yearly leave quota</p><p className="hint">Paid and casual days this employee can take per year.</p></div>
      <Field id="dossierPaidLeavesQuota" label="Paid days"><input id="dossierPaidLeavesQuota" type="number" min="0" value={p} onChange={(e) => setP(e.target.value)} className="input w-28" /></Field>
      <Field id="dossierCasualLeavesQuota" label="Casual days"><input id="dossierCasualLeavesQuota" type="number" min="0" value={c} onChange={(e) => setC(e.target.value)} className="input w-28" /></Field>
      <button type="submit" id="btnSaveLeaveQuota" disabled={save.isPending} className="btn btn-primary h-10"><i className="fa-solid fa-floppy-disk" />{save.isPending ? 'Saving…' : 'Update quota'}</button>
    </form>
  );
}
