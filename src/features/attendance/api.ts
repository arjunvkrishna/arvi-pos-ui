import { api } from '../../api/client';
import type { AttendanceRecord, Leave } from '../staff/api';

export interface Summary {
  employeeId?: number; employeeName?: string; role?: string; joinedDate?: string | null; year: number; month: number;
  totalDaysInMonth: number; eligibleDays: number; effectivePresentDays: number; presentDays: number; halfDays: number;
  absentDays: number; leaveDays: number; attendancePercentage: number;
}
export interface Profile {
  username?: string; role?: string; active?: boolean; employeeName?: string; designation?: string; department?: string; phone?: string; email?: string;
  joinedDate?: string; basicSalary?: number | null; paidLeavesQuota?: number | null; casualLeavesQuota?: number | null; address?: string;
  canTakeOrders?: boolean; canManageInventory?: boolean; canPrintBill?: boolean;
  bankAccountHolderName?: string; bankName?: string; bankAccountNumber?: string; bankIfsc?: string; bankBranch?: string; upiId?: string;
}

export const fetchSummary = (employeeId: number | string | null | undefined, year: number, month: number) =>
  api<Summary>(employeeId ? `/attendance/summary?employeeId=${employeeId}&year=${year}&month=${month}` : `/attendance/summary?year=${year}&month=${month}`);
export const fetchMonthly = (year: number, month: number) => api<Summary[]>(`/attendance/monthly-summary?year=${year}&month=${month}`);
export const fetchDay = (date: string) => api<AttendanceRecord[]>(`/attendance/date?date=${date}`);
export const markAttendance = (employeeId: number, date: string, status: string) => api('/attendance/mark', { method: 'POST', body: { employeeId, date, status } });
export const checkIn = (employeeId?: number | null) => api<AttendanceRecord>(employeeId ? `/attendance/check-in/${employeeId}` : '/attendance/check-in', { method: 'POST' });
export const checkOut = (employeeId?: number | null) => api<AttendanceRecord>(employeeId ? `/attendance/check-out/${employeeId}` : '/attendance/check-out', { method: 'POST' });

export interface PunchStatus { checkedIn: boolean; since?: string | null; shiftDate?: string | null }
/** Is a shift open right now (a shift that runs past midnight counts)? Check In or Check Out is offered, never both. */
export const fetchPunchStatus = (employeeId?: number | null) => api<PunchStatus>(employeeId ? `/attendance/punch-status/${employeeId}` : '/attendance/punch-status');

export const fetchLeaves = (employeeId: number | null | undefined, ownOnly: boolean) =>
  api<Leave[]>(ownOnly ? (employeeId ? `/leaves/employee/${employeeId}` : '/leaves/employee') : '/leaves/audit');
export const applyLeave = (b: { employeeId: number | null | undefined; fromDate: string; toDate: string; leaveType: string; reason: string }) => api('/leaves/apply', { method: 'POST', body: b });
export const fetchProfile = () => api<Profile>('/users/me');
