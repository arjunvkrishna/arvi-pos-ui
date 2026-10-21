// NERAM POS - on-demand module: Attendance, leaves, employee dossier and profile
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 8: ATTENDANCE & LEAVES
// ============================================================
let attendanceEmployeesList = [];

async function loadAttendanceData() {
  const filterDateInput = document.getElementById('attendanceFilterDate');
  if (filterDateInput && !filterDateInput.value) {
    filterDateInput.value = new Date().toISOString().split('T')[0];
  }

  // Setup Month and Year selectors if not populated
  initAttendanceSummaryFilters();

  // If Employee, hide the full admin register and "All Staff Overview" option
  const adminSec = document.getElementById('adminAttendanceSection');
  const employeeSelectorContainer = document.getElementById('summaryEmployeeSelectorContainer');

  if (currentUser.role === 'EMPLOYEE') {
    if (adminSec) adminSec.classList.add('hidden');
    if (employeeSelectorContainer) employeeSelectorContainer.classList.add('hidden');
  } else {
    if (adminSec) adminSec.classList.remove('hidden');
    if (employeeSelectorContainer) employeeSelectorContainer.classList.remove('hidden');
    fetchAttendanceForDate();
    await populateAttendanceEmployeeDropdown();
  }

  await loadMonthlyAttendanceSummary();
}

async function openUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  if (!modal) return;

  try {
    const profile = await apiRequest('/users/me');

    // Header info
    const nameEl = document.getElementById('profileModalName');
    const roleBadgeEl = document.getElementById('profileModalRoleBadge');
    const activeBadgeEl = document.getElementById('profileModalActiveBadge');
    const desigDeptEl = document.getElementById('profileModalDesignationDept');

    if (nameEl) nameEl.textContent = profile.employeeName || profile.username || 'User Profile';
    if (roleBadgeEl) {
      roleBadgeEl.textContent = profile.role || 'USER';
      roleBadgeEl.className = `px-2.5 py-0.5 rounded-full text-[10px] font-bold ${profile.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
        profile.role === 'MANAGER' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`;
    }
    if (activeBadgeEl) {
      activeBadgeEl.textContent = profile.active ? 'ACTIVE' : 'INACTIVE';
      activeBadgeEl.className = `px-2 py-0.5 rounded-full text-[9px] font-bold ${profile.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
        'bg-rose-500/20 text-rose-400 border border-rose-500/30'
        }`;
    }
    if (desigDeptEl) {
      const parts = [];
      if (profile.designation) parts.push(profile.designation);
      if (profile.department) parts.push(profile.department);
      desigDeptEl.textContent = parts.length > 0 ? parts.join(' • ') : 'Standard System User';
    }

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };

    setTxt('profileUsername', profile.username);
    setTxt('profileRole', profile.role);

    const orderPerm = document.getElementById('profileOrderPerm');
    if (orderPerm) {
      orderPerm.innerHTML = profile.canTakeOrders ?
        '<i class="fa-solid fa-check text-emerald-400 mr-1"></i><span class="text-emerald-400 font-medium">Allowed (Active)</span>' :
        '<i class="fa-solid fa-xmark text-rose-400 mr-1"></i><span class="text-gray-400 font-medium">Restricted</span>';
    }

    const invPerm = document.getElementById('profileInvPerm');
    if (invPerm) {
      invPerm.innerHTML = profile.canManageInventory ?
        '<i class="fa-solid fa-check text-emerald-400 mr-1"></i><span class="text-emerald-400 font-medium">Allowed (Active)</span>' :
        '<i class="fa-solid fa-xmark text-rose-400 mr-1"></i><span class="text-gray-400 font-medium">Restricted</span>';
    }

    // Employment details
    setTxt('profileFullName', profile.employeeName || profile.username);
    setTxt('profileDesignation', profile.designation);
    setTxt('profilePhone', profile.phone);
    setTxt('profileEmail', profile.email);
    setTxt('profileDepartment', profile.department);
    setTxt('profileJoinDate', profile.joinedDate);
    setTxt('profileSalary', profile.basicSalary !== null && profile.basicSalary !== undefined ? `₹${parseFloat(profile.basicSalary).toFixed(2)}` : null);
    setTxt('profileLeavesQuota', (profile.paidLeavesQuota !== null && profile.casualLeavesQuota !== null && profile.paidLeavesQuota !== undefined) ?
      `${profile.paidLeavesQuota || 0} Paid / ${profile.casualLeavesQuota || 0} Casual days/yr` : null);
    setTxt('profileAddress', profile.address);

    // Bank Details
    setTxt('profileBankAccountHolder', profile.bankAccountHolderName || profile.employeeName);
    setTxt('profileBankName', profile.bankName);
    setTxt('profileBankAccountNumber', profile.bankAccountNumber);
    setTxt('profileBankIfsc', profile.bankIfsc);
    setTxt('profileBankBranch', profile.bankBranch);
    setTxt('profileUpiId', profile.upiId);

    modal.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load profile:', err);
    showToast('Failed to load user profile: ' + err.message, 'error');
  }
}

