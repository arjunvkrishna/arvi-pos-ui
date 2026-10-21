// NERAM POS - on-demand module: Business analytics and drawer analysis
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 7: WEEKLY ANALYTICS (MOVING DISHES GRAPH)
// ============================================================
// TAB 7: COMPREHENSIVE BUSINESS ANALYTICS & FINANCIAL CONTROL
// ============================================================
let currentAnalyticsPeriod = 'THIS_MONTH';
let analyticsCustomStart = '';
let analyticsCustomEnd = '';
let currentDrillDownTab = 'sales';
let comprehensiveAnalyticsData = null;

let salesTrendChartInstance = null;
let expenseDonutChartInstance = null;
let cashFlowChartInstance = null;

function setAnalyticsPeriod(period) {
  currentAnalyticsPeriod = period;

  // Update pill styles
  const allPeriods = ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM'];
  allPeriods.forEach(p => {
    const el = document.getElementById(`pill-${p}`);
    if (el) {
      if (p === period) {
        el.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-gray-950 font-bold active-period transition';
      } else {
        el.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition';
      }
    }
  });

  const customBox = document.getElementById('analyticsCustomDateBox');
  if (period === 'CUSTOM') {
    if (customBox) customBox.classList.remove('hidden');
    // Pre-fill dates if empty
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    if (!document.getElementById('analyticsStartDate').value) document.getElementById('analyticsStartDate').value = thirtyDaysAgo;
    if (!document.getElementById('analyticsEndDate').value) document.getElementById('analyticsEndDate').value = today;
  } else {
    if (customBox) customBox.classList.add('hidden');
    loadComprehensiveAnalytics(period);
  }
}

function applyCustomAnalyticsDate() {
  const start = document.getElementById('analyticsStartDate').value;
  const end = document.getElementById('analyticsEndDate').value;
  if (!start || !end) {
    showToast('Please select both start and end date', 'warning');
    return;
  }
  if (start > end) {
    showToast('Start date must be before or equal to end date', 'warning');
    return;
  }
  analyticsCustomStart = start;
  analyticsCustomEnd = end;
  loadComprehensiveAnalytics('CUSTOM', start, end);
}

function refreshComprehensiveAnalytics() {
  loadComprehensiveAnalytics(currentAnalyticsPeriod, analyticsCustomStart, analyticsCustomEnd);
}

/**
 * Exports Comprehensive Business Analytics based on the currently selected period (Today, Month, Custom, etc.)
 * Restricted to ADMIN and MANAGER roles.
 */
