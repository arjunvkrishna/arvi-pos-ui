// NERAM POS - on-demand module: Staff directory and payroll
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 5: STAFF & PAYROLL (SALARY)
// ============================================================
let staffList = [];

async function loadStaffData() {
  try {
    staffList = await apiRequest('/employees');
    renderStaffTable();
  } catch (err) {
    showToast('Failed to load staff: ' + err.message, 'error');
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No staff records found</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList.map(s => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-3 font-semibold text-white">
        <button onclick="openEmployeeDetailsModal(${s.id})" class="text-left font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5" title="View Full Employee Dossier (Pay, Attendance, Leaves)">
          <i class="fa-solid fa-user-circle text-xs text-amber-400/70"></i>
          <span>${escapeHtml(s.name)}</span>
        </button>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : s.role === 'MANAGER' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}">
          ${s.role}
        </span>
      </td>
      <td class="p-3 text-gray-400">${s.designation || '-'}</td>
      <td class="p-3 text-gray-400">${s.phone || '-'}</td>
      <td class="p-3 font-bold text-amber-400">₹${s.basicSalary.toFixed(2)}</td>
      <td class="p-3 text-gray-400">${s.joinedDate || '-'}</td>
      <td class="p-3 text-right">
        <button onclick="openEmployeeDetailsModal(${s.id})" class="text-amber-400 hover:text-amber-300 mr-2.5 transition" title="View Detailed Profile, Pay, Attendance & Leaves">
          <i class="fa-solid fa-address-card"></i>
        </button>
        ${currentUser.role === 'ADMIN' || (currentUser.role === 'MANAGER' && s.role === 'EMPLOYEE') ? `
          <button onclick="openEditStaffModal(${s.id})" class="text-gray-400 hover:text-amber-400 mr-2.5 transition" title="Edit Employee Details">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteStaff(${s.id})" class="text-gray-400 hover:text-rose-400 transition" title="Deactivate">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function openEditStaffModal(id) {
  const staff = (staffList || []).find(s => s.id === id);
  if (!staff) {
    showToast('Employee record not found', 'error');
    return;
  }
  document.getElementById('editStaffId').value = staff.id;
  document.getElementById('editStaffName').value = staff.name || '';
  document.getElementById('editStaffDesignation').value = staff.designation || '';
  document.getElementById('editStaffPhone').value = staff.phone || '';
  document.getElementById('editStaffSalary').value = staff.basicSalary !== undefined ? staff.basicSalary : '';
  const joinDateEl = document.getElementById('editStaffJoiningDate');
  if (joinDateEl) {
    joinDateEl.value = staff.joinedDate || '';
  }

  // Bank details fields
  if (document.getElementById('editStaffBankAccountHolder')) {
    document.getElementById('editStaffBankAccountHolder').value = staff.bankAccountHolderName || '';
  }
  if (document.getElementById('editStaffBankName')) {
    document.getElementById('editStaffBankName').value = staff.bankName || '';
  }
  if (document.getElementById('editStaffBankAccountNumber')) {
    document.getElementById('editStaffBankAccountNumber').value = staff.bankAccountNumber || '';
  }
  if (document.getElementById('editStaffBankIfsc')) {
    document.getElementById('editStaffBankIfsc').value = staff.bankIfsc || '';
  }
  if (document.getElementById('editStaffBankBranch')) {
    document.getElementById('editStaffBankBranch').value = staff.bankBranch || '';
  }
  if (document.getElementById('editStaffUpiId')) {
    document.getElementById('editStaffUpiId').value = staff.upiId || '';
  }

  const modal = document.getElementById('editStaffModal');
  if (modal) modal.classList.remove('hidden');
}

async function saveStaffEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editStaffId').value;
  const designation = document.getElementById('editStaffDesignation').value.trim();
  const phone = document.getElementById('editStaffPhone').value.trim();
  const salaryVal = document.getElementById('editStaffSalary').value;
  const basicSalary = parseFloat(salaryVal);
  const joiningDateVal = document.getElementById('editStaffJoiningDate')?.value?.trim();

  if (!designation) {
    showToast('Designation is required', 'warning');
    return;
  }
  if (!phone) {
    showToast('Phone number is required', 'warning');
    return;
  }
  if (isNaN(basicSalary) || basicSalary < 0) {
    showToast('Please enter a valid basic salary', 'warning');
    return;
  }

  const payload = {
    designation: designation,
    phone: phone,
    basicSalary: basicSalary,
    bankAccountHolderName: document.getElementById('editStaffBankAccountHolder')?.value.trim() || null,
    bankName: document.getElementById('editStaffBankName')?.value.trim() || null,
    bankAccountNumber: document.getElementById('editStaffBankAccountNumber')?.value.trim() || null,
    bankIfsc: document.getElementById('editStaffBankIfsc')?.value.trim() || null,
    bankBranch: document.getElementById('editStaffBankBranch')?.value.trim() || null,
    upiId: document.getElementById('editStaffUpiId')?.value.trim() || null
  };

  const btn = document.getElementById('saveStaffEditBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
  }

  try {
    const payload = {
      designation: designation,
      phone: phone,
      basicSalary: basicSalary
    };
    if (joiningDateVal) {
      payload.joinedDate = joiningDateVal;
    }
    await apiRequest(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    closeModal('editStaffModal');
    showToast('Employee updated successfully', 'success');
    loadStaffData();
  } catch (err) {
    showToast('Failed to update employee: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Employee';
    }
  }
}

function openAddStaffModal() {
  document.getElementById('staffName').value = '';
  document.getElementById('staffDesignation').value = '';
  document.getElementById('staffPhone').value = '';
  document.getElementById('staffSalary').value = '';
  document.getElementById('staffUsername').value = '';
  document.getElementById('staffPassword').value = '';

  if (document.getElementById('staffBankAccountHolder')) document.getElementById('staffBankAccountHolder').value = '';
  if (document.getElementById('staffBankName')) document.getElementById('staffBankName').value = '';
  if (document.getElementById('staffBankAccountNumber')) document.getElementById('staffBankAccountNumber').value = '';
  if (document.getElementById('staffBankIfsc')) document.getElementById('staffBankIfsc').value = '';
  if (document.getElementById('staffBankBranch')) document.getElementById('staffBankBranch').value = '';
  if (document.getElementById('staffUpiId')) document.getElementById('staffUpiId').value = '';

  const optManager = document.getElementById('optRoleManager');
  const optAdmin = document.getElementById('optRoleAdmin');
  const titleEl = document.getElementById('staffModalTitle');

  if (currentUser && currentUser.role === 'ADMIN') {
    if (titleEl) titleEl.textContent = 'Add New User / Staff (Root Admin)';
    if (optManager) { optManager.disabled = false; optManager.hidden = false; }
    if (optAdmin) { optAdmin.disabled = false; optAdmin.hidden = false; }
    document.getElementById('staffRole').value = 'EMPLOYEE';
  } else {
    if (titleEl) titleEl.textContent = 'Add Staff Member';
    if (optManager) { optManager.disabled = true; optManager.hidden = true; }
    if (optAdmin) { optAdmin.disabled = true; optAdmin.hidden = true; }
    document.getElementById('staffRole').value = 'EMPLOYEE';
  }

  document.getElementById('staffModal').classList.remove('hidden');
}

async function saveStaff(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staffName').value.trim(),
    role: document.getElementById('staffRole').value,
    designation: document.getElementById('staffDesignation').value.trim(),
    phone: document.getElementById('staffPhone').value.trim(),
    basicSalary: parseFloat(document.getElementById('staffSalary').value || 0),
    username: document.getElementById('staffUsername').value.trim(),
    password: document.getElementById('staffPassword').value,
    bankAccountHolderName: document.getElementById('staffBankAccountHolder')?.value.trim() || null,
    bankName: document.getElementById('staffBankName')?.value.trim() || null,
    bankAccountNumber: document.getElementById('staffBankAccountNumber')?.value.trim() || null,
    bankIfsc: document.getElementById('staffBankIfsc')?.value.trim() || null,
    bankBranch: document.getElementById('staffBankBranch')?.value.trim() || null,
    upiId: document.getElementById('staffUpiId')?.value.trim() || null
  };

  try {
    await apiRequest('/employees', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Staff member added successfully', 'success');
    closeModal('staffModal');
    loadStaffData();
  } catch (err) {
    showToast('Failed to add staff: ' + err.message, 'error');
  }
}

async function deleteStaff(id) {
  if (!confirm('Deactivate this staff member?')) return;
  try {
    await apiRequest(`/employees/${id}`, { method: 'DELETE' });
    showToast('Staff deactivated', 'success');
    loadStaffData();
  } catch (err) {
    showToast('Failed to delete staff: ' + err.message, 'error');
  }
}

// Salary / Payroll Logic
async function loadSalaryData() {
  try {
    const salaries = await apiRequest('/salaries');
    renderSalaryTable(salaries);
  } catch (err) {
    showToast('Failed to load salaries: ' + err.message, 'error');
  }
}

function renderSalaryTable(salaries) {
  const tbody = document.getElementById('salaryTableBody');
  if (salaries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">No salary records generated</td></tr>`;
    return;
  }

  tbody.innerHTML = salaries.map(s => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-3 font-semibold text-white">${s.employeeName}</td>
      <td class="p-3">${s.month}/${s.year}</td>
      <td class="p-3">₹${s.basic.toFixed(2)}</td>
      <td class="p-3 text-emerald-400">+₹${s.allowances.toFixed(2)}</td>
      <td class="p-3 text-rose-400">-₹${s.deductions.toFixed(2)}</td>
      <td class="p-3 font-bold text-amber-400">₹${s.netSalary.toFixed(2)}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}">
          ${s.paid ? 'PAID' : 'PENDING'}
        </span>
      </td>
      <td class="p-3 text-right">
        ${!s.paid ? `
          <button onclick="markSalaryPaid(${s.id})" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold">
            Mark Paid
          </button>
        ` : `<span class="text-[10px] text-gray-500">${s.paidDate || 'Paid'}</span>`}
      </td>
    </tr>
  `).join('');
}

function openAddSalaryModal() {
  const select = document.getElementById('salEmployee');
  select.innerHTML = '<option value="">-- Choose Employee --</option>' +
    staffList.map(s => `<option value="${s.id}" data-salary="${s.basicSalary}">${s.name} (${s.role})</option>`).join('');

  document.getElementById('salMonth').value = new Date().getMonth() + 1;
  document.getElementById('salYear').value = new Date().getFullYear();
  document.getElementById('salBasic').value = 0;
  document.getElementById('salAllowances').value = 0;
  document.getElementById('salDeductions').value = 0;
  document.getElementById('salMarkPaid').checked = false;
  recalculateSalaryNet();

  document.getElementById('salaryModal').classList.remove('hidden');
}

function onSalEmployeeSelected() {
  const select = document.getElementById('salEmployee');
  const selected = select.options[select.selectedIndex];
  const basic = parseFloat(selected?.getAttribute('data-salary') || 0);
  document.getElementById('salBasic').value = basic;
  recalculateSalaryNet();
}

function recalculateSalaryNet() {
  const basic = parseFloat(document.getElementById('salBasic')?.value || 0);
  const allowances = parseFloat(document.getElementById('salAllowances')?.value || 0);
  const deductions = parseFloat(document.getElementById('salDeductions')?.value || 0);
  const net = Math.max(0, basic + allowances - deductions);
  document.getElementById('salNetPreview').textContent = `₹${net.toFixed(2)}`;
}

async function saveSalary(e) {
  e.preventDefault();
  const empId = document.getElementById('salEmployee').value;
  if (!empId) {
    showToast('Please select an employee', 'error');
    return;
  }

  const payload = {
    employeeId: parseInt(empId),
    month: parseInt(document.getElementById('salMonth').value),
    year: parseInt(document.getElementById('salYear').value),
    basic: parseFloat(document.getElementById('salBasic').value || 0),
    allowances: parseFloat(document.getElementById('salAllowances').value || 0),
    deductions: parseFloat(document.getElementById('salDeductions').value || 0),
    paid: document.getElementById('salMarkPaid').checked,
    paidDate: document.getElementById('salMarkPaid').checked ? new Date().toISOString().split('T')[0] : null,
    paymentMode: 'CASH',
    notes: 'Monthly payout'
  };

  try {
    await apiRequest('/salaries', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Salary processed successfully', 'success');
    closeModal('salaryModal');
    loadSalaryData();
  } catch (err) {
    showToast('Failed to process salary: ' + err.message, 'error');
  }
}

async function markSalaryPaid(id) {
  try {
    await apiRequest(`/salaries/${id}/pay`, { method: 'PATCH', body: JSON.stringify({ paymentMode: 'BANK' }) });
    showToast('Salary marked as paid', 'success');
    loadSalaryData();
  } catch (err) {
    showToast('Failed to mark paid: ' + err.message, 'error');
  }
}

// ============================================================
