// NERAM POS - on-demand module: Cafe expenses and recurring EMI
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 6: CAFE EXPENSES & RECURRING EMI CENTER
// ============================================================
let currentExpenseSubtab = 'all';
let allExpensesList = [];
let allExpenseTemplatesList = [];
let monthlyRecurringStatusList = [];
let expenseFiltersInitialised = false;

async function loadExpensesData() {
  try {
    // Set default month & year in selectors if not selected
    const now = new Date();
    const monthSel = document.getElementById('expFilterMonth');
    const yearSel = document.getElementById('expFilterYear');
    // A <select> always has a value (its first option), so default to today once per session and keep the user's pick afterwards.
    if (!expenseFiltersInitialised) {
      if (monthSel) monthSel.value = String(now.getMonth() + 1);
      if (yearSel) yearSel.value = String(now.getFullYear());
      expenseFiltersInitialised = true;
    }

    const selMonth = parseInt(monthSel ? monthSel.value : (now.getMonth() + 1));
    const selYear = parseInt(yearSel ? yearSel.value : now.getFullYear());

    const [expenses, templates, statusList] = await Promise.all([
      apiRequest('/expenses'),
      apiRequest('/expenses/templates'),
      apiRequest(`/expenses/templates/monthly-status?month=${selMonth}&year=${selYear}`).catch(() => [])
    ]);

    allExpensesList = Array.isArray(expenses) ? expenses : [];
    allExpenseTemplatesList = Array.isArray(templates) ? templates : [];
    monthlyRecurringStatusList = Array.isArray(statusList) ? statusList : [];

    // Update pending recurring templates badge
    const pendingCount = monthlyRecurringStatusList.filter(s => s.status === 'UNRECORDED' || s.status === 'OVERDUE' || s.status === 'DUE_SOON').length;
    const badgeEl = document.getElementById('expPendingTemplatesBadge');
    if (badgeEl) {
      if (pendingCount > 0) {
        badgeEl.textContent = String(pendingCount);
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    applyExpenseFiltersAndRender();
  } catch (err) {
    showToast('Failed to load expenses: ' + err.message, 'error');
  }
}

function switchExpenseSubtab(subtab) {
  currentExpenseSubtab = subtab;

  const btnAll = document.getElementById('expSubtab-all');
  const btnTpl = document.getElementById('expSubtab-templates');
  const btnChk = document.getElementById('expSubtab-checklist');

  const viewAll = document.getElementById('expViewAll');
  const viewTpl = document.getElementById('expViewTemplates');
  const viewChk = document.getElementById('expViewChecklist');

  // Reset pill button styles
  const activeClass = 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-gray-950 shadow transition flex items-center gap-2 shrink-0';
  const inactiveClass = 'px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition flex items-center gap-2 shrink-0';

  if (btnAll) btnAll.className = subtab === 'all' ? activeClass : inactiveClass;
  if (btnTpl) btnTpl.className = subtab === 'templates' ? activeClass : inactiveClass;
  if (btnChk) btnChk.className = subtab === 'checklist' ? activeClass : inactiveClass;

  if (viewAll) viewAll.classList.toggle('hidden', subtab !== 'all');
  if (viewTpl) viewTpl.classList.toggle('hidden', subtab !== 'templates');
  if (viewChk) viewChk.classList.toggle('hidden', subtab !== 'checklist');

  applyExpenseFiltersAndRender();
}

function onExpenseFilterChanged() {
  loadExpensesData();
}

function onExpenseSearchInput() {
  applyExpenseFiltersAndRender();
}

function applyExpenseFiltersAndRender() {
  const monthSel = document.getElementById('expFilterMonth');
  const yearSel = document.getElementById('expFilterYear');
  const typeSel = document.getElementById('expFilterType');
  const statusSel = document.getElementById('expFilterStatus');
  const searchInput = document.getElementById('expSearchInput');

  const selMonth = monthSel ? parseInt(monthSel.value) : null;
  const selYear = yearSel ? parseInt(yearSel.value) : null;
  const selType = typeSel ? typeSel.value : 'ALL';
  const selStatus = statusSel ? statusSel.value : 'ALL';
  const searchQ = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Filter expenses by selected period & criteria
  const filteredExpenses = allExpensesList.filter(e => {
    if (selMonth && e.month !== selMonth) return false;
    if (selYear && e.year !== selYear) return false;
    if (selType !== 'ALL' && e.type !== selType) return false;
    if (selStatus !== 'ALL' && (e.status || 'PAID') !== selStatus) return false;
    if (searchQ) {
      const desc = (e.description || '').toLowerCase();
      const payee = (e.vendorOrPayee || '').toLowerCase();
      const ref = (e.receiptRef || '').toLowerCase();
      const notes = (e.notes || '').toLowerCase();
      if (!desc.includes(searchQ) && !payee.includes(searchQ) && !ref.includes(searchQ) && !notes.includes(searchQ)) {
        return false;
      }
    }
    return true;
  });

  // Calculate Breakdown KPIs for currently selected month
  let rentSum = 0, emiSum = 0, utilSum = 0, miscSum = 0, totalMonthSum = 0;
  allExpensesList.filter(e => (!selMonth || e.month === selMonth) && (!selYear || e.year === selYear)).forEach(e => {
    const amt = parseFloat(e.amount) || 0;
    totalMonthSum += amt;
    switch (e.type) {
      case 'RENT': rentSum += amt; break;
      case 'EMI': emiSum += amt; break;
      case 'WATER':
      case 'ELECTRICITY':
      case 'INTERNET':
      case 'GAS':
        utilSum += amt; break;
      default:
        miscSum += amt; break;
    }
  });

  const rentEl = document.getElementById('expTotalRent');
  const emiEl = document.getElementById('expTotalEmi');
  const utilEl = document.getElementById('expTotalUtilities');
  const miscEl = document.getElementById('expTotalMisc');
  const totalEl = document.getElementById('expTotalMonthOutflow');

  if (rentEl) rentEl.textContent = `₹${rentSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (emiEl) emiEl.textContent = `₹${emiSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (utilEl) utilEl.textContent = `₹${utilSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (miscEl) miscEl.textContent = `₹${miscSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (totalEl) totalEl.textContent = `₹${totalMonthSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // Render active view
  renderExpensesTable(filteredExpenses);
  renderExpenseTemplatesTable(allExpenseTemplatesList);
  renderRecurringChecklist(monthlyRecurringStatusList);
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">
      <i class="fa-solid fa-receipt text-3xl mb-2 block opacity-40"></i>
      No expenses match the selected filters for this period.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => {
    const isPaid = (e.status || 'PAID') === 'PAID';
    const statusBadge = isPaid
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Paid</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">Pending</span>`;

    const recurringBadge = e.isRecurring
      ? `<span class="ml-1 text-[10px] text-amber-400" title="Recurring obligation"><i class="fa-solid fa-arrows-rotate"></i></span>`
      : '';

    return `
      <tr class="hover:bg-gray-800/40 transition">
        <td class="p-3 font-bold text-xs whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getExpenseBadgeColor(e.type)}">
            ${escapeHtml(e.type)}
          </span>
          ${recurringBadge}
        </td>
        <td class="p-3">
          <div class="font-semibold text-white">${escapeHtml(e.description || '')}</div>
          ${e.vendorOrPayee ? `<div class="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><i class="fa-regular fa-building text-[10px]"></i> ${escapeHtml(e.vendorOrPayee)}</div>` : ''}
        </td>
        <td class="p-3 text-gray-300 whitespace-nowrap">
          <div>${escapeHtml(e.expenseDate || '-')}</div>
          ${e.dueDate ? `<div class="text-[10px] text-amber-400">Due: ${escapeHtml(e.dueDate)}</div>` : ''}
        </td>
        <td class="p-3 font-bold text-rose-400 whitespace-nowrap">₹${(parseFloat(e.amount) || 0).toFixed(2)}</td>
        <td class="p-3 text-gray-400 whitespace-nowrap">${escapeHtml(e.paymentMethod || e.paidBy || '-')}</td>
        <td class="p-3 whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">${escapeHtml(e.receiptRef || '-')}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end space-x-2">
            ${!isPaid ? `
              <button onclick="markExpenseAsPaid(${e.id})" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold transition" title="Mark as Paid">
                <i class="fa-solid fa-check mr-1"></i>Pay
              </button>
            ` : ''}
            <button onclick="openEditExpenseModal(${e.id})" class="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition" title="Edit">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="deleteExpense(${e.id})" class="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center transition" title="Delete">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderExpenseTemplatesTable(templates) {
  const tbody = document.getElementById('expenseTemplatesTableBody');
  if (!tbody) return;

  if (!templates || templates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">
      <i class="fa-solid fa-calendar-plus text-3xl mb-2 block opacity-40"></i>
      No recurring templates created yet. Click "New Recurring Template" to add monthly rent, EMI, or utilities.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = templates.map(t => {
    const isActive = t.isActive !== false;
    const statusPill = isActive
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Active</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700 text-gray-400 border border-gray-600">Paused</span>`;

    return `
      <tr class="hover:bg-gray-800/40 transition">
        <td class="p-3">
          <div class="font-bold text-white text-xs">${escapeHtml(t.title)}</div>
          ${t.notes ? `<div class="text-[11px] text-gray-400 truncate max-w-xs mt-0.5">${escapeHtml(t.notes)}</div>` : ''}
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getExpenseBadgeColor(t.type)}">
            ${escapeHtml(t.type)}
          </span>
        </td>
        <td class="p-3 text-gray-300 text-xs">${escapeHtml(t.vendorOrPayee || '-')}</td>
        <td class="p-3 text-gray-300 text-xs whitespace-nowrap">
          <span class="font-semibold">${escapeHtml(t.frequency || 'MONTHLY')}</span> (Day ${t.dueDay || 1})
        </td>
        <td class="p-3 font-bold text-amber-400 text-xs whitespace-nowrap">₹${(parseFloat(t.amount) || 0).toFixed(2)}</td>
        <td class="p-3 text-gray-400 text-xs whitespace-nowrap">${escapeHtml(t.paymentMethod || '-')}</td>
        <td class="p-3 whitespace-nowrap">${statusPill}</td>
        <td class="p-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="generateExpenseFromTemplate(${t.id})"
              class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 font-bold text-[11px] border border-amber-500/30 transition flex items-center gap-1"
              title="Post as expense for current selected month">
              <i class="fa-solid fa-plus text-[10px]"></i> Post
            </button>
            <button onclick="openExpenseTemplateModal(${t.id})"
              class="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition" title="Edit Template">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="toggleExpenseTemplateActive(${t.id})"
              class="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 ${isActive ? 'text-amber-400' : 'text-gray-500'} flex items-center justify-center transition"
              title="${isActive ? 'Pause Template' : 'Activate Template'}">
              <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'} text-xs"></i>
            </button>
            <button onclick="deleteExpenseTemplate(${t.id})"
              class="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center transition" title="Delete Template">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecurringChecklist(statusList) {
  const container = document.getElementById('expChecklistGrid');
  if (!container) return;

  const monthSel = document.getElementById('expFilterMonth');
  const yearSel = document.getElementById('expFilterYear');
  const monthName = monthSel && monthSel.options[monthSel.selectedIndex] ? monthSel.options[monthSel.selectedIndex].text : 'Current Month';
  const yearVal = yearSel ? yearSel.value : '';
  const labelEl = document.getElementById('expChecklistMonthLabel');
  if (labelEl) labelEl.textContent = `${monthName} ${yearVal}`;

  if (!statusList || statusList.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 glass-panel rounded-xl">
      <i class="fa-solid fa-clipboard-check text-4xl mb-2 block opacity-40"></i>
      No recurring templates setup yet. Add your rent, water, and EMI templates to see monthly checklists!
    </div>`;
    return;
  }

  container.innerHTML = statusList.map(item => {
    const isRecorded = item.isRecorded === true;
    const isOverdue = item.status === 'OVERDUE';
    const isPaid = item.status === 'PAID';

    let cardBorder = 'border-gray-800';
    let statusPill = '';

    if (isPaid) {
      cardBorder = 'border-emerald-500/40';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <i class="fa-solid fa-check mr-1"></i>Recorded &amp; Paid
      </span>`;
    } else if (item.status === 'PENDING') {
      cardBorder = 'border-amber-500/40';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <i class="fa-regular fa-clock mr-1"></i>Recorded (Pending)
      </span>`;
    } else if (isOverdue) {
      cardBorder = 'border-rose-500/50 bg-rose-500/5';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i>Overdue (Due Day ${item.dueDay})
      </span>`;
    } else {
      cardBorder = 'border-gray-800';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
        <i class="fa-regular fa-calendar mr-1"></i>Due Day ${item.dueDay}
      </span>`;
    }

    return `
      <div class="glass-panel p-4 rounded-xl border ${cardBorder} flex flex-col justify-between space-y-3 transition hover:border-gray-700">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getExpenseBadgeColor(item.type)} mb-1.5 inline-block">
                ${escapeHtml(item.type)}
              </span>
              <h4 class="font-bold text-white text-sm leading-tight">${escapeHtml(item.title)}</h4>
            </div>
            <div>${statusPill}</div>
          </div>
          ${item.vendorOrPayee ? `<p class="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5"><i class="fa-regular fa-building text-[10px]"></i> ${escapeHtml(item.vendorOrPayee)}</p>` : ''}
        </div>

        <div class="pt-2 border-t border-gray-800/60 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">Amount Due</div>
            <div class="text-base font-bold text-amber-400">₹${(parseFloat(item.expectedAmount) || 0).toFixed(2)}</div>
          </div>
          <div>
            ${!isRecorded ? `
              <button onclick="generateExpenseFromTemplate(${item.templateId})"
                class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs shadow-md transition flex items-center gap-1.5">
                <i class="fa-solid fa-receipt text-xs"></i> Record Now
              </button>
            ` : `
              <span class="text-xs text-gray-400 flex items-center gap-1 font-mono">
                <i class="fa-solid fa-circle-check text-emerald-400"></i> ${escapeHtml(item.expenseDate || 'Logged')}
              </span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getExpenseBadgeColor(type) {
  switch (type) {
    case 'RENT': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'EMI': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    case 'WATER': return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
    case 'ELECTRICITY': return 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30';
    case 'INTERNET': return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
    case 'GAS': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'MAINTENANCE': return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
    case 'MARKETING': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
    default: return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
  }
}

function openRecordExpenseModal(templateId = null) {
  document.getElementById('expId').value = '';
  document.getElementById('expTemplateId').value = templateId ? String(templateId) : '';
  document.getElementById('expenseModalTitle').textContent = 'Record Cafe Expense / EMI';
  document.getElementById('expDesc').value = '';
  document.getElementById('expVendor').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expDueDate').value = '';
  document.getElementById('expPaymentMethod').value = 'Bank Transfer';
  document.getElementById('expStatus').value = 'PAID';
  document.getElementById('expReceiptRef').value = '';
  document.getElementById('expNotes').value = '';
  document.getElementById('expSaveAsTemplate').checked = false;

  const tplBox = document.getElementById('expSaveAsTemplateBox');
  if (tplBox) tplBox.classList.remove('hidden');

  // If templateId provided, prefill
  if (templateId) {
    const tpl = allExpenseTemplatesList.find(t => t.id === templateId);
    if (tpl) {
      document.getElementById('expType').value = tpl.type || 'RENT';
      document.getElementById('expDesc').value = tpl.title || '';
      document.getElementById('expVendor').value = tpl.vendorOrPayee || '';
      document.getElementById('expAmount').value = tpl.amount || '';
      document.getElementById('expPaymentMethod').value = tpl.paymentMethod || 'Bank Transfer';
      document.getElementById('expNotes').value = tpl.notes || '';
      if (tplBox) tplBox.classList.add('hidden');
    }
  }

  document.getElementById('expenseModal').classList.remove('hidden');
}

function openEditExpenseModal(id) {
  const exp = allExpensesList.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expId').value = exp.id;
  document.getElementById('expTemplateId').value = exp.templateId || '';
  document.getElementById('expenseModalTitle').textContent = 'Edit Cafe Expense / EMI';
  document.getElementById('expType').value = exp.type || 'RENT';
  document.getElementById('expDesc').value = exp.description || '';
  document.getElementById('expVendor').value = exp.vendorOrPayee || '';
  document.getElementById('expAmount').value = exp.amount || '';
  document.getElementById('expDate').value = exp.expenseDate || new Date().toISOString().split('T')[0];
  document.getElementById('expDueDate').value = exp.dueDate || '';
  document.getElementById('expPaymentMethod').value = exp.paymentMethod || exp.paidBy || 'Bank Transfer';
  document.getElementById('expStatus').value = exp.status || 'PAID';
  document.getElementById('expReceiptRef').value = exp.receiptRef || '';
  document.getElementById('expNotes').value = exp.notes || '';

  const tplBox = document.getElementById('expSaveAsTemplateBox');
  if (tplBox) tplBox.classList.add('hidden');

  document.getElementById('expenseModal').classList.remove('hidden');
}

function openExpenseTemplateModal(templateId = null) {
  document.getElementById('tplId').value = templateId ? String(templateId) : '';
  const titleEl = document.getElementById('expenseTemplateModalTitle');

  if (templateId) {
    const tpl = allExpenseTemplatesList.find(t => t.id === templateId);
    if (tpl) {
      if (titleEl) titleEl.textContent = 'Edit Recurring Expense Template';
      document.getElementById('tplTitle').value = tpl.title || '';
      document.getElementById('tplType').value = tpl.type || 'RENT';
      document.getElementById('tplAmount').value = tpl.amount || '';
      document.getElementById('tplFrequency').value = tpl.frequency || 'MONTHLY';
      document.getElementById('tplDueDay').value = tpl.dueDay || 1;
      document.getElementById('tplVendor').value = tpl.vendorOrPayee || '';
      document.getElementById('tplPaymentMethod').value = tpl.paymentMethod || 'Bank Transfer';
      document.getElementById('tplNotes').value = tpl.notes || '';
      document.getElementById('tplIsActive').checked = tpl.isActive !== false;
    }
  } else {
    if (titleEl) titleEl.textContent = 'New Recurring Expense & EMI Template';
    document.getElementById('tplTitle').value = '';
    document.getElementById('tplType').value = 'RENT';
    document.getElementById('tplAmount').value = '';
    document.getElementById('tplFrequency').value = 'MONTHLY';
    document.getElementById('tplDueDay').value = 1;
    document.getElementById('tplVendor').value = '';
    document.getElementById('tplPaymentMethod').value = 'Bank Transfer';
    document.getElementById('tplNotes').value = '';
    document.getElementById('tplIsActive').checked = true;
  }

  document.getElementById('expenseTemplateModal').classList.remove('hidden');
}

let isSavingExpense = false;
let isSavingExpenseTemplate = false;

async function saveExpense(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  if (isSavingExpense) return;
  isSavingExpense = true;

  const form = document.getElementById('expenseForm');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  const originalSaveBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
  }

  const id = document.getElementById('expId').value;
  const templateId = document.getElementById('expTemplateId').value;

  const payload = {
    type: document.getElementById('expType').value,
    description: document.getElementById('expDesc').value.trim(),
    vendorOrPayee: document.getElementById('expVendor').value.trim(),
    amount: parseFloat(document.getElementById('expAmount').value),
    expenseDate: document.getElementById('expDate').value,
    dueDate: document.getElementById('expDueDate').value || null,
    paymentMethod: document.getElementById('expPaymentMethod').value,
    paidBy: document.getElementById('expPaymentMethod').value,
    status: document.getElementById('expStatus').value,
    receiptRef: document.getElementById('expReceiptRef').value.trim(),
    notes: document.getElementById('expNotes').value.trim(),
    templateId: templateId ? parseInt(templateId) : null,
    isRecurring: Boolean(templateId)
  };

  const saveAsTemplate = document.getElementById('expSaveAsTemplate') ? document.getElementById('expSaveAsTemplate').checked : false;

  try {
    if (id) {
      await apiRequest(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Expense updated successfully', 'success');
    } else {
      await apiRequest('/expenses', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Expense recorded successfully', 'success');

      if (saveAsTemplate) {
        const dateObj = new Date(payload.expenseDate);
        await apiRequest('/expenses/templates', {
          method: 'POST',
          body: JSON.stringify({
            title: payload.description,
            type: payload.type,
            amount: payload.amount,
            frequency: 'MONTHLY',
            dueDay: dateObj.getDate() || 1,
            vendorOrPayee: payload.vendorOrPayee,
            paymentMethod: payload.paymentMethod,
            notes: payload.notes,
            isActive: true
          })
        });
        showToast('Recurring template created automatically', 'info');
      }
    }

    closeModal('expenseModal');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to save expense: ' + err.message, 'error');
  } finally {
    isSavingExpense = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      if (originalSaveBtnContent) submitBtn.innerHTML = originalSaveBtnContent;
    }
  }
}

async function saveExpenseTemplate(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  if (isSavingExpenseTemplate) return;
  isSavingExpenseTemplate = true;

  const form = document.getElementById('expenseTemplateForm');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  const originalSaveBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
  }

  const id = document.getElementById('tplId').value;

  const payload = {
    title: document.getElementById('tplTitle').value.trim(),
    type: document.getElementById('tplType').value,
    amount: parseFloat(document.getElementById('tplAmount').value),
    frequency: document.getElementById('tplFrequency').value,
    dueDay: parseInt(document.getElementById('tplDueDay').value) || 1,
    vendorOrPayee: document.getElementById('tplVendor').value.trim(),
    paymentMethod: document.getElementById('tplPaymentMethod').value,
    notes: document.getElementById('tplNotes').value.trim(),
    isActive: document.getElementById('tplIsActive').checked
  };

  try {
    if (id) {
      await apiRequest(`/expenses/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Recurring template updated successfully', 'success');
    } else {
      await apiRequest('/expenses/templates', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Recurring template created successfully', 'success');
    }

    closeModal('expenseTemplateModal');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to save template: ' + err.message, 'error');
  } finally {
    isSavingExpenseTemplate = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      if (originalSaveBtnContent) submitBtn.innerHTML = originalSaveBtnContent;
    }
  }
}

async function toggleExpenseTemplateActive(id) {
  try {
    await apiRequest(`/expenses/templates/${id}/toggle-active`, { method: 'POST' });
    showToast('Template status updated', 'info');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to toggle status: ' + err.message, 'error');
  }
}

async function deleteExpenseTemplate(id) {
  if (!confirm('Are you sure you want to delete this recurring template?')) return;
  try {
    await apiRequest(`/expenses/templates/${id}`, { method: 'DELETE' });
    showToast('Template deleted successfully', 'success');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to delete template: ' + err.message, 'error');
  }
}

async function generateExpenseFromTemplate(templateId) {
  const monthSel = document.getElementById('expFilterMonth');
  const yearSel = document.getElementById('expFilterYear');
  const now = new Date();
  const m = monthSel ? parseInt(monthSel.value) : (now.getMonth() + 1);
  const y = yearSel ? parseInt(yearSel.value) : now.getFullYear();
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`;

  try {
    await apiRequest(`/expenses/templates/${templateId}/generate?expenseDate=${dateStr}&status=PAID`, { method: 'POST' });
    showToast('Expense recorded from recurring template!', 'success');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to record recurring expense: ' + err.message, 'error');
  }
}

async function generateAllDueRecurringExpenses() {
  const monthSel = document.getElementById('expFilterMonth');
  const yearSel = document.getElementById('expFilterYear');
  const now = new Date();
  const m = monthSel ? parseInt(monthSel.value) : (now.getMonth() + 1);
  const y = yearSel ? parseInt(yearSel.value) : now.getFullYear();

  if (!confirm(`Post all due active recurring expenses (Rent, EMI, Utilities) for ${m}/${y}?`)) return;

  try {
    const res = await apiRequest(`/expenses/templates/generate-all?month=${m}&year=${y}`, { method: 'POST' });
    const count = Array.isArray(res) ? res.length : 0;
    showToast(`Posted ${count} recurring expense(s) for ${m}/${y}`, 'success');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to batch post recurring expenses: ' + err.message, 'error');
  }
}

async function markExpenseAsPaid(id) {
  try {
    await apiRequest(`/expenses/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'PAID' })
    });
    showToast('Marked expense as PAID', 'success');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  try {
    await apiRequest(`/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    loadExpensesData();
  } catch (err) {
    showToast('Failed to delete expense: ' + err.message, 'error');
  }
}

// ============================================================
