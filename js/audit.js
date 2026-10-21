// NERAM POS - on-demand module: Audit log and bill edit tools
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 9: AUDIT LOG (ADMIN ONLY) - ENHANCED USER & BILL LIFECYCLE
// ============================================================
let rawAuditLogs = [];
let auditViewMode = 'all'; // 'all' (All Activity / Global) or 'bills' (Bill Lifecycle)

function setAuditViewMode(mode) {
  auditViewMode = mode;
  const btnBills = document.getElementById('btnAuditModeBills');
  const btnAll = document.getElementById('btnAuditModeAll');
  const catWrapper = document.getElementById('auditCategoryFilterWrapper');
  const catWrapperMob = document.getElementById('auditCategoryFilterMobileWrapper');
  const bannerText = document.getElementById('auditBannerText');

  if (mode === 'bills') {
    if (btnBills) btnBills.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded bg-amber-500 text-gray-950 font-bold transition text-center whitespace-nowrap';
    if (btnAll) btnAll.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded text-gray-400 hover:text-white transition text-center whitespace-nowrap';
    if (catWrapper) catWrapper.classList.add('opacity-40', 'pointer-events-none');
    if (catWrapperMob) catWrapperMob.classList.add('opacity-40', 'pointer-events-none');
    if (bannerText) bannerText.innerHTML = '<i class="fa-solid fa-receipt mr-1.5 text-amber-400"></i>Showing <strong>Bill Lifecycle Audit</strong> (Created, Edited, Cancelled, Deleted, Printed)';
  } else {
    if (btnBills) btnBills.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded text-gray-400 hover:text-white transition text-center whitespace-nowrap';
    if (btnAll) btnAll.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded bg-amber-500 text-gray-950 font-bold transition text-center whitespace-nowrap';
    if (catWrapper) catWrapper.classList.remove('opacity-40', 'pointer-events-none');
    if (catWrapperMob) catWrapperMob.classList.remove('opacity-40', 'pointer-events-none');
    if (bannerText) bannerText.innerHTML = '<i class="fa-solid fa-list-check mr-1.5 text-cyan-400"></i>Showing <strong>All System Activity Logs</strong>';
  }

  applyAuditFilters();
}

async function loadAuditLogs() {
  try {
    const isStaff = currentUser && currentUser.role !== 'ADMIN';
    const endpoint = isStaff ? '/audit-logs/my' : '/audit-logs';

    // Update title, subtitle and mode buttons for personal employee audit vs full admin audit
    const heading = document.getElementById('auditTabHeading');
    const subtitle = document.getElementById('auditTabSubtitle');
    const icon = document.getElementById('auditTabIcon');
    const btnAll = document.getElementById('btnAuditModeAll');
    const btnSecond = document.getElementById('btnAuditModeBills');

    if (isStaff) {
      if (heading) heading.textContent = 'My Login & Activity Audit';
      if (subtitle) subtitle.textContent = `Personal sign-in history and activity audit trail for ${currentUser.username} with date & timestamps`;
      if (icon) icon.className = 'fa-solid fa-clock-rotate-left text-cyan-400';
      if (btnAll) btnAll.innerHTML = '<i class="fa-solid fa-list-check mr-1"></i>All My Activity';
      if (btnSecond) btnSecond.innerHTML = '<i class="fa-solid fa-key mr-1"></i>Login Audit';
    } else {
      if (heading) heading.textContent = 'System Security & Activity Audit Log';
      if (subtitle) subtitle.textContent = 'Comprehensive audit trail of billing, inventory, user security & system actions';
      if (icon) icon.className = 'fa-solid fa-shield-halved text-amber-400';
      if (btnAll) btnAll.innerHTML = '<i class="fa-solid fa-list-check mr-1"></i>All Activity';
      if (btnSecond) btnSecond.innerHTML = '<i class="fa-solid fa-receipt mr-1"></i>Bill Audit';
    }

    rawAuditLogs = await apiRequest(endpoint);
    populateAuditUserDropdown();
    applyAuditFilters();
  } catch (err) {
    showToast('Failed to load audit logs: ' + err.message, 'error');
  }
}

