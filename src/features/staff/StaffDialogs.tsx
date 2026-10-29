import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Field } from '../../components/ui';
import { isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import type { RealRole } from '../../api/types';
import { creatableRoles, isBranchRole, roleName } from '../users/rules';
import { createEmployee, createSalary, giveAdvance, updateEmployee, type Employee, type Salary } from './api';
import { useStaffAction } from './hooks';
import { MONTHS, advanceContext, bankOf, bankPayload, emptyBank, money, netSalary, todayISO, type BankForm } from './rules';

function BankFields({ value, onChange, prefix }: { value: BankForm; onChange: (b: BankForm) => void; prefix: string }) {
  const f = (k: keyof BankForm, id: string, label: string, ph: string) => (
    <Field id={`${prefix}${id}`} label={label}><input id={`${prefix}${id}`} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="input" placeholder={ph} /></Field>
  );
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-xs font-medium text-muted">Bank & payout details (optional)</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {f('bankAccountHolderName', 'BankAccountHolder', 'Account holder name', 'e.g. Rahul Sharma')}
        {f('bankName', 'BankName', 'Bank name', 'e.g. HDFC Bank, SBI')}
        {f('bankAccountNumber', 'BankAccountNumber', 'Account number', 'e.g. 50100234567890')}
        {f('bankIfsc', 'BankIfsc', 'IFSC code', 'e.g. HDFC0001234')}
        {f('bankBranch', 'BankBranch', 'Branch', 'e.g. Indiranagar Branch')}
        {f('upiId', 'UpiId', 'UPI ID', 'e.g. rahul@okaxis')}
      </div>
    </fieldset>
  );
}

/** Add a staff member (optionally with a login), at or below the level the caller may create. */
export function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const me = useSession((s) => s.user)!;
  const roles = creatableRoles(me);
  const [name, setName] = useState('');
  const [role, setRole] = useState<RealRole>(roles.includes('EMPLOYEE') ? 'EMPLOYEE' : roles[roles.length - 1]);
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bank, setBank] = useState<BankForm>(emptyBank);
  const add = useStaffAction(createEmployee, 'Staff member added successfully', 'Failed to add staff');
  const admin = me.role === 'ADMIN';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // A person belongs to one branch. Someone who runs every branch must say which one first (top bar), or the record would belong to none.
    if (isCafeWide(me) && !me.selectedOutletId && isBranchRole(role)) { showToast('Pick the branch in the top bar first: this person works in one branch.', 'error'); return; }
    add.mutate({ name: name.trim(), role, designation: designation.trim(), phone: phone.trim(), basicSalary: parseFloat(salary || '0'), username: username.trim(), password, ...bankPayload(bank) }, { onSuccess: onClose });
  };
  return (
    <Dialog id="staffModal" open onClose={onClose} size="lg" title={admin ? 'Add new user / staff (root admin)' : 'Add staff member'}>
      <form id="staffForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="staffName" label="Full name"><input id="staffName" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Rahul Sharma" /></Field>
          <Field id="staffRole" label="Role"><select id="staffRole" value={role} onChange={(e) => setRole(e.target.value as RealRole)} className="input">
            {roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></Field>
          <Field id="staffDesignation" label="Designation"><input id="staffDesignation" value={designation} onChange={(e) => setDesignation(e.target.value)} className="input" placeholder="e.g. Head Barista" /></Field>
          <Field id="staffPhone" label="Phone"><input id="staffPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="9876543210" /></Field>
          <Field id="staffSalary" label="Basic salary (₹)"><input id="staffSalary" required type="number" min="0" step="any" value={salary} onChange={(e) => setSalary(e.target.value)} className="input" placeholder="e.g. 18000" /></Field>
        </div>
        <BankFields value={bank} onChange={setBank} prefix="staff" />
        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">System login (optional)</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field id="staffUsername" label="Username"><input id="staffUsername" value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="Username" autoComplete="off" /></Field>
            <Field id="staffPassword" label="Password"><input id="staffPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Password" autoComplete="new-password" /></Field>
          </div>
        </fieldset>
        <button type="submit" disabled={add.isPending} className="btn btn-primary w-full h-10">{add.isPending ? 'Saving…' : 'Add staff member'}</button>
      </form>
    </Dialog>
  );
}

