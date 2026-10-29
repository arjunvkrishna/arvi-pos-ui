import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../../components/ChartCanvas';
import { Badge, EmptyState, Skeleton } from '../../components/ui';
import { chartColors } from '../../lib/chartColors';
import { fetchComprehensive, fetchInsights, fetchProfit, type Comprehensive, type Profit, type Query } from './api';
import * as W from './InsightWidgets';
import { WIDGETS, shownOrder, type Layout, type Span, type WidgetId } from './layout';
import { DRILL_TABS, growthLabel, inr0, inr2, type DrillTab } from './rules';

const DONUT = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#64748b'];

function Stat({ id, label, value, tone = 'text-fg', sub }: { id: string; label: string; value: string; tone?: string; sub?: React.ReactNode }) {
  return <div className="card p-4"><p className="text-xs text-muted">{label}</p><p id={id} className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>{sub && <div className="text-xs text-muted mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">{sub}</div>}</div>;
}

function charts(d: Comprehensive) {
  const { muted, line } = chartColors();
  const ticks = { color: muted };
  const trend = d.salesTrend ?? [];
  const sales: ChartConfiguration = { type: 'line', data: { labels: trend.map((t) => t.label), datasets: [
    { label: 'Sales revenue (₹)', data: trend.map((t) => t.sales), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, yAxisID: 'y' },
    { label: 'Order count', data: trend.map((t) => t.orders), borderColor: '#f59e0b', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 2, yAxisID: 'y1' }] },
  options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: muted } }, tooltip: { callbacks: { label: (c) => (c.dataset.yAxisID === 'y' ? `Sales: ₹${Number(c.raw).toLocaleString('en-IN')}` : `Orders: ${c.raw}`) } } },
    scales: { y: { beginAtZero: true, position: 'left', ticks: { color: muted, callback: (v) => `₹${v}` }, grid: { color: line } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: muted, precision: 0 } }, x: { ticks: { color: muted, maxRotation: 45 }, grid: { display: false } } } } };
  const bd = d.expenseBreakdown?.length ? d.expenseBreakdown : [{ category: 'No expenses recorded', amount: 1 }];
  const donut: ChartConfiguration<'doughnut'> = { type: 'doughnut', data: { labels: bd.map((b) => b.category), datasets: [{ data: bd.map((b) => b.amount), backgroundColor: DONUT.slice(0, bd.length), borderWidth: 2, borderColor: 'transparent' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: muted, boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ₹${Number(c.raw || 0).toLocaleString('en-IN')}` } } } } };
  const cf = d.cashFlowTrend ?? [];
  const cash: ChartConfiguration = { type: 'bar', data: { labels: cf.map((t) => t.label), datasets: [
    { label: 'Money in (sales)', data: cf.map((t) => t.moneyIn), backgroundColor: 'rgba(16,185,129,0.75)', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 },
    { label: 'Money out (expenses + invoices)', data: cf.map((t) => t.moneyOut), backgroundColor: 'rgba(244,63,94,0.75)', borderColor: '#f43f5e', borderWidth: 1, borderRadius: 4 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: muted } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ₹${Number(c.raw || 0).toLocaleString('en-IN')}` } } },
    scales: { y: { beginAtZero: true, ticks: { color: muted, callback: (v) => `₹${v}` }, grid: { color: line } }, x: { ticks, grid: { display: false } } } } };
  return { sales, donut: donut as unknown as ChartConfiguration, cash, hasExpenses: Boolean(d.expenseBreakdown?.length) };
}

