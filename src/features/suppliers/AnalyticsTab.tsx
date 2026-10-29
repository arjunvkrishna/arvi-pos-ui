import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../../components/ChartCanvas';
import { chartColors } from '../../lib/chartColors';
import { EmptyState, Skeleton } from '../../components/ui';
import type { SupplierAnalytics } from './api';
import { useSupplierAnalytics } from './hooks';
import { fmtINR } from './rules';

const MODE_COLORS: Record<string, string> = { CASH: '#f59e0b', UPI: '#60a5fa', BANK_TRANSFER: '#a78bfa', CHEQUE: '#34d399' };

function configs(d: SupplierAnalytics): { title: string; icon: string; label: string; config: ChartConfiguration | null }[] {
  const { muted } = chartColors();
  const axes = { x: { ticks: { color: muted } }, y: { ticks: { color: muted } } };
  const noLegend = { legend: { display: false } };
  const modes = d.paymentModeBreakdown ?? {};
  return [
    { title: 'Outstanding by supplier', icon: 'fa-chart-bar', label: 'Outstanding by supplier', config: d.outstandingBySupplier?.length ? {
      type: 'bar', data: { labels: d.outstandingBySupplier.map((r) => r.supplierName), datasets: [{ label: 'Outstanding (₹)', data: d.outstandingBySupplier.map((r) => r.outstanding), backgroundColor: 'rgba(251,113,133,0.5)', borderColor: '#fb7185', borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: noLegend, scales: axes } } : null },
    { title: 'Monthly payment trend', icon: 'fa-chart-line', label: 'Monthly payment trend', config: d.monthlyPaymentTrend?.length ? {
      type: 'line', data: { labels: d.monthlyPaymentTrend.map((r) => r.month), datasets: [{ label: 'Paid (₹)', data: d.monthlyPaymentTrend.map((r) => r.paid), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', fill: true, tension: 0.4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: noLegend, scales: axes } } : null },
    { title: 'Payment mode breakdown', icon: 'fa-chart-pie', label: 'Payment mode breakdown', config: Object.keys(modes).length ? {
      type: 'doughnut', data: { labels: Object.keys(modes), datasets: [{ data: Object.values(modes), backgroundColor: Object.keys(modes).map((k) => MODE_COLORS[k] || '#6b7280') }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: muted } } } } } : null },
    { title: 'Top suppliers by invoice value', icon: 'fa-trophy', label: 'Top suppliers by invoice value', config: d.topSuppliersByInvoice?.length ? {
      type: 'bar', data: { labels: d.topSuppliersByInvoice.map((r) => r.supplierName), datasets: [{ label: 'Total invoiced (₹)', data: d.topSuppliersByInvoice.map((r) => r.totalInvoiced), backgroundColor: 'rgba(167,139,250,0.5)', borderColor: '#a78bfa', borderWidth: 1 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: noLegend, scales: axes } } : null },
  ];
}

export function SupplierAnalyticsTab() {
  const q = useSupplierAnalytics();
  if (q.isPending) return <div id="supplier-sub-analytics" className="card"><Skeleton rows={4} /></div>;
  if (q.isError) return <p id="supplier-sub-analytics" className="card p-6 text-center text-sm text-danger">Failed to load supplier analytics: {q.error.message}</p>;
  const d = q.data;
  const kpis = [
    { id: 'kpiOutstanding', label: 'Total outstanding', value: fmtINR(d.totalOutstanding), tone: 'text-danger' },
    { id: 'kpiOverdue', label: 'Overdue invoices', value: String(d.overdueInvoiceCount), tone: 'text-warn' },
    { id: 'kpiPaidMonth', label: 'Paid this month', value: fmtINR(d.totalPaidThisMonth), tone: 'text-ok' },
    { id: 'kpiSupplierCount', label: 'Active suppliers', value: String(d.activeSupplierCount), tone: 'text-info' },
    { id: 'kpiOnTimeDelivery', label: 'On-time delivery', value: d.onTimeDeliveryRatePercent != null ? `${d.onTimeDeliveryRatePercent}%` : 'No data', tone: 'text-ok' },
    { id: 'kpiLeadTime', label: 'Average lead time', value: d.averageLeadTimeDays != null ? `${d.averageLeadTimeDays} days` : 'No data', tone: 'text-info' },
    { id: 'kpiFulfillment', label: 'PO fulfillment rate', value: d.fulfillmentRatePercent != null ? `${d.fulfillmentRatePercent}%` : 'No data', tone: 'text-ok' },
  ];
  return (
    <div id="supplier-sub-analytics" className="space-y-4">
      <div id="supplierKpiCards" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((k) => <div key={k.id} className="card p-4"><p className="text-xs text-muted">{k.label}</p><p id={k.id} className={`text-2xl font-semibold mt-1 ${k.tone}`}>{k.value}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {configs(d).map((c) => (
          <div key={c.title} className="card p-4 min-w-0"><h3 className="text-sm font-medium text-fg mb-3"><i className={`fa-solid ${c.icon} mr-1.5 text-faint`} />{c.title}</h3>
            {c.config ? <ChartCanvas config={c.config} label={c.label} /> : <EmptyState icon="fa-chart-simple" title="Nothing to show yet" />}</div>
        ))}
      </div>
    </div>
  );
}