/** Edit designation, phone, salary, joining date and bank details (the classic app silently dropped the bank details on save). */
export function EditStaffDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [designation, setDesignation] = useState(employee.designation || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [salary, setSalary] = useState(employee.basicSalary !== undefined ? String(employee.basicSalary) : '');
  const [joined, setJoined] = useState(employee.joinedDate || '');
  const [bank, setBank] = useState<BankForm>(() => bankOf(employee));
  const save = useStaffAction((p: Parameters<typeof updateEmployee>[1]) => updateEmployee(employee.id, p), 'Employee updated successfully', 'Failed to update employee');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = parseFloat(salary);
    if (!designation.trim()) { showToast('Designation is required', 'warning'); return; }
    if (!phone.trim()) { showToast('Phone number is required', 'warning'); return; }
    if (isNaN(value) || value < 0) { showToast('Please enter a valid basic salary', 'warning'); return; }
    save.mutate({ designation: designation.trim(), phone: phone.trim(), basicSalary: value, ...(joined ? { joinedDate: joined } : {}), ...bankPayload(bank) }, { onSuccess: onClose });
  };
  return (
    <Dialog id="editStaffModal" open onClose={onClose} size="lg" title="Edit staff member" description="Update designation, phone, monthly salary, joining date and bank details.">
      <form id="editStaffForm" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="editStaffName" label="Employee name"><input id="editStaffName" value={employee.name} disabled className="input" /></Field>
          <Field id="editStaffDesignation" label="Designation"><input id="editStaffDesignation" value={designation} onChange={(e) => setDesignation(e.target.value)} className="input" placeholder="e.g. Head Barista, Cashier, Waiter" /></Field>
          <Field id="editStaffPhone" label="Phone contact"><input id="editStaffPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="e.g. 9876543210" /></Field>
          <Field id="editStaffSalary" label="Basic salary (₹)"><input id="editStaffSalary" type="number" min="0" step="any" value={salary} onChange={(e) => setSalary(e.target.value)} className="input" placeholder="e.g. 18000" /></Field>
          <Field id="editStaffJoiningDate" label="Joining date"><input id="editStaffJoiningDate" type="date" value={joined} onChange={(e) => setJoined(e.target.value)} className="input" /></Field>
        </div>
        <BankFields value={bank} onChange={setBank} prefix="editStaff" />
        <button type="submit" id="saveStaffEditBtn" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Updating…' : 'Update employee'}</button>
      </form>
    </Dialog>
  );
}

/** Process a monthly salary slip; the net amount is shown live. */
export function SalaryDialog({ employees, onClose }: { employees: Employee[]; onClose: () => void }) {
  const now = new Date();
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [basic, setBasic] = useState('0');
  const [allowances, setAllowances] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [paid, setPaid] = useState(false);
  const save = useStaffAction(createSalary, 'Salary processed successfully', 'Failed to process salary');
  const num = (v: string) => parseFloat(v || '0') || 0;

  const pick = (id: string) => { setEmployeeId(id); setBasic(String(employees.find((e) => String(e.id) === id)?.basicSalary ?? 0)); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) { showToast('Please select an employee', 'error'); return; }
    save.mutate({ employeeId: parseInt(employeeId, 10), month: parseInt(month, 10), year: parseInt(year, 10), basic: num(basic), allowances: num(allowances), deductions: num(deductions), paid, paidDate: paid ? todayISO() : null, paymentMode: 'CASH', notes: 'Monthly payout' }, { onSuccess: onClose });
  };
  return (
    <Dialog id="salaryModal" open onClose={onClose} size="md" title="Process monthly salary">
      <form id="salaryForm" onSubmit={submit} className="space-y-4">
        <Field id="salEmployee" label="Employee"><select id="salEmployee" value={employeeId} onChange={(e) => pick(e.target.value)} className="input"><option value="">-- Choose employee --</option>{employees.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="salMonth" label="Month"><select id="salMonth" value={month} onChange={(e) => setMonth(e.target.value)} className="input">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
          <Field id="salYear" label="Year"><input id="salYear" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="input" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field id="salBasic" label="Basic (₹)"><input id="salBasic" type="number" min="0" step="any" value={basic} onChange={(e) => setBasic(e.target.value)} className="input" /></Field>
          <Field id="salAllowances" label="Allowances (₹)"><input id="salAllowances" type="number" min="0" step="any" value={allowances} onChange={(e) => setAllowances(e.target.value)} className="input" /></Field>
          <Field id="salDeductions" label="Deductions (₹)"><input id="salDeductions" type="number" min="0" step="any" value={deductions} onChange={(e) => setDeductions(e.target.value)} className="input" /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2.5 text-sm"><span className="text-muted">Net salary</span><span id="salNetPreview" className="font-semibold text-fg">{money(netSalary(num(basic), num(allowances), num(deductions)))}</span></div>
        <label htmlFor="salMarkPaid" className="flex items-center gap-2 text-sm text-fg cursor-pointer"><input id="salMarkPaid" type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Mark as immediately paid</label>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Process salary'}</button>
      </form>
    </Dialog>
  );
}

