import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, SegmentedTabs, Skeleton, EmptyState } from '../../components/ui';
import { showToast } from '../../components/toast';
import { fetchEmployees } from '../staff/api';
import {
  fetchSchedules,
  createSchedule,
  deleteSchedule,
  fetchTipPool,
  calculateTipPool,
  markTipSharePaid,
  type ShiftSchedule,
  type ShiftScheduleInput,
} from './api';

const fmtINR = (val?: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val ?? 0);

export function SchedulingPage() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'schedules' | 'tippool'>('schedules');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tipDate, setTipDate] = useState<string>('');
  const [overrideTips, setOverrideTips] = useState<string>('');

  // Shift form state
  const [empId, setEmpId] = useState<number>(0);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [roleNote, setRoleNote] = useState<string>('');

  const employeesQ = useQuery({ queryKey: ['employees'], queryFn: fetchEmployees });
  const schedulesQ = useQuery({ queryKey: ['shift-schedules'], queryFn: () => fetchSchedules() });
  const tipPoolQ = useQuery({
    queryKey: ['tip-pool', tipDate],
    queryFn: () => fetchTipPool(tipDate || undefined),
  });

  const addShiftMutation = useMutation({
    mutationFn: (body: ShiftScheduleInput) => createSchedule(body),
    onSuccess: () => {
      showToast('Shift scheduled successfully!', 'success');
      setIsAddModalOpen(false);
      setRoleNote('');
      void qc.invalidateQueries({ queryKey: ['shift-schedules'] });
    },
    onError: (err: Error) => {
      showToast(err.message || 'Failed to schedule shift (check for overlaps)', 'error');
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: number) => deleteSchedule(id),
    onSuccess: () => {
      showToast('Shift deleted', 'success');
      void qc.invalidateQueries({ queryKey: ['shift-schedules'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const calculateTipMutation = useMutation({
    mutationFn: (body: { distributionDate?: string; overrideTotalTips?: number }) => calculateTipPool(body),
    onSuccess: () => {
      showToast('Tip pool calculated and distributed!', 'success');
      void qc.invalidateQueries({ queryKey: ['tip-pool'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => markTipSharePaid(id),
    onSuccess: () => {
      showToast('Tip share marked as paid', 'success');
      void qc.invalidateQueries({ queryKey: ['tip-pool'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) {
      showToast('Please select an employee', 'error');
      return;
    }
    if (!startTime || !endTime) {
      showToast('Please select both start and end time', 'error');
      return;
    }
    const startsAt = new Date(startTime).toISOString();
    const endsAt = new Date(endTime).toISOString();

    addShiftMutation.mutate({
      employeeId: empId,
      startsAt,
      endsAt,
      roleNote: roleNote.trim() || undefined,
      status: 'SCHEDULED',
    });
  };

  const handleCalculateTips = () => {
    const override = overrideTips ? parseFloat(overrideTips) : undefined;
    calculateTipMutation.mutate({
      distributionDate: tipDate || undefined,
      overrideTotalTips: override,
    });
  };

  const employees = employeesQ.data ?? [];
  const schedules = schedulesQ.data ?? [];
  const tipPool = tipPoolQ.data;

  return (
    <section id="tab-scheduling" data-testid="tab-scheduling" className="space-y-6">
      <PageHeader
        title="Shift Scheduling & Tip Pooling"
        description="Plan staff rosters with overlap exclusion constraints, and calculate business-date tip pool distributions."
        actions={
          subTab === 'schedules' ? (
            <button
              type="button"
              id="btnAddShift"
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary text-sm flex items-center gap-1.5"
            >
              <i className="fa-solid fa-plus" />
              <span>Schedule Shift</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={tipDate}
                onChange={(e) => setTipDate(e.target.value)}
                className="input input-sm border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-fg"
                title="Business Date"
              />
              <button
                type="button"
                onClick={handleCalculateTips}
                disabled={calculateTipMutation.isPending}
                className="btn btn-primary text-sm flex items-center gap-1.5"
              >
                <i className={`fa-solid fa-calculator ${calculateTipMutation.isPending ? 'animate-spin' : ''}`} />
                <span>Calculate Tips</span>
              </button>
            </div>
          )
        }
      />

      <SegmentedTabs
        label="Scheduling Sections"
        value={subTab}
        onChange={(v) => setSubTab(v as 'schedules' | 'tippool')}
        options={[
          { value: 'schedules', label: 'Shift Schedules', id: 'stab-schedules' },
          { value: 'tippool', label: 'Tip Pooling & Payout', id: 'stab-tippool' },
        ]}
      />

      {subTab === 'schedules' && (
        <div className="space-y-4">
          {schedulesQ.isPending ? (
            <div className="card p-6"><Skeleton rows={5} /></div>
          ) : schedules.length === 0 ? (
            <EmptyState
              icon="fa-calendar-days"
              title="No upcoming shifts scheduled"
              action={
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary btn-sm mt-3"
                >
                  Schedule first shift
                </button>
              }
            />
          ) : (
            <div className="card overflow-x-auto">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role / Designation</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s: ShiftSchedule) => (
                    <tr key={s.id} className="hover:bg-muted/10">
                      <td data-label="" className="font-semibold text-fg cell-title">{s.employeeName || `Employee #${s.employeeId}`}</td>
                      <td data-label="Role / Designation" className="text-muted text-xs">{s.employeeRole || 'Staff'}</td>
                      <td data-label="Start Time" className="text-xs font-mono">{new Date(s.startsAt).toLocaleString()}</td>
                      <td data-label="End Time" className="text-xs font-mono">{new Date(s.endsAt).toLocaleString()}</td>
                      <td data-label="Notes" className="text-xs text-muted">{s.roleNote || '—'}</td>
                      <td data-label="Status" className="">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          s.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                          s.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td data-label="Actions" className="text-right cell-actions">
                        <button
                          type="button"
                          onClick={() => deleteShiftMutation.mutate(s.id)}
                          disabled={deleteShiftMutation.isPending}
                          className="btn btn-secondary text-xs text-rose-500 hover:bg-rose-500/10 px-2 py-1"
                          title="Delete Shift"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'tippool' && (
        <div className="space-y-6">
          {tipPoolQ.isPending ? (
            <div className="card p-6"><Skeleton rows={5} /></div>
          ) : !tipPool ? (
            <div className="card p-8 text-center space-y-4">
              <i className="fa-solid fa-hand-holding-dollar text-4xl text-primary/40" />
              <h3 className="text-lg font-semibold text-fg">No Tip Pool Distribution Yet</h3>
              <p className="text-sm text-muted max-w-md mx-auto">
                Calculate tips for this business date using tips recorded on paid bills and hours logged in attendance records.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <input
                  type="number"
                  placeholder="Override Tips (optional)"
                  value={overrideTips}
                  onChange={(e) => setOverrideTips(e.target.value)}
                  className="input input-sm border border-border bg-card px-3 py-1.5 rounded-lg text-sm w-48 max-w-full text-fg"
                />
                <button
                  type="button"
                  onClick={handleCalculateTips}
                  disabled={calculateTipMutation.isPending}
                  className="btn btn-primary text-sm flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-calculator" />
                  <span>Calculate Now</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tip Pool Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5">
                  <span className="text-xs text-muted">Total Tip Pool</span>
                  <div className="text-2xl font-bold text-emerald-500 mt-1">{fmtINR(tipPool.totalTips)}</div>
                  <span className="text-xs text-muted">Date: {tipPool.distributionDate}</span>
                </div>
                <div className="card p-5">
                  <span className="text-xs text-muted">Total Hours Worked</span>
                  <div className="text-2xl font-bold text-fg mt-1">{tipPool.totalHours} hrs</div>
                  <span className="text-xs text-muted">Across all shift workers</span>
                </div>
                <div className="card p-5">
                  <span className="text-xs text-muted">Distribution Rate</span>
                  <div className="text-2xl font-bold text-primary mt-1">{fmtINR(tipPool.ratePerHour)} / hr</div>
                  <span className="text-xs text-muted">Exact penny reconciliation</span>
                </div>
              </div>

              {/* Employee Shares Breakdown Table */}
              <div className="card overflow-x-auto">
                <div className="p-4 border-b border-border flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-fg">Employee Tip Allocations</h3>
                  <span className="text-xs text-muted">
                    Rounding paise allocated to top hours worker to match pool total exactly.
                  </span>
                </div>
                <table className="rtable">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Hours Worked</th>
                      <th>Tip Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tipPool.shares.map((share) => (
                      <tr key={share.id} className="hover:bg-muted/10">
                        <td data-label="" className="font-semibold text-fg cell-title">
                          {share.employeeName || `Employee #${share.employeeId}`}
                        </td>
                        <td data-label="Hours Worked" className="text-right font-medium">{share.hoursWorked} hrs</td>
                        <td data-label="Tip Amount" className="text-right font-bold text-emerald-500">{fmtINR(share.tipAmount)}</td>
                        <td data-label="Status" className="text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            share.paid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {share.paid ? 'PAID' : 'PENDING'}
                          </span>
                        </td>
                        <td data-label="Action" className="text-right cell-actions">
                          {!share.paid ? (
                            <button
                              type="button"
                              onClick={() => markPaidMutation.mutate(share.id)}
                              disabled={markPaidMutation.isPending}
                              className="btn btn-secondary text-xs px-2.5 py-1 text-emerald-500 hover:bg-emerald-500/10 font-medium"
                            >
                              Mark Paid
                            </button>
                          ) : (
                            <span className="text-xs text-muted">
                              Paid {share.paidAt ? new Date(share.paidAt).toLocaleDateString() : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Shift Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-semibold text-fg">Schedule New Shift</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-fg text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddShift} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Employee</label>
                <select
                  value={empId}
                  onChange={(e) => setEmpId(Number(e.target.value))}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                >
                  <option value={0}>Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Shift Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Shift End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Role / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Barista Lead / Kitchen Opening"
                  value={roleNote}
                  onChange={(e) => setRoleNote(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addShiftMutation.isPending}
                  className="btn btn-primary text-sm px-4 py-2"
                >
                  {addShiftMutation.isPending ? 'Saving...' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