function ProfitStatement({ p }: { p: Profit }) {
  const net = Number(p.netOperatingProfit || 0);
  const cf = Number(p.netCashFlow || 0);
  const row = (n: string, label: string, id: string, value: string, sub?: React.ReactNode, tone = 'text-fg', help?: string) => (
    <div key={n} className="rounded-lg border border-line p-3"><p className="text-xs text-muted">{label}</p><p id={id} className={`text-lg font-semibold mt-0.5 ${tone}`}>{value}</p>{sub && <p className="text-xs text-muted mt-1">{sub}</p>}{help && <p className="text-[11px] text-faint mt-1">{help}</p>}</div>
  );
  return (
    <div className="card p-4 space-y-3">
      <div><h2 className="font-medium text-fg">Accounting profit statement</h2><p className="text-sm text-muted">Separates cost of goods, operating overheads, payroll and cash movement so profit is not mixed with cash.</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {row('1', '1. Net sales (excl. tax)', 'profNetSales', inr2(p.netSales), <>Gross: <span id="profGrossSales">{inr0(p.grossSales)}</span> · Refunds: <span id="profRefunds">{inr0(p.totalRefunds)}</span></>)}
        {row('2', '2. Cost of goods sold (COGS)', 'profTotalCogs', inr2(p.cogs), <>Ingredients: <span id="profIngrCost">{inr0(p.ingredientConsumptionCost)}</span> · Waste: <span id="profWasteCost">{inr0(p.wasteCost)}</span></>, 'text-danger')}
        {row('3', '3. Gross profit (sales − COGS)', 'profGrossProfit', inr2(p.grossProfit), <span id="profGrossMargin">{Number(p.grossMarginPercentage || 0).toFixed(1)}% margin</span>, 'text-ok')}
        {row('4', '4 & 5. Overheads & payroll', 'profOpEx', inr2(p.operatingExpenses), <>Payroll: <span id="profPayroll">{inr2(p.payrollExpense)}</span></>, 'text-warn')}
        {row('6', '6. Net operating profit', 'profNetOperatingProfit', inr2(net), <span id="profNetOperatingMargin">{Number(p.netOperatingMarginPercentage || 0).toFixed(1)}% net margin</span>, net >= 0 ? 'text-ok' : 'text-danger', 'Gross profit − operating expenses − payroll')}
        {row('7', '7. Cash flow (money in − out)', 'profNetCashFlow', inr2(cf), <>In: <span id="profCashIn">{inr0(p.totalCashIn)}</span> · Out: <span id="profCashOut">{inr0(p.totalCashOut)}</span></>, cf >= 0 ? 'text-info' : 'text-warn', 'Period cash sales + drawer cash added − cash paid out')}
      </div>
    </div>
  );
}