function populateAuditUserDropdown() {
  const userSelect = document.getElementById('auditUserFilter');
  const userSelectMobile = document.getElementById('auditUserFilterMobile');
  const staffBadge = document.getElementById('auditStaffUserBadge');
  const staffBadgeMobile = document.getElementById('auditStaffUserBadgeMobile');
  const staffNameSpan = document.getElementById('auditStaffUserName');
  const staffNameSpanMobile = document.getElementById('auditStaffUserNameMobile');

  const isStaff = currentUser && currentUser.role !== 'ADMIN';

  if (isStaff) {
    // For regular staff/employees, lock selection to their own username
    if (staffNameSpan) staffNameSpan.textContent = currentUser.username;
    if (staffNameSpanMobile) staffNameSpanMobile.textContent = currentUser.username;

    if (staffBadge) staffBadge.classList.remove('hidden');
    if (staffBadgeMobile) staffBadgeMobile.classList.remove('hidden');

    if (userSelect) {
      userSelect.classList.add('hidden');
      userSelect.innerHTML = `<option value="${currentUser.username}">${currentUser.username}</option>`;
      userSelect.value = currentUser.username;
    }
    if (userSelectMobile) {
      userSelectMobile.classList.add('hidden');
      userSelectMobile.innerHTML = `<option value="${currentUser.username}">${currentUser.username}</option>`;
      userSelectMobile.value = currentUser.username;
    }
    return;
  }

  // Admin view: show full user dropdown
  if (staffBadge) staffBadge.classList.add('hidden');
  if (staffBadgeMobile) staffBadgeMobile.classList.add('hidden');
  if (userSelect) userSelect.classList.remove('hidden');
  if (userSelectMobile) userSelectMobile.classList.remove('hidden');

  if (!userSelect && !userSelectMobile) return;
  const currentVal = (userSelect?.value || userSelectMobile?.value || 'ALL').trim();

  const userSet = new Set(['admin', 'manager', 'employee']);
  rawAuditLogs.forEach(l => {
    if (l.performedByName && l.performedByName.trim()) {
      userSet.add(l.performedByName.trim());
    }
  });

  const sortedUsers = Array.from(userSet).sort();
  const optionsHtml = `<option value="ALL">All Users</option>` +
    sortedUsers.map(u => `<option value="${u}">${u}</option>`).join('');

  if (userSelect) {
    userSelect.innerHTML = optionsHtml;
    userSelect.value = Array.from(userSet).includes(currentVal) ? currentVal : 'ALL';
  }
  if (userSelectMobile) {
    userSelectMobile.innerHTML = optionsHtml;
    userSelectMobile.value = Array.from(userSet).includes(currentVal) ? currentVal : 'ALL';
  }
}

function syncAndApplyAuditSearch(val) {
  const pcInput = document.getElementById('auditSearchInput');
  const mobInput = document.getElementById('auditSearchInputMobile');
  if (pcInput && pcInput.value !== val) pcInput.value = val;
  if (mobInput && mobInput.value !== val) mobInput.value = val;
  applyAuditFilters();
}

function clearAuditSearch() {
  syncAndApplyAuditSearch('');
}

function setAuditTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  syncAndApplyAuditFilter('date', todayStr);
}

function syncAndApplyAuditFilter(type, val) {
  if (type === 'date') {
    const pc = document.getElementById('auditDateFilter');
    const mob = document.getElementById('auditDateFilterMobile');
    if (pc) pc.value = val;
    if (mob) mob.value = val;
  } else if (type === 'user') {
    const pc = document.getElementById('auditUserFilter');
    const mob = document.getElementById('auditUserFilterMobile');
    if (pc) pc.value = val;
    if (mob) mob.value = val;
  } else if (type === 'category') {
    const pc = document.getElementById('auditCategoryFilter');
    const mob = document.getElementById('auditCategoryFilterMobile');
    if (pc) pc.value = val;
    if (mob) mob.value = val;
  } else if (type === 'action') {
    const pc = document.getElementById('auditActionFilter');
    const mob = document.getElementById('auditActionFilterMobile');
    if (pc) pc.value = val;
    if (mob) mob.value = val;
  }
  applyAuditFilters();
}