function initAttendanceSummaryFilters() {
  const yearSelect = document.getElementById('attendanceSummaryYear');
  const monthSelect = document.getElementById('attendanceSummaryMonth');
  const now = new Date();

  if (yearSelect && yearSelect.options.length === 0) {
    const currentYear = now.getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
  }

  if (monthSelect && !monthSelect.dataset.initialized) {
    monthSelect.value = now.getMonth() + 1; // 1 to 12
    monthSelect.dataset.initialized = 'true';
  }
}

async function populateAttendanceEmployeeDropdown() {
  const select = document.getElementById('attendanceSummaryEmployee');
  if (!select) return;

  try {
    attendanceEmployeesList = await apiRequest('/employees');
    // Keep 'ALL' as first option
    select.innerHTML = '<option value="ALL">All Staff Overview</option>';
    attendanceEmployeesList.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.role})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching employees for attendance summary:', err);
  }
}

function onAttendanceSummaryEmployeeChange() {
  loadMonthlyAttendanceSummary();
}

async function loadMonthlyAttendanceSummary() {
  const yearSelect = document.getElementById('attendanceSummaryYear');
  const monthSelect = document.getElementById('attendanceSummaryMonth');
  const empSelect = document.getElementById('attendanceSummaryEmployee');

  const now = new Date();
  const year = yearSelect ? parseInt(yearSelect.value) || now.getFullYear() : now.getFullYear();
  const month = monthSelect ? parseInt(monthSelect.value) || (now.getMonth() + 1) : (now.getMonth() + 1);

  const singleView = document.getElementById('singleEmployeeSummaryView');
  const allView = document.getElementById('allStaffSummaryView');

  if (currentUser.role === 'EMPLOYEE') {
    // Current user view
    const empId = currentUser.employeeId;
    if (singleView) singleView.classList.remove('hidden');
    if (allView) allView.classList.add('hidden');
    await fetchAndRenderSingleEmployeeSummary(empId, year, month);
  } else {
    // Admin / Manager view
    const selectedEmp = empSelect ? empSelect.value : 'ALL';
    if (selectedEmp === 'ALL') {
      if (singleView) singleView.classList.add('hidden');
      if (allView) allView.classList.remove('hidden');
      await fetchAndRenderAllStaffSummary(year, month);
    } else {
      if (singleView) singleView.classList.remove('hidden');
      if (allView) allView.classList.add('hidden');
      await fetchAndRenderSingleEmployeeSummary(selectedEmp, year, month);
    }
  }
}

async function fetchAndRenderSingleEmployeeSummary(employeeId, year, month) {
  try {
    const url = employeeId ? `/attendance/summary?employeeId=${employeeId}&year=${year}&month=${month}` : `/attendance/summary?year=${year}&month=${month}`;
    const summary = await apiRequest(url);
    renderSingleEmployeeSummaryKPI(summary);
  } catch (err) {
    console.error('Failed to load employee monthly summary:', err);
    showToast('Failed to load monthly summary: ' + err.message, 'error');
  }
}

