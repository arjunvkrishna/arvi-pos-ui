import { api } from '../../api/client';
import type { RealRole } from '../../api/types';

export interface Employee {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: RealRole;
  department?: string | null;
  designation?: string | null;
  basicSalary: number;
  joinedDate?: string | null;
  address?: string | null;
  paidLeavesQuota?: number | null;
  casualLeavesQuota?: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  bankAccountHolderName?: string | null;
  upiId?: string | null;
  active?: boolean;
}

export interface Salary {
  id: number;
  employeeId?: number;
  employeeName?: string;
  month: number;
  year: number;
  basic: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paid: boolean;
  paidDate?: string | null;
  paymentMode?: string | null;
  /** advances given so far and what is still to pay (net salary minus advances) */
  advance?: number;
  balance?: number;
  advances?: SalaryAdvance[];
}
export interface SalaryAdvance { id: number; amount: number; givenDate?: string | null; givenBy?: string | null; note?: string | null }
export interface AdvanceInput { employeeId: number; month: number; year: number; amount: number; note: string }

export interface Bank { bankAccountHolderName: string | null; bankName: string | null; bankAccountNumber: string | null; bankIfsc: string | null; bankBranch: string | null; upiId: string | null }
export interface NewEmployee extends Bank { name: string; role: RealRole; designation: string; phone: string; basicSalary: number; username: string; password: string }
export interface EmployeeUpdate extends Bank { designation: string; phone: string; basicSalary: number; joinedDate?: string }
export interface SalaryInput { employeeId: number; month: number; year: number; basic: number; allowances: number; deductions: number; paid: boolean; paidDate: string | null; paymentMode: string; notes: string }

export interface AttendanceRecord { id?: number; employeeId: number; employeeName: string; date: string; checkIn?: string | null; checkOut?: string | null; status: string; workHours?: number | null }
export interface Leave { id: number; employeeId?: number; employeeName?: string; fromDate: string; toDate: string; leaveType: string; reason?: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewedByName?: string | null }

export const employeesKey = ['employees'] as const;
export const salariesKey = ['salaries'] as const;

export const fetchEmployees = () => api<Employee[]>('/employees');
export const fetchEmployee = (id: number) => api<Employee>(`/employees/${id}`);
export const createEmployee = (e: NewEmployee) => api('/employees', { method: 'POST', body: e });
export const updateEmployee = (id: number, e: Partial<EmployeeUpdate> & { paidLeavesQuota?: number; casualLeavesQuota?: number }) => api(`/employees/${id}`, { method: 'PUT', body: e });
export const deactivateEmployee = (id: number) => api(`/employees/${id}`, { method: 'DELETE' });

export const fetchSalaries = () => api<Salary[]>('/salaries');
export const fetchEmployeeSalaries = (id: number) => api<Salary[]>(`/salaries/employee/${id}`);
export const createSalary = (s: SalaryInput) => api('/salaries', { method: 'POST', body: s });
export const giveAdvance = (a: AdvanceInput) => api<Salary>('/salaries/advance', { method: 'POST', body: a });
export const deleteAdvance = (id: number) => api<Salary>(`/salaries/advance/${id}`, { method: 'DELETE' });
export const paySalary = (id: number) => api(`/salaries/${id}/pay`, { method: 'PATCH', body: { paymentMode: 'BANK' } });

export const fetchEmployeeAttendance = (id: number) => api<AttendanceRecord[]>(`/attendance/employee/${id}`);
export const fetchEmployeeLeaves = (id: number) => api<Leave[]>(`/leaves/employee/${id}`);
export const reviewLeave = (id: number, status: string, reviewNotes: string) => api(`/leaves/${id}/review`, { method: 'PATCH', body: { status, reviewNotes } });