function resetAuditFilters() {
  const dFilter = document.getElementById('auditDateFilter');
  const dFilterMob = document.getElementById('auditDateFilterMobile');
  const uFilter = document.getElementById('auditUserFilter');
  const uFilterMob = document.getElementById('auditUserFilterMobile');
  const cFilter = document.getElementById('auditCategoryFilter');
  const cFilterMob = document.getElementById('auditCategoryFilterMobile');
  const aFilter = document.getElementById('auditActionFilter');
  const aFilterMob = document.getElementById('auditActionFilterMobile');
  const sInput = document.getElementById('auditSearchInput');
  const sInputMob = document.getElementById('auditSearchInputMobile');

  if (dFilter) dFilter.value = '';
  if (dFilterMob) dFilterMob.value = '';
  if (uFilter) uFilter.value = 'ALL';
  if (uFilterMob) uFilterMob.value = 'ALL';
  if (cFilter) cFilter.value = 'ALL';
  if (cFilterMob) cFilterMob.value = 'ALL';
  if (aFilter) aFilter.value = 'ALL';
  if (aFilterMob) aFilterMob.value = 'ALL';
  if (sInput) sInput.value = '';
  if (sInputMob) sInputMob.value = '';

  auditViewMode = 'all';
  const btnAll = document.getElementById('btnAuditModeAll');
  const btnSecond = document.getElementById('btnAuditModeBills');
  if (btnAll) btnAll.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded bg-amber-500 text-gray-950 font-bold transition text-center whitespace-nowrap';
  if (btnSecond) btnSecond.className = 'flex-1 sm:flex-initial px-3 py-1.5 rounded text-gray-400 hover:text-white transition text-center whitespace-nowrap';

  applyAuditFilters();
}