function renderSingleEmployeeSummaryKPI(summary) {
  const joinDateEl = document.getElementById('kpiJoinedDate');
  const joinNoteEl = document.getElementById('kpiJoinedNote');
  const monthDaysEl = document.getElementById('kpiTotalMonthDays');
  const eligibleDaysEl = document.getElementById('kpiEligibleDays');
  const presentDaysEl = document.getElementById('kpiPresentDays');
  const halfDaysEl = document.getElementById('kpiHalfDaysNote');
  const absentLeaveEl = document.getElementById('kpiAbsentLeaveDays');
  const leaveNoteEl = document.getElementById('kpiLeaveNote');
  const percentEl = document.getElementById('kpiAttendancePercent');
  const progressBar = document.getElementById('kpiProgressBar');

  if (joinDateEl) joinDateEl.textContent = summary.joinedDate || 'Not Set';
  if (joinNoteEl) {
    if (summary.joinedDate) {
      const parts = summary.joinedDate.split('-');
      const jYear = parseInt(parts[0]);
      const jMonth = parseInt(parts[1]);
      const jDay = parseInt(parts[2]);
      if (jYear === summary.year && jMonth === summary.month) {
        joinNoteEl.textContent = `Joined day ${jDay} of this month`;
      } else if (jYear > summary.year || (jYear === summary.year && jMonth > summary.month)) {
        joinNoteEl.textContent = 'Joined in future month';
      } else {
        joinNoteEl.textContent = 'Joined prior to this month';
      }
    } else {
      joinNoteEl.textContent = 'Joined prior (full month)';
    }
  }

  if (monthDaysEl) monthDaysEl.textContent = summary.totalDaysInMonth;
  if (eligibleDaysEl) eligibleDaysEl.textContent = `${summary.eligibleDays} days`;
  if (presentDaysEl) presentDaysEl.textContent = `${summary.effectivePresentDays} days`;
  if (halfDaysEl) halfDaysEl.textContent = `${summary.halfDays} half-day, ${summary.presentDays} full-day`;
  if (absentLeaveEl) absentLeaveEl.textContent = `${summary.absentDays + summary.leaveDays} days`;
  if (leaveNoteEl) leaveNoteEl.textContent = `${summary.absentDays} absent, ${summary.leaveDays} on leave`;
  if (percentEl) percentEl.textContent = `${summary.attendancePercentage}%`;

  if (progressBar) {
    const pct = Math.min(100, Math.max(0, summary.attendancePercentage));
    progressBar.style.width = `${pct}%`;
    progressBar.className = pct >= 80 ? 'bg-emerald-400 h-1.5 rounded-full' : (pct >= 50 ? 'bg-amber-400 h-1.5 rounded-full' : 'bg-rose-500 h-1.5 rounded-full');
  }
}