/** Give a staff member part of the month's pay early. The month's slip is created when there is none; the balance to pay is shown live. */
export function AdvanceDialog({ employees, salaries, initial, onClose }: { employees: Employee[]; salaries: Salary[]; initial?: { employeeId: number; month: number; year: number }; onClose: () => void }) {
  const now = new Date();
  const [employeeId, setEmployeeId] = useState(initial ? String(initial.employeeId) : '');
  const [month, setMonth] = useState(String(initial?.month ?? now.getMonth() + 1));
  const [year, setYear] = useState(String(initial?.year ?? now.getFullYear()));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [serverError, setServerError] = useState('');
  const save = useStaffAction(giveAdvance, 'Advance given', 'Failed to give advance');
  const amt = parseFloat(amount) || 0;
  const ctx = employeeId ? advanceContext(employees, salaries, parseInt(employeeId, 10), parseInt(month, 10), parseInt(year, 10), amt) : null;
  const problem = serverError || ctx?.problem || '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) { showToast('Please select an employee', 'error'); return; }
    if (!(amt > 0)) { showToast('Enter an advance amount', 'error'); return; }
    setServerError('');
    save.mutate({ employeeId: parseInt(employeeId, 10), month: parseInt(month, 10), year: parseInt(year, 10), amount: amt, note: note.trim() }, { onSuccess: onClose, onError: (err) => setServerError(err.message) });
  };
  return (
    <Dialog id="advanceModal" open onClose={onClose} size="md" title="Give salary advance" description="The advance is taken off that month's pay. The balance left is shown in the payroll list.">
      <form id="advanceForm" onSubmit={submit} className="space-y-4">
        <Field id="advEmployee" label="Employee"><select id="advEmployee" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setServerError(''); }} className="input"><option value="">-- Choose employee --</option>{employees.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="advMonth" label="Month"><select id="advMonth" value={month} onChange={(e) => setMonth(e.target.value)} className="input">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
          <Field id="advYear" label="Year"><input id="advYear" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="input" /></Field>
        </div>
        <Field id="advAmount" label="Advance amount (₹)"><input id="advAmount" type="number" min="1" step="0.01" inputMode="decimal" required value={amount} onChange={(e) => { setAmount(e.target.value); setServerError(''); }} className="input" placeholder="e.g. 2000" /></Field>
        <Field id="advNote" label="Note (optional)"><input id="advNote" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="e.g. festival, medical" /></Field>
        <div id="advPreview" className="rounded-lg bg-brand/10 px-3 py-2.5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted">Month's pay</span><span id="advPrevNet" className="text-fg">{ctx ? money(ctx.net) : '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Advance already given</span><span id="advPrevGiven" className="text-fg">{ctx ? money(ctx.given) : '-'}</span></div>
          <div className="flex justify-between font-semibold"><span className="text-muted">Balance to pay after this</span><span id="advPrevBalance" className={ctx && ctx.left < 0 ? 'text-danger' : 'text-fg'}>{ctx ? money(ctx.left) : '-'}</span></div>
        </div>
        {problem && <p id="advError" role="alert" className="text-sm text-danger">{problem}</p>}
        <button type="submit" id="advSubmit" disabled={save.isPending || !!ctx?.problem} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Give advance'}</button>
      </form>
    </Dialog>
  );
}