function applyAuditFilters() {
  const isStaff = currentUser && currentUser.role !== 'ADMIN';
  const selectedDate = (document.getElementById('auditDateFilter')?.value || document.getElementById('auditDateFilterMobile')?.value || '').trim();
  const selectedUser = isStaff ? (currentUser?.username || '').trim() : (document.getElementById('auditUserFilter')?.value || document.getElementById('auditUserFilterMobile')?.value || 'ALL').trim();
  const selectedCategory = (document.getElementById('auditCategoryFilter')?.value || document.getElementById('auditCategoryFilterMobile')?.value || 'ALL').trim();
  const selectedAction = (document.getElementById('auditActionFilter')?.value || document.getElementById('auditActionFilterMobile')?.value || 'ALL').trim();
  const searchTerm = (document.getElementById('auditSearchInput')?.value || document.getElementById('auditSearchInputMobile')?.value || '').trim().toLowerCase();

  let filtered = [...rawAuditLogs];

  // 1. View Mode filter
  if (auditViewMode === 'bills') {
    if (isStaff) {
      // In staff mode, the 2nd quick filter button is "Login Audit"
      filtered = filtered.filter(l => (l.action || '').toUpperCase() === 'LOGIN');
    } else {
      filtered = filtered.filter(l => {
        const isBillEntity = (l.entityType || '').toUpperCase() === 'BILL';
        const isBillAction = (l.action || '').toUpperCase().includes('BILL');
        return isBillEntity || isBillAction;
      });
    }
  } else if (selectedCategory !== 'ALL') {
    filtered = filtered.filter(l => (l.entityType || '').toUpperCase() === selectedCategory.toUpperCase());
  }

  // 2. Date filter (with date)
  if (selectedDate) {
    filtered = filtered.filter(l => {
      if (!l.performedAt) return false;
      return l.performedAt.startsWith(selectedDate);
    });
  }

  // 3. User filter
  if (selectedUser !== 'ALL') {
    filtered = filtered.filter(l => (l.performedByName || '').toLowerCase() === selectedUser.toLowerCase());
  }

  // 4. Action filter
  if (selectedAction !== 'ALL') {
    filtered = filtered.filter(l => (l.action || '').toUpperCase() === selectedAction.toUpperCase());
  }

  // 5. Search text filter
  if (searchTerm) {
    filtered = filtered.filter(l => {
      const act = (l.action || '').toLowerCase();
      const user = (l.performedByName || '').toLowerCase();
      const entity = (l.entityType || '').toLowerCase();
      const oldVal = (l.oldValue || '').toLowerCase();
      const newVal = (l.newValue || '').toLowerCase();
      const id = String(l.entityId || '');
      return act.includes(searchTerm) || user.includes(searchTerm) || entity.includes(searchTerm) ||
        oldVal.includes(searchTerm) || newVal.includes(searchTerm) || id.includes(searchTerm);
    });
  }

  // Update KPI counters
  const totalCount = rawAuditLogs.length;
  const loginOps = rawAuditLogs.filter(l => (l.action || '').toUpperCase() === 'LOGIN').length;
  const billOps = rawAuditLogs.filter(l => (l.entityType || '').toUpperCase() === 'BILL' || (l.action || '').includes('BILL')).length;
  const billEdits = rawAuditLogs.filter(l => ['EDIT_BILL', 'CANCEL_BILL', 'DELETE_BILL'].includes((l.action || '').toUpperCase())).length;
  const uniqueUsers = new Set(rawAuditLogs.map(l => (l.performedByName || 'System').toLowerCase())).size;

  const statTotal = document.getElementById('statAuditTotal');
  const statBills = document.getElementById('statAuditBills');
  const statEdits = document.getElementById('statAuditBillEdits');
  const statUsers = document.getElementById('statAuditUsers');
  const recCount = document.getElementById('auditRecordCount');
  const lblSecond = document.getElementById('lblAuditSecondCard');
  const iconSecond = document.getElementById('iconAuditSecondCard');
  const lblUsers = document.getElementById('lblAuditUsersCard');

  if (statTotal) statTotal.textContent = totalCount;
  if (statBills) {
    if (isStaff) {
      statBills.textContent = loginOps;
      if (lblSecond) lblSecond.textContent = 'Login Events';
      if (iconSecond) iconSecond.innerHTML = '<i class="fa-solid fa-key"></i>';
    } else {
      statBills.textContent = billOps;
      if (lblSecond) lblSecond.textContent = 'Bill Operations';
      if (iconSecond) iconSecond.innerHTML = '<i class="fa-solid fa-receipt"></i>';
    }
  }
  if (statEdits) statEdits.textContent = billEdits;
  if (statUsers) {
    if (isStaff) {
      statUsers.textContent = '1 (You)';
      if (lblUsers) lblUsers.textContent = 'User Profile';
    } else {
      statUsers.textContent = uniqueUsers;
      if (lblUsers) lblUsers.textContent = 'Active Users';
    }
  }
  if (recCount) recCount.textContent = `${filtered.length} log${filtered.length === 1 ? '' : 's'} found`;

  renderAuditTable(filtered);
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('auditTableBody');
  const mobileCards = document.getElementById('auditMobileCards');

  // A. Desktop Table View (for PC / Tablet Landscape)
  if (tbody) {
    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-12 text-gray-500">
            <i class="fa-solid fa-clipboard-question text-3xl mb-2 block opacity-40"></i>
            <p class="font-semibold text-gray-400">No matching audit logs found</p>
            <p class="text-[11px] text-gray-500 mt-1">Try resetting filters or checking another user/category</p>
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = logs.map(l => {
        const actionBadge = getAuditActionBadge(l.action);
        const categoryBadge = getAuditCategoryBadge(l.entityType, l.entityId);
        const detailsHtml = formatAuditDetails(l);

        return `
          <tr class="hover:bg-gray-800/50 transition">
            <td class="p-3 text-gray-400 font-mono text-[11px] whitespace-nowrap align-top">
              <div class="text-gray-300 font-semibold">${formatISTDateTime(l.performedAt)}</div>
            </td>
            <td class="p-3 align-top whitespace-nowrap">
              ${actionBadge}
            </td>
            <td class="p-3 align-top whitespace-nowrap">
              ${categoryBadge}
            </td>
            <td class="p-3 align-top whitespace-nowrap">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-circle-user text-amber-400/80 text-xs"></i>
                <span class="text-white font-semibold text-xs">${escapeHtml(l.performedByName || 'System')}</span>
              </div>
            </td>
            <td class="p-3 align-top max-w-xl text-xs">
              ${detailsHtml}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // B. Mobile Card Feed View (for Mobile Portrait / Phone screens)
  if (mobileCards) {
    if (logs.length === 0) {
      mobileCards.innerHTML = `
        <div class="text-center py-10 px-4 glass-panel rounded-xl border border-gray-800 text-gray-400">
          <i class="fa-solid fa-clipboard-question text-3xl mb-2 text-gray-500 opacity-60"></i>
          <p class="font-semibold text-sm text-gray-300">No matching audit logs found</p>
          <p class="text-xs text-gray-500 mt-1">Try resetting filters or checking another user/category</p>
        </div>`;
    } else {
      mobileCards.innerHTML = logs.map(l => {
        const actionBadge = getAuditActionBadge(l.action);
        const categoryBadge = getAuditCategoryBadge(l.entityType, l.entityId);
        const detailsHtml = formatAuditDetails(l);

        return `
          <div class="p-3.5 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2.5 shadow-sm">
            <!-- Top Row: Badges & Timestamp -->
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${actionBadge}
                ${categoryBadge}
              </div>
              <span class="text-[10px] text-gray-400 font-mono flex items-center gap-1 shrink-0">
                <i class="fa-regular fa-clock text-[9px] text-gray-500"></i>
                ${formatISTDateTime(l.performedAt)}
              </span>
            </div>

            <!-- Performed By & Event ID -->
            <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-800/60">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-circle-user text-amber-400 text-xs"></i>
                <span class="text-white font-semibold text-xs">${escapeHtml(l.performedByName || 'System')}</span>
              </div>
              <span class="text-[10px] text-gray-500 font-mono">Event #${l.id}</span>
            </div>

            <!-- Lifecycle Details Box (Auto-wraps without horizontal scrolling) -->
            <div class="text-xs bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80 text-gray-300 break-words leading-relaxed overflow-hidden">
              ${detailsHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function getAuditActionBadge(action) {
  const act = (action || '').toUpperCase();
  if (act === 'CREATE_BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-file-circle-plus"></i>CREATE_BILL</span>`;
  } else if (act === 'EDIT_BILL' || act === 'UPDATE_BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-pen-to-square"></i>EDIT_BILL</span>`;
  } else if (act === 'CANCEL_BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-ban"></i>CANCEL_BILL</span>`;
  } else if (act === 'DELETE_BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-700/30 text-red-300 border border-red-600/40 inline-flex items-center gap-1"><i class="fa-solid fa-trash-can"></i>DELETE_BILL</span>`;
  } else if (act === 'PRINT_BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-print"></i>PRINT_BILL</span>`;
  } else if (act === 'LOGIN') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-key"></i>LOGIN</span>`;
  } else if (act === 'CHECK_IN') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-right-to-bracket"></i>CHECK_IN</span>`;
  } else if (act === 'CHECK_OUT') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-right-from-bracket"></i>CHECK_OUT</span>`;
  } else if (act === 'MARK_ATTENDANCE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-fingerprint"></i>ATTENDANCE</span>`;
  } else if (act === 'APPLY_LEAVE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-calendar-plus"></i>APPLY_LEAVE</span>`;
  } else if (act === 'REVIEW_LEAVE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-calendar-check"></i>REVIEW_LEAVE</span>`;
  } else if (act.includes('INVENTORY') || act === 'STOCK_ADJUST') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-boxes-stacked"></i>${act}</span>`;
  } else if (act.includes('SUPPLIER') || act.includes('INVOICE') || act.includes('PAYMENT')) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-truck-field"></i>${act}</span>`;
  } else if (act === 'CREATE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-plus"></i>CREATE</span>`;
  } else if (act === 'UPDATE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-pencil"></i>UPDATE</span>`;
  } else if (act === 'DELETE') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-trash"></i>DELETE</span>`;
  }
  return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300 border border-gray-700">${act}</span>`;
}

