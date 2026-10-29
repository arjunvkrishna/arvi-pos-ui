import { useEffect, useState } from 'react';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui';
import { deactivateEmployee, deleteAdvance, paySalary, type Employee, type Salary } from './api';
import { EmployeeDossier } from './EmployeeDossier';
import { useEmployees, useSalaries, useStaffAction } from './hooks';
import { AddStaffDialog, AdvanceDialog, EditStaffDialog, SalaryDialog } from './StaffDialogs';
import { roleName } from '../users/rules';
import { balanceOf, canEditEmployee, money, roleTone, slipStatus } from './rules';

type Modal = { kind: 'add' } | { kind: 'edit'; employee: Employee } | { kind: 'salary' } | { kind: 'advance'; initial?: { employeeId: number; month: number; year: number } } | { kind: 'dossier'; id: number } | null;

export function StaffPage() {
  const me = useSession((s) => s.user)!;
  const staff = useEmployees();
  const salaries = useSalaries();
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);
  const deactivate = useStaffAction(deactivateEmployee, 'Staff deactivated', 'Failed to delete staff');
  const pay = useStaffAction(paySalary, 'Payment marked as done', 'Failed to mark paid');
  const removeAdvance = useStaffAction(deleteAdvance, 'Advance removed', 'Failed to remove advance');
  const list = staff.data ?? [];

  const err = staff.isError ? staff.error.message : salaries.isError ? salaries.error.message : '';
  useEffect(() => { if (err) showToast(`Failed to load staff: ${err}`, 'error'); }, [err]);
  const onPaymentDone = (s: Salary) => {
    const adv = Number(s.advance || 0); const balance = balanceOf(s);
    const msg = adv > 0 ? `Mark payment done for ${s.employeeName}?\n\nSalary ${money(s.netSalary)} - advance ${money(adv)} = ${money(balance)} paid now.` : `Mark payment done for ${s.employeeName}?\n\n${money(balance)} paid now.`;
    if (window.confirm(msg)) pay.mutate(s.id);
  };
  const onRemoveAdvance = (id: number) => { if (window.confirm('Remove this advance?')) removeAdvance.mutate(id); };
  const onDeactivate = (e: Employee) => { if (window.confirm('Deactivate this staff member?')) deactivate.mutate(e.id); };

  return (
    <section id="tab-staff" data-testid="tab-staff" className="space-y-5">
      <PageHeader title="Staff & payroll" description="Manage employee accounts, designations and monthly salaries."
        actions={<>
          <button type="button" id="btnProcessSalary" onClick={() => setModal({ kind: 'salary' })} className="btn btn-secondary"><i className="fa-solid fa-hand-holding-dollar" />Process salary</button>
          <button type="button" id="btnGiveAdvance" onClick={() => setModal({ kind: 'advance' })} className="btn btn-secondary"><i className="fa-solid fa-money-bill-transfer" />Give advance</button>
          <button type="button" id="btnAddStaff" onClick={() => setModal({ kind: 'add' })} className="btn btn-primary"><i className="fa-solid fa-user-plus" />Add staff member</button>
        </>} />

      <div className="card overflow-hidden">
        <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg"><i className="fa-solid fa-users mr-1.5 text-faint" />Active staff directory</p>
        {staff.isPending ? <Skeleton rows={4} /> : list.length === 0 ? <EmptyState icon="fa-users" title="No staff records found" /> : (
          <table className="rtable">
            <thead><tr><th>Name</th><th>Role</th><th>Designation</th><th>Phone</th><th>Basic salary</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="staffTableBody">{list.map((s) => (
              <tr key={s.id}>
                <td data-label="" className="cell-title"><button type="button" onClick={() => setModal({ kind: 'dossier', id: s.id })} title="View full employee dossier" className="font-medium text-brand-text hover:underline text-left inline-flex items-center min-h-9"><i className="fa-solid fa-user-circle mr-1.5 text-xs opacity-70" />{s.name}</button></td>
                <td data-label="Role"><Badge tone={roleTone(s.role)}>{roleName(s.role)}</Badge></td>
                <td data-label="Designation" className="text-muted">{s.designation || '-'}</td><td data-label="Phone" className="text-muted">{s.phone || '-'}</td>
                <td data-label="Salary" className="font-semibold text-fg">{money(s.basicSalary)}</td><td data-label="Joined" className="text-muted">{s.joinedDate || '-'}</td>
                <td className="cell-actions"><div className="flex items-center justify-end gap-1 w-full md:w-auto">
                  <button type="button" onClick={() => setModal({ kind: 'dossier', id: s.id })} title="View detailed profile, pay, attendance & leaves" aria-label={`Dossier of ${s.name}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-address-card" /></button>
                  {canEditEmployee(me, s.role) && (<>
                    <button type="button" onClick={() => setModal({ kind: 'edit', employee: s })} title="Edit employee details" aria-label={`Edit ${s.name}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>
                    <button type="button" onClick={() => onDeactivate(s)} title="Deactivate" aria-label={`Deactivate ${s.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button></>)}
                </div></td>
              </tr>))}</tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <p className="px-4 py-3 border-b border-line text-sm font-medium text-fg"><i className="fa-solid fa-money-check-dollar mr-1.5 text-faint" />Salary slips & payout records</p>
        {salaries.isPending ? <Skeleton rows={3} /> : (salaries.data ?? []).length === 0 ? <EmptyState icon="fa-money-check-dollar" title="No salary records generated" /> : (
          <table className="rtable">
            <thead><tr><th>Employee</th><th>Month / year</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net salary</th><th>Advance</th><th>Balance to pay</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="salaryTableBody">{(salaries.data ?? []).map((s) => (
              <tr key={s.id}>
                <td data-label="" className="cell-title font-medium text-fg">{s.employeeName}</td><td data-label="Month">{s.month}/{s.year}</td><td data-label="Basic">{money(s.basic)}</td>
                <td data-label="Allowances" className="text-ok">+{money(s.allowances)}</td><td data-label="Deductions" className="text-danger">-{money(s.deductions)}</td>
                <td data-label="Net" className="font-semibold text-fg">{money(s.netSalary)}</td>
                <td data-label="Advance" className="text-info">{Number(s.advance || 0) > 0 ? `-${money(s.advance)}` : '-'}
                  {(s.advances ?? []).map((a) => (
                    <div key={a.id} className="text-xs text-muted whitespace-nowrap">{a.givenDate || ''} · {money(a.amount)}{a.note ? ` · ${a.note}` : ''}
                      {!s.paid && <button type="button" onClick={() => onRemoveAdvance(a.id)} title="Remove this advance" aria-label="Remove advance" className="ml-1 inline-flex items-center justify-center min-h-8 min-w-8 text-danger hover:underline align-middle">✕</button>}</div>))}</td>
                <td data-label="Balance" className={`font-semibold ${s.paid ? 'text-ok' : 'text-fg'}`}>{money(balanceOf(s))}</td>
                <td data-label="Status"><Badge tone={slipStatus(s).tone}>{slipStatus(s).label}</Badge></td>
                <td className="cell-actions"><div className="flex flex-wrap justify-end gap-1.5 w-full md:w-auto">{!s.paid ? (<>
                  <button type="button" onClick={() => setModal({ kind: 'advance', initial: { employeeId: s.employeeId!, month: s.month, year: s.year } })} className="btn btn-soft-brand btn-sm">Advance</button>
                  <button type="button" onClick={() => onPaymentDone(s)} className="btn btn-soft-ok btn-sm">Payment done</button></>)
                  : <span className="text-xs text-muted">Paid {s.paidDate || ''}</span>}</div></td>
              </tr>))}</tbody>
          </table>
        )}
      </div>

      {modal?.kind === 'add' && <AddStaffDialog onClose={close} />}
      {modal?.kind === 'edit' && <EditStaffDialog key={modal.employee.id} employee={modal.employee} onClose={close} />}
      {modal?.kind === 'salary' && <SalaryDialog employees={list} onClose={close} />}
      {modal?.kind === 'advance' && <AdvanceDialog employees={list} salaries={salaries.data ?? []} initial={modal.initial} onClose={close} />}
      {modal?.kind === 'dossier' && <EmployeeDossier key={modal.id} employeeId={modal.id} onClose={close} />}
    </section>
  );
}