async function fetchAndRenderAllStaffSummary(year, month) {
  const tbody = document.getElementById('allStaffSummaryTableBody');
  if (!tbody) return;

  try {
    const list = await apiRequest(`/attendance/monthly-summary?year=${year}&month=${month}`);
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500">No staff attendance summaries found for this month</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const pct = s.attendancePercentage;
      const pctBadge = pct >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (pct >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30');

      return `
        <tr class="hover:bg-gray-800/40">
          <td class="p-3 font-semibold text-white">
            <button onclick="openEmployeeDetailsModal(${s.employeeId})" class="text-left font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5" title="View Full Employee Dossier (Pay, Attendance, Leaves)">
              <i class="fa-solid fa-user-circle text-xs text-amber-400/70"></i>
              <span>${escapeHtml(s.employeeName)}</span>
            </button>
          </td>
          <td class="p-3 text-[11px] text-gray-400">
            <span class="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 font-medium">${s.role}</span>
          </td>
          <td class="p-3 text-gray-300 text-xs font-mono">
            ${s.joinedDate ? s.joinedDate : '<span class="text-gray-500">-</span>'}
          </td>
          <td class="p-3 text-gray-300">${s.totalDaysInMonth}</td>
          <td class="p-3 font-bold text-cyan-300">
            ${s.eligibleDays} days
          </td>
          <td class="p-3 font-bold text-emerald-400">
            ${s.effectivePresentDays} days
            <span class="text-[10px] text-gray-500 font-normal">(${s.presentDays} full, ${s.halfDays} half)</span>
          </td>
          <td class="p-3 font-semibold text-rose-400">
            ${s.absentDays + s.leaveDays}
            <span class="text-[10px] text-gray-500 font-normal">(${s.absentDays} abs, ${s.leaveDays} lve)</span>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${pctBadge}">
              ${s.attendancePercentage}%
            </span>
          </td>
          <td class="p-3 text-right">
            <button onclick="openEmployeeDetailsModal(${s.employeeId})" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold mr-1.5" title="Full Dossier">
              <i class="fa-solid fa-id-card mr-1"></i>Dossier
            </button>
            <button onclick="selectEmployeeForMonthlySummary(${s.employeeId})" class="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">
              <i class="fa-solid fa-chart-pie mr-1"></i>Month
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load all staff monthly summary:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400">Failed to load summaries: ${err.message}</td></tr>`;
  }
}

function selectEmployeeForMonthlySummary(employeeId) {
  const empSelect = document.getElementById('attendanceSummaryEmployee');
  if (empSelect) {
    empSelect.value = employeeId;
    loadMonthlyAttendanceSummary();
  }
}

async function fetchAttendanceForDate() {
  const dateVal = document.getElementById('attendanceFilterDate').value;
  try {
    const records = await apiRequest(`/attendance/date?date=${dateVal}`);
    renderAttendanceTable(records);
  } catch (err) {
    showToast('Failed to load attendance: ' + err.message, 'error');
  }
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendanceTableBody');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No attendance records for this date</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-3 font-semibold text-white">
        <button onclick="openEmployeeDetailsModal(${r.employeeId})" class="text-left font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5" title="View Full Employee Dossier (Pay, Attendance, Leaves)">
          <i class="fa-solid fa-user-circle text-xs text-amber-400/70"></i>
          <span>${escapeHtml(r.employeeName)}</span>
        </button>
      </td>
      <td class="p-3">${r.date}</td>
      <td class="p-3 text-emerald-400">${r.checkIn || '-'}</td>
      <td class="p-3 text-rose-400">${r.checkOut || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getAttendanceBadge(r.status)}">
          ${r.status}
        </span>
      </td>
      <td class="p-3 text-right space-x-1">
        <button onclick="quickMarkAttendance(${r.employeeId}, 'PRESENT')" class="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px]">P</button>
        <button onclick="quickMarkAttendance(${r.employeeId}, 'ABSENT')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px]">A</button>
        <button onclick="quickMarkAttendance(${r.employeeId}, 'HALF_DAY')" class="px-2 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px]">HD</button>
      </td>
    </tr>
  `).join('');
}

function getAttendanceBadge(status) {
  switch (status) {
    case 'PRESENT': return 'bg-emerald-500/20 text-emerald-400';
    case 'ABSENT': return 'bg-rose-500/20 text-rose-400';
    case 'HALF_DAY': return 'bg-yellow-500/20 text-yellow-300';
    default: return 'bg-cyan-500/20 text-cyan-400';
  }
}

async function punchCheckIn() {
  const url = currentUser && currentUser.employeeId ? `/attendance/check-in/${currentUser.employeeId}` : '/attendance/check-in';
  try {
    const record = await apiRequest(url, { method: 'POST' });
    showToast(`Shift Started! Checked in at ${record.checkIn}`, 'success');
    loadAttendanceData();
  } catch (err) {
    showToast('Check in failed: ' + err.message, 'error');
  }
}

async function punchCheckOut() {
  const url = currentUser && currentUser.employeeId ? `/attendance/check-out/${currentUser.employeeId}` : '/attendance/check-out';
  try {
    const record = await apiRequest(url, { method: 'POST' });
    const shiftDateNote = record.date ? ` (Shift Date: ${record.date})` : '';
    showToast(`Shift Ended! Checked out at ${record.checkOut}${shiftDateNote}`, 'success');
    loadAttendanceData();
  } catch (err) {
    showToast('Check out failed: ' + err.message, 'error');
  }
}

async function quickMarkAttendance(employeeId, status) {
  const dateVal = document.getElementById('attendanceFilterDate').value;
  try {
    await apiRequest('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ employeeId, date: dateVal, status })
    });
    fetchAttendanceForDate();
    loadMonthlyAttendanceSummary();
  } catch (err) {
    showToast('Failed to mark attendance: ' + err.message, 'error');
  }
}

// Leave Applications & Audit
async function loadLeavesData() {
  try {
    let leaves;
    if (currentUser.role === 'EMPLOYEE') {
      const empId = currentUser.employeeId;
      leaves = await apiRequest(empId ? `/leaves/employee/${empId}` : '/leaves/employee');
    } else {
      leaves = await apiRequest('/leaves/audit');
    }
    renderLeavesTable(leaves);
  } catch (err) {
    showToast('Failed to load leaves: ' + err.message, 'error');
  }
}

function renderLeavesTable(leaves) {
  const tbody = document.getElementById('leaveTableBody');
  if (leaves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No leave requests found</td></tr>`;
    return;
  }

  tbody.innerHTML = leaves.map(l => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-3 font-semibold text-white">${l.employeeName}</td>
      <td class="p-3">${l.fromDate} to ${l.toDate}</td>
      <td class="p-3 text-cyan-300 font-bold text-[10px]">${l.leaveType}</td>
      <td class="p-3 text-gray-300 max-w-xs truncate">${l.reason}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : l.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' : 'bg-yellow-500/20 text-yellow-300'}">
          ${l.status}
        </span>
      </td>
      <td class="p-3 text-gray-400">${l.reviewedByName || '-'}</td>
      <td class="p-3 text-right">
        ${(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && l.status === 'PENDING' ? `
          <button onclick="openReviewLeaveModal(${l.id})" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold">
            Review
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function openApplyLeaveModal() {
  document.getElementById('leaveFromDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('leaveToDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('leaveReason').value = '';
  document.getElementById('leaveModal').classList.remove('hidden');
}

async function saveLeaveApplication(e) {
  e.preventDefault();
  const empId = currentUser.employeeId;
  const payload = {
    employeeId: empId,
    fromDate: document.getElementById('leaveFromDate').value,
    toDate: document.getElementById('leaveToDate').value,
    leaveType: document.getElementById('leaveType').value,
    reason: document.getElementById('leaveReason').value.trim()
  };

  try {
    await apiRequest('/leaves/apply', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Leave request submitted', 'success');
    closeModal('leaveModal');
    loadLeavesData();
    if (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')) {
      fetchSystemNotifications();
    }
  } catch (err) {
    showToast('Failed to apply leave: ' + err.message, 'error');
  }
}

function openReviewLeaveModal(id) {
  document.getElementById('reviewLeaveId').value = id;
  document.getElementById('reviewNotes').value = '';
  document.getElementById('reviewLeaveModal').classList.remove('hidden');
}

async function saveReviewLeave(e) {
  e.preventDefault();
  const id = document.getElementById('reviewLeaveId').value;
  const payload = {
    status: document.getElementById('reviewStatus').value,
    reviewNotes: document.getElementById('reviewNotes').value.trim()
  };

  try {
    await apiRequest(`/leaves/${id}/review`, { method: 'PATCH', body: JSON.stringify(payload) });
    showToast('Leave status updated', 'success');
    closeModal('reviewLeaveModal');
    loadLeavesData();
    fetchSystemNotifications();
  } catch (err) {
    showToast('Failed to review leave: ' + err.message, 'error');
  }
}

// ============================================================

// DEDICATED EMPLOYEE DOSSIER & PROFILE (Feature 35)
// Month-by-month pay, lifetime pay, attendance hours, leave quota
// ============================================================
let activeDossierEmployeeId = null;

async function openEmployeeDetailsModal(employeeId) {
  activeDossierEmployeeId = employeeId;
  const modal = document.getElementById('employeeDetailsModal');
  if (!modal) return;

  switchDossierSubTab('overview');
  modal.classList.remove('hidden');

  try {
    // 1. Fetch employee details
    const emp = await apiRequest(`/employees/${employeeId}`);
    document.getElementById('dossierEmployeeName').textContent = emp.name || 'Staff Member';
    document.getElementById('dossierEmployeeRole').textContent = emp.role || 'EMPLOYEE';
    document.getElementById('dossierEmployeeRole').className = `px-2 py-0.5 rounded text-[10px] font-bold ${emp.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : emp.role === 'MANAGER' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`;
    document.getElementById('dossierEmployeeMeta').textContent = `${emp.designation || 'Staff'} • Phone: ${emp.phone || '-'} • Joined: ${emp.joinedDate || 'N/A'}`;
    document.getElementById('dossierKpiJoinedDate').textContent = emp.joinedDate || 'N/A';
    document.getElementById('dossierKpiBasicSalary').textContent = `₹${Number(emp.basicSalary || 0).toFixed(2)}`;

    // Set Quota Inputs
    document.getElementById('dossierQuotaEmployeeId').value = emp.id;
    document.getElementById('dossierPaidLeavesQuota').value = emp.paidLeavesQuota !== undefined ? emp.paidLeavesQuota : 12;
    document.getElementById('dossierCasualLeavesQuota').value = emp.casualLeavesQuota !== undefined ? emp.casualLeavesQuota : 12;

    // 2. Fetch salaries for month-by-month & lifetime pay
    const salaries = await apiRequest(`/salaries/employee/${employeeId}`).catch(() => []);
    renderDossierSalaries(salaries);

    // 3. Fetch attendance records and calculate total hours
    const attendances = await apiRequest(`/attendance/employee/${employeeId}`).catch(() => []);
    renderDossierAttendance(attendances);

    // 4. Fetch leave history
    const leaves = await apiRequest(`/leaves/employee/${employeeId}`).catch(() => []);
    renderDossierLeaves(leaves);

  } catch (err) {
    showToast('Failed to load employee dossier: ' + err.message, 'error');
  }
}

function switchDossierSubTab(subTab) {
  const tabs = ['overview', 'salary', 'attendance', 'leaves'];
  tabs.forEach(t => {
    const el = document.getElementById(`dossierSubTab-${t}`);
    const btn = document.getElementById(`dossierTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (el) {
      if (t === subTab) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
    if (btn) {
      if (t === subTab) {
        btn.className = 'px-3 py-1.5 rounded-lg font-semibold transition bg-amber-500/20 text-amber-300 border border-amber-500/30';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg font-semibold text-gray-400 hover:text-white transition';
      }
    }
  });
}

function renderDossierSalaries(salaries) {
  const tbody = document.getElementById('dossierSalaryTableBody');
  const countEl = document.getElementById('dossierSalaryCount');
  const lifetimePayEl = document.getElementById('dossierLifetimeTotalPay');

  if (!salaries || salaries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-gray-500 font-sans">No salary disbursements recorded</td></tr>';
    if (countEl) countEl.textContent = '0 records';
    if (lifetimePayEl) lifetimePayEl.textContent = '₹0.00';
    return;
  }

  const totalPaid = salaries.reduce((sum, s) => sum + Number(s.netSalary || 0), 0);
  if (lifetimePayEl) lifetimePayEl.textContent = `₹${totalPaid.toFixed(2)}`;
  if (countEl) countEl.textContent = `${salaries.length} records`;

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  tbody.innerHTML = salaries.map(s => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-2.5 font-bold text-white font-sans">${monthNames[s.month] || s.month} ${s.year}</td>
      <td class="p-2.5 text-gray-300">₹${Number(s.basicSalary || 0).toFixed(2)}</td>
      <td class="p-2.5 text-emerald-400">+₹${Number(s.bonus || 0).toFixed(2)}</td>
      <td class="p-2.5 text-rose-400">-₹${Number(s.deductions || 0).toFixed(2)}</td>
      <td class="p-2.5 font-bold text-amber-400">₹${Number(s.netSalary || 0).toFixed(2)}</td>
      <td class="p-2.5 text-gray-400 font-sans text-[11px]">${s.paymentDate || '-'}</td>
      <td class="p-2.5 font-sans">
        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${s.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}">
          ${s.paymentStatus || 'PAID'}
        </span>
      </td>
    </tr>
  `).join('');
}

function renderDossierAttendance(attendances) {
  const tbody = document.getElementById('dossierAttendanceTableBody');
  const badgeEl = document.getElementById('dossierAttendanceTotalHoursBadge');
  const kpiHours = document.getElementById('dossierKpiTotalHours');
  const kpiPresent = document.getElementById('dossierKpiDaysPresent');

  if (!attendances || attendances.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-500 font-sans">No attendance records found</td></tr>';
    if (badgeEl) badgeEl.textContent = 'Total: 0.0 hrs';
    if (kpiHours) kpiHours.textContent = '0.0 hrs';
    if (kpiPresent) kpiPresent.textContent = '0 days';
    return;
  }

  let totalHours = 0;
  let presentDays = 0;

  attendances.forEach(a => {
    totalHours += Number(a.workHours || 0);
    if (a.status === 'PRESENT' || a.status === 'HALF_DAY') {
      presentDays++;
    }
  });

  if (badgeEl) badgeEl.textContent = `Total: ${totalHours.toFixed(1)} hrs`;
  if (kpiHours) kpiHours.textContent = `${totalHours.toFixed(1)} hrs`;
  if (kpiPresent) kpiPresent.textContent = `${presentDays} days`;

  tbody.innerHTML = attendances.map(a => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-2.5 font-semibold text-white font-sans">${a.date}</td>
      <td class="p-2.5 text-emerald-400">${a.checkIn || '-'}</td>
      <td class="p-2.5 text-rose-400">${a.checkOut || '-'}</td>
      <td class="p-2.5 text-cyan-300 font-bold">${Number(a.workHours || 0).toFixed(1)} hrs</td>
      <td class="p-2.5 font-sans">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getAttendanceBadge(a.status)}">
          ${a.status}
        </span>
      </td>
    </tr>
  `).join('');
}

function renderDossierLeaves(leaves) {
  const tbody = document.getElementById('dossierLeavesTableBody');
  const countEl = document.getElementById('dossierLeaveCount');

  if (!leaves || leaves.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500">No leave requests found</td></tr>';
    if (countEl) countEl.textContent = '0 leaves';
    return;
  }

  if (countEl) countEl.textContent = `${leaves.length} leaves`;

  tbody.innerHTML = leaves.map(l => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-2.5 text-gray-200 font-mono text-[11px]">${l.fromDate} to ${l.toDate}</td>
      <td class="p-2.5 text-amber-300 font-bold">${l.leaveType}</td>
      <td class="p-2.5 text-gray-300 max-w-xs truncate">${escapeHtml(l.reason || '-')}</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : l.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}">
          ${l.status}
        </span>
      </td>
      <td class="p-2.5 text-gray-400">${l.reviewedByName || '-'}</td>
      <td class="p-2.5 text-right">
        ${(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && l.status === 'PENDING' ? `
          <button onclick="quickApproveLeaveFromDossier(${l.id}, 'APPROVED')" class="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] mr-1">
            Approve
          </button>
          <button onclick="quickApproveLeaveFromDossier(${l.id}, 'REJECTED')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[10px]">
            Reject
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

async function quickApproveLeaveFromDossier(leaveId, decision) {
  try {
    await apiRequest(`/leaves/${leaveId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: decision, reviewNotes: `Reviewed via employee dossier (${decision})` })
    });
    showToast(`Leave request ${decision.toLowerCase()}`, 'success');
    if (activeDossierEmployeeId) {
      const leaves = await apiRequest(`/leaves/employee/${activeDossierEmployeeId}`).catch(() => []);
      renderDossierLeaves(leaves);
    }
    loadLeavesData();
    fetchSystemNotifications();
  } catch (err) {
    showToast('Failed to update leave status: ' + err.message, 'error');
  }
}

async function saveEmployeeLeaveQuota(e) {
  e.preventDefault();
  const empId = document.getElementById('dossierQuotaEmployeeId').value;
  const paidLeavesQuota = parseInt(document.getElementById('dossierPaidLeavesQuota').value, 10);
  const casualLeavesQuota = parseInt(document.getElementById('dossierCasualLeavesQuota').value, 10);

  if (isNaN(paidLeavesQuota) || isNaN(casualLeavesQuota)) {
    showToast('Please enter valid numeric quota days', 'warning');
    return;
  }

  const btn = document.getElementById('btnSaveLeaveQuota');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }

  try {
    await apiRequest(`/employees/${empId}`, {
      method: 'PUT',
      body: JSON.stringify({ paidLeavesQuota, casualLeavesQuota })
    });
    showToast('Leave quotas successfully updated', 'success');
    loadStaffData();
  } catch (err) {
    showToast('Failed to update leave quotas: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i>Update Quota';
    }
  }
}

// ============================================================