export function OverviewTab({ q, layout }: { q: Query; layout: Layout }) {
  const ready = q.period !== 'CUSTOM' || (!!q.start && !!q.end);
  const order = shownOrder(layout);
  const needInsights = order.some((id) => WIDGETS.find((w) => w.id === id)?.insights);
  const data = useQuery({ queryKey: ['analytics', 'comprehensive', q], queryFn: () => fetchComprehensive(q), enabled: ready });
  const profit = useQuery({ queryKey: ['analytics', 'profit', q], queryFn: () => fetchProfit(q), enabled: ready });
  const ins = useQuery({ queryKey: ['analytics', 'insights', q], queryFn: () => fetchInsights(q), enabled: ready && needInsights });
  const [drill, setDrill] = useState<DrillTab>('sales');
  const d = data.data;
  if (!ready) return <div id="analytics-sub-overview" className="card"><EmptyState icon="fa-calendar-days" title="Choose a start and end date, then press Apply" /></div>;
  if (data.isPending) return <div id="analytics-sub-overview" className="card"><Skeleton rows={6} /></div>;
  if (data.isError || !d) return <p id="analytics-sub-overview" className="card p-6 text-center text-sm text-danger">Failed to load analytics: {data.error?.message}</p>;
  const k = d.kpis ?? {};
  const c = charts(d);
  const net = k.netProfit || 0;
  const dd = d.drillDown ?? {};
  const counts: Record<DrillTab, number> = { sales: dd.sales?.length ?? 0, expenses: dd.expenses?.length ?? 0, purchases: dd.purchases?.length ?? 0, supplierPayments: dd.supplierPayments?.length ?? 0, salaries: dd.salaries?.length ?? 0 };
  const medal = (i: number) => (i === 0 ? 'bg-yellow-400 text-gray-950' : i === 1 ? 'bg-gray-300 text-gray-950' : i === 2 ? 'bg-amber-600 text-white' : 'bg-subtle text-muted');
  const none = (cols: number, text: string) => <tr><td colSpan={cols} className="text-center text-sm text-muted py-6">{text}</td></tr>;

  /** A card for one of the new sections: waits for the insights request, shows its error, then the content. */
  const card = (id: WidgetId, render: (i: NonNullable<typeof ins.data>) => ReactNode) => {
    const def = WIDGETS.find((w) => w.id === id)!;
    return (
      <div className="card p-4 min-w-0 h-full">
        <h3 className="text-sm font-medium text-fg flex items-center gap-1.5">{def.title}<span tabIndex={0} role="note" aria-label={def.help} title={def.help} className="w-4 h-4 rounded-full border border-line text-[10px] text-muted inline-flex items-center justify-center cursor-help">?</span></h3>
        <div className="mt-3">{ins.isPending ? <Skeleton rows={3} /> : ins.isError || !ins.data ? <p className="text-sm text-danger py-4 text-center">Could not load this section: {ins.error?.message}</p> : render(ins.data)}</div>
      </div>
    );
  };

  const parts: Record<WidgetId, ReactNode> = {
    highlights: card('highlights', (i) => <W.HighlightsWidget i={i} />),
    kpis: (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat id="kpiTotalSales" label="Total sales" value={inr2(k.totalSales)} tone="text-ok" sub={<><span id="kpiSalesGrowthBadge" className={(k.salesGrowthPercent || 0) >= 0 ? 'text-ok font-medium' : 'text-danger font-medium'}>{growthLabel(k.salesGrowthPercent)}</span><span id="kpiOrdersCount">{k.totalOrders || 0} Orders</span></>} />
        <Stat id="kpiTotalExpenses" label="Total outgoings" value={inr2(k.totalExpenses)} tone="text-danger" sub={<><span>OpEx: <b id="kpiOpEx" className="text-fg">{inr0(k.totalOperatingExpenses)}</b></span><span>Salaries: <b id="kpiSalaries" className="text-fg">{inr0(k.totalSalariesPaid)}</b></span><span>Suppliers: <b id="kpiSupplierPaid" className="text-fg">{inr0(k.totalSupplierPayments)}</b></span><span className="hidden">Purchases <span id="kpiPurchases">{inr0(k.totalSupplierPurchases)}</span></span></>} />
        <Stat id="kpiNetProfit" label="Net profit (recorded)" value={inr2(net)} tone={net >= 0 ? 'text-ok' : 'text-danger'} sub={<><span>Gross profit: <b id="kpiGrossProfit" className="text-fg">{inr0(k.grossProfit)}</b></span><span>Sales − outgoings</span></>} />
        <Stat id="kpiInventoryValuation" label="Inventory & operations" value={inr2(k.inventoryValuation)} sub={<><span>Avg order: <b id="kpiAvgOrder" className="text-fg">{`₹${(k.avgOrderValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}`}</b></span><span id="kpiLowStockAlertBadge" className={(k.lowStockCount || 0) > 0 ? 'text-danger font-medium' : 'text-ok'}>{k.lowStockCount || 0} Low Stock</span></>} />
      </div>
    ),
    compare: card('compare', (i) => <W.CompareWidget i={i} />),
    profit: profit.data ? <ProfitStatement p={profit.data} /> : null,
    salesTrend: (
        <div className="card p-4 lg:col-span-2 min-w-0"><h3 className="text-sm font-medium text-fg mb-0.5">Sales trend</h3><p className="text-xs text-muted mb-2">Time-series revenue (₹)</p><div id="analyticsSalesTrendChart"><ChartCanvas config={c.sales} height={260} label="Sales trend" /></div></div>
    ),
    expenses: (
        <div className="card p-4 min-w-0"><h3 className="text-sm font-medium text-fg mb-0.5">Expense breakdown</h3><p className="text-xs text-muted mb-2">By category</p><div id="analyticsExpenseDonutChart"><ChartCanvas config={c.donut} height={260} label="Expense breakdown" /></div>{!c.hasExpenses && <p id="analyticsExpenseDonutNote" className="text-xs text-muted text-center mt-1">No expenses recorded in this period</p>}</div>
    ),
    peakHours: card('peakHours', (i) => <W.PeakHoursWidget i={i} />),
    heatmap: card('heatmap', (i) => <W.HeatmapWidget i={i} />),
    weekday: card('weekday', (i) => <W.WeekdayWidget i={i} />),
    orderType: card('orderType', (i) => <W.SplitWidget slices={i.byOrderType} id="analyticsOrderTypeSplit" label="Sales by order type" empty="No sales in this period" />),
    paymentMode: card('paymentMode', (i) => <W.SplitWidget slices={i.byPaymentMode} id="analyticsPaymentSplit" label="Sales by payment mode" empty="No sales in this period" />),
    category: card('category', (i) => <W.CategoryWidget i={i} />),
    topDishes: (
        <div className="card p-4 min-w-0"><h3 className="text-sm font-medium text-fg mb-0.5">Top selling dishes</h3><p className="text-xs text-muted mb-2">Ranked by volume</p>
          <div id="analyticsTopDishesList" className="space-y-2">{(d.topSellingDishes ?? []).length === 0 ? <p className="text-center text-sm text-muted py-6">No orders recorded in this period</p> : (d.topSellingDishes ?? []).map((x, i) => (
            <div key={x.dishName + i} className="flex items-center justify-between gap-3 rounded-lg border border-line p-2.5 text-sm"><span className="flex items-center gap-2.5 min-w-0"><span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${medal(i)}`}>{i + 1}</span><span className="min-w-0"><span className="font-medium text-fg block truncate">{x.dishName}</span><span className="text-xs text-muted">{x.percentageOfSales || 0}% of sales</span></span></span>
              <span className="text-right shrink-0"><b className="text-brand-text block">{x.quantity} sold</b><span className="text-xs text-muted">₹{(x.revenue || 0).toLocaleString('en-IN')}</span></span></div>))}</div></div>
    ),
    cashFlow: (
        <div className="card p-4 lg:col-span-2 min-w-0"><h3 className="text-sm font-medium text-fg mb-0.5">Cash flow</h3><p className="text-xs text-muted mb-2">Comparison</p><div id="analyticsCashFlowChart"><ChartCanvas config={c.cash} height={240} label="Cash flow" /></div></div>
    ),
    staff: card('staff', (i) => <W.StaffWidget i={i} />),
    tables: card('tables', (i) => <W.TablesWidget i={i} />),
    menuMatrix: card('menuMatrix', (i) => <W.MenuMatrixWidget i={i} />),
    dishProfit: card('dishProfit', (i) => <W.DishProfitWidget i={i} />),
    neverSold: card('neverSold', (i) => <W.NeverSoldWidget i={i} />),
    discounts: card('discounts', (i) => <W.DiscountsWidget i={i} />),
    tax: card('tax', (i) => <W.TaxWidget i={i} />),
    stock: card('stock', (i) => <W.StockWidget i={i} />),
    suppliers: (
        <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Supplier spending <span className="text-muted font-normal">· purchases vs paid</span></p>
          <table className="rtable"><thead><tr><th>Supplier</th><th>Invoices</th><th className="text-right">Invoiced</th><th className="text-right">Paid</th><th className="text-right">Balance due</th><th className="text-right">% share</th></tr></thead>
            <tbody id="analyticsSupplierSpendBody">{(d.supplierSpending ?? []).length === 0 ? none(6, 'No supplier purchases or payments recorded in this period') : (d.supplierSpending ?? []).map((s, i) => {
              const due = s.outstandingBalance ?? Math.max(0, (s.totalSpend || 0) - (s.amountPaid || 0));
              return <tr key={s.supplierName + i}><td data-label="" className="cell-title font-medium text-fg">{s.supplierName}</td><td data-label="Invoices">{s.invoiceCount}</td><td data-label="Invoiced" className="md:text-right font-semibold text-brand-text">{inr2(s.totalSpend)}</td><td data-label="Paid" className="md:text-right text-ok">{inr2(s.amountPaid)}</td><td data-label="Due" className={`md:text-right font-semibold ${due > 0 ? 'text-danger' : 'text-muted'}`}>{inr2(due)}</td><td data-label="Share" className="md:text-right text-muted">{s.percentage || 0}%</td></tr>;
            })}</tbody></table></div>
    ),
    purchased: (
        <div className="card overflow-hidden"><p className="px-4 py-3 border-b border-line text-sm font-medium text-fg">Top purchased ingredients</p>
          <table className="rtable"><thead><tr><th>Ingredient / product</th><th>Purchased qty</th><th className="text-right">Avg rate</th><th className="text-right">Total spend</th></tr></thead>
            <tbody id="analyticsPurchasedProductsBody">{(d.topPurchasedProducts ?? []).length === 0 ? none(4, 'No ingredient purchases recorded in this period') : (d.topPurchasedProducts ?? []).map((p, i) => (
              <tr key={p.productName + i}><td data-label="" className="cell-title font-medium text-fg">{p.productName}</td><td data-label="Qty">{p.totalQuantity} {p.unit || ''}</td><td data-label="Avg rate" className="md:text-right text-muted">₹{(p.avgUnitRate || 0).toFixed(2)}</td><td data-label="Spend" className="md:text-right font-semibold text-brand-text">{inr2(p.totalSpend)}</td></tr>))}</tbody></table></div>
    ),
    drill: (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line"><h3 className="font-medium text-fg">Source records (drill-down)</h3><p className="text-sm text-muted">Trace every summary amount back to the original records.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{DRILL_TABS.map(([id, label]) => <button key={id} type="button" id={`dtab-${id}`} onClick={() => setDrill(id)} className={`btn btn-sm ${drill === id ? 'btn-primary' : 'btn-secondary'}`}>{label} <span id={`drill${id[0].toUpperCase()}${id.slice(1)}Count`} className="badge badge-neutral ml-1">{counts[id]}</span></button>)}</div></div>
        <div id={`drillSection-${drill}`}>
          {drill === 'sales' && <table className="rtable"><thead><tr><th>Bill #</th><th>Date / time</th><th>Table</th><th>Customer</th><th>Mode</th><th className="text-right">Amount</th></tr></thead><tbody id="drillSalesBody">{(dd.sales ?? []).length === 0 ? none(6, 'No completed bills in this period') : (dd.sales ?? []).map((b, i) => <tr key={b.billNumber + i}><td data-label="" className="cell-title font-mono font-semibold text-brand-text">{b.billNumber}</td><td data-label="When" className="text-xs text-muted">{b.createdAt}</td><td data-label="Table">{b.tableNumber || 'Takeaway'}</td><td data-label="Customer">{b.customerName || '-'}</td><td data-label="Mode"><Badge>{b.paymentMode}</Badge></td><td data-label="Amount" className="md:text-right font-semibold text-ok">{inr2(b.netAmount)}</td></tr>)}</tbody></table>}
          {drill === 'expenses' && <table className="rtable"><thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Paid by</th><th>Receipt / ref</th><th className="text-right">Amount</th></tr></thead><tbody id="drillExpensesBody">{(dd.expenses ?? []).length === 0 ? none(6, 'No operating expenses in this period') : (dd.expenses ?? []).map((e, i) => <tr key={i}><td data-label="Category"><Badge tone="danger">{e.type}</Badge></td><td data-label="" className="cell-title text-fg">{e.description}</td><td data-label="Date" className="text-xs text-muted">{e.expenseDate}</td><td data-label="Paid by" className="text-muted">{e.paidBy || '-'}</td><td data-label="Ref" className="font-mono text-xs text-muted">{e.receiptRef || '-'}</td><td data-label="Amount" className="md:text-right font-semibold text-danger">{inr2(e.amount)}</td></tr>)}</tbody></table>}
          {drill === 'purchases' && <table className="rtable"><thead><tr><th>Invoice #</th><th>Supplier</th><th>Date</th><th className="text-right">Subtotal</th><th className="text-right">GST</th><th className="text-right">Total invoiced</th><th>Status</th></tr></thead><tbody id="drillPurchasesBody">{(dd.purchases ?? []).length === 0 ? none(7, 'No supplier invoices in this period') : (dd.purchases ?? []).map((p, i) => <tr key={i}><td data-label="" className="cell-title font-mono font-semibold text-brand-text">{p.invoiceNumber}</td><td data-label="Supplier" className="font-medium text-fg">{p.supplierName}</td><td data-label="Date" className="text-xs text-muted">{p.invoiceDate}</td><td data-label="Subtotal" className="md:text-right text-muted">₹{(p.subtotal || 0).toFixed(2)}</td><td data-label="GST" className="md:text-right text-muted">₹{(p.gstAmount || 0).toFixed(2)}</td><td data-label="Total" className="md:text-right font-semibold text-brand-text">{inr2(p.totalAmount)}</td><td data-label="Status"><Badge tone={p.status === 'PAID' ? 'ok' : 'warn'}>{p.status}</Badge></td></tr>)}</tbody></table>}
          {drill === 'supplierPayments' && <table className="rtable"><thead><tr><th>Payment date</th><th>Supplier</th><th>Linked invoice</th><th>Mode</th><th>Ref / trans #</th><th>Notes</th><th className="text-right">Amount paid</th></tr></thead><tbody id="drillSupplierPaymentsBody">{(dd.supplierPayments ?? []).length === 0 ? none(7, 'No supplier payments disbursed in this period') : (dd.supplierPayments ?? []).map((s, i) => <tr key={i}><td data-label="" className="cell-title text-xs text-fg">{s.paymentDate || '-'}</td><td data-label="Supplier" className="font-medium text-fg">{s.supplierName || '-'}</td><td data-label="Invoice" className="font-mono text-brand-text">{s.invoiceNumber || '-'}</td><td data-label="Mode"><Badge tone="info">{s.paymentMode || 'CASH'}</Badge></td><td data-label="Ref" className="font-mono text-xs text-muted">{s.referenceNumber || '-'}</td><td data-label="Notes" className="text-xs text-muted">{s.notes || '-'}</td><td data-label="Amount" className="md:text-right font-semibold text-ok">{inr2(s.amount)}</td></tr>)}</tbody></table>}
          {drill === 'salaries' && <table className="rtable"><thead><tr><th>Staff member</th><th>Payroll month</th><th>Payment date</th><th>Mode</th><th>Status</th><th className="text-right">Net salary</th></tr></thead><tbody id="drillSalariesBody">{(dd.salaries ?? []).length === 0 ? none(6, 'No salary payouts in this period') : (dd.salaries ?? []).map((s, i) => <tr key={i}><td data-label="" className="cell-title font-medium text-fg">{s.employeeName}</td><td data-label="Month">{s.month}/{s.year}</td><td data-label="Paid on" className="text-xs text-muted">{s.paymentDate || '-'}</td><td data-label="Mode" className="text-muted">{s.paymentMode || 'CASH'}</td><td data-label="Status"><Badge tone={s.status === 'PAID' ? 'ok' : 'warn'}>{s.status}</Badge></td><td data-label="Net" className="md:text-right font-semibold text-danger">{inr2(s.netSalary)}</td></tr>)}</tbody></table>}
        </div>
      </div>
    ),
  };
  const SPAN: Record<Span, string> = { full: 'lg:col-span-12', wide: 'lg:col-span-8', half: 'lg:col-span-6', third: 'lg:col-span-4' };

  return (
    <div id="analytics-sub-overview" className="space-y-4">
      <p className="text-sm text-muted">Period: <strong id="analyticsPeriodLabel" className="text-fg">{d.periodInfo ? `${d.periodInfo.startDate} to ${d.periodInfo.endDate}` : ''}</strong></p>
      {order.length === 0 ? <div className="card"><EmptyState icon="fa-sliders" title="Every section is hidden. Use Customize to bring some back." /></div> : (
        <div className="grid grid-cols-12 gap-4">
          {order.map((id) => parts[id] && <div key={id} id={`widget-${id}`} data-widget={id} className={`col-span-12 min-w-0 [&>.card]:h-full ${SPAN[WIDGETS.find((w) => w.id === id)!.span]}`}>{parts[id]}</div>)}
        </div>)}
    </div>
  );
}
