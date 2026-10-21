// NERAM POS - on-demand module: Suppliers, invoices and payments
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 11: SUPPLIERS & PARTIAL PAYMENT TRACKING
// ============================================================

// Chart instances for cleanup
let supplierCharts = {};

// State
// allSuppliers lives in app.js (the inventory screens read it too)
let allInvoices = [];

function fmtINR(v) {
  const n = Number(v) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN');
}

// ── Sub-tab navigation ──
let supplierDirectoryView = 'cards';
let currentDossierSupplierId = null;

function showSupplierSubTab(tab) {
  ['overview', 'details', 'invoices', 'payments', 'analytics'].forEach(t => {
    const el = document.getElementById(`supplier-sub-${t}`);
    const btn = document.getElementById(`stab-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) {
      btn.className = 'px-3 py-1.5 text-xs rounded-lg glass-card text-gray-300 hover:text-white font-semibold flex items-center gap-1.5';
    }
  });
  const active = document.getElementById(`supplier-sub-${tab}`);
  const activeBtn = document.getElementById(`stab-${tab}`);
  if (active) active.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold flex items-center gap-1.5';
  }
  if (tab === 'analytics') loadSupplierAnalytics();
  if (tab === 'invoices') loadSupplierInvoices();
  if (tab === 'payments') loadAllPayments();
  if (tab === 'overview') loadSuppliersData();
  if (tab === 'details') loadSupplierDirectory();
}

// ── Master load (called on tab switch) ──
async function loadSuppliersData() {
  try {
    allSuppliers = await apiRequest('/suppliers?activeOnly=false');
    renderSupplierTable(allSuppliers);
    populateSupplierDropdowns();
  } catch (e) {
    document.getElementById('supplierTableBody').innerHTML =
      `<tr><td colspan="8" class="p-4 text-center text-rose-400 text-xs">${e.message}</td></tr>`;
  }
}

function filterOverviewSuppliers() {
  const query = (document.getElementById('supplierOverviewSearchInput')?.value || '').trim().toLowerCase();
  if (!allSuppliers || !allSuppliers.length) return;
  if (!query) {
    renderSupplierTable(allSuppliers);
    return;
  }
  const filtered = allSuppliers.filter(s => {
    return (s.name && s.name.toLowerCase().includes(query)) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(query)) ||
      (s.phone && s.phone.toLowerCase().includes(query)) ||
      (s.email && s.email.toLowerCase().includes(query)) ||
      (s.category && s.category.toLowerCase().includes(query));
  });
  renderSupplierTable(filtered);
}

// ── Supplier Directory & Details Module ──
async function loadSupplierDirectory() {
  try {
    if (!allSuppliers || allSuppliers.length === 0) {
      allSuppliers = await apiRequest('/suppliers?activeOnly=false');
    }
    populateSupplierCategoryFilter();
    filterSupplierDirectory();
  } catch (e) {
    showToast('Failed to load supplier directory: ' + e.message, 'error');
  }
}

function populateSupplierCategoryFilter() {
  const catSelect = document.getElementById('supplierCategoryFilter');
  if (!catSelect || !allSuppliers) return;
  const currentVal = catSelect.value;
  const categories = Array.from(new Set(allSuppliers.map(s => (s.category || '').trim()).filter(Boolean))).sort();
  let html = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
  });
  catSelect.innerHTML = html;
  if (currentVal) catSelect.value = currentVal;
}

function setSupplierDirectoryView(view) {
  supplierDirectoryView = view;
  const btnCards = document.getElementById('btnSupplierViewCards');
  const btnTable = document.getElementById('btnSupplierViewTable');
  const viewCards = document.getElementById('supplierDirectoryCardsView');
  const viewTable = document.getElementById('supplierDirectoryTableView');

  if (view === 'cards') {
    if (btnCards) btnCards.className = 'px-2.5 py-1 rounded text-[11px] bg-amber-500 text-gray-950 font-bold flex items-center gap-1';
    if (btnTable) btnTable.className = 'px-2.5 py-1 rounded text-[11px] text-gray-400 hover:text-white flex items-center gap-1';
    if (viewCards) viewCards.classList.remove('hidden');
    if (viewTable) viewTable.classList.add('hidden');
  } else {
    if (btnCards) btnCards.className = 'px-2.5 py-1 rounded text-[11px] text-gray-400 hover:text-white flex items-center gap-1';
    if (btnTable) btnTable.className = 'px-2.5 py-1 rounded text-[11px] bg-amber-500 text-gray-950 font-bold flex items-center gap-1';
    if (viewCards) viewCards.classList.add('hidden');
    if (viewTable) viewTable.classList.remove('hidden');
  }
  filterSupplierDirectory();
}

function resetSupplierDirectoryFilters() {
  const sInput = document.getElementById('supplierDetailSearchInput');
  const pInput = document.getElementById('supplierPhoneSearchInput');
  const cSelect = document.getElementById('supplierCategoryFilter');
  const stSelect = document.getElementById('supplierStatusFilter');
  if (sInput) sInput.value = '';
  if (pInput) pInput.value = '';
  if (cSelect) cSelect.value = '';
  if (stSelect) stSelect.value = 'ACTIVE';
  filterSupplierDirectory();
}

function filterSupplierDirectory() {
  const query = (document.getElementById('supplierDetailSearchInput')?.value || '').trim().toLowerCase();
  const phoneQuery = (document.getElementById('supplierPhoneSearchInput')?.value || '').trim().toLowerCase().replace(/[^0-9+a-z]/g, '');
  const category = (document.getElementById('supplierCategoryFilter')?.value || '').trim().toLowerCase();
  const status = document.getElementById('supplierStatusFilter')?.value || 'ACTIVE';

  let list = allSuppliers || [];

  // Filter by Status
  if (status === 'ACTIVE') {
    list = list.filter(s => s.active !== false);
  } else if (status === 'INACTIVE') {
    list = list.filter(s => s.active === false);
  }

  // Filter by Category
  if (category) {
    list = list.filter(s => (s.category || '').toLowerCase() === category);
  }

  // Filter by Supplier Text (Name, Contact, Email, GST, UPI, Address, Notes)
  if (query) {
    list = list.filter(s => {
      const name = (s.name || '').toLowerCase();
      const contact = (s.contactPerson || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const gst = (s.gstNumber || '').toLowerCase();
      const upi = (s.upiId || '').toLowerCase();
      const addr = (s.address || '').toLowerCase();
      const notes = (s.notes || '').toLowerCase();
      const bank = (s.bankName || '').toLowerCase();
      return name.includes(query) || contact.includes(query) || email.includes(query) ||
        gst.includes(query) || upi.includes(query) || addr.includes(query) || notes.includes(query) || bank.includes(query);
    });
  }

  // Filter by Phone / Number Specifically
  if (phoneQuery) {
    list = list.filter(s => {
      const rawPhone = (s.phone || '').toLowerCase().replace(/[^0-9+a-z]/g, '');
      const rawBankAcc = (s.bankAccount || '').toLowerCase().replace(/[^0-9+a-z]/g, '');
      const rawGst = (s.gstNumber || '').toLowerCase().replace(/[^0-9+a-z]/g, '');
      return rawPhone.includes(phoneQuery) || rawBankAcc.includes(phoneQuery) || rawGst.includes(phoneQuery);
    });
  }

  // Update Summary Badges
  const countEl = document.getElementById('supplierDirCount');
  const invEl = document.getElementById('supplierDirTotalInvoiced');
  const outEl = document.getElementById('supplierDirTotalOutstanding');

  const totalInvoiced = list.reduce((sum, s) => sum + (s.totalInvoiced || 0), 0);
  const totalOutstanding = list.reduce((sum, s) => sum + (s.totalOutstanding || 0), 0);

  if (countEl) countEl.textContent = list.length;
  if (invEl) invEl.textContent = fmtINR(totalInvoiced);
  if (outEl) outEl.textContent = fmtINR(totalOutstanding);

  // Render view
  if (supplierDirectoryView === 'table') {
    renderSupplierDirectoryTable(list);
  } else {
    renderSupplierDirectoryCards(list);
  }
}

function renderSupplierDirectoryCards(suppliers) {
  const container = document.getElementById('supplierDirectoryCardsView');
  if (!container) return;

  if (!suppliers.length) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-gray-500 space-y-2">
        <i class="fa-solid fa-truck-ramp-box text-3xl text-gray-600"></i>
        <p class="text-xs">No suppliers found matching the search criteria.</p>
        <button onclick="resetSupplierDirectoryFilters()" class="px-3 py-1 text-xs rounded-lg bg-gray-800 text-amber-400 font-semibold hover:bg-gray-700">Clear Search Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = suppliers.map(s => {
    const isOut = (s.totalOutstanding || 0) > 0;
    const phoneDisplay = s.phone || 'No phone';
    const upiDisplay = s.upiId || '';
    const gstDisplay = s.gstNumber || '';
    const categoryBadge = s.category ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 truncate max-w-[120px]">${escapeHtml(s.category)}</span>` : '';
    const statusBadge = s.active !== false
      ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Active</span>`
      : `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">Inactive</span>`;

    return `
      <div class="glass-card p-4 rounded-xl flex flex-col justify-between space-y-3 border border-gray-800/80 hover:border-amber-500/40 transition group">
        <!-- Top Title & Category -->
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-white group-hover:text-amber-400 transition flex items-center gap-1.5">
                <i class="fa-solid fa-building text-xs text-amber-500"></i>
                <span>${escapeHtml(s.name)}</span>
              </h3>
              <p class="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                <i class="fa-regular fa-user text-[10px]"></i>
                <span>${escapeHtml(s.contactPerson || 'General Contact')}</span>
              </p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              ${statusBadge}
              ${categoryBadge}
            </div>
          </div>

          <!-- Contact Details (Phone with tel: and copy, Email) -->
          <div class="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/60 space-y-1.5 text-[11px]">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <i class="fa-solid fa-phone text-[10px] text-emerald-400 shrink-0"></i>
                ${s.phone ? `<a href="tel:${escapeHtml(s.phone)}" class="text-emerald-300 hover:underline font-mono font-bold">${escapeHtml(s.phone)}</a>` : '<span class="text-gray-500">No phone</span>'}
              </div>
              ${s.phone ? `
                <button type="button" onclick="event.stopPropagation(); copyTextToClipboard('${escapeHtml(s.phone)}', 'Phone Number')"
                  class="px-1.5 py-0.5 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white" title="Copy Phone">
                  <i class="fa-regular fa-copy"></i>
                </button>
              ` : ''}
            </div>
            ${s.email ? `
              <div class="flex items-center gap-1.5 text-gray-400 truncate">
                <i class="fa-regular fa-envelope text-[10px] text-blue-400 shrink-0"></i>
                <a href="mailto:${escapeHtml(s.email)}" class="hover:underline truncate">${escapeHtml(s.email)}</a>
              </div>
            ` : ''}
            ${s.address ? `
              <div class="flex items-start gap-1.5 text-gray-400 text-[10px] line-clamp-1">
                <i class="fa-solid fa-location-dot text-[10px] text-rose-400 shrink-0 mt-0.5"></i>
                <span class="truncate" title="${escapeHtml(s.address)}">${escapeHtml(s.address)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Tax & Banking Details (GST, UPI, Bank) -->
          <div class="grid grid-cols-2 gap-1.5 text-[10px]">
            <!-- GSTIN -->
            <div class="bg-gray-900/50 p-1.5 rounded border border-gray-800 flex items-center justify-between">
              <div class="truncate">
                <span class="text-gray-500 block text-[9px] uppercase font-semibold">GSTIN</span>
                <span class="font-mono text-gray-300 font-semibold truncate block">${gstDisplay || '-'}</span>
              </div>
              ${gstDisplay ? `<button type="button" onclick="event.stopPropagation(); copyTextToClipboard('${escapeHtml(gstDisplay)}', 'GSTIN')" class="text-gray-400 hover:text-amber-400"><i class="fa-regular fa-copy"></i></button>` : ''}
            </div>
            <!-- UPI ID -->
            <div class="bg-gray-900/50 p-1.5 rounded border border-gray-800 flex items-center justify-between">
              <div class="truncate">
                <span class="text-gray-500 block text-[9px] uppercase font-semibold">UPI ID</span>
                <span class="font-mono text-cyan-300 font-semibold truncate block">${upiDisplay || '-'}</span>
              </div>
              ${upiDisplay ? `<button type="button" onclick="event.stopPropagation(); copyTextToClipboard('${escapeHtml(upiDisplay)}', 'UPI ID')" class="text-gray-400 hover:text-cyan-400"><i class="fa-regular fa-copy"></i></button>` : ''}
            </div>
          </div>
        </div>

        <!-- Ledger Financial Snapshot -->
        <div class="border-t border-gray-800/80 pt-2 space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-400 text-[11px]">Outstanding Due:</span>
            <span class="font-bold font-mono ${isOut ? 'text-rose-400' : 'text-gray-500'}">${fmtINR(s.totalOutstanding)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-500">
            <span>Invoiced: <strong class="text-gray-300">${fmtINR(s.totalInvoiced)}</strong></span>
            <span>Paid: <strong class="text-emerald-400">${fmtINR(s.totalPaid)}</strong></span>
          </div>

          <!-- Card Action Buttons -->
          <div class="grid grid-cols-3 gap-1.5 pt-1">
            <button type="button" onclick="openSupplierDossierModal(${s.id})"
              class="py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition">
              <i class="fa-solid fa-eye text-[9px]"></i> Dossier
            </button>
            <button type="button" onclick="openInvoiceModalForSupplier(${s.id})"
              class="py-1 px-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-semibold flex items-center justify-center gap-1 transition">
              <i class="fa-solid fa-file-invoice text-[9px]"></i> Invoice
            </button>
            <button type="button" onclick="editSupplier(${s.id})"
              class="py-1 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition">
              <i class="fa-solid fa-pen text-[9px]"></i> Edit
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSupplierDirectoryTable(suppliers) {
  const tbody = document.getElementById('supplierDirectoryTableBody');
  if (!tbody) return;

  if (!suppliers.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-gray-500 text-xs">No suppliers found matching criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = suppliers.map(s => {
    const isOut = (s.totalOutstanding || 0) > 0;
    return `
      <tr class="hover:bg-gray-800/30 transition ${!s.active ? 'opacity-50' : ''}">
        <td class="p-3">
          <div class="font-bold text-white flex items-center gap-1.5">
            <i class="fa-solid fa-building text-amber-400 text-xs"></i>
            <span>${escapeHtml(s.name)}</span>
          </div>
          <div class="text-[10px] text-gray-400 truncate max-w-xs">${escapeHtml(s.address || s.email || '')}</div>
        </td>
        <td class="p-3">
          <div class="text-gray-200 font-semibold">${escapeHtml(s.contactPerson || '-')}</div>
          <div class="flex items-center gap-1 mt-0.5">
            ${s.phone ? `
              <a href="tel:${escapeHtml(s.phone)}" class="text-emerald-400 font-mono text-[11px] hover:underline">${escapeHtml(s.phone)}</a>
              <button type="button" onclick="copyTextToClipboard('${escapeHtml(s.phone)}', 'Phone')" class="text-gray-400 hover:text-white text-[10px]"><i class="fa-regular fa-copy"></i></button>
            ` : '<span class="text-gray-500 text-[11px]">-</span>'}
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">${escapeHtml(s.category || '-')}</span>
        </td>
        <td class="p-3 font-mono text-[11px]">
          ${s.gstNumber ? `
            <div class="flex items-center gap-1">
              <span>${escapeHtml(s.gstNumber)}</span>
              <button type="button" onclick="copyTextToClipboard('${escapeHtml(s.gstNumber)}', 'GSTIN')" class="text-gray-400 hover:text-amber-400 text-[10px]"><i class="fa-regular fa-copy"></i></button>
            </div>
          ` : '<span class="text-gray-500">-</span>'}
        </td>
        <td class="p-3 text-[11px]">
          <div class="text-cyan-300 font-mono truncate max-w-[120px]" title="UPI: ${escapeHtml(s.upiId || '')}">${s.upiId ? escapeHtml(s.upiId) : '-'}</div>
          <div class="text-gray-400 text-[10px] font-mono truncate max-w-[120px]">${s.bankAccount ? 'A/C: ' + escapeHtml(s.bankAccount) : ''}</div>
        </td>
        <td class="p-3 text-right font-mono">${fmtINR(s.totalInvoiced)}</td>
        <td class="p-3 text-right font-mono font-bold ${isOut ? 'text-rose-400' : 'text-gray-500'}">${fmtINR(s.totalOutstanding)}</td>
        <td class="p-3 text-center space-x-1 whitespace-nowrap">
          <button onclick="openSupplierDossierModal(${s.id})" class="px-2 py-1 text-[10px] rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30">Dossier</button>
          <button onclick="editSupplier(${s.id})" class="px-2 py-1 text-[10px] rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20">Edit</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Supplier Dossier & Full Details Modal ──
async function openSupplierDossierModal(supplierId) {
  try {
    currentDossierSupplierId = supplierId;
    let data;
    try {
      data = await apiRequest(`/suppliers/${supplierId}/details`);
    } catch (e) {
      // Fallback
      const s = await apiRequest(`/suppliers/${supplierId}`);
      const invs = await apiRequest(`/suppliers/${supplierId}/invoices`).catch(() => []);
      const pays = await apiRequest(`/suppliers/${supplierId}/payments`).catch(() => []);
      data = { supplier: s, recentInvoices: invs, recentPayments: pays };
    }

    const s = data.supplier || {};
    const invoices = data.recentInvoices || [];
    const payments = data.recentPayments || [];

    // Header
    const nameEl = document.getElementById('dossierSupplierName');
    const badgeEl = document.getElementById('dossierSupplierStatusBadge');
    const catEl = document.getElementById('dossierSupplierCategory');
    if (nameEl) nameEl.textContent = s.name || 'Supplier Dossier';
    if (catEl) catEl.textContent = `Category: ${s.category || 'General'} · Payment Terms: ${s.paymentTerms || 30} days`;
    if (badgeEl) {
      badgeEl.textContent = s.active !== false ? 'Active' : 'Inactive';
      badgeEl.className = s.active !== false
        ? 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700';
    }

    // Contact
    const cPerson = document.getElementById('dossierContactPerson'); if (cPerson) cPerson.textContent = s.contactPerson || '-';
    const cPhone = document.getElementById('dossierPhone'); if (cPhone) cPhone.textContent = s.phone || '-';
    const cEmail = document.getElementById('dossierEmail'); if (cEmail) cEmail.textContent = s.email || '-';
    const cAddress = document.getElementById('dossierAddress'); if (cAddress) cAddress.textContent = s.address || '-';

    // Banking & Tax
    const cGst = document.getElementById('dossierGst'); if (cGst) cGst.textContent = s.gstNumber || '-';
    const cUpi = document.getElementById('dossierUpi'); if (cUpi) cUpi.textContent = s.upiId || '-';
    const cBank = document.getElementById('dossierBankName'); if (cBank) cBank.textContent = s.bankName || '-';
    const cAcc = document.getElementById('dossierBankAcc'); if (cAcc) cAcc.textContent = s.bankAccount || '-';
    const cIfsc = document.getElementById('dossierBankIfsc'); if (cIfsc) cIfsc.textContent = s.bankIfsc || '-';

    // Financial
    const cTerms = document.getElementById('dossierTerms'); if (cTerms) cTerms.textContent = `${s.paymentTerms || 30} days`;
    const cInv = document.getElementById('dossierTotalInvoiced'); if (cInv) cInv.textContent = fmtINR(s.totalInvoiced);
    const cPaid = document.getElementById('dossierTotalPaid'); if (cPaid) cPaid.textContent = fmtINR(s.totalPaid);
    const cOut = document.getElementById('dossierOutstanding');
    if (cOut) {
      cOut.textContent = fmtINR(s.totalOutstanding);
      cOut.className = (s.totalOutstanding || 0) > 0 ? 'text-rose-400 font-bold' : 'text-gray-400 font-bold';
    }
    const cNotes = document.getElementById('dossierNotes'); if (cNotes) cNotes.textContent = s.notes || 'None';

    // Wire Copy buttons in dossier
    const btnPhone = document.getElementById('btnCopyDossierPhone');
    if (btnPhone) btnPhone.onclick = () => copyTextToClipboard(s.phone, 'Phone');
    const btnGst = document.getElementById('btnCopyDossierGst');
    if (btnGst) btnGst.onclick = () => copyTextToClipboard(s.gstNumber, 'GSTIN');
    const btnUpi = document.getElementById('btnCopyDossierUpi');
    if (btnUpi) btnUpi.onclick = () => copyTextToClipboard(s.upiId, 'UPI ID');
    const btnAcc = document.getElementById('btnCopyDossierAcc');
    if (btnAcc) btnAcc.onclick = () => copyTextToClipboard(s.bankAccount, 'Account Number');

    // Invoices list
    const invBadge = document.getElementById('dossierInvoiceCountBadge');
    if (invBadge) invBadge.textContent = `${invoices.length} invoices`;
    const invTbody = document.getElementById('dossierInvoicesTableBody');
    if (invTbody) {
      if (!invoices.length) {
        invTbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500 text-xs">No invoices on file</td></tr>';
      } else {
        invTbody.innerHTML = invoices.map(i => `
          <tr class="hover:bg-gray-800/30">
            <td class="p-2 font-mono font-bold text-white">${escapeHtml(i.invoiceNumber)}</td>
            <td class="p-2 text-gray-400">${fmtDate(i.invoiceDate)}</td>
            <td class="p-2 text-right font-mono">${fmtINR(i.totalAmount)}</td>
            <td class="p-2 text-right font-mono text-emerald-400">${fmtINR(i.paidAmount)}</td>
            <td class="p-2 text-right font-mono font-bold ${(i.outstandingAmount || 0) > 0 ? 'text-rose-400' : 'text-gray-500'}">${fmtINR(i.outstandingAmount)}</td>
            <td class="p-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${i.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">${i.status}</span></td>
          </tr>
        `).join('');
      }
    }

    // Payments list
    const payBadge = document.getElementById('dossierPaymentCountBadge');
    if (payBadge) payBadge.textContent = `${payments.length} payments`;
    const payTbody = document.getElementById('dossierPaymentsTableBody');
    if (payTbody) {
      if (!payments.length) {
        payTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 text-xs">No payments recorded</td></tr>';
      } else {
        payTbody.innerHTML = payments.map(p => `
          <tr class="hover:bg-gray-800/30">
            <td class="p-2 font-mono font-bold text-white">${escapeHtml(p.paymentReceiptNumber || '#' + p.id)}</td>
            <td class="p-2 text-gray-400">${fmtDate(p.paymentDate)}</td>
            <td class="p-2"><span class="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300">${p.paymentMode}</span></td>
            <td class="p-2 text-gray-400 truncate max-w-xs">${escapeHtml(p.referenceNumber || p.notes || '-')}</td>
            <td class="p-2 text-right font-mono font-bold text-emerald-400">${fmtINR(p.amount)}</td>
          </tr>
        `).join('');
      }
    }

    // Modal action buttons
    const btnCreate = document.getElementById('btnDossierCreateInvoice');
    if (btnCreate) {
      btnCreate.onclick = () => {
        closeSupplierDossierModal();
        openInvoiceModalForSupplier(supplierId);
      };
    }
    const btnEdit = document.getElementById('btnDossierEditSupplier');
    if (btnEdit) {
      btnEdit.onclick = () => {
        closeSupplierDossierModal();
        editSupplier(supplierId);
      };
    }

    document.getElementById('supplierDossierModal')?.classList.remove('hidden');
  } catch (e) {
    showToast('Failed to open dossier: ' + e.message, 'error');
  }
}

function closeSupplierDossierModal() {
  document.getElementById('supplierDossierModal')?.classList.add('hidden');
}

function openInvoiceModalForSupplier(supplierId) {
  openInvoiceModal();
  const select = document.getElementById('invoiceSupplierId');
  if (select) {
    select.value = supplierId;
  }
}

function copyTextToClipboard(text, label) {
  if (!text) {
    showToast(`No ${label || 'text'} to copy`, 'warning');
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => showToast(`${label || 'Text'} copied to clipboard!`, 'success'))
    .catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`${label || 'Text'} copied to clipboard!`, 'success');
    });
}

function renderSupplierTable(suppliers) {
  const tbody = document.getElementById('supplierTableBody');
  if (!suppliers.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-500 text-xs">No suppliers added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = suppliers.map(s => `
    <tr class="hover:bg-gray-800/30 transition ${!s.active ? 'opacity-50' : ''}">
      <td class="p-3">
        <div class="font-semibold text-white">${s.name}</div>
        <div class="text-[10px] text-gray-400">${s.email || ''} ${s.phone ? '· ' + s.phone : ''}</div>
      </td>
      <td class="p-3">${s.contactPerson || '-'}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">${s.category || '-'}</span></td>
      <td class="p-3">${s.paymentTerms || 30} days</td>
      <td class="p-3 text-right">${fmtINR(s.totalInvoiced)}</td>
      <td class="p-3 text-right text-emerald-400">${fmtINR(s.totalPaid)}</td>
      <td class="p-3 text-right font-bold ${(s.totalOutstanding || 0) > 0 ? 'text-rose-400' : 'text-gray-500'}">${fmtINR(s.totalOutstanding)}</td>
      <td class="p-3 text-right space-x-1">
        <button onclick="openSupplierDossierModal(${s.id})" class="px-2 py-1 text-[10px] rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30">Dossier</button>
        <button onclick="editSupplier(${s.id})" class="px-2 py-1 text-[10px] rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20">Edit</button>
        ${currentUser.role === 'ADMIN' ? `<button onclick="deleteSupplier(${s.id})" class="px-2 py-1 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20">Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function populateSupplierDropdowns() {
  const opts = allSuppliers.filter(s => s.active).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ['invoiceSupplierId', 'invoiceSupplierFilter', 'paymentSupplierFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const placeholder = el.id.includes('Filter') ? '<option value="">All Suppliers</option>' : '<option value="">Select Supplier</option>';
    el.innerHTML = placeholder + opts;
  });
}

// ── Supplier Modal ──
function openSupplierModal(supplier = null) {
  document.getElementById('supplierId').value = supplier ? supplier.id : '';
  document.getElementById('supplierModalTitle').innerHTML = supplier
    ? '<i class="fa-solid fa-pen mr-2"></i>Edit Supplier'
    : '<i class="fa-solid fa-building mr-2"></i>Add Supplier';
  document.getElementById('supplierName').value = supplier?.name || '';
  document.getElementById('supplierContact').value = supplier?.contactPerson || '';
  document.getElementById('supplierPhone').value = supplier?.phone || '';
  document.getElementById('supplierEmail').value = supplier?.email || '';
  document.getElementById('supplierCategory').value = supplier?.category || '';
  document.getElementById('supplierTerms').value = supplier?.paymentTerms || 30;
  document.getElementById('supplierGst').value = supplier?.gstNumber || '';
  document.getElementById('supplierAddress').value = supplier?.address || '';
  document.getElementById('supplierUpi').value = supplier?.upiId || '';
  document.getElementById('supplierBank').value = supplier?.bankName || '';
  document.getElementById('supplierAccNo').value = supplier?.bankAccount || '';
  document.getElementById('supplierIfsc').value = supplier?.bankIfsc || '';
  document.getElementById('supplierNotes').value = supplier?.notes || '';
  document.getElementById('supplierFormError').classList.add('hidden');
  document.getElementById('supplierModal').classList.remove('hidden');
}

function closeSupplierModal() {
  document.getElementById('supplierModal').classList.add('hidden');
}

async function editSupplier(id) {
  try {
    const supplier = await apiRequest(`/suppliers/${id}`);
    openSupplierModal(supplier);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteSupplier(id) {
  if (!confirm('Deactivate this supplier? Their invoices and payment history will be kept.')) return;
  try {
    await apiRequest(`/suppliers/${id}`, { method: 'DELETE' });
    showToast('Supplier deactivated', 'success');
    loadSuppliersData();
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveSupplier(event) {
  event.preventDefault();
  const errEl = document.getElementById('supplierFormError');
  errEl.classList.add('hidden');
  const id = document.getElementById('supplierId').value;
  const body = {
    name: document.getElementById('supplierName').value.trim(),
    contactPerson: document.getElementById('supplierContact').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
    category: document.getElementById('supplierCategory').value.trim(),
    paymentTerms: parseInt(document.getElementById('supplierTerms').value) || 30,
    gstNumber: document.getElementById('supplierGst').value.trim(),
    address: document.getElementById('supplierAddress').value.trim(),
    upiId: document.getElementById('supplierUpi').value.trim(),
    bankName: document.getElementById('supplierBank').value.trim(),
    bankAccount: document.getElementById('supplierAccNo').value.trim(),
    bankIfsc: document.getElementById('supplierIfsc').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim(),
  };
  try {
    if (id) {
      await apiRequest(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Supplier updated', 'success');
    } else {
      await apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(body) });
      showToast('Supplier added', 'success');
    }
    closeSupplierModal();
    loadSuppliersData();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

// ── Invoice CRUD ──
async function loadSupplierInvoices() {
  const supplierId = document.getElementById('invoiceSupplierFilter')?.value || '';
  const statusFilter = document.getElementById('invoiceStatusFilter')?.value || '';
  try {
    let url = supplierId ? `/suppliers/${supplierId}/invoices` : '/suppliers/invoices';
    const invoices = await apiRequest(url);
    allInvoices = invoices;
    const filtered = invoices.filter(i => !statusFilter || i.status === statusFilter);
    renderInvoiceTable(filtered);
    populatePaymentInvoiceDropdown(invoices);
  } catch (e) {
    document.getElementById('invoiceTableBody').innerHTML =
      `<tr><td colspan="9" class="p-4 text-center text-rose-400 text-xs">${e.message}</td></tr>`;
  }
}

function populatePaymentInvoiceDropdown(invoices) {
  const sel = document.getElementById('paymentInvoiceId');
  if (!sel) return;
  const outstanding = (invoices || allInvoices).filter(i => i.status !== 'PAID');
  sel.innerHTML = '<option value="">Select Invoice</option>' +
    outstanding.map(i => `<option value="${i.id}">[${i.supplierName}] ${i.invoiceNumber} — ${fmtINR(i.outstandingAmount)} outstanding</option>`).join('');
}

function invoiceStatusBadge(status, isOverdue) {
  const map = {
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PARTIAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    UNPAID: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    OVERDUE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  const label = isOverdue && status !== 'PAID' ? 'OVERDUE' : status;
  const cls = map[label] || map['UNPAID'];
  return `<span class="px-2 py-0.5 rounded-full text-[10px] border ${cls}">${label}</span>`;
}

function renderInvoiceTable(invoices) {
  const tbody = document.getElementById('invoiceTableBody');
  if (!invoices.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-gray-500 text-xs">No invoices found.</td></tr>';
    return;
  }
  tbody.innerHTML = invoices.map(inv => `
    <tr class="hover:bg-gray-800/30 transition">
      <td class="p-3 font-mono text-amber-300">${inv.invoiceNumber}</td>
      <td class="p-3">${inv.supplierName || '-'}</td>
      <td class="p-3">${fmtDate(inv.invoiceDate)}</td>
      <td class="p-3 ${inv.isOverdue ? 'text-rose-400 font-semibold' : ''}">${fmtDate(inv.dueDate)}</td>
      <td class="p-3 text-right">${fmtINR(inv.totalAmount)}</td>
      <td class="p-3 text-right text-emerald-400">${fmtINR(inv.paidAmount)}</td>
      <td class="p-3 text-right font-bold ${inv.outstandingAmount > 0 ? 'text-rose-400' : 'text-gray-500'}">${fmtINR(inv.outstandingAmount)}</td>
      <td class="p-3 text-center">${invoiceStatusBadge(inv.status, inv.isOverdue)}</td>
      <td class="p-3 text-right space-x-1 whitespace-nowrap">
        <button onclick="editInvoice(${inv.id})" class="px-2 py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20" title="Edit / Update Invoice">Edit</button>
        ${inv.status !== 'PAID' ? `<button onclick="quickPay(${inv.id})" class="px-2 py-1 text-[10px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Pay</button>` : ''}
        <button onclick="viewInvoicePayments(${inv.id})" class="px-2 py-1 text-[10px] rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20">History</button>
        ${currentUser.role === 'ADMIN' ? `<button onclick="deleteInvoice(${inv.id})" class="px-2 py-1 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20">Del</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function editInvoice(id) {
  try {
    if (!allSuppliers || allSuppliers.length === 0) {
      await loadSuppliers();
    }
    if (!inventoryItemsList || inventoryItemsList.length === 0) {
      await loadInventoryData();
    }
    let inv = (typeof allInvoices !== 'undefined' && allInvoices) ? allInvoices.find(i => i.id === id) : null;
    if (!inv || !inv.items || inv.items.length === 0) {
      inv = await apiRequest(`/suppliers/invoices/${id}`);
    }
    if (!inv) {
      showToast('Invoice details not found', 'error');
      return;
    }
    openInvoiceModal(inv);
  } catch (err) {
    showToast(err.message || 'Failed to load invoice for editing', 'error');
  }
}

let currentInvoiceItems = [];

function openInvoiceModal(inv = null) {
  document.getElementById('invoiceId').value = inv ? inv.id : '';
  document.getElementById('invoiceModalTitle').innerHTML = inv
    ? '<i class="fa-solid fa-pen mr-2"></i>Edit Supplier Invoice'
    : '<i class="fa-solid fa-file-invoice-dollar mr-2"></i>Add Supplier Invoice';
  const opts = allSuppliers.filter(s => s.active || (inv && inv.supplierId === s.id)).map(s => `<option value="${s.id}" ${inv && inv.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
  document.getElementById('invoiceSupplierId').innerHTML = '<option value="">Select Supplier</option>' + opts;
  document.getElementById('invoiceNumber').value = inv?.invoiceNumber || '';
  document.getElementById('invoiceDate').value = inv?.invoiceDate || new Date().toISOString().split('T')[0];
  document.getElementById('invoiceDueDate').value = inv?.dueDate || '';
  document.getElementById('invoiceDescription').value = inv?.description || '';
  document.getElementById('invoiceFormError').classList.add('hidden');

  // Clear fast product search and inline creator
  const searchInput = document.getElementById('invoiceProductSearch');
  if (searchInput) searchInput.value = '';
  const searchResults = document.getElementById('invoiceProductSearchResults');
  if (searchResults) { searchResults.innerHTML = ''; searchResults.classList.add('hidden'); }
  toggleNewProductInlineBox(false);

  // Set financial adjustments & GST
  const gstSelect = document.getElementById('invoiceGstRateSelect');
  if (gstSelect) {
    if (inv) {
      const distinctRates = [...new Set(inv.items?.map(it => it.gstRate != null ? String(it.gstRate) : String(inv.gstRate || 0)) || [])];
      if (distinctRates.length === 1 && ['0', '5', '12', '18', '28'].includes(distinctRates[0])) {
        gstSelect.value = distinctRates[0];
      } else {
        gstSelect.value = 'AUTO';
      }
    } else {
      gstSelect.value = 'AUTO';
    }
  }
  const gstAmountInput = document.getElementById('invoiceGstAmountInput');
  if (gstAmountInput) gstAmountInput.value = inv?.gstAmount != null ? inv.gstAmount.toFixed(2) : '0.00';

  const otherChargesInput = document.getElementById('invoiceOtherChargesInput');
  if (otherChargesInput) otherChargesInput.value = inv?.otherCharges != null ? inv.otherCharges.toFixed(2) : '0.00';

  const discountInput = document.getElementById('invoiceDiscountInput');
  if (discountInput) discountInput.value = inv?.discount != null ? inv.discount.toFixed(2) : '0.00';

  if (inv && inv.items && inv.items.length > 0) {
    currentInvoiceItems = inv.items.map(it => {
      const unitVol = it.unitVolume != null ? it.unitVolume : (it.volume != null ? it.volume : 1);
      const volUnit = it.volumeUnit || it.unit || 'kg';
      const qty = it.quantity != null ? it.quantity : 0;
      const unitPrice = it.unitPrice != null ? it.unitPrice : 0;
      const costPerVol = unitVol > 0 ? (unitPrice / unitVol) : (it.costPerVolume || 0);
      const itemGstRate = it.gstRate != null ? it.gstRate : (inv.gstRate != null ? inv.gstRate : 0);
      const lineSubtotal = Math.round((it.totalPrice || (qty * unitPrice)) * 100) / 100;
      const itemGstAmount = it.gstAmount != null ? it.gstAmount : Math.round((lineSubtotal * itemGstRate / 100) * 100) / 100;
      return {
        inventoryItemId: it.inventoryItemId,
        productName: it.productName,
        itemCategory: it.itemCategory || 'Stock',
        unit: it.unit || 'packet',
        unitVolume: unitVol,
        volume: unitVol,
        volumeUnit: volUnit,
        quantity: qty,
        unitPrice: unitPrice,
        gstRate: itemGstRate,
        gstAmount: itemGstAmount,
        totalVolume: Math.round(qty * unitVol * 1000) / 1000,
        costPerVolume: Math.round(costPerVol * 100) / 100,
        totalPrice: lineSubtotal
      };
    });
  } else {
    currentInvoiceItems = [];
  }

  renderInvoiceItemsTable();
  recalcInvoiceFinancials();

  if (inv?.totalAmount != null && inv.totalAmount > 0) {
    document.getElementById('invoiceTotal').value = inv.totalAmount.toFixed(2);
    recalcInvoiceFinancials(true);
  }

  document.getElementById('invoiceModal').classList.remove('hidden');
}

// ─── Fast Product Search & Autocomplete ─────────────────────────

function onInvoiceProductSearchInput() {
  const query = document.getElementById('invoiceProductSearch').value.trim().toLowerCase();
  const resContainer = document.getElementById('invoiceProductSearchResults');
  if (!resContainer) return;

  if (!query) {
    resContainer.innerHTML = '';
    resContainer.classList.add('hidden');
    return;
  }

  const existingItemIds = new Set(currentInvoiceItems.filter(i => i.inventoryItemId != null).map(i => i.inventoryItemId));
  const existingNames = new Set(currentInvoiceItems.map(i => i.productName.toLowerCase()));

  const matches = inventoryItemsList.filter(item => {
    return item.name.toLowerCase().includes(query) || (item.category && item.category.toLowerCase().includes(query));
  }).slice(0, 8);

  if (matches.length === 0) {
    resContainer.innerHTML = `
      <div class="p-2.5 text-center text-gray-400">
        <p class="text-xs">No matching products found.</p>
        <button type="button" onclick="quickCreateNewProductFromSearch('${query.replace(/'/g, "\\'")}')" class="mt-1 text-amber-400 hover:text-amber-300 font-bold underline text-[11px]">
          + Create "${query}" as New Product
        </button>
      </div>
    `;
    resContainer.classList.remove('hidden');
    return;
  }

  resContainer.innerHTML = matches.map(m => {
    const isAdded = existingItemIds.has(m.id) || existingNames.has(m.name.toLowerCase());
    const unitVol = m.unitVolume != null ? m.unitVolume : (m.volume != null ? m.volume : 1);
    const volUnit = m.volumeUnit || m.unit || 'kg';
    const isCountable = isItemCountableUnit(m.unit, volUnit);
    return `
      <div onclick="selectProductForInvoice(${m.id})" class="p-2 hover:bg-gray-800 cursor-pointer flex items-center justify-between transition ${isAdded ? 'bg-gray-900/60 opacity-80' : ''}">
        <div>
          <span class="font-bold text-white text-xs">${escapeHtml(m.name)}</span>
          <span class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">${escapeHtml(m.unit || 'pcs')}</span>
          ${isCountable ? `<span class="ml-2 text-[10px] text-amber-300 font-medium">Countable</span>` : `<span class="ml-2 text-[10px] text-amber-300 font-medium">Vol: ${unitVol} ${escapeHtml(volUnit)}</span>`}
          <span class="ml-2 text-[10px] text-gray-400">Stock: ${m.quantity}</span>
        </div>
        <div class="text-right">
          <span class="text-xs font-semibold text-emerald-400">₹${(m.costPerUnit || 0).toFixed(2)}</span>
          ${isAdded ? '<span class="block text-[9px] text-amber-400 font-semibold">(Already in table)</span>' : '<span class="block text-[9px] text-gray-500">Click to add</span>'}
        </div>
      </div>
    `;
  }).join('');

  resContainer.classList.remove('hidden');
}

function onInvoiceProductSearchKeydown(event) {
  const resContainer = document.getElementById('invoiceProductSearchResults');
  if (event.key === 'Escape') {
    if (resContainer) resContainer.classList.add('hidden');
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (resContainer && !resContainer.classList.contains('hidden')) {
      const firstResult = resContainer.querySelector('[onclick^="selectProductForInvoice"]');
      if (firstResult) {
        firstResult.click();
      }
    }
  }
}

function selectProductForInvoice(itemId) {
  const item = inventoryItemsList.find(i => i.id === itemId);
  if (!item) return;

  const existingIdx = currentInvoiceItems.findIndex(i => i.inventoryItemId === itemId || i.productName.toLowerCase() === item.name.toLowerCase());
  if (existingIdx >= 0) {
    showToast(`"${item.name}" is already in the invoice. Focused for editing.`, 'info');
    const existingInput = document.getElementById(`invItemQty_${existingIdx}`);
    if (existingInput) {
      existingInput.focus();
      existingInput.select();
    }
  } else {
    const unitVol = item.unitVolume != null ? item.unitVolume : (item.volume != null ? item.volume : 1);
    const volUnit = item.volumeUnit || item.unit || 'kg';
    const rate = item.costPerUnit || 0;
    const isCountable = isItemCountableUnit(item.unit, volUnit);
    const costPerVol = isCountable ? rate : (unitVol > 0 ? (rate / unitVol) : rate);

    const defaultGst = parseFloat(document.getElementById('invoiceBulkGstSelect')?.value) || 0;
    const lineSub = rate * 1;
    const lineGst = Math.round((lineSub * defaultGst / 100) * 100) / 100;

    currentInvoiceItems.push({
      inventoryItemId: item.id,
      productName: item.name,
      itemCategory: item.itemCategory || 'Stock',
      unit: item.unit || 'packet',
      unitVolume: isCountable ? 1 : unitVol,
      volume: isCountable ? 1 : unitVol,
      volumeUnit: volUnit,
      quantity: 1,
      unitPrice: rate,
      gstRate: defaultGst,
      gstAmount: lineGst,
      totalVolume: isCountable ? 1 : (unitVol * 1),
      costPerVolume: Math.round(costPerVol * 100) / 100,
      totalPrice: rate
    });

    renderInvoiceItemsTable();
    recalcInvoiceFinancials();

    // Auto-focus the quantity input of the newly added row
    const newIdx = currentInvoiceItems.length - 1;
    setTimeout(() => {
      const newQtyInput = document.getElementById(`invItemQty_${newIdx}`);
      if (newQtyInput) {
        newQtyInput.focus();
        newQtyInput.select();
      }
    }, 50);
  }

  // Clear search bar and hide results
  const searchInput = document.getElementById('invoiceProductSearch');
  if (searchInput) searchInput.value = '';
  const resContainer = document.getElementById('invoiceProductSearchResults');
  if (resContainer) resContainer.classList.add('hidden');
}

function quickCreateNewProductFromSearch(name) {
  toggleNewProductInlineBox(true);
  const nameInput = document.getElementById('invoiceNewItemName');
  if (nameInput) {
    nameInput.value = name;
    nameInput.focus();
  }
  const resContainer = document.getElementById('invoiceProductSearchResults');
  if (resContainer) resContainer.classList.add('hidden');
}

// ─── Inline New Product Creator ─────────────────────────────────

function onInvoiceNewItemUnitChange() {
  const unitEl = document.getElementById('invoiceNewItemUnit');
  const volEl = document.getElementById('invoiceNewItemVolume');
  const volUnitEl = document.getElementById('invoiceNewItemVolUnit');
  if (!unitEl || !volUnitEl) return;
  const val = unitEl.value.toLowerCase();
  if (['piece', 'pieces'].includes(val)) {
    if (volEl) volEl.value = '1';
    volUnitEl.value = 'pieces';
  } else if (['meter', 'cm', 'mm', 'inch'].includes(val)) {
    volUnitEl.value = val;
  }
}

function toggleNewProductInlineBox(show = null) {
  const box = document.getElementById('invoiceNewProductInlineBox');
  if (!box) return;
  const isHidden = box.classList.contains('hidden');
  const targetShow = show !== null ? show : isHidden;
  if (targetShow) {
    box.classList.remove('hidden');
    document.getElementById('invoiceNewItemName').focus();
  } else {
    box.classList.add('hidden');
    document.getElementById('invoiceNewItemName').value = '';
    const catInput = document.getElementById('invoiceNewItemCategory');
    if (catInput) catInput.value = 'Stock';
    document.getElementById('invoiceNewItemUnit').value = 'packet';
    const volInput = document.getElementById('invoiceNewItemVolume');
    if (volInput) volInput.value = '1';
    const volUnitInput = document.getElementById('invoiceNewItemVolUnit');
    if (volUnitInput) volUnitInput.value = 'kg';
  }
}

function addNewProductInlineToTable() {
  const name = document.getElementById('invoiceNewItemName').value.trim();
  const unit = document.getElementById('invoiceNewItemUnit').value.trim() || 'packet';
  const volUnit = document.getElementById('invoiceNewItemVolUnit')?.value.trim() || 'kg';
  const isCountable = isItemCountableUnit(unit, volUnit);
  const rawVol = parseFloat(document.getElementById('invoiceNewItemVolume')?.value);
  const unitVol = isCountable ? (rawVol > 0 ? rawVol : 1) : (rawVol || 1);

  if (!name) {
    showToast('Please enter the new product name', 'error');
    return;
  }

  const existingIdx = currentInvoiceItems.findIndex(i => i.productName.toLowerCase() === name.toLowerCase());
  if (existingIdx >= 0) {
    showToast(`"${name}" is already in the invoice table.`, 'error');
    toggleNewProductInlineBox(false);
    return;
  }

  const itemCategory = document.getElementById('invoiceNewItemCategory')?.value || 'Stock';

  const defaultGst = parseFloat(document.getElementById('invoiceBulkGstSelect')?.value) || 0;

  currentInvoiceItems.push({
    inventoryItemId: null, // Indicates brand-new product created on-the-fly
    productName: name,
    itemCategory: itemCategory,
    unit: unit,
    unitVolume: isCountable ? 1 : unitVol,
    volume: isCountable ? 1 : unitVol,
    volumeUnit: volUnit,
    quantity: 1,
    unitPrice: 0,
    gstRate: defaultGst,
    gstAmount: 0,
    totalVolume: isCountable ? 1 : (unitVol * 1),
    costPerVolume: 0,
    totalPrice: 0
  });

  toggleNewProductInlineBox(false);
  renderInvoiceItemsTable();
  recalcInvoiceFinancials();

  // Focus the purchase rate input of the new product
  const newIdx = currentInvoiceItems.length - 1;
  setTimeout(() => {
    const rateInput = document.getElementById(`invItemRate_${newIdx}`);
    if (rateInput) {
      rateInput.focus();
      rateInput.select();
    }
  }, 50);
}

// ─── Editable Table Rows & Real-Time Calculation ────────────────

function renderInvoiceItemsTable() {
  const tbody = document.getElementById('invoiceItemsTableBody');
  if (!tbody) return;

  if (currentInvoiceItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-gray-500 text-xs">No products added. Use the search bar above to quickly add products.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentInvoiceItems.map((it, idx) => {
    const unitVol = it.unitVolume != null ? it.unitVolume : (it.volume != null ? it.volume : 1);
    const volUnit = it.volumeUnit || it.unit || 'kg';
    const qty = it.quantity != null ? it.quantity : 0;
    const unitPrice = it.unitPrice != null ? it.unitPrice : 0;
    const lineSubtotal = Math.round((it.totalPrice || (qty * unitPrice)) * 100) / 100;
    const isCountable = isItemCountableUnit(it.unit, volUnit);
    const totalVol = isCountable ? qty : (Math.round(qty * unitVol * 1000) / 1000);
    const costPerVol = isCountable ? unitPrice : (unitVol > 0 ? (unitPrice / unitVol) : 0);

    const gstRate = it.gstRate != null ? parseFloat(it.gstRate) : 0;
    const lineGst = gstRate > 0 ? Math.round((lineSubtotal * gstRate / 100) * 100) / 100 : 0;
    it.gstAmount = lineGst;
    const lineNetTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;

    const totalVolDisplay = isCountable
      ? `${qty} ${volUnit === 'na' ? (it.unit || 'pcs') : volUnit}`
      : `${totalVol} ${escapeHtml(volUnit)}`;
    const costPerVolDisplay = isCountable
      ? `₹${unitPrice.toFixed(2)} / pc`
      : `₹${costPerVol.toFixed(2)} / ${escapeHtml(volUnit)}`;

    const packUnitsList = ['packet', 'bag', 'box', 'bottle', 'can', 'tin', 'jar', 'piece', 'pieces', 'crate', 'bundle', 'kg', 'ltr', 'meter', 'cm', 'mm', 'inch'];
    const volUnitsList = ['kg', 'g', 'mg', 'ltr', 'ml', 'meter', 'cm', 'mm', 'inch', 'pieces', 'piece', 'na'];
    const volLabelMap = { kg: 'Kg', g: 'G', mg: 'Mg', ltr: 'Ltr', ml: 'Ml', meter: 'Meter', cm: 'Cm', mm: 'Mm', inch: 'Inch', pieces: 'Pieces', piece: 'Piece', na: 'N/A' };

    return `
      <tr class="hover:bg-gray-800/40 transition">
        <td class="py-1.5 px-2.5">
          <span class="font-medium text-white text-xs block">${escapeHtml(it.productName)}</span>
          ${it.inventoryItemId == null ? '<span class="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1 rounded border border-amber-400/30">+ New Item</span>' : ''}
        </td>
        <td class="py-1.5 px-1.5 text-center">
          <select id="invItemCat_${idx}"
            onchange="updateInvoiceRowCategory(${idx}, this.value)"
            class="glass-input px-1 py-1 text-[11px] w-24 text-center text-amber-300 font-medium bg-gray-900 border-gray-700 focus:border-amber-400">
            <option value="Stock" ${(it.itemCategory || 'Stock') === 'Stock' ? 'selected' : ''}>Stock</option>
            <option value="Consumable" ${(it.itemCategory || 'Stock') === 'Consumable' ? 'selected' : ''}>Consumable</option>
            <option value="Small equipment" ${(it.itemCategory || 'Stock') === 'Small equipment' ? 'selected' : ''}>Small eq.</option>
            <option value="Fixed asset" ${(it.itemCategory || 'Stock') === 'Fixed asset' ? 'selected' : ''}>Fixed asset</option>
          </select>
        </td>
        <td class="py-1.5 px-1.5 text-center">
          <input type="number" id="invItemQty_${idx}" min="0.01" step="any" value="${qty}"
            oninput="updateInvoiceRowQty(${idx}, this.value)"
            class="glass-input px-1.5 py-1 text-xs w-16 text-center font-bold text-white bg-gray-900 border-gray-700 focus:border-amber-400" />
        </td>
        <td class="py-1.5 px-1 text-center">
          <select id="invItemUnit_${idx}"
            onchange="updateInvoiceRowUnit(${idx}, this.value)"
            class="glass-input px-1 py-1 text-xs w-20 text-center text-gray-200 bg-gray-900 border-gray-700 focus:border-amber-400">
            ${packUnitsList.map(u => {
      const sel = (it.unit || 'packet').toLowerCase() === u.toLowerCase() ? 'selected' : '';
      return `<option value="${u}" ${sel}>${u.charAt(0).toUpperCase() + u.slice(1)}</option>`;
    }).join('')}
            ${!packUnitsList.includes((it.unit || '').toLowerCase()) && it.unit ? `<option value="${escapeHtml(it.unit)}" selected>${escapeHtml(it.unit)}</option>` : ''}
          </select>
        </td>
        <td class="py-1.5 px-1.5 text-center">
          <input type="number" id="invItemVol_${idx}" min="0.01" step="any" value="${unitVol}"
            oninput="updateInvoiceRowVol(${idx}, this.value)"
            class="glass-input px-1.5 py-1 text-xs w-16 text-center font-bold text-amber-300 bg-gray-900 border-gray-700 focus:border-amber-400" />
        </td>
        <td class="py-1.5 px-1 text-center">
          <select id="invItemVolUnit_${idx}"
            onchange="updateInvoiceRowVolUnit(${idx}, this.value)"
            class="glass-input px-1 py-1 text-xs w-16 text-center font-semibold text-amber-300 bg-gray-900 border-gray-700 focus:border-amber-400">
            ${volUnitsList.map(u => {
      const sel = (volUnit || 'kg').toLowerCase() === u.toLowerCase() ? 'selected' : '';
      const label = volLabelMap[u] || u.toUpperCase();
      return `<option value="${u}" ${sel}>${label}</option>`;
    }).join('')}
            ${!volUnitsList.includes((volUnit || '').toLowerCase()) && volUnit ? `<option value="${escapeHtml(volUnit)}" selected>${escapeHtml(volUnit)}</option>` : ''}
          </select>
        </td>
        <td class="py-1.5 px-2 text-right">
          <input type="number" id="invItemRate_${idx}" min="0" step="any" value="${unitPrice}"
            oninput="updateInvoiceRowRate(${idx}, this.value)"
            class="glass-input px-2 py-1 text-xs w-20 text-right font-bold text-white bg-gray-900 border-gray-700 focus:border-amber-400" />
        </td>
        <td class="py-1.5 px-2 text-center">
          <div class="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-center min-w-[120px]">
            <span id="invItemTotalVolDisplay_${idx}" class="font-bold text-amber-300 block text-[11px]">${totalVolDisplay}</span>
            <span id="invItemCostPerVolDisplay_${idx}" class="text-[10px] text-emerald-400 font-semibold block">${costPerVolDisplay}</span>
          </div>
        </td>
        <td class="py-1.5 px-1.5 text-center">
          <select id="invItemGst_${idx}"
            onchange="updateInvoiceRowGst(${idx}, this.value)"
            class="glass-input px-1.5 py-1 text-xs w-20 text-center font-bold text-amber-300 bg-gray-900 border-gray-700 focus:border-amber-400">
            <option value="0" ${gstRate === 0 ? 'selected' : ''}>0%</option>
            <option value="5" ${gstRate === 5 ? 'selected' : ''}>5%</option>
            <option value="12" ${gstRate === 12 ? 'selected' : ''}>12%</option>
            <option value="18" ${gstRate === 18 ? 'selected' : ''}>18%</option>
            <option value="28" ${gstRate === 28 ? 'selected' : ''}>28%</option>
            ${![0, 5, 12, 18, 28].includes(gstRate) ? `<option value="${gstRate}" selected>${gstRate}%</option>` : ''}
          </select>
          <span id="invItemGstAmountDisplay_${idx}" class="block text-[10px] text-gray-400 mt-0.5">+₹${lineGst.toFixed(2)} tax</span>
        </td>
        <td class="py-1.5 px-2 text-right">
          <span class="font-bold text-emerald-400 text-xs block">₹<span id="invItemLineTotal_${idx}">${lineSubtotal.toFixed(2)}</span></span>
          <span class="text-[9px] text-gray-400 block font-mono">Net: ₹<span id="invItemLineNetTotal_${idx}">${lineNetTotal.toFixed(2)}</span></span>
        </td>
        <td class="py-1.5 px-1.5 text-center">
          <button type="button" onclick="removeInvoiceItemRow(${idx})" class="text-gray-500 hover:text-rose-400 transition" title="Remove">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function recalcRowVolumesAndTotals(idx) {
  const item = currentInvoiceItems[idx];
  if (!item) return;
  const qty = parseFloat(item.quantity) || 0;
  const unitVol = parseFloat(item.unitVolume) || 1;
  const volUnit = item.volumeUnit || item.unit || 'kg';
  const unitPrice = parseFloat(item.unitPrice) || 0;
  const isCountable = isItemCountableUnit(item.unit, volUnit);

  const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
  const totalVol = isCountable ? qty : (Math.round(qty * unitVol * 1000) / 1000);
  const costPerVol = isCountable ? unitPrice : (unitVol > 0 ? (unitPrice / unitVol) : 0);

  const gstRate = item.gstRate != null ? parseFloat(item.gstRate) : 0;
  const lineGst = gstRate > 0 ? Math.round((lineSubtotal * gstRate / 100) * 100) / 100 : 0;
  const lineNetTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;

  item.totalPrice = lineSubtotal;
  item.gstAmount = lineGst;
  item.totalVolume = totalVol;
  item.costPerVolume = Math.round(costPerVol * 100) / 100;

  const lineSpan = document.getElementById(`invItemLineTotal_${idx}`);
  if (lineSpan) lineSpan.textContent = lineSubtotal.toFixed(2);

  const lineNetSpan = document.getElementById(`invItemLineNetTotal_${idx}`);
  if (lineNetSpan) lineNetSpan.textContent = lineNetTotal.toFixed(2);

  const lineGstSpan = document.getElementById(`invItemGstAmountDisplay_${idx}`);
  if (lineGstSpan) lineGstSpan.textContent = `+₹${lineGst.toFixed(2)} tax`;

  const volSpan = document.getElementById(`invItemTotalVolDisplay_${idx}`);
  if (volSpan) {
    volSpan.textContent = isCountable
      ? `${qty} ${volUnit === 'na' ? (item.unit || 'pcs') : volUnit}`
      : `${totalVol} ${volUnit}`;
  }

  const costPerVolSpan = document.getElementById(`invItemCostPerVolDisplay_${idx}`);
  if (costPerVolSpan) {
    costPerVolSpan.textContent = isCountable
      ? `₹${unitPrice.toFixed(2)} / pc`
      : `₹${costPerVol.toFixed(2)} / ${volUnit}`;
  }

  recalcInvoiceFinancials();
}

function updateInvoiceRowCategory(idx, val) {
  if (currentInvoiceItems[idx]) {
    currentInvoiceItems[idx].itemCategory = val;
  }
}

function updateInvoiceRowQty(idx, val) {
  currentInvoiceItems[idx].quantity = parseFloat(val) || 0;
  recalcRowVolumesAndTotals(idx);
}

function updateInvoiceRowVol(idx, val) {
  const v = parseFloat(val) || 1;
  currentInvoiceItems[idx].unitVolume = v;
  currentInvoiceItems[idx].volume = v;
  recalcRowVolumesAndTotals(idx);
}

function updateInvoiceRowVolUnit(idx, val) {
  const item = currentInvoiceItems[idx];
  if (!item) return;
  item.volumeUnit = val.trim();
  const vuLower = item.volumeUnit.toLowerCase();
  if (['na', 'piece', 'pieces'].includes(vuLower)) {
    if (!item.unitVolume || item.unitVolume <= 0) {
      item.unitVolume = 1;
      item.volume = 1;
      const volInput = document.getElementById(`invItemVol_${idx}`);
      if (volInput) volInput.value = '1';
    }
  }
  recalcRowVolumesAndTotals(idx);
}

function updateInvoiceRowUnit(idx, val) {
  const item = currentInvoiceItems[idx];
  if (!item) return;
  item.unit = val.trim();
  const uLower = item.unit.toLowerCase();
  if (['piece', 'pieces'].includes(uLower)) {
    if (['kg', 'ltr', 'g', 'ml'].includes((item.volumeUnit || '').toLowerCase())) {
      item.volumeUnit = 'pieces';
      item.unitVolume = 1;
      item.volume = 1;
      const volInput = document.getElementById(`invItemVol_${idx}`);
      if (volInput) volInput.value = '1';
      const volUnitSelect = document.getElementById(`invItemVolUnit_${idx}`);
      if (volUnitSelect) volUnitSelect.value = 'pieces';
    }
  } else if (['meter', 'cm', 'mm', 'inch'].includes(uLower)) {
    item.volumeUnit = uLower;
    const volUnitSelect = document.getElementById(`invItemVolUnit_${idx}`);
    if (volUnitSelect) volUnitSelect.value = uLower;
  }
  recalcRowVolumesAndTotals(idx);
}

function updateInvoiceRowRate(idx, val) {
  currentInvoiceItems[idx].unitPrice = parseFloat(val) || 0;
  recalcRowVolumesAndTotals(idx);
}

function updateInvoiceRowGst(idx, val) {
  if (currentInvoiceItems[idx]) {
    currentInvoiceItems[idx].gstRate = parseFloat(val) || 0;
    const gstSelect = document.getElementById('invoiceGstRateSelect');
    if (gstSelect && gstSelect.value !== 'CUSTOM') {
      gstSelect.value = 'AUTO';
    }
    recalcRowVolumesAndTotals(idx);
  }
}

function applyBulkGstToAllItems() {
  const bulkVal = parseFloat(document.getElementById('invoiceBulkGstSelect')?.value) || 0;
  if (!currentInvoiceItems.length) {
    showToast('Add products first before applying bulk GST', 'info');
    return;
  }
  currentInvoiceItems.forEach(it => {
    it.gstRate = bulkVal;
  });
  const gstSelect = document.getElementById('invoiceGstRateSelect');
  if (gstSelect && ['0', '5', '12', '18', '28'].includes(String(bulkVal))) {
    gstSelect.value = String(bulkVal);
  }
  renderInvoiceItemsTable();
  recalcInvoiceFinancials();
  showToast(`Applied ${bulkVal}% GST to all ${currentInvoiceItems.length} products`, 'info');
}

function removeInvoiceItemRow(idx) {
  currentInvoiceItems.splice(idx, 1);
  renderInvoiceItemsTable();
  recalcInvoiceFinancials();
}

// ─── Financial Calculations, GST & Total Mismatch ───────────────

function recalcInvoiceFinancials(fromManualTotal = false) {
  let subtotal = 0;
  let totalItemGst = 0;
  const gstBreakdown = {}; // rate -> { base, gst }

  currentInvoiceItems.forEach(it => {
    const qty = parseFloat(it.quantity) || 0;
    const unitPrice = parseFloat(it.unitPrice) || 0;
    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    it.totalPrice = lineSubtotal;
    const rate = it.gstRate != null ? parseFloat(it.gstRate) : 0;
    const lineGst = rate > 0 ? Math.round((lineSubtotal * rate / 100) * 100) / 100 : 0;
    it.gstAmount = lineGst;

    subtotal += lineSubtotal;
    totalItemGst += lineGst;

    if (!gstBreakdown[rate]) {
      gstBreakdown[rate] = { base: 0, gst: 0 };
    }
    gstBreakdown[rate].base += lineSubtotal;
    gstBreakdown[rate].gst += lineGst;
  });

  const subtotalRound = Math.round(subtotal * 100) / 100;
  const totalItemGstRound = Math.round(totalItemGst * 100) / 100;

  const subtotalDisplay = document.getElementById('invoiceSubtotalDisplay');
  if (subtotalDisplay) subtotalDisplay.textContent = `₹${subtotalRound.toFixed(2)}`;

  // GST Calculation
  const gstSelect = document.getElementById('invoiceGstRateSelect');
  const gstAmountInput = document.getElementById('invoiceGstAmountInput');
  let finalGstAmount = totalItemGstRound;

  if (gstSelect && gstAmountInput) {
    const selVal = gstSelect.value;
    if (selVal === 'CUSTOM') {
      finalGstAmount = parseFloat(gstAmountInput.value) || 0;
    } else {
      gstAmountInput.value = totalItemGstRound.toFixed(2);
      finalGstAmount = totalItemGstRound;
    }
  }

  // Update GST breakdown badge in UI
  const breakdownEl = document.getElementById('invoiceGstBreakdownBadge');
  if (breakdownEl) {
    const rates = Object.keys(gstBreakdown).map(Number).sort((a, b) => a - b);
    if (rates.length > 0 && totalItemGstRound > 0) {
      const parts = rates.filter(r => gstBreakdown[r].base > 0).map(r =>
        `<span class="px-2 py-0.5 rounded bg-gray-900 border border-gray-700 font-mono text-[10px] text-amber-300">GST ${r}%: ₹${gstBreakdown[r].gst.toFixed(2)} (on ₹${gstBreakdown[r].base.toFixed(2)})</span>`
      );
      breakdownEl.innerHTML = `<span class="text-gray-400 text-[10px] font-semibold uppercase mr-1"><i class="fa-solid fa-receipt mr-1"></i>Slabs:</span>` + parts.join(' ');
      breakdownEl.classList.remove('hidden');
    } else {
      breakdownEl.classList.add('hidden');
    }
  }

  // Adjustments
  const otherCharges = parseFloat(document.getElementById('invoiceOtherChargesInput')?.value) || 0;
  const discount = parseFloat(document.getElementById('invoiceDiscountInput')?.value) || 0;

  const calculatedTotal = Math.round((subtotalRound + finalGstAmount + otherCharges - discount) * 100) / 100;

  const totalInput = document.getElementById('invoiceTotal');
  if (!fromManualTotal && totalInput) {
    totalInput.value = calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '0.00';
  }

  // Mismatch Validation
  checkInvoiceTotalMismatch(calculatedTotal);
}

function onInvoiceGstRateChange() {
  const gstSelect = document.getElementById('invoiceGstRateSelect');
  if (!gstSelect) return;
  const val = gstSelect.value;
  if (['0', '5', '12', '18', '28'].includes(val)) {
    const rateNum = parseFloat(val);
    currentInvoiceItems.forEach(it => {
      it.gstRate = rateNum;
    });
    renderInvoiceItemsTable();
  }
  recalcInvoiceFinancials();
}

function onInvoiceGstAmountInput() {
  const gstSelect = document.getElementById('invoiceGstRateSelect');
  if (gstSelect) gstSelect.value = 'CUSTOM';
  recalcInvoiceFinancials();
}

function onInvoiceTotalManualInput() {
  recalcInvoiceFinancials(true);
}

function checkInvoiceTotalMismatch(expectedTotal) {
  const enteredTotal = parseFloat(document.getElementById('invoiceTotal')?.value) || 0;
  const badge = document.getElementById('invoiceMismatchBadge');
  const hint = document.getElementById('invoiceMismatchHint');
  if (!badge || !hint) return;

  const diff = Math.round((enteredTotal - expectedTotal) * 100) / 100;
  if (enteredTotal > 0 && Math.abs(diff) > 0.05) {
    badge.classList.remove('hidden');
    hint.innerHTML = `Calculated: ₹${expectedTotal.toFixed(2)} (Difference: <span class="font-bold">${diff > 0 ? '+₹' : '-₹'}${Math.abs(diff).toFixed(2)}</span>). <button type="button" onclick="syncCalculatedTotal(${expectedTotal})" class="underline text-amber-400 font-bold ml-1 hover:text-amber-300">Set to ₹${expectedTotal.toFixed(2)}</button>`;
    hint.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    hint.classList.add('hidden');
  }
}

function syncCalculatedTotal(expectedTotal) {
  const totalInput = document.getElementById('invoiceTotal');
  if (totalInput) totalInput.value = expectedTotal.toFixed(2);
  checkInvoiceTotalMismatch(expectedTotal);
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.add('hidden');
}

async function saveInvoice(event) {
  event.preventDefault();
  const errEl = document.getElementById('invoiceFormError');
  errEl.classList.add('hidden');
  const id = document.getElementById('invoiceId').value;

  const supplierId = parseInt(document.getElementById('invoiceSupplierId').value);
  if (!supplierId) {
    errEl.textContent = 'Please select a supplier.';
    errEl.classList.remove('hidden');
    return;
  }

  const invoiceNumber = document.getElementById('invoiceNumber').value.trim();
  if (!invoiceNumber) {
    errEl.textContent = 'Invoice number is required.';
    errEl.classList.remove('hidden');
    return;
  }

  if (currentInvoiceItems.length === 0) {
    errEl.textContent = 'Please add at least one product to the invoice.';
    errEl.classList.remove('hidden');
    return;
  }

  // Validate items
  for (const it of currentInvoiceItems) {
    if (!it.quantity || it.quantity <= 0) {
      errEl.textContent = `Invalid quantity for "${it.productName}". Must be greater than 0.`;
      errEl.classList.remove('hidden');
      return;
    }
    if (it.unitPrice == null || it.unitPrice < 0) {
      errEl.textContent = `Invalid price for "${it.productName}". Cannot be negative.`;
      errEl.classList.remove('hidden');
      return;
    }
  }

  const subtotal = currentInvoiceItems.reduce((acc, it) => acc + (it.totalPrice || (it.quantity * it.unitPrice)), 0);
  const gstRateVal = document.getElementById('invoiceGstRateSelect')?.value;
  const gstAmount = parseFloat(document.getElementById('invoiceGstAmountInput')?.value) || 0;
  let gstRate = 0;
  if (gstRateVal !== 'CUSTOM' && gstRateVal !== 'AUTO' && gstRateVal !== '0') {
    gstRate = parseFloat(gstRateVal) || 0;
  } else if (subtotal > 0 && gstAmount > 0) {
    gstRate = Math.round((gstAmount / subtotal) * 10000) / 100;
  }
  const otherCharges = parseFloat(document.getElementById('invoiceOtherChargesInput')?.value) || 0;
  const discount = parseFloat(document.getElementById('invoiceDiscountInput')?.value) || 0;
  const totalAmount = parseFloat(document.getElementById('invoiceTotal')?.value);

  const calculatedTotal = Math.round((subtotal + gstAmount + otherCharges - discount) * 100) / 100;
  if (Math.abs(totalAmount - calculatedTotal) > 0.05) {
    errEl.innerHTML = `Invoice total does not match calculation: Entered ₹${totalAmount.toFixed(2)}, but Subtotal + GST + Charges - Discount is ₹${calculatedTotal.toFixed(2)}. <button type="button" onclick="syncCalculatedTotal(${calculatedTotal})" class="underline font-bold text-amber-400">Click to use ₹${calculatedTotal.toFixed(2)}</button>`;
    errEl.classList.remove('hidden');
    return;
  }

  const itemsSummary = currentInvoiceItems.map(i => `${i.productName} x${i.quantity} ${i.unit} (${i.gstRate || 0}% GST)`).join(', ');

  const body = {
    supplierId: supplierId,
    invoiceNumber: invoiceNumber,
    invoiceDate: document.getElementById('invoiceDate').value,
    dueDate: document.getElementById('invoiceDueDate').value || null,
    subtotal: subtotal,
    gstRate: gstRate,
    gstAmount: gstAmount,
    otherCharges: otherCharges,
    discount: discount,
    totalAmount: totalAmount,
    description: document.getElementById('invoiceDescription').value.trim(),
    itemsReceived: itemsSummary,
    items: currentInvoiceItems
  };

  try {
    if (id) {
      await apiRequest(`/suppliers/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Invoice updated successfully', 'success');
    } else {
      await apiRequest('/suppliers/invoices', { method: 'POST', body: JSON.stringify(body) });
      showToast('Invoice saved & inventory stock automatically updated', 'success');
    }
    closeInvoiceModal();
    loadSupplierInvoices();
    loadInventoryData();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice? This cannot be undone if no payments exist.')) return;
  try {
    await apiRequest(`/suppliers/invoices/${id}`, { method: 'DELETE' });
    showToast('Invoice deleted', 'success');
    loadSupplierInvoices();
  } catch (e) { showToast(e.message, 'error'); }
}

async function viewInvoicePayments(invoiceId) {
  try {
    const payments = await apiRequest(`/suppliers/invoices/${invoiceId}/payments`);
    const inv = allInvoices.find(i => i.id === invoiceId);
    const info = inv ? `Invoice ${inv.invoiceNumber} — ${fmtINR(inv.totalAmount)} total` : '';
    if (!payments.length) {
      alert(`${info}\n\nNo payments recorded yet.`);
      return;
    }
    const lines = payments.map(p =>
      `${fmtDate(p.paymentDate)}  ${fmtINR(p.amount).padEnd(12)}  ${p.paymentMode}  ${p.referenceNumber || ''}`
    ).join('\n');
    alert(`${info}\n\nPayment History:\n${'─'.repeat(60)}\n${lines}`);
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Payment CRUD ──
async function loadAllPayments() {
  try {
    const supplierId = document.getElementById('paymentSupplierFilter')?.value || '';
    const payments = supplierId
      ? await apiRequest(`/suppliers/${supplierId}/payments`)
      : await apiRequest('/suppliers/payments');
    renderPaymentTable(payments);
  } catch (e) {
    document.getElementById('paymentTableBody').innerHTML =
      `<tr><td colspan="7" class="p-4 text-center text-rose-400 text-xs">${e.message}</td></tr>`;
  }
}

function renderPaymentTable(payments) {
  const tbody = document.getElementById('paymentTableBody');
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-500 text-xs">No payments recorded.</td></tr>';
    return;
  }
  tbody.innerHTML = payments.map(p => `
    <tr class="hover:bg-gray-800/30 transition">
      <td class="p-3">${fmtDate(p.paymentDate)}</td>
      <td class="p-3 font-semibold">${p.supplierName || '-'}</td>
      <td class="p-3 font-mono text-amber-300">${p.invoiceNumber || '-'}</td>
      <td class="p-3 text-right font-bold text-emerald-400">${fmtINR(p.amount)}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">${p.paymentMode}</span></td>
      <td class="p-3 text-gray-400">${p.referenceNumber || '-'}</td>
      <td class="p-3 text-right">
        ${currentUser.role === 'ADMIN' ? `<button onclick="deletePayment(${p.id})" class="px-2 py-1 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20">Reverse</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function openPaymentModal(preselectedInvoiceId = null) {
  // Populate outstanding invoices
  if (!allInvoices.length) {
    // load invoices first
    apiRequest('/suppliers/invoices').then(invs => {
      allInvoices = invs;
      populatePaymentInvoiceDropdown(invs);
      _openPaymentModalInner(preselectedInvoiceId);
    });
  } else {
    populatePaymentInvoiceDropdown();
    _openPaymentModalInner(preselectedInvoiceId);
  }
}

function _openPaymentModalInner(preselectedInvoiceId) {
  document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentRef').value = '';
  document.getElementById('paymentNotes').value = '';
  document.getElementById('paymentFormError').classList.add('hidden');
  document.getElementById('paymentInvoiceInfo').classList.add('hidden');
  if (preselectedInvoiceId) {
    document.getElementById('paymentInvoiceId').value = preselectedInvoiceId;
    onPaymentInvoiceChange();
  }
  document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
}

function onPaymentInvoiceChange() {
  const invoiceId = parseInt(document.getElementById('paymentInvoiceId').value);
  const inv = allInvoices.find(i => i.id === invoiceId);
  const infoPanel = document.getElementById('paymentInvoiceInfo');
  if (inv) {
    document.getElementById('piTotal').textContent = fmtINR(inv.totalAmount);
    document.getElementById('piPaid').textContent = fmtINR(inv.paidAmount);
    document.getElementById('piOutstanding').textContent = fmtINR(inv.outstandingAmount);
    document.getElementById('paymentAmount').value = inv.outstandingAmount.toFixed(2);
    infoPanel.classList.remove('hidden');
  } else {
    infoPanel.classList.add('hidden');
  }
}

function quickPay(invoiceId) {
  showSupplierSubTab('payments');
  openPaymentModal(invoiceId);
}

async function savePayment(event) {
  event.preventDefault();
  const errEl = document.getElementById('paymentFormError');
  errEl.classList.add('hidden');
  const body = {
    invoiceId: parseInt(document.getElementById('paymentInvoiceId').value),
    paymentDate: document.getElementById('paymentDate').value,
    amount: parseFloat(document.getElementById('paymentAmount').value),
    paymentMode: document.getElementById('paymentMode').value,
    referenceNumber: document.getElementById('paymentRef').value.trim(),
    notes: document.getElementById('paymentNotes').value.trim(),
  };
  try {
    await apiRequest('/suppliers/payments', { method: 'POST', body: JSON.stringify(body) });
    showToast('Payment recorded successfully!', 'success');
    closePaymentModal();
    loadAllPayments();
    loadSupplierInvoices();
    loadSuppliersData();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function deletePayment(id) {
  if (!confirm('Reverse this payment? The outstanding balance will be restored.')) return;
  try {
    await apiRequest(`/suppliers/payments/${id}`, { method: 'DELETE' });
    showToast('Payment reversed', 'success');
    loadAllPayments();
    loadSupplierInvoices();
    loadSuppliersData();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Analytics ──
async function loadSupplierAnalytics() {
  try {
    const data = await apiRequest('/suppliers/analytics');

    // KPI cards
    document.getElementById('kpiOutstanding').textContent = fmtINR(data.totalOutstanding);
    document.getElementById('kpiOverdue').textContent = data.overdueInvoiceCount;
    document.getElementById('kpiPaidMonth').textContent = fmtINR(data.totalPaidThisMonth);
    document.getElementById('kpiSupplierCount').textContent = data.activeSupplierCount;

    try { await ensureChartJs(); } catch (e) { console.warn(e.message); return; }
    // Destroy old charts
    Object.values(supplierCharts).forEach(c => { if (c) c.destroy(); });
    supplierCharts = {};

    // Chart 1: Outstanding by supplier (bar)
    if (data.outstandingBySupplier?.length) {
      const ctx = document.getElementById('outstandingChart').getContext('2d');
      supplierCharts.outstanding = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.outstandingBySupplier.map(r => r.supplierName),
          datasets: [{
            label: 'Outstanding (₹)',
            data: data.outstandingBySupplier.map(r => r.outstanding),
            backgroundColor: 'rgba(251, 113, 133, 0.5)',
            borderColor: '#fb7185',
            borderWidth: 1,
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } } }
      });
    }

    // Chart 2: Monthly payment trend (line)
    if (data.monthlyPaymentTrend?.length) {
      const ctx = document.getElementById('paymentTrendChart').getContext('2d');
      supplierCharts.trend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.monthlyPaymentTrend.map(r => r.month),
          datasets: [{
            label: 'Paid (₹)',
            data: data.monthlyPaymentTrend.map(r => r.paid),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } } }
      });
    }

    // Chart 3: Payment mode (doughnut)
    if (data.paymentModeBreakdown && Object.keys(data.paymentModeBreakdown).length) {
      const ctx = document.getElementById('paymentModeChart').getContext('2d');
      const modeColors = { CASH: '#f59e0b', UPI: '#60a5fa', BANK_TRANSFER: '#a78bfa', CHEQUE: '#34d399' };
      supplierCharts.mode = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data.paymentModeBreakdown),
          datasets: [{
            data: Object.values(data.paymentModeBreakdown),
            backgroundColor: Object.keys(data.paymentModeBreakdown).map(k => modeColors[k] || '#6b7280'),
          }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#d1d5db' } } } }
      });
    }

    // Chart 4: Top suppliers by invoice (horizontal bar)
    if (data.topSuppliersByInvoice?.length) {
      const ctx = document.getElementById('topSuppliersChart').getContext('2d');
      supplierCharts.top = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.topSuppliersByInvoice.map(r => r.supplierName),
          datasets: [{
            label: 'Total Invoiced (₹)',
            data: data.topSuppliersByInvoice.map(r => r.totalInvoiced),
            backgroundColor: 'rgba(167, 139, 250, 0.5)',
            borderColor: '#a78bfa',
            borderWidth: 1,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } }
        }
      });
    }
  } catch (e) {
    showToast('Failed to load supplier analytics: ' + e.message, 'error');
  }
}

// ============================================================
// 7-MEASURE ACCOUNTING PROFIT REPORT (Feature 5)
// ============================================================
function renderAccountingProfitReport(p) {
  if (!p) return;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('profNetSales', `₹${Number(p.netSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  setEl('profGrossSales', `₹${Number(p.grossSales || 0).toFixed(0)}`);
  setEl('profRefunds', `₹${Number(p.totalRefunds || 0).toFixed(0)}`);

  setEl('profTotalCogs', `₹${Number(p.cogs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  setEl('profIngrCost', `₹${Number(p.ingredientConsumptionCost || 0).toFixed(0)}`);
  setEl('profWasteCost', `₹${Number(p.wasteCost || 0).toFixed(0)}`);

  setEl('profGrossProfit', `₹${Number(p.grossProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  setEl('profGrossMargin', `${Number(p.grossMarginPercentage || 0).toFixed(1)}% Margin`);

  setEl('profOpEx', `₹${Number(p.operatingExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  setEl('profPayroll', `₹${Number(p.payrollExpense || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

  const elNet = document.getElementById('profNetOperatingProfit');
  if (elNet) {
    const net = Number(p.netOperatingProfit || 0);
    elNet.textContent = `₹${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    elNet.className = net >= 0 ? 'text-xl font-black text-emerald-400' : 'text-xl font-black text-rose-400';
  }
  setEl('profNetOperatingMargin', `${Number(p.netOperatingMarginPercentage || 0).toFixed(1)}% Net Margin`);

  const elCash = document.getElementById('profNetCashFlow');
  if (elCash) {
    const cf = Number(p.netCashFlow || 0);
    elCash.textContent = `₹${cf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    elCash.className = cf >= 0 ? 'text-xl font-black text-blue-400' : 'text-xl font-black text-amber-400';
  }
  setEl('profCashIn', `₹${Number(p.totalCashIn || 0).toFixed(0)}`);
  setEl('profCashOut', `₹${Number(p.totalCashOut || 0).toFixed(0)}`);
}

// ============================================================