async function exportAnalyticsReport(format = 'pdf') {
  if (!currentUser || !['ADMIN', 'MANAGER'].includes(currentUser.role)) {
    showToast('Unauthorized: Only Admin and Manager can export analytics reports.', 'error');
    return;
  }

  const period = currentAnalyticsPeriod || 'THIS_MONTH';
  const start = (period === 'CUSTOM') ? (analyticsCustomStart || document.getElementById('analyticsStartDate')?.value || '') : '';
  const end = (period === 'CUSTOM') ? (analyticsCustomEnd || document.getElementById('analyticsEndDate')?.value || '') : '';

  if (period === 'CUSTOM' && (!start || !end)) {
    showToast('Please specify both start and end date for custom export', 'warning');
    return;
  }

  const isExcel = format.toLowerCase() === 'excel';
  const formatUpper = isExcel ? 'Excel' : 'PDF';
  const endpoint = isExcel ? '/analytics/export/excel' : '/analytics/export/pdf';
  let url = `${API_BASE_URL}${endpoint}?period=${encodeURIComponent(period)}`;
  if (start && end) {
    url += `&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
  }

  const btnId = isExcel ? 'btnExportAnalyticsExcel' : 'btnExportAnalyticsPdf';
  const btn = document.getElementById(btnId);
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating ${formatUpper}...`;
  }

  try {
    showToast(`Generating ${formatUpper} analytics report for ${period}...`, 'info');
    const headers = {};
    if (currentUser && currentUser.token) {
      headers['Authorization'] = `Bearer ${currentUser.token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Access denied: You do not have permission to export analytics.');
      }
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Export failed (${res.status}): ${errText}`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `NERAM_Analytics_${period}_${new Date().toISOString().split('T')[0]}.${isExcel ? 'xlsx' : 'pdf'}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    // Trigger file download
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();

    showToast(`Analytics ${formatUpper} report downloaded successfully!`, 'success');
  } catch (err) {
    console.error(`Export ${formatUpper} failed:`, err);
    showToast(`Export failed: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

// Fallback for legacy callers
async function loadAnalytics() {
  await loadComprehensiveAnalytics();
}

async function loadComprehensiveAnalytics(period = currentAnalyticsPeriod, start = analyticsCustomStart, end = analyticsCustomEnd) {
  try {
    let url = `/analytics/comprehensive?period=${encodeURIComponent(period)}`;
    if (period === 'CUSTOM' && start && end) {
      url += `&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
    }
    const data = await apiRequest(url);
    comprehensiveAnalyticsData = data;
    renderComprehensiveAnalytics(data);
  } catch (err) {
    console.error('Failed to load comprehensive analytics:', err);
    showToast('Failed to load analytics: ' + err.message, 'error');
  }

  // Load 7-Measure Accounting Profit Statement
  try {
    let pUrl = '/analytics/comprehensive-profit';
    if (period === 'CUSTOM' && start && end) {
      pUrl += `?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
    }
    const pData = await apiRequest(pUrl);
    renderAccountingProfitReport(pData);
  } catch (pErr) {
    console.warn('Accounting profit report error:', pErr);
  }
}

function renderComprehensiveAnalytics(data) {
  if (!data) return;

  // 1. Period Label
  const pLabel = document.getElementById('analyticsPeriodLabel');
  if (pLabel && data.periodInfo) {
    pLabel.textContent = `${data.periodInfo.startDate} to ${data.periodInfo.endDate}`;
  }

  // 2. Overview KPI Cards
  const kpis = data.kpis || {};

  // Sales
  const elSales = document.getElementById('kpiTotalSales');
  if (elSales) elSales.textContent = `₹${(kpis.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const elGrowth = document.getElementById('kpiSalesGrowthBadge');
  if (elGrowth) {
    const growth = kpis.salesGrowthPercent || 0;
    const sign = growth >= 0 ? '+' : '';
    elGrowth.textContent = `${sign}${growth}% vs prev`;
    elGrowth.className = growth >= 0
      ? 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400'
      : 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400';
  }

  const elOrders = document.getElementById('kpiOrdersCount');
  if (elOrders) elOrders.textContent = `${kpis.totalOrders || 0} Orders`;

  // Expenses
  const elExpenses = document.getElementById('kpiTotalExpenses');
  if (elExpenses) elExpenses.textContent = `₹${(kpis.totalExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const elOpEx = document.getElementById('kpiOpEx');
  if (elOpEx) elOpEx.textContent = `₹${(kpis.totalOperatingExpenses || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const elSalaries = document.getElementById('kpiSalaries');
  if (elSalaries) elSalaries.textContent = `₹${(kpis.totalSalariesPaid || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const elPurchases = document.getElementById('kpiPurchases');
  if (elPurchases) elPurchases.textContent = `₹${(kpis.totalSupplierPurchases || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const elSuppPaid = document.getElementById('kpiSupplierPaid');
  if (elSuppPaid) elSuppPaid.textContent = `₹${(kpis.totalSupplierPayments || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // Net Profit
  const elNet = document.getElementById('kpiNetProfit');
  if (elNet) {
    const net = kpis.netProfit || 0;
    elNet.textContent = `₹${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    elNet.className = net >= 0 ? 'text-2xl font-black text-emerald-400 mt-2' : 'text-2xl font-black text-rose-400 mt-2';
  }

  const elGross = document.getElementById('kpiGrossProfit');
  if (elGross) elGross.textContent = `₹${(kpis.grossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // Inventory & Avg Order
  const elInv = document.getElementById('kpiInventoryValuation');
  if (elInv) elInv.textContent = `₹${(kpis.inventoryValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const elAvg = document.getElementById('kpiAvgOrder');
  if (elAvg) elAvg.textContent = `₹${(kpis.avgOrderValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;

  const elLowStock = document.getElementById('kpiLowStockAlertBadge');
  if (elLowStock) {
    const count = kpis.lowStockCount || 0;
    elLowStock.textContent = `${count} Low Stock`;
    elLowStock.className = count > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-medium';
  }

  // 3. Render Visual Charts
  renderAnalyticsSalesTrendChart(data.salesTrend || []);
  renderAnalyticsExpenseDonutChart(data.expenseBreakdown || []);
  renderAnalyticsCashFlowChart(data.cashFlowTrend || []);

  // 4. Render Top Selling Menu Items Leaderboard
  renderAnalyticsTopDishesList(data.topSellingDishes || []);

  // 5. Render Supplier Spending Table
  renderAnalyticsSupplierSpendTable(data.supplierSpending || []);

  // 6. Render Purchased Products Table
  renderAnalyticsPurchasedProductsTable(data.topPurchasedProducts || []);

  // 7. Render Drill-Down Source Records
  renderAnalyticsDrillDown(data.drillDown || {});
}

async function renderAnalyticsSalesTrendChart(trend) {
  if (!document.getElementById('analyticsSalesTrendChart')) return;
  try { await ensureChartJs(); } catch (e) { console.warn(e.message); return; }
  const canvas = document.getElementById('analyticsSalesTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = trend.map(t => t.label);
  const sales = trend.map(t => t.sales);
  const orders = trend.map(t => t.orders);

  if (salesTrendChartInstance) {
    salesTrendChartInstance.destroy();
  }

  salesTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sales Revenue (₹)',
          data: sales,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10b981',
          yAxisID: 'y'
        },
        {
          label: 'Order Count',
          data: orders,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (context) {
              if (context.dataset.yAxisID === 'y') {
                return `Sales: ₹${context.raw.toLocaleString('en-IN')}`;
              }
              return `Orders: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          ticks: { color: '#9ca3af', callback: v => '₹' + v },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { color: '#9ca3af', precision: 0 }
        },
        x: {
          ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 0, font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

async function renderAnalyticsExpenseDonutChart(breakdown) {
  if (!document.getElementById('analyticsExpenseDonutChart')) return;
  try { await ensureChartJs(); } catch (e) { console.warn(e.message); return; }
  const canvas = document.getElementById('analyticsExpenseDonutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (expenseDonutChartInstance) {
    expenseDonutChartInstance.destroy();
  }

  if (breakdown.length === 0) {
    breakdown = [{ category: 'No Expenses Recorded', amount: 1 }];
  }

  const labels = breakdown.map(b => b.category);
  const amounts = breakdown.map(b => b.amount);
  const colors = [
    '#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
    '#06b6d4', '#ec4899', '#eab308', '#64748b'
  ];

  expenseDonutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#111827'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.raw || 0;
              return `${context.label}: ₹${val.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

async function renderAnalyticsCashFlowChart(trend) {
  if (!document.getElementById('analyticsCashFlowChart')) return;
  try { await ensureChartJs(); } catch (e) { console.warn(e.message); return; }
  const canvas = document.getElementById('analyticsCashFlowChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = trend.map(t => t.label);
  const moneyIn = trend.map(t => t.moneyIn);
  const moneyOut = trend.map(t => t.moneyOut);

  if (cashFlowChartInstance) {
    cashFlowChartInstance.destroy();
  }

  cashFlowChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Money In (Sales)',
          data: moneyIn,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Money Out (Expenses + Invoices)',
          data: moneyOut,
          backgroundColor: 'rgba(244, 63, 94, 0.75)',
          borderColor: '#f43f5e',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ₹${(context.raw || 0).toLocaleString('en-IN')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#9ca3af', callback: v => '₹' + v },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        x: {
          ticks: { color: '#9ca3af', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderAnalyticsTopDishesList(dishes) {
  const container = document.getElementById('analyticsTopDishesList');
  if (!container) return;

  if (dishes.length === 0) {
    container.innerHTML = `<p class="text-center py-8 text-gray-500 text-xs">No orders recorded in this period</p>`;
    return;
  }

  container.innerHTML = dishes.map((d, index) => `
    <div class="flex items-center justify-between p-2.5 rounded-lg bg-gray-900/60 border border-gray-800 text-xs">
      <div class="flex items-center space-x-3">
        <span class="w-5 h-5 rounded-full ${index === 0 ? 'bg-yellow-400 text-gray-950 font-bold' : index === 1 ? 'bg-gray-300 text-gray-950 font-bold' : index === 2 ? 'bg-amber-600 text-white font-bold' : 'bg-gray-800 text-gray-400'} flex items-center justify-center text-[10px]">
          ${index + 1}
        </span>
        <div>
          <span class="font-semibold text-white">${escapeHtml(d.dishName)}</span>
          <span class="block text-[10px] text-gray-400">${d.percentageOfSales || 0}% of sales</span>
        </div>
      </div>
      <div class="text-right">
        <p class="font-bold text-amber-400">${d.quantity} sold</p>
        <span class="text-[10px] text-gray-400">₹${(d.revenue || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>
  `).join('');
}

function renderAnalyticsSupplierSpendTable(suppliers) {
  const tbody = document.getElementById('analyticsSupplierSpendBody');
  if (!tbody) return;

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No supplier purchases or payments recorded in this period</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers.map(s => {
    const billed = s.totalSpend || 0;
    const paid = s.amountPaid || 0;
    const due = s.outstandingBalance != null ? s.outstandingBalance : Math.max(0, billed - paid);
    return `
      <tr class="hover:bg-gray-800/40">
        <td class="p-2.5 font-medium text-white">${escapeHtml(s.supplierName)}</td>
        <td class="p-2.5 text-center text-gray-300">${s.invoiceCount}</td>
        <td class="p-2.5 text-right font-bold text-amber-400">₹${billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="p-2.5 text-right font-bold text-emerald-400">₹${paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="p-2.5 text-right font-semibold ${due > 0 ? 'text-rose-400' : 'text-gray-400'}">₹${due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="p-2.5 text-right text-gray-400">${s.percentage || 0}%</td>
      </tr>
    `;
  }).join('');
}

function renderAnalyticsPurchasedProductsTable(products) {
  const tbody = document.getElementById('analyticsPurchasedProductsBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No ingredient purchases recorded in this period</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-2.5 font-medium text-white">${escapeHtml(p.productName)}</td>
      <td class="p-2.5 text-center text-gray-300">${p.totalQuantity} ${escapeHtml(p.unit || '')}</td>
      <td class="p-2.5 text-right text-gray-400">₹${(p.avgUnitRate || 0).toFixed(2)}</td>
      <td class="p-2.5 text-right font-bold text-amber-400">₹${(p.totalSpend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');
}

function switchDrillDownTab(subTab) {
  currentDrillDownTab = subTab;
  const tabs = ['sales', 'expenses', 'purchases', 'supplierPayments', 'salaries'];

  tabs.forEach(t => {
    const btn = document.getElementById(`dtab-${t}`);
    const section = document.getElementById(`drillSection-${t}`);
    if (btn) {
      if (t === subTab) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-gray-950 font-bold active-dtab transition';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold glass-card text-gray-300 hover:text-white transition';
      }
    }
    if (section) {
      if (t === subTab) section.classList.remove('hidden');
      else section.classList.add('hidden');
    }
  });
}

function renderAnalyticsDrillDown(drill) {
  const sales = drill.sales || [];
  const expenses = drill.expenses || [];
  const purchases = drill.purchases || [];
  const supplierPayments = drill.supplierPayments || [];
  const salaries = drill.salaries || [];

  // Update counts on tab buttons
  const elSCount = document.getElementById('drillSalesCount');
  if (elSCount) elSCount.textContent = sales.length;

  const elECount = document.getElementById('drillExpensesCount');
  if (elECount) elECount.textContent = expenses.length;

  const elPCount = document.getElementById('drillPurchasesCount');
  if (elPCount) elPCount.textContent = purchases.length;

  const elSpCount = document.getElementById('drillSupplierPaymentsCount');
  if (elSpCount) elSpCount.textContent = supplierPayments.length;

  const elSalCount = document.getElementById('drillSalariesCount');
  if (elSalCount) elSalCount.textContent = salaries.length;

  // 1. Sales
  const sBody = document.getElementById('drillSalesBody');
  if (sBody) {
    if (sales.length === 0) {
      sBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No completed bills in this period</td></tr>`;
    } else {
      sBody.innerHTML = sales.map(b => `
        <tr class="hover:bg-gray-800/40">
          <td class="p-2.5 font-mono text-amber-400 font-bold">${escapeHtml(b.billNumber)}</td>
          <td class="p-2.5 text-gray-400 text-[11px]">${escapeHtml(b.createdAt)}</td>
          <td class="p-2.5 text-gray-300">${escapeHtml(b.tableNumber || 'Takeaway')}</td>
          <td class="p-2.5 text-gray-300">${escapeHtml(b.customerName || '-')}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300">${escapeHtml(b.paymentMode)}</span></td>
          <td class="p-2.5 text-right font-bold text-emerald-400">₹${(b.netAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // 2. Expenses
  const eBody = document.getElementById('drillExpensesBody');
  if (eBody) {
    if (expenses.length === 0) {
      eBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No operating expenses in this period</td></tr>`;
    } else {
      eBody.innerHTML = expenses.map(e => `
        <tr class="hover:bg-gray-800/40">
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300">${escapeHtml(e.type)}</span></td>
          <td class="p-2.5 text-gray-200">${escapeHtml(e.description)}</td>
          <td class="p-2.5 text-gray-400 text-[11px]">${escapeHtml(e.expenseDate)}</td>
          <td class="p-2.5 text-gray-400">${escapeHtml(e.paidBy || '-')}</td>
          <td class="p-2.5 text-gray-400 text-[11px] font-mono">${escapeHtml(e.receiptRef || '-')}</td>
          <td class="p-2.5 text-right font-bold text-rose-400">₹${(e.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // 3. Purchases (Invoices)
  const pBody = document.getElementById('drillPurchasesBody');
  if (pBody) {
    if (purchases.length === 0) {
      pBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No supplier invoices in this period</td></tr>`;
    } else {
      pBody.innerHTML = purchases.map(p => `
        <tr class="hover:bg-gray-800/40">
          <td class="p-2.5 font-mono text-amber-400 font-bold">${escapeHtml(p.invoiceNumber)}</td>
          <td class="p-2.5 font-medium text-white">${escapeHtml(p.supplierName)}</td>
          <td class="p-2.5 text-gray-400 text-[11px]">${escapeHtml(p.invoiceDate)}</td>
          <td class="p-2.5 text-right text-gray-400">₹${(p.subtotal || 0).toFixed(2)}</td>
          <td class="p-2.5 text-right text-gray-400">₹${(p.gstAmount || 0).toFixed(2)}</td>
          <td class="p-2.5 text-right font-bold text-amber-400">₹${(p.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ${p.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${escapeHtml(p.status)}</span></td>
        </tr>
      `).join('');
    }
  }

  // 4. Supplier Payments Given
  const spBody = document.getElementById('drillSupplierPaymentsBody');
  if (spBody) {
    if (supplierPayments.length === 0) {
      spBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No supplier payments disbursed in this period</td></tr>`;
    } else {
      spBody.innerHTML = supplierPayments.map(sp => `
        <tr class="hover:bg-gray-800/40">
          <td class="p-2.5 text-gray-300 font-medium text-[11px]">${escapeHtml(sp.paymentDate || '-')}</td>
          <td class="p-2.5 font-medium text-white">${escapeHtml(sp.supplierName || '-')}</td>
          <td class="p-2.5 font-mono text-amber-400">${escapeHtml(sp.invoiceNumber || '-')}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300">${escapeHtml(sp.paymentMode || 'CASH')}</span></td>
          <td class="p-2.5 text-gray-400 font-mono text-[11px]">${escapeHtml(sp.referenceNumber || '-')}</td>
          <td class="p-2.5 text-gray-400 text-xs">${escapeHtml(sp.notes || '-')}</td>
          <td class="p-2.5 text-right font-bold text-emerald-400">₹${(sp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // 5. Salaries
  const salBody = document.getElementById('drillSalariesBody');
  if (salBody) {
    if (salaries.length === 0) {
      salBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No salary payouts in this period</td></tr>`;
    } else {
      salBody.innerHTML = salaries.map(s => `
        <tr class="hover:bg-gray-800/40">
          <td class="p-2.5 font-medium text-white">${escapeHtml(s.employeeName)}</td>
          <td class="p-2.5 text-gray-300">${s.month}/${s.year}</td>
          <td class="p-2.5 text-gray-400 text-[11px]">${escapeHtml(s.paymentDate || '-')}</td>
          <td class="p-2.5 text-gray-400">${escapeHtml(s.paymentMode || 'CASH')}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ${s.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${escapeHtml(s.status)}</span></td>
          <td class="p-2.5 text-right font-bold text-rose-400">₹${(s.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }
}

// ============================================================

// DEDICATED MANAGER DRAWER ANALYSIS & SHIFT RECONCILIATION (v2.3.0)
// ============================================================

let currentAnalyticsSubTab = 'overview';
let currentDrawerPeriod = 'THIS_MONTH';
let drawerCustomStart = null;
let drawerCustomEnd = null;
let currentDrawerAnalysisData = null;
let currentDrawerAnalysisView = 'shifts';
let currentActiveLedgerShift = null;

function showAnalyticsSubTab(tab) {
  currentAnalyticsSubTab = tab;
  const overviewBtn = document.getElementById('atab-overview');
  const drawerBtn = document.getElementById('atab-drawer');
  const overviewSection = document.getElementById('analytics-sub-overview');
  const drawerSection = document.getElementById('analytics-sub-drawer');

  if (tab === 'overview') {
    if (overviewBtn) {
      overviewBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-2 shadow-sm';
    }
    if (drawerBtn) {
      drawerBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800/80 transition flex items-center gap-2';
    }
    if (overviewSection) overviewSection.classList.remove('hidden');
    if (drawerSection) drawerSection.classList.add('hidden');
  } else if (tab === 'drawer') {
    if (overviewBtn) {
      overviewBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800/80 transition flex items-center gap-2';
    }
    if (drawerBtn) {
      drawerBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-2 shadow-sm';
    }
    if (overviewSection) overviewSection.classList.add('hidden');
    if (drawerSection) drawerSection.classList.remove('hidden');
    loadDrawerAnalysis();
  }
}

function setDrawerPeriod(period) {
  currentDrawerPeriod = period;
  const pills = ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'];
  pills.forEach(p => {
    const el = document.getElementById(`dpill-${p}`);
    if (el) {
      if (p === period) {
        el.className = 'whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-gray-950 font-bold active-period transition';
      } else {
        el.className = 'whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition';
      }
    }
  });

  const customBox = document.getElementById('drawerCustomDateBox');
  if (period === 'CUSTOM') {
    if (customBox) customBox.classList.remove('hidden');
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    if (!document.getElementById('drawerStartDate').value) document.getElementById('drawerStartDate').value = thirtyDaysAgo;
    if (!document.getElementById('drawerEndDate').value) document.getElementById('drawerEndDate').value = today;
  } else {
    if (customBox) customBox.classList.add('hidden');
    drawerCustomStart = null;
    drawerCustomEnd = null;
    loadDrawerAnalysis();
  }
}

function applyDrawerCustomDate() {
  const start = document.getElementById('drawerStartDate').value;
  const end = document.getElementById('drawerEndDate').value;
  if (!start || !end) {
    showToast('Please select both start and end date for drawer analysis', 'warning');
    return;
  }
  if (start > end) {
    showToast('Start date must be before or equal to end date', 'warning');
    return;
  }
  drawerCustomStart = start;
  drawerCustomEnd = end;
  loadDrawerAnalysis();
}

function setDrawerAnalysisView(view) {
  currentDrawerAnalysisView = view;
  const btnShifts = document.getElementById('btnDViewShifts');
  const btnDaily = document.getElementById('btnDViewDaily');
  const btnMonthly = document.getElementById('btnDViewMonthly');

  const containerShifts = document.getElementById('drawerTableContainerShifts');
  const containerDaily = document.getElementById('drawerTableContainerDaily');
  const containerMonthly = document.getElementById('drawerTableContainerMonthly');

  if (btnShifts) btnShifts.className = view === 'shifts' ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-gray-950 transition' : 'px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition';
  if (btnDaily) btnDaily.className = view === 'daily' ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-gray-950 transition' : 'px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition';
  if (btnMonthly) btnMonthly.className = view === 'monthly' ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-gray-950 transition' : 'px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition';

  if (containerShifts) containerShifts.classList.toggle('hidden', view !== 'shifts');
  if (containerDaily) containerDaily.classList.toggle('hidden', view !== 'daily');
  if (containerMonthly) containerMonthly.classList.toggle('hidden', view !== 'monthly');
}

async function loadDrawerAnalysis() {
  const tbody = document.getElementById('drawerShiftsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="15" class="p-6 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading drawer analysis &amp; reconciliations...</td></tr>';
  }

  try {
    const params = new URLSearchParams();
    if (currentDrawerPeriod) params.append('period', currentDrawerPeriod);
    if (drawerCustomStart) params.append('startDate', drawerCustomStart);
    if (drawerCustomEnd) params.append('endDate', drawerCustomEnd);

    const cashierId = document.getElementById('drawerFilterCashier')?.value;
    if (cashierId) params.append('cashierId', cashierId);

    const registerId = document.getElementById('drawerFilterRegister')?.value;
    if (registerId) params.append('registerId', registerId);

    const status = document.getElementById('drawerFilterStatus')?.value;
    if (status && status !== 'ALL') params.append('status', status);

    const data = await apiRequest('/shifts/analysis?' + params.toString());
    currentDrawerAnalysisData = data;

    // 1. Populate Formula Chips
    const summary = data.summary || {};
    const floatVal = Number(summary.totalOpeningFloat || 0);
    const cashSalesVal = Number(summary.totalCashSales || 0);
    const cashInVal = Number(summary.totalCashAdded || 0);
    const cashRefundsVal = Number(summary.totalCashRefunds || 0);
    const cashOutVal = Number(summary.totalCashPaidOut || 0);
    const transfersOutVal = Number(summary.totalTransfersToBankSafe || 0);
    const transfersInVal = Number(summary.totalTransfersFromBankSafe || 0);
    const expectedVal = Number(summary.totalExpectedCash || 0);

    setText('formulaFloat', `₹${floatVal.toFixed(2)}`);
    setText('formulaCashSales', `₹${cashSalesVal.toFixed(2)}`);
    setText('formulaCashIn', `₹${cashInVal.toFixed(2)}`);
    setText('formulaCashRefunds', `₹${cashRefundsVal.toFixed(2)}`);
    setText('formulaCashOut', `₹${cashOutVal.toFixed(2)}`);
    setText('formulaTransfersOut', `₹${transfersOutVal.toFixed(2)}`);
    setText('formulaTransfersIn', `₹${transfersInVal.toFixed(2)}`);
    setText('formulaExpectedTotal', `₹${expectedVal.toFixed(2)}`);

    setText('drawerFormulaPeriodBadge', `${data.startDate || ''} to ${data.endDate || ''}`);

    // 2. Populate KPI Cards
    const countedVal = Number(summary.totalCountedCash || 0);
    const varianceVal = Number(summary.netVariance || 0);

    setText('kpiDrawerExpected', `₹${expectedVal.toFixed(2)}`);
    setText('kpiDrawerOpeningFloat', `₹${floatVal.toFixed(2)}`);
    setText('kpiDrawerCounted', `₹${countedVal.toFixed(2)}`);
    setText('kpiDrawerClosedCount', `${summary.closedShifts || 0} Shifts`);

    const varianceEl = document.getElementById('kpiDrawerNetVariance');
    const varianceBadge = document.getElementById('kpiDrawerVarianceBadge');
    if (varianceEl) {
      varianceEl.textContent = `${varianceVal >= 0 ? '+' : ''}₹${varianceVal.toFixed(2)}`;
      varianceEl.className = varianceVal === 0 ? 'text-2xl font-black text-emerald-400 mt-1' :
        (varianceVal > 0 ? 'text-2xl font-black text-amber-300 mt-1' : 'text-2xl font-black text-rose-400 mt-1');
    }
    if (varianceBadge) {
      if (varianceVal === 0) {
        varianceBadge.textContent = 'BALANCED';
        varianceBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400';
      } else if (varianceVal > 0) {
        varianceBadge.textContent = 'SURPLUS';
        varianceBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400';
      } else {
        varianceBadge.textContent = 'SHORTAGE';
        varianceBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400';
      }
    }

    setText('kpiDrawerShortageSub', `Shortages: ${summary.shortageCount || 0} (-₹${Number(summary.totalShortageAmount || 0).toFixed(2)})`);
    setText('kpiDrawerSurplusSub', `Surpluses: ${summary.surplusCount || 0} (+₹${Number(summary.totalSurplusAmount || 0).toFixed(2)})`);

    setText('kpiDrawerTransfersOut', `₹${transfersOutVal.toFixed(2)}`);
    setText('kpiDrawerTransfersIn', `₹${transfersInVal.toFixed(2)}`);

    const upiSalesVal = Number(summary.totalUpiSales || 0);
    const cardSalesVal = Number(summary.totalCardSales || 0);
    setText('kpiDrawerNonCashSales', `₹${(upiSalesVal + cardSalesVal).toFixed(2)}`);
    setText('kpiDrawerUpiSales', `₹${upiSalesVal.toFixed(2)}`);
    setText('kpiDrawerCardSales', `₹${cardSalesVal.toFixed(2)}`);

    // 3. Populate Financial Distinctions Block
    const distinctions = summary.distinctions || {};
    setText('distinctionDrawerFlow', `₹${Number(distinctions.drawerCashFlow || 0).toFixed(2)}`);
    setText('distinctionBankReloc', `₹${Number(distinctions.bankSafeTransfers || 0).toFixed(2)}`);
    setText('distinctionExpenses', `₹${Number(distinctions.businessExpenses || 0).toFixed(2)}`);
    setText('distinctionProfit', `₹${Number(distinctions.accountingProfit || 0).toFixed(2)}`);

    // 4. Populate Flagged Anomalies Banner
    renderDrawerAnomalies(data.shifts || []);

    // 5. Populate Cashier Filter Dropdown (if not already populated)
    populateCashierFilterOptions(data.shifts || []);

    // 6. Render Tables
    filterDrawerAnalysisLocally();
    renderDrawerDailyTable(data.dailySummaries || []);
    renderDrawerMonthlyTable(data.monthlySummaries || []);

  } catch (err) {
    console.error('Failed to load drawer analysis:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="15" class="p-6 text-center text-rose-400 text-xs">Error loading drawer analysis: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function renderDrawerAnomalies(shifts) {
  const banner = document.getElementById('drawerAnomaliesBanner');
  const countEl = document.getElementById('drawerAnomaliesCount');
  const listEl = document.getElementById('drawerAnomaliesList');
  if (!banner || !listEl) return;

  const anomalousShifts = shifts.filter(s => s.anomalyFlags && s.anomalyFlags.length > 0);
  if (countEl) countEl.textContent = anomalousShifts.length;

  if (anomalousShifts.length === 0) {
    banner.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');
  let html = '';
  anomalousShifts.forEach(item => {
    const s = item.shift || {};
    const flags = item.anomalyFlags || [];
    flags.forEach(f => {
      const isHigh = f.severity === 'HIGH';
      html += `
        <div class="p-2.5 rounded-lg bg-gray-900 border ${isHigh ? 'border-rose-500/40 bg-rose-950/30' : 'border-amber-500/40 bg-amber-950/30'} flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div class="flex items-start gap-2">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 mt-0.5 ${isHigh ? 'bg-rose-500 text-white' : 'bg-amber-500 text-gray-950'}">
              ${escapeHtml(f.severity)}: ${escapeHtml(f.flagType)}
            </span>
            <span class="text-gray-200">
              <strong class="text-white">Shift #${s.id} (${escapeHtml(s.cashierName || 'Staff')} - ${escapeHtml(s.registerId || 'REG-01')}):</strong>
              ${escapeHtml(f.description)}
            </span>
          </div>
          <button onclick="openDrawerShiftLedger(${s.id})" class="px-2.5 py-1 text-[11px] rounded bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold shrink-0 transition">
            Inspect Shift &rarr;
          </button>
        </div>
      `;
    });
  });
  listEl.innerHTML = html;
}

function populateCashierFilterOptions(shifts) {
  const select = document.getElementById('drawerFilterCashier');
  if (!select || select.children.length > 1) return; // Keep existing options if already loaded

  const map = new Map();
  shifts.forEach(item => {
    const s = item.shift;
    if (s && s.cashierId && s.cashierName) {
      map.set(s.cashierId, s.cashierName);
    }
  });

  map.forEach((name, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${name} (ID: ${id})`;
    select.appendChild(opt);
  });
}

function filterDrawerAnalysisLocally() {
  if (!currentDrawerAnalysisData) return;
  const onlyAnomalies = document.getElementById('drawerFilterAnomaliesOnly')?.checked;
  const shifts = currentDrawerAnalysisData.shifts || [];

  const filtered = onlyAnomalies
    ? shifts.filter(s => s.anomalyFlags && s.anomalyFlags.length > 0)
    : shifts;

  renderDrawerShiftsTable(filtered);
}

function renderDrawerShiftsTable(items) {
  const tbody = document.getElementById('drawerShiftsTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" class="p-6 text-center text-gray-500 text-xs">No shifts found matching selected filters.</td></tr>';
    return;
  }

  let html = '';
  items.forEach(item => {
    const s = item.shift || {};
    const isOpen = s.status === 'OPEN';
    const variance = Number(s.variance || 0);
    const expected = Number(s.expectedCash || 0);
    const counted = Number(s.countedCash || 0);
    const float = Number(s.openingFloat || 0);
    const cashSales = Number(s.cashSales || 0);
    const cashIn = Number(s.cashInTotal || 0);
    const cashRefunds = Number(s.cashRefunds || 0);
    const cashOut = Number(s.cashOutTotal || 0);
    const transfersOut = Number(s.transfersOutTotal || 0);
    const transfersIn = Number(s.transfersInTotal || 0);

    const hasAnomalies = item.anomalyFlags && item.anomalyFlags.length > 0;
    const isCorrected = Boolean(s.isCorrected);

    html += `
      <tr class="hover:bg-gray-900/60 transition ${hasAnomalies ? 'bg-rose-950/10' : ''}">
        <td class="p-3 whitespace-nowrap">
          <div class="font-bold text-white flex items-center gap-1.5">
            <span>#${s.id}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${isOpen ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
              ${escapeHtml(s.status)}
            </span>
          </div>
          ${s.previousShiftId ? `<div class="text-[10px] text-gray-500 font-mono">From #${s.previousShiftId}</div>` : ''}
        </td>
        <td class="p-3 whitespace-nowrap">
          <div class="font-medium text-white">${escapeHtml(s.cashierName || 'Staff')}</div>
          <div class="text-[10px] text-gray-400 font-mono">${escapeHtml(s.registerId || 'REG-01')}</div>
        </td>
        <td class="p-3 whitespace-nowrap text-[11px] text-gray-400 font-mono">
          <div>${s.openedAt ? formatISTDateTime(s.openedAt) : '-'}</div>
          ${s.closedAt ? `<div class="text-gray-500 text-[10px]">Closed: ${formatISTDateTime(s.closedAt)} (${item.durationMinutes || 0}m)</div>` : '<div class="text-amber-400 text-[10px]">Active Shift</div>'}
        </td>
        <td class="p-3 text-right font-mono text-gray-300">₹${float.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-emerald-400 font-semibold">₹${cashSales.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-sky-400">₹${cashIn.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-rose-400">₹${cashRefunds.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-amber-400">₹${cashOut.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-purple-400 font-semibold">
          ${transfersOut > 0 ? `-₹${transfersOut.toFixed(2)}` : '₹0.00'}
        </td>
        <td class="p-3 text-right font-mono text-purple-300">
          ${transfersIn > 0 ? `+₹${transfersIn.toFixed(2)}` : '₹0.00'}
        </td>
        <td class="p-3 text-right font-mono text-amber-300 font-bold">₹${expected.toFixed(2)}</td>
        <td class="p-3 text-right font-mono text-white">
          ${isOpen ? '<span class="text-gray-500 italic">Open</span>' : `₹${counted.toFixed(2)}`}
          ${isCorrected ? `<div class="text-[9px] text-amber-400 font-semibold" title="Corrected count: ₹${Number(s.correctedCountedCash).toFixed(2)}"><i class="fa-solid fa-pen-to-square"></i> ₹${Number(s.correctedCountedCash).toFixed(2)}</div>` : ''}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${isOpen ? '<span class="text-gray-500 text-[11px]">-</span>' : `
            <span class="px-2 py-0.5 rounded text-[10px] font-black font-mono ${variance === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (variance > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30')}">
              ${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}
            </span>
          `}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${hasAnomalies ? `
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 cursor-pointer" onclick="openDrawerShiftLedger(${s.id})" title="${escapeHtml(item.anomalyFlags.map(f => f.description).join('; '))}">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i>${item.anomalyFlags.length} Flag${item.anomalyFlags.length > 1 ? 's' : ''}
            </span>
          ` : '<span class="text-gray-600 text-[10px]"><i class="fa-solid fa-check text-emerald-500/50"></i> Clear</span>'}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openDrawerShiftLedger(${s.id})" class="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold transition" title="View Full Transaction Ledger">
              <i class="fa-solid fa-receipt"></i>
            </button>
            ${isOpen ? `
              <button onclick="openDrawerTransferModal(${s.id})" class="px-2 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold transition" title="Transfer Cash to Bank/Safe">
                <i class="fa-solid fa-money-bill-transfer"></i>
              </button>
            ` : `
              <button onclick="openCorrectVarianceModal(${s.id}, ${counted}, ${variance})" class="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-amber-500/20 text-gray-400 hover:text-amber-300 transition" title="Manager Correct Variance">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderDrawerDailyTable(dailyList) {
  const tbody = document.getElementById('drawerDailyTableBody');
  if (!tbody) return;

  if (!dailyList || dailyList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="p-6 text-center text-gray-500 text-xs">No daily aggregate data available.</td></tr>';
    return;
  }

  let html = '';
  dailyList.forEach(d => {
    const variance = Number(d.netVariance || 0);
    html += `
      <tr class="hover:bg-gray-900/60 transition font-mono text-xs">
        <td class="p-3 font-bold text-white font-sans">${escapeHtml(d.date)}</td>
        <td class="p-3 text-center text-gray-300">${d.shiftCount}</td>
        <td class="p-3 text-right text-gray-300">₹${Number(d.openingTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-emerald-400 font-semibold">₹${Number(d.cashSales || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-sky-400">₹${(Number(d.upiSales || 0) + Number(d.cardSales || 0)).toFixed(2)}</td>
        <td class="p-3 text-right text-rose-400">₹${Number(d.cashRefunds || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-sky-300">₹${Number(d.cashIn || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-amber-400">₹${Number(d.cashOut || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-purple-400 font-semibold">₹${Number(d.transfersOut || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-purple-300">₹${Number(d.transfersIn || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-amber-300 font-bold">₹${Number(d.expectedTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-white font-semibold">₹${Number(d.countedTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${variance === 0 ? 'bg-emerald-500/20 text-emerald-400' : (variance > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400')}">
            ${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}
          </span>
        </td>
        <td class="p-3 text-center text-[11px] font-sans">
          ${d.shortageCount > 0 ? `<span class="text-rose-400 font-bold mr-1.5">${d.shortageCount} Short</span>` : ''}
          ${d.surplusCount > 0 ? `<span class="text-amber-400 font-bold">${d.surplusCount} Surplus</span>` : ''}
          ${d.shortageCount === 0 && d.surplusCount === 0 ? '<span class="text-emerald-400">0 Discrepancy</span>' : ''}
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderDrawerMonthlyTable(monthlyList) {
  const tbody = document.getElementById('drawerMonthlyTableBody');
  if (!tbody) return;

  if (!monthlyList || monthlyList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-500 text-xs">No monthly trends data available.</td></tr>';
    return;
  }

  let html = '';
  monthlyList.forEach(m => {
    const variance = Number(m.netVariance || 0);
    html += `
      <tr class="hover:bg-gray-900/60 transition font-mono text-xs">
        <td class="p-3 font-bold text-white font-sans">${escapeHtml(m.monthYear)}</td>
        <td class="p-3 text-center text-gray-300">${m.shiftCount}</td>
        <td class="p-3 text-right text-gray-300">₹${Number(m.openingTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-emerald-400 font-semibold">₹${Number(m.cashSales || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-amber-300 font-bold">₹${Number(m.expectedTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-right text-white font-semibold">₹${Number(m.countedTotal || 0).toFixed(2)}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${variance === 0 ? 'bg-emerald-500/20 text-emerald-400' : (variance > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400')}">
            ${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}
          </span>
        </td>
        <td class="p-3 text-center text-[11px] font-sans">
          <span class="text-rose-400 font-semibold mr-1.5">${m.shortageCount || 0} Short</span>
          <span class="text-amber-400 font-semibold">${m.surplusCount || 0} Surplus</span>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function openDrawerShiftLedger(shiftId) {
  const modal = document.getElementById('drawerShiftLedgerModal');
  if (!modal) return;

  const item = currentDrawerAnalysisData?.shifts?.find(s => s.shift && s.shift.id === shiftId);
  if (!item) {
    showToast('Shift details not found in current dataset', 'warning');
    return;
  }

  currentActiveLedgerShift = item;
  const s = item.shift;

  setText('dslModalTitle', `Shift #${s.id} Ledger & Reconciliation`);
  const statusBadge = document.getElementById('dslStatusBadge');
  if (statusBadge) {
    statusBadge.textContent = s.status;
    statusBadge.className = s.status === 'OPEN'
      ? 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30'
      : 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  }

  // Correction Banner
  const corrBanner = document.getElementById('dslCorrectionBanner');
  if (corrBanner) {
    if (s.isCorrected) {
      corrBanner.classList.remove('hidden');
      setText('dslCorrectedAt', s.correctedAt ? formatISTDateTime(s.correctedAt) : '');
      setText('dslCorrectionDetails', `Original Count: ₹${Number(s.countedCash).toFixed(2)} (Variance: ₹${Number(s.variance).toFixed(2)}) &rarr; Corrected Count: ₹${Number(s.correctedCountedCash).toFixed(2)} (Variance: ₹${Number(s.correctedVariance).toFixed(2)}) by ${escapeHtml(s.correctedByUserName || 'Manager')}`);
      setText('dslCorrectionReason', `Reason: ${escapeHtml(s.correctionReason || 'Verified adjustment')}`);
    } else {
      corrBanner.classList.add('hidden');
    }
  }

  setText('dslRegisterCashier', `${s.cashierName || 'Staff'} (${s.registerId || 'REG-01'})`);
  setText('dslOpenedAt', s.openedAt ? formatISTDateTime(s.openedAt) : '-');
  setText('dslClosedAt', s.closedAt ? formatISTDateTime(s.closedAt) : 'Currently Open');
  setText('dslDuration', `${item.durationMinutes || 0} mins`);

  setText('dslOpeningFloat', `₹${Number(s.openingFloat || 0).toFixed(2)}`);
  setText('dslCashSales', `₹${Number(s.cashSales || 0).toFixed(2)}`);
  setText('dslCashIn', `₹${Number(s.cashInTotal || 0).toFixed(2)}`);
  setText('dslCashRefunds', `₹${Number(s.cashRefunds || 0).toFixed(2)}`);
  setText('dslCashOut', `₹${Number(s.cashOutTotal || 0).toFixed(2)}`);
  setText('dslTransfersOut', `₹${Number(s.transfersOutTotal || 0).toFixed(2)}`);
  setText('dslTransfersIn', `₹${Number(s.transfersInTotal || 0).toFixed(2)}`);
  setText('dslExpectedCash', `₹${Number(s.expectedCash || 0).toFixed(2)}`);
  setText('dslCountedCash', s.status === 'OPEN' ? 'Shift Open' : `₹${Number(s.isCorrected ? s.correctedCountedCash : s.countedCash || 0).toFixed(2)}`);

  const vBadge = document.getElementById('dslVarianceBadge');
  const variance = Number(s.isCorrected ? s.correctedVariance : s.variance || 0);
  if (vBadge) {
    if (s.status === 'OPEN') {
      vBadge.textContent = 'OPEN';
      vBadge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-400';
    } else {
      vBadge.textContent = `${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}`;
      vBadge.className = variance === 0 ? 'px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400' :
        (variance > 0 ? 'px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400' : 'px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400');
    }
  }

  setText('dslUpiSales', `₹${Number(s.upiSales || 0).toFixed(2)}`);
  setText('dslCardSales', `₹${Number(s.cardSales || 0).toFixed(2)}`);
  setText('dslTotalSales', `₹${Number(s.totalSales || 0).toFixed(2)}`);

  setText('dslHandoverRef', s.carryForwardRef ? `Carry-forward Ref: ${s.carryForwardRef} (Prev Shift #${s.previousShiftId || 'N/A'})` : 'Standard Till Float Setup');
  setText('dslNotes', s.notes || 'No closing notes recorded.');

  // Movements table
  const movementsBody = document.getElementById('dslMovementsTableBody');
  const countMv = document.getElementById('dslMovementsCount');
  const movements = s.movements || [];
  if (countMv) countMv.textContent = movements.length;

  if (movementsBody) {
    if (movements.length === 0) {
      movementsBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-500 text-xs">No cash movements recorded on this shift.</td></tr>';
    } else {
      let mHtml = '';
      movements.forEach(m => {
        const isTransfer = m.transferType && (m.transferType.includes('BANK') || m.transferType.includes('SAFE'));
        mHtml += `
          <tr class="hover:bg-gray-900/50">
            <td class="p-2.5 font-mono text-gray-400 text-[11px]">${m.createdAt ? formatISTDateTime(m.createdAt) : '-'}</td>
            <td class="p-2.5 whitespace-nowrap">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${m.movementType === 'CASH_IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                ${m.movementType === 'CASH_IN' ? '<i class=\"fa-solid fa-arrow-down mr-1\"></i>' : '<i class=\"fa-solid fa-arrow-up mr-1\"></i>'}
                ${escapeHtml(m.transferType || m.movementType)}
              </span>
            </td>
            <td class="p-2.5 text-right font-mono font-bold ${m.movementType === 'CASH_IN' ? 'text-emerald-400' : 'text-rose-400'}">
              ₹${Number(m.amount).toFixed(2)}
            </td>
            <td class="p-2.5 text-gray-300 font-mono text-[11px]">${escapeHtml(m.destinationAccount || '-')}</td>
            <td class="p-2.5 text-gray-400 font-mono text-[11px]">${escapeHtml(m.referenceNumber || '-')}</td>
            <td class="p-2.5 text-gray-300">${escapeHtml(m.reason || '-')}</td>
            <td class="p-2.5 text-gray-400 text-[11px]">${escapeHtml(m.userName || 'Staff')}</td>
          </tr>
        `;
      });
      movementsBody.innerHTML = mHtml;
    }
  }

  // Manage Correct Variance button visibility
  const correctBtn = document.getElementById('btnDslCorrectVariance');
  if (correctBtn) {
    correctBtn.classList.toggle('hidden', s.status === 'OPEN');
  }

  modal.classList.remove('hidden');
}

function closeDrawerShiftLedgerModal() {
  const modal = document.getElementById('drawerShiftLedgerModal');
  if (modal) modal.classList.add('hidden');
}

function openDrawerTransferModal(shiftId) {
  const modal = document.getElementById('drawerTransferModal');
  if (!modal) return;

  const select = document.getElementById('dtShiftSelect');
  if (select) {
    select.innerHTML = '<option value="">Select Shift...</option>';
    const shifts = currentDrawerAnalysisData?.shifts || [];
    shifts.forEach(item => {
      const s = item.shift;
      if (s) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `Shift #${s.id} (${s.status}) - ${s.cashierName} [${s.registerId}]`;
        select.appendChild(opt);
      }
    });

    if (shiftId) {
      select.value = shiftId;
    } else {
      // Default to open shift if present
      const openShift = shifts.find(item => item.shift && item.shift.status === 'OPEN');
      if (openShift) select.value = openShift.shift.id;
    }
  }

  // Reset form inputs
  const form = document.getElementById('drawerTransferForm');
  if (form) form.reset();

  modal.classList.remove('hidden');
}

function closeDrawerTransferModal() {
  const modal = document.getElementById('drawerTransferModal');
  if (modal) modal.classList.add('hidden');
}

async function submitDrawerTransfer(e) {
  e.preventDefault();
  const shiftId = document.getElementById('dtShiftSelect').value;
  const transferType = document.getElementById('dtTypeSelect').value;
  const amount = parseFloat(document.getElementById('dtAmountInput').value);
  const referenceNumber = document.getElementById('dtRefInput').value.trim();
  const destinationAccount = document.getElementById('dtAccountInput').value.trim();
  const reason = document.getElementById('dtReasonInput').value.trim();
  const approvedBy = document.getElementById('dtApprovedByInput').value.trim();

  if (!shiftId) {
    showToast('Please select a target shift', 'warning');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please enter a valid transfer amount greater than zero', 'warning');
    return;
  }
  if (!reason) {
    showToast('A reason is mandatory for cash transfers', 'warning');
    return;
  }

  try {
    await apiRequest(`/shifts/${shiftId}/transfers`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        transferType,
        destinationAccount,
        referenceNumber,
        reason,
        approvedBy
      })
    });
    showToast(`Transfer ${transferType} of ₹${amount.toFixed(2)} recorded successfully`, 'success');
    closeDrawerTransferModal();
    loadDrawerAnalysis();
    if (typeof loadCashierShiftData === 'function') loadCashierShiftData();
  } catch (err) {
    showToast('Failed to record cash transfer: ' + err.message, 'error');
  }
}

function openCorrectVarianceModal(shiftId, countedCash, variance) {
  const modal = document.getElementById('correctVarianceModal');
  if (!modal) return;

  const idInput = document.getElementById('cvShiftId');
  if (idInput) idInput.value = shiftId;

  setText('cvOriginalCounted', `₹${Number(countedCash || 0).toFixed(2)}`);
  const varEl = document.getElementById('cvOriginalVariance');
  if (varEl) {
    const v = Number(variance || 0);
    varEl.textContent = `${v >= 0 ? '+' : ''}₹${v.toFixed(2)}`;
    varEl.className = v === 0 ? 'text-emerald-400 font-mono font-bold' : (v > 0 ? 'text-amber-400 font-mono font-bold' : 'text-rose-400 font-mono font-bold');
  }

  const countInput = document.getElementById('cvNewCountInput');
  if (countInput) countInput.value = Number(countedCash || 0).toFixed(2);

  const reasonInput = document.getElementById('cvReasonInput');
  if (reasonInput) reasonInput.value = '';

  modal.classList.remove('hidden');
}

function openCorrectVarianceModalFromLedger() {
  if (!currentActiveLedgerShift || !currentActiveLedgerShift.shift) return;
  const s = currentActiveLedgerShift.shift;
  openCorrectVarianceModal(s.id, s.isCorrected ? s.correctedCountedCash : s.countedCash, s.isCorrected ? s.correctedVariance : s.variance);
}

function closeCorrectVarianceModal() {
  const modal = document.getElementById('correctVarianceModal');
  if (modal) modal.classList.add('hidden');
}

async function submitCorrectVariance(e) {
  e.preventDefault();
  const shiftId = document.getElementById('cvShiftId').value;
  const countedCash = parseFloat(document.getElementById('cvNewCountInput').value);
  const reason = document.getElementById('cvReasonInput').value.trim();

  if (isNaN(countedCash) || countedCash < 0) {
    showToast('Enter a valid physical cash count', 'warning');
    return;
  }
  if (!reason || reason.length < 5) {
    showToast('Enter an audit reason (at least 5 characters) explaining the correction', 'warning');
    return;
  }

  try {
    const updated = await apiRequest(`/shifts/${shiftId}/correct-variance`, {
      method: 'POST',
      body: JSON.stringify({ countedCash, reason })
    });
    showToast(`Variance corrected for Shift #${shiftId}: Counted ₹${Number(updated.correctedCountedCash).toFixed(2)}, Variance ₹${Number(updated.correctedVariance).toFixed(2)}`, 'success');
    closeCorrectVarianceModal();
    closeDrawerShiftLedgerModal();
    loadDrawerAnalysis();
    if (typeof loadCashierShiftData === 'function') loadCashierShiftData();
  } catch (err) {
    showToast('Failed to apply variance correction: ' + err.message, 'error');
  }
}

async function openShiftAnomalySettingsModal() {
  const modal = document.getElementById('shiftAnomalySettingsModal');
  if (!modal) return;

  try {
    const settings = await apiRequest('/shifts/settings');
    const varInput = document.getElementById('asVarianceThreshold');
    const moveInput = document.getElementById('asLargeMovementThreshold');
    const flagMissing = document.getElementById('asFlagMissingCount');
    const flagTransfers = document.getElementById('asFlagTransfersWithoutRef');

    if (varInput) varInput.value = Number(settings.varianceThreshold || 500).toFixed(2);
    if (moveInput) moveInput.value = Number(settings.largeMovementThreshold || 5000).toFixed(2);
    if (flagMissing) flagMissing.checked = !Boolean(settings.flagMissingCount === false);
    if (flagTransfers) flagTransfers.checked = !Boolean(settings.flagTransfersWithoutRef === false);

    modal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to fetch anomaly settings: ' + err.message, 'error');
  }
}

function closeShiftAnomalySettingsModal() {
  const modal = document.getElementById('shiftAnomalySettingsModal');
  if (modal) modal.classList.add('hidden');
}

async function saveShiftAnomalySettings(e) {
  e.preventDefault();
  const varianceThreshold = parseFloat(document.getElementById('asVarianceThreshold').value);
  const largeMovementThreshold = parseFloat(document.getElementById('asLargeMovementThreshold').value);
  const flagMissingCount = document.getElementById('asFlagMissingCount').checked;
  const flagTransfersWithoutRef = document.getElementById('asFlagTransfersWithoutRef').checked;

  try {
    await apiRequest('/shifts/settings', {
      method: 'PUT',
      body: JSON.stringify({
        varianceThreshold,
        largeMovementThreshold,
        flagMissingCount,
        flagTransfersWithoutRef
      })
    });
    showToast('Drawer anomaly rules updated successfully', 'success');
    closeShiftAnomalySettingsModal();
    loadDrawerAnalysis();
  } catch (err) {
    showToast('Failed to update anomaly settings: ' + err.message, 'error');
  }
}

async function exportDrawerAnalysisCsv() {
  showToast('Preparing Drawer Analysis CSV export...', 'info');
  try {
    const params = new URLSearchParams();
    if (currentDrawerPeriod) params.append('period', currentDrawerPeriod);
    if (drawerCustomStart) params.append('startDate', drawerCustomStart);
    if (drawerCustomEnd) params.append('endDate', drawerCustomEnd);

    const cashierId = document.getElementById('drawerFilterCashier')?.value;
    if (cashierId) params.append('cashierId', cashierId);

    const registerId = document.getElementById('drawerFilterRegister')?.value;
    if (registerId) params.append('registerId', registerId);

    const status = document.getElementById('drawerFilterStatus')?.value;
    if (status && status !== 'ALL') params.append('status', status);

    const token = localStorage.getItem('token');
    const response = await fetch('/api/shifts/analysis/export/csv?' + params.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed with status ' + response.status);

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NERAM_Drawer_Analysis_${currentDrawerPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast('CSV export downloaded successfully', 'success');
  } catch (err) {
    showToast('Failed to export CSV: ' + err.message, 'error');
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