function getAuditCategoryBadge(entityType, entityId) {
  const et = (entityType || '').toUpperCase();
  const idStr = entityId ? ` #${entityId}` : '';
  if (et === 'BILL') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold"><i class="fa-solid fa-receipt mr-1"></i>BILL${idStr}</span>`;
  } else if (et === 'INVENTORY') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"><i class="fa-solid fa-box mr-1"></i>INVENTORY${idStr}</span>`;
  } else if (et === 'SUPPLIER' || et === 'SUPPLIER_INVOICE' || et === 'SUPPLIER_PAYMENT') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20"><i class="fa-solid fa-building mr-1"></i>${et}${idStr}</span>`;
  } else if (et === 'USER') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20"><i class="fa-solid fa-user-shield mr-1"></i>USER${idStr}</span>`;
  } else if (et === 'LEAVE' || et === 'ATTENDANCE' || et === 'SALARY') {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20"><i class="fa-solid fa-users mr-1"></i>${et}${idStr}</span>`;
  }
  return `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-gray-400 border border-gray-700">${et}${idStr}</span>`;
}

function formatAuditDetails(l) {
  if (l.oldValue && l.newValue) {
    let diffBadge = '';
    const diffMatch = (l.newValue || '').match(/Diff:\s*([+-]?₹[0-9.]+|₹[+-]?[0-9.]+)/i);
    if (diffMatch) {
      const diffStr = diffMatch[1];
      const isNegative = diffStr.includes('-');
      diffBadge = `
        <div class="mt-1 flex items-center gap-1.5 flex-wrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 ${isNegative ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
            <i class="fa-solid ${isNegative ? 'fa-triangle-exclamation' : 'fa-arrow-trend-up'}"></i>
            Net Amount Changed: ${escapeHtml(diffStr)}
          </span>
          ${isNegative ? '<span class="text-[10px] text-rose-400 font-semibold">(Amount Reduced - Anomaly Flag)</span>' : ''}
        </div>
      `;
    }

    return `
      <div class="space-y-1.5 font-mono text-[11px]">
        <div class="flex items-start gap-1.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-bold uppercase shrink-0">Before</span>
          <span class="text-gray-400 line-through bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800 break-words flex-1 leading-snug">${escapeHtml(l.oldValue)}</span>
        </div>
        <div class="flex items-start gap-1.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold uppercase shrink-0">After</span>
          <span class="text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 break-words flex-1 font-semibold leading-snug">${escapeHtml(l.newValue)}</span>
        </div>
        ${diffBadge}
      </div>
    `;
  }

  const val = l.newValue || l.oldValue || '-';
  const isBill = (l.entityType || '').toUpperCase() === 'BILL' || (l.action || '').includes('BILL');

  if (isBill) {
    return `
      <div class="font-mono text-[11px] text-gray-200 bg-gray-900/80 p-2 rounded-lg border border-gray-800 flex items-center justify-between">
        <span>${escapeHtml(val)}</span>
      </div>
    `;
  }

  return `
    <div class="font-mono text-[11px] text-gray-300 bg-gray-900/60 p-2 rounded-lg border border-gray-800/80 break-all">
      ${escapeHtml(val)}
    </div>
  `;
}

