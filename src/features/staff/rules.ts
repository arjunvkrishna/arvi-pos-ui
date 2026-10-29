import { outranks } from '../../api/roles';
import type { RealRole, Session } from '../../api/types';
import type { Employee, Salary } from './api';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const money = (n: number | null | undefined) => `₹${(Number(n) || 0).toFixed(2)}`;

/** Admins manage every employee, managers only staff (same rule as user accounts). */
/** Only people strictly below you (owners may also manage owners); the server enforces the same rule. */
export const canEditEmployee = (caller: Session, target: RealRole) => outranks(caller, target);

export const netSalary = (basic: number, allowances: number, deductions: number) => Math.max(0, basic + allowances - deductions);

/** What has actually been paid out; pending slips do not count towards lifetime pay. */
export const lifetimePaid = (salaries: Salary[]) => salaries.filter((s) => s.paid).reduce((sum, s) => sum + Number(s.netSalary || 0), 0);

export const roleTone = (role: string) => (role === 'ADMIN' || role === 'CAFE_ADMIN' ? 'brand' : role === 'GENERAL_MANAGER' || role === 'MANAGER' ? 'info' : 'ok') as 'brand' | 'info' | 'ok';

export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const bankOf = (e: Employee) => ({
  bankAccountHolderName: e.bankAccountHolderName ?? '', bankName: e.bankName ?? '', bankAccountNumber: e.bankAccountNumber ?? '',
  bankIfsc: e.bankIfsc ?? '', bankBranch: e.bankBranch ?? '', upiId: e.upiId ?? '',
});
export type BankForm = ReturnType<typeof bankOf>;
export const emptyBank: BankForm = { bankAccountHolderName: '', bankName: '', bankAccountNumber: '', bankIfsc: '', bankBranch: '', upiId: '' };
/** Blank bank fields are sent as null so they clear on the server. */
export const bankPayload = (b: BankForm) => ({
  bankAccountHolderName: b.bankAccountHolderName.trim() || null, bankName: b.bankName.trim() || null, bankAccountNumber: b.bankAccountNumber.trim() || null,
  bankIfsc: b.bankIfsc.trim() || null, bankBranch: b.bankBranch.trim() || null, upiId: b.upiId.trim() || null,
});

/** What is still to pay on a slip: the server's balance, or net salary minus advances for older responses. */
export const balanceOf = (s: Pick<Salary, 'netSalary' | 'advance' | 'balance'>) => (s.balance !== undefined && s.balance !== null ? Number(s.balance) : Number(s.netSalary || 0) - Number(s.advance || 0));

export type SlipStatus = { label: 'PAID' | 'ADVANCE GIVEN' | 'PENDING'; tone: 'ok' | 'info' | 'warn' };
export const slipStatus = (s: Pick<Salary, 'paid' | 'advance'>): SlipStatus => (s.paid ? { label: 'PAID', tone: 'ok' } : Number(s.advance || 0) > 0 ? { label: 'ADVANCE GIVEN', tone: 'info' } : { label: 'PENDING', tone: 'warn' });

/** Advance dialog numbers for the chosen person and month: the month's pay, what is already advanced, and what is left after this advance. */
export function advanceContext(employees: Pick<Employee, 'id' | 'basicSalary'>[], salaries: Salary[], employeeId: number, month: number, year: number, amount: number) {
  const slip = salaries.find((r) => r.employeeId === employeeId && r.month === month && r.year === year);
  const emp = employees.find((e) => e.id === employeeId);
  const net = slip ? Number(slip.netSalary || 0) : Number(emp?.basicSalary || 0);
  const given = slip ? Number(slip.advance || 0) : 0;
  const left = net - given - (amount || 0);
  const paid = !!slip?.paid;
  const problem = paid ? 'This month is already paid.' : left < 0 ? `Advance is more than the balance of ${money(net - given)}.` : '';
  return { net, given, left, paid, problem };
}