// Edit Bill Form Handler
async function handleEditBillSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editBillId').value;
  const table = document.getElementById('editBillTable').value.trim();
  const customer = document.getElementById('editBillCustomer').value.trim();
  const payMode = document.getElementById('editBillPaymentMode').value;
  const discount = parseFloat(document.getElementById('editBillDiscount').value) || 0;
  const tax = parseFloat(document.getElementById('editBillTax').value) || 0;
  const notes = document.getElementById('editBillNotes').value.trim();

  if (!editBillState.items || editBillState.items.length === 0) {
    showToast('Bill must contain at least one item', 'error');
    return;
  }

  if (!notes) {
    showToast('Please provide a reason for editing the bill (required for audit trail)', 'warning');
    document.getElementById('editBillNotes').focus();
    return;
  }

  const saveBtn = document.getElementById('saveEditBillBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving changes...';
  }

  try {
    await apiRequest(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        tableNumber: table,
        customerName: customer,
        paymentMode: payMode,
        discountPercent: discount,
        taxPercent: tax,
        notes: notes,
        items: editBillState.items
      })
    });
    closeModal('editBillModal');
    showToast('Bill & items updated successfully; audit log recorded', 'success');
    fetchBillsByCurrentFilter();
    if (typeof fetchAuditLogs === 'function') {
      fetchAuditLogs();
    }
  } catch (err) {
    showToast('Failed to update bill: ' + err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Bill Changes &amp; Record Audit';
    }
  }
}

// ============================================================
