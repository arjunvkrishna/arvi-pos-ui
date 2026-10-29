import { useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../../components/ChartCanvas';
import { Badge, EmptyState } from '../../components/ui';
import { chartColors } from '../../lib/chartColors';
import type { DishRow, Insights, Slice } from './api';
import { QUADRANT, deltaView, heatLevel, highlights, hourLabel, hourRange, peakHours } from './insights';
import { inr0, inr2 } from './rules';

const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#eab308', '#64748b'];
const TONE_TEXT = { ok: 'text-ok', danger: 'text-danger', neutral: 'text-muted' } as const;
const rupee = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const none = (text: string) => <p className="text-sm text-muted text-center py-8">{text}</p>;

export function Delta({ m, higherIsBetter = true, id }: { m: Parameters<typeof deltaView>[0]; higherIsBetter?: boolean; id?: string }) {
  const v = deltaView(m, higherIsBetter);
  return <span id={id} className={`text-xs font-semibold ${TONE_TEXT[v.tone]}`}>{v.text}</span>;
}

/** A few sentences about the period, in plain words. */
export function HighlightsWidget({ i }: { i: Insights }) {
  const list = highlights(i);
  if (list.length === 0) return none('There is nothing to report for this period yet.');
  const icon = { ok: 'fa-circle-check text-ok', danger: 'fa-triangle-exclamation text-danger', neutral: 'fa-circle-info text-info' } as const;
  return <ul id="analyticsHighlights" className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">{list.map((h) => <li key={h.id} data-highlight={h.id} className="flex items-start gap-2.5 text-sm text-fg"><i className={`fa-solid ${icon[h.tone]} mt-0.5 shrink-0`} /><span>{h.text}</span></li>)}</ul>;
}

/** The same key numbers for the period just before, and how far they moved. */
export function CompareWidget({ i }: { i: Insights }) {
  const c = i.compare;
  const cards: { id: string; label: string; m: typeof c.sales; fmt: (n: number) => string; better: boolean }[] = [
    { id: 'Sales', label: 'Sales', m: c.sales, fmt: inr0, better: true }, { id: 'Orders', label: 'Orders', m: c.orders, fmt: (n) => String(n), better: true },
    { id: 'AvgOrder', label: 'Average bill', m: c.avgOrder, fmt: inr0, better: true }, { id: 'Items', label: 'Dishes per order', m: c.itemsPerOrder, fmt: (n) => n.toFixed(1), better: true },
    { id: 'Discounts', label: 'Discounts given', m: c.discounts, fmt: inr0, better: false }, { id: 'Refunds', label: 'Refunds', m: c.refunds, fmt: inr0, better: false }, { id: 'Voids', label: 'Voided orders', m: c.voids, fmt: (n) => String(n), better: false },
  ];
  return (
    <div>
      <p className="text-xs text-muted mb-3">This period {i.start} to {i.end}, against {i.prevStart} to {i.prevEnd}.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((x) => (
          <div key={x.id} className="rounded-lg border border-line p-3" data-compare={x.id}>
            <p className="text-xs text-muted">{x.label}</p>
            <p className="text-lg font-semibold text-fg mt-0.5">{x.fmt(x.m.current)}</p>
            <p className="text-xs text-muted mt-1 flex items-center justify-between gap-2"><span>was {x.fmt(x.m.previous)}</span><Delta id={`cmpDelta${x.id}`} m={x.m} higherIsBetter={x.better} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sales per hour of the day, the three busiest hours in colour. */
export function PeakHoursWidget({ i }: { i: Insights }) {
  const top = peakHours(i.byHour, 3);
  const topSet = new Set(top.map((h) => h.hour));
  const active = i.byHour.filter((h) => h.sales > 0);
  if (active.length === 0) return none('No sales in this period');
  const first = Math.max(0, Math.min(...active.map((h) => h.hour)) - 1); const last = Math.min(23, Math.max(...active.map((h) => h.hour)) + 1);
  const hours = i.byHour.filter((h) => h.hour >= first && h.hour <= last);
  const { muted, line } = chartColors();
  const config: ChartConfiguration = { type: 'bar', data: { labels: hours.map((h) => hourLabel(h.hour)), datasets: [{ label: 'Sales (₹)', data: hours.map((h) => h.sales), backgroundColor: hours.map((h) => (topSet.has(h.hour) ? '#f59e0b' : 'rgba(148,163,184,0.45)')), borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => hourRange(hours[c[0].dataIndex].hour), label: (c) => `Sales: ${rupee(c.raw)}`, afterLabel: (c) => `${hours[c.dataIndex].orders} order${hours[c.dataIndex].orders === 1 ? '' : 's'}` } } },
      scales: { y: { beginAtZero: true, ticks: { color: muted, callback: (v) => `₹${v}` }, grid: { color: line } }, x: { ticks: { color: muted, maxRotation: 0, autoSkip: true }, grid: { display: false } } } } };
  return (
    <div>
      <p id="analyticsPeakHint" className="text-sm text-fg mb-2">Busiest: {top.map((h) => `${hourRange(h.hour)} (${inr0(h.sales)})`).join(' · ')}</p>
      <div id="analyticsPeakHoursChart"><ChartCanvas config={config} height={240} label="Sales by hour of the day" /></div>
    </div>
  );
}

/** A weekday by hour grid: the darker the square, the more was sold then. */
export function HeatmapWidget({ i }: { i: Insights }) {
  const max = Math.max(0, ...i.heatmap.flat());
  if (max <= 0) return none('No sales in this period');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const alpha = [0.05, 0.22, 0.42, 0.68, 1];
  const used = i.heatmap.flatMap((r) => r.map((v, h) => (v > 0 ? h : -1))).filter((h) => h >= 0);
  const from = Math.max(0, Math.min(...used)); const to = Math.min(23, Math.max(...used));
  const hours = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  return (
    <div>
      <div className="overflow-x-auto no-scrollbar" id="analyticsHeatmap" role="table" aria-label="Sales by weekday and hour">
        <div className="min-w-max">
          <div className="flex pl-10 gap-1 mb-1">{hours.map((h) => <span key={h} className="w-7 shrink-0 text-center text-[10px] text-muted">{h % 3 === 0 ? hourLabel(h).replace(' ', '') : ''}</span>)}</div>
          {i.heatmap.map((row, d) => (
            <div key={d} className="flex items-center gap-1 mb-1" role="row">
              <span className="w-9 shrink-0 text-xs text-muted">{days[d]}</span>
              {hours.map((h) => { const v = row[h] ?? 0; const lv = heatLevel(v, max); return <span key={h} role="cell" data-level={lv} title={`${days[d]} ${hourRange(h)}: ${v > 0 ? inr0(v) : 'no sales'}`} className="w-7 h-7 shrink-0 rounded" style={{ background: lv === 0 ? 'rgb(var(--subtle))' : `rgb(var(--brand) / ${alpha[lv]})` }} />; })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted mt-2 flex items-center gap-1.5">Less <span className="inline-flex gap-0.5">{alpha.map((a, k) => <span key={k} className="w-4 h-3 rounded-sm" style={{ background: k === 0 ? 'rgb(var(--subtle))' : `rgb(var(--brand) / ${a})` }} />)}</span> More</p>
    </div>
  );
}

/** Average sales per day for each weekday, best and slowest marked. */
export function WeekdayWidget({ i }: { i: Insights }) {
  const days = i.byWeekday;
  if (days.every((d) => d.sales === 0)) return none('No sales in this period');
  const live = days.filter((d) => d.days > 0 && d.orders > 0);
  const best = live.length ? Math.max(...live.map((d) => d.salesPerDay)) : 0; const worst = live.length ? Math.min(...live.map((d) => d.salesPerDay)) : 0;
  const { muted, line } = chartColors();
  const config: ChartConfiguration = { type: 'bar', data: { labels: days.map((d) => d.label), datasets: [{ label: 'Average sales per day (₹)', data: days.map((d) => d.salesPerDay), backgroundColor: days.map((d) => (d.salesPerDay === best && best > 0 ? '#10b981' : d.salesPerDay === worst && live.length > 1 ? '#f43f5e' : 'rgba(148,163,184,0.5)')), borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Per day: ${rupee(c.raw)}`, afterLabel: (c) => `${days[c.dataIndex].orders} orders over ${days[c.dataIndex].days} days · average bill ${rupee(days[c.dataIndex].avgOrder)}` } } },
      scales: { y: { beginAtZero: true, ticks: { color: muted, callback: (v) => `₹${v}` }, grid: { color: line } }, x: { ticks: { color: muted }, grid: { display: false } } } } };
  return <div id="analyticsWeekdayChart"><ChartCanvas config={config} height={220} label="Average sales by weekday" /><p className="text-xs text-muted mt-1.5"><span className="text-ok">Green</span> is the best day, <span className="text-danger">red</span> the slowest.</p></div>;
}

/** A donut with a legend that carries the numbers (the legend is also the text version of the chart). */
export function SplitWidget({ slices, id, label, empty }: { slices: Slice[]; id: string; label: string; empty: string }) {
  if (slices.length === 0) return none(empty);
  const { muted } = chartColors();
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const config: ChartConfiguration<'doughnut'> = { type: 'doughnut', data: { labels: slices.map((s) => s.label), datasets: [{ data: slices.map((s) => s.amount), backgroundColor: PALETTE.slice(0, slices.length), borderWidth: 2, borderColor: 'transparent' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${rupee(c.raw)} (${slices[c.dataIndex].share}%)` } } } } };
  void muted;
  return (
    <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4" id={id}>
      <div className="w-40 shrink-0"><ChartCanvas config={config as unknown as ChartConfiguration} height={160} label={label} /></div>
      <ul className="flex-1 min-w-0 w-full space-y-1.5 text-sm">
        {slices.map((s, k) => <li key={s.label} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[k % PALETTE.length] }} /><span className="truncate text-fg">{s.label}</span></span><span className="shrink-0 text-muted"><b className="text-fg">{inr0(s.amount)}</b> · {s.share}%</span></li>)}
        <li className="text-xs text-muted pt-1 border-t border-line">{slices.reduce((s, x) => s + x.orders, 0) || ''}{slices[0].orders ? ' orders · ' : ''}total {inr0(total)}</li>
      </ul>
    </div>
  );
}

/** Horizontal bars with the numbers beside them (categories, staff). */
export function BarList({ rows, id, empty, render }: { rows: { key: string; label: string; value: number; share: number; sub: string }[]; id: string; empty: string; render?: (r: { key: string }) => React.ReactNode }) {
  if (rows.length === 0) return none(empty);
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul id={id} className="space-y-3">
      {rows.map((r, k) => (
        <li key={r.key} data-row={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-medium text-fg truncate">{r.label}</span><span className="shrink-0 text-muted"><b className="text-fg">{inr0(r.value)}</b> · {r.share}%</span></div>
          <div className="h-2 rounded-full bg-subtle mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: PALETTE[k % PALETTE.length] }} /></div>
          <p className="text-xs text-muted mt-0.5">{r.sub}</p>{render?.({ key: r.key })}
        </li>
      ))}
    </ul>
  );
}

export const CategoryWidget = ({ i }: { i: Insights }) => <BarList id="analyticsCategoryList" empty="No sales in this period" rows={i.byCategory.map((c) => ({ key: c.label, label: c.label, value: c.amount, share: c.share, sub: `${c.quantity} dish${c.quantity === 1 ? '' : 'es'} sold` }))} />;
export const StaffWidget = ({ i }: { i: Insights }) => <BarList id="analyticsStaffList" empty="No orders in this period" rows={i.byStaff.map((s) => ({ key: s.staff, label: s.staff, value: s.sales, share: s.share, sub: `${s.orders} order${s.orders === 1 ? '' : 's'} · average bill ${inr0(s.avgOrder)}` }))} />;

export function TablesWidget({ i }: { i: Insights }) {
  if (i.byTable.length === 0) return none('No table orders in this period');
  return <ol id="analyticsTablesList" className="space-y-2">{i.byTable.map((t, k) => <li key={t.table} className="flex items-center justify-between gap-3 rounded-lg border border-line p-2.5 text-sm"><span className="flex items-center gap-2.5"><span className="w-6 h-6 rounded-full bg-subtle text-muted text-xs font-bold flex items-center justify-center">{k + 1}</span><b className="text-fg">{t.table}</b></span><span className="text-muted"><b className="text-brand-text">{inr0(t.sales)}</b> · {t.orders} order{t.orders === 1 ? '' : 's'}</span></li>)}</ol>;
}

const QUAD_ORDER = ['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const;
const QUAD_COLOR: Record<string, string> = { STAR: '#10b981', PLOWHORSE: '#f59e0b', PUZZLE: '#3b82f6', DOG: '#f43f5e' };

/** Dishes by how much they sell (across) and how much they earn per dish (up), in four groups with advice. */
export function MenuMatrixWidget({ i }: { i: Insights }) {
  const known = i.dishes.filter((d) => d.quadrant && d.profit != null);
  if (known.length === 0) return none('No dish with a recipe sold in this period. Link recipes in Stock Links to see profit per dish.');
  const { muted, line } = chartColors();
  const per = (d: DishRow) => Math.round(((d.profit ?? 0) / d.quantity) * 100) / 100;
  const config: ChartConfiguration = { type: 'scatter', data: { datasets: QUAD_ORDER.map((q) => ({ label: QUADRANT[q].label, data: known.filter((d) => d.quadrant === q).map((d) => ({ x: d.quantity, y: per(d), name: d.name })), backgroundColor: QUAD_COLOR[q], pointRadius: 6, pointHoverRadius: 8 })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: muted, boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => { const p = c.raw as { x: number; y: number; name: string }; return `${p.name}: ${p.x} sold, ₹${p.y} profit each`; } } } },
      scales: { x: { title: { display: true, text: 'Dishes sold', color: muted }, beginAtZero: true, ticks: { color: muted, precision: 0 }, grid: { color: line } }, y: { title: { display: true, text: 'Profit per dish (₹)', color: muted }, ticks: { color: muted }, grid: { color: line } } } } };
  return (
    <div className="space-y-4">
      <div id="analyticsMenuMatrixChart"><ChartCanvas config={config} height={300} label="Menu matrix: dishes sold against profit per dish" /></div>
      <div id="analyticsMenuGroups" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {QUAD_ORDER.map((q) => { const list = known.filter((d) => d.quadrant === q); return (
          <div key={q} data-quadrant={q} className="rounded-lg border border-line p-3">
            <p className="flex items-center justify-between gap-2"><Badge tone={QUADRANT[q].tone}>{QUADRANT[q].label}</Badge><b className="text-fg">{list.length}</b></p>
            <p className="text-xs text-muted mt-2">{QUADRANT[q].advice}</p>
            <p className="text-xs text-fg mt-2 line-clamp-3">{list.slice(0, 6).map((d) => d.name).join(' · ') || '-'}{list.length > 6 ? ` +${list.length - 6}` : ''}</p>
          </div>); })}
      </div>
    </div>
  );
}

type SortKey = 'revenue' | 'profit' | 'margin' | 'quantity';
/** Revenue, cost and profit per dish, filterable by group and sortable. */
export function DishProfitWidget({ i }: { i: Insights }) {
  const [sort, setSort] = useState<SortKey>('revenue');
  const [group, setGroup] = useState<'ALL' | 'NONE' | (typeof QUAD_ORDER)[number]>('ALL');
  if (i.dishes.length === 0) return none('No dishes sold in this period');
  const val = (d: DishRow) => (sort === 'profit' ? d.profit ?? -Infinity : sort === 'margin' ? d.marginPercent ?? -Infinity : sort === 'quantity' ? d.quantity : d.revenue);
  const rows = [...i.dishes].filter((d) => group === 'ALL' || (group === 'NONE' ? d.cost == null : d.quadrant === group)).sort((a, b) => val(b) - val(a));
  const heads: [SortKey, string][] = [['quantity', 'Sold'], ['revenue', 'Revenue'], ['profit', 'Profit'], ['margin', 'Margin']];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select id="dishProfitGroup" aria-label="Show dishes" value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="input w-auto">
          <option value="ALL">All dishes</option>{QUAD_ORDER.map((q) => <option key={q} value={q}>{QUADRANT[q].label}</option>)}<option value="NONE">No recipe (cost unknown)</option>
        </select>
        <span className="flex gap-1.5 flex-wrap">{heads.map(([k, l]) => <button key={k} type="button" data-sort={k} aria-pressed={sort === k} onClick={() => setSort(k)} className={`btn btn-sm ${sort === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>)}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="rtable"><thead><tr><th>Dish</th><th>Category</th><th className="text-right">Sold</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th>Group</th></tr></thead>
          <tbody id="dishProfitBody">{rows.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-muted py-6">No dishes in this group</td></tr> : rows.slice(0, 30).map((d, k) => (
            <tr key={`${d.name}-${k}`}><td data-label="" className="cell-title font-medium text-fg">{d.name}</td><td data-label="Category" className="text-muted">{d.category}</td><td data-label="Sold" className="md:text-right">{d.quantity}</td><td data-label="Revenue" className="md:text-right font-semibold text-brand-text">{inr2(d.revenue)}</td>
              <td data-label="Cost" className="md:text-right text-muted">{d.cost != null ? inr2(d.cost) : 'no recipe'}</td><td data-label="Profit" className={`md:text-right font-semibold ${(d.profit ?? 0) < 0 ? 'text-danger' : 'text-ok'}`}>{d.profit != null ? inr2(d.profit) : '-'}</td>
              <td data-label="Margin" className="md:text-right">{d.marginPercent != null ? `${d.marginPercent}%` : '-'}</td><td data-label="Group">{d.quadrant ? <Badge tone={QUADRANT[d.quadrant].tone}>{QUADRANT[d.quadrant].label}</Badge> : <span className="text-xs text-muted">-</span>}</td></tr>))}</tbody></table>
      </div>
      {rows.length > 30 && <p className="text-xs text-muted">Showing the first 30 of {rows.length}.</p>}
    </div>
  );
}

export function NeverSoldWidget({ i }: { i: Insights }) {
  if (i.neverSoldCount === 0) return <p id="analyticsNeverSold" className="text-sm text-ok py-4 text-center"><i className="fa-solid fa-circle-check mr-1.5" />Every active dish sold at least once.</p>;
  return (
    <div id="analyticsNeverSold">
      <p className="text-sm text-fg mb-2"><b>{i.neverSoldCount}</b> active dish{i.neverSoldCount === 1 ? '' : 'es'} with no sale in this period.</p>
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">{i.neverSold.map((d, k) => <span key={`${d.name}-${k}`} className="badge badge-neutral" title={d.category}>{d.name}</span>)}</div>
      {i.neverSoldCount > i.neverSold.length && <p className="text-xs text-muted mt-2">+{i.neverSoldCount - i.neverSold.length} more</p>}
    </div>
  );
}

const Tile = ({ id, label, value, tone = 'text-fg', sub }: { id: string; label: string; value: string; tone?: string; sub?: string }) => (
  <div className="rounded-lg border border-line p-3"><p className="text-xs text-muted">{label}</p><p id={id} className={`text-lg font-semibold mt-0.5 ${tone}`}>{value}</p>{sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}</div>
);

export function DiscountsWidget({ i }: { i: Insights }) {
  const d = i.discounts; const l = i.losses;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile id="lossDiscounts" label="Discounts and promotions" value={inr0(d.total)} tone="text-warn" sub={`${d.billsWithDiscount} bill${d.billsWithDiscount === 1 ? '' : 's'} · ${d.percentOfGross}% of sales before discount`} />
      <Tile id="lossRefunds" label="Refunds" value={inr0(l.refundAmount)} tone={l.refundAmount > 0 ? 'text-danger' : 'text-fg'} sub={`${l.refundCount} refund${l.refundCount === 1 ? '' : 's'}`} />
      <Tile id="lossVoids" label="Voided orders" value={String(l.voidedCount)} tone={l.voidedCount > 0 ? 'text-danger' : 'text-fg'} sub={`worth ${inr0(l.voidedValue)}`} />
      <Tile id="lossCancelled" label="Cancelled orders" value={String(l.cancelledCount)} sub="never billed" />
      <Tile id="lossWaste" label="Stock wasted" value={inr0(l.wasteCost)} tone={l.wasteCost > 0 ? 'text-danger' : 'text-fg'} sub="expired, spoiled, broken, discarded food" />
    </div>
  );
}

export function TaxWidget({ i }: { i: Insights }) {
  const t = i.tax;
  if (t.totalTax <= 0 && t.taxableSales <= 0) return none('No GST bills in this period');
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile id="taxTaxable" label="Taxable sales" value={inr2(t.taxableSales)} /><Tile id="taxTotal" label="GST collected" value={inr2(t.totalTax)} tone="text-brand-text" />
      <Tile id="taxCgst" label="CGST" value={inr2(t.cgst)} /><Tile id="taxSgst" label="SGST" value={inr2(t.sgst)} />
    </div>
  );
}

export function StockWidget({ i }: { i: Insights }) {
  const s = i.stock;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <Tile id="stockValue" label="Stock value" value={inr0(s.totalValue)} sub="items above zero" />
        <Tile id="stockLow" label="Low stock" value={String(s.lowCount)} tone={s.lowCount > 0 ? 'text-warn' : 'text-fg'} />
        <Tile id="stockNegative" label="Below zero" value={String(s.negativeCount)} tone={s.negativeCount > 0 ? 'text-danger' : 'text-fg'} sub="purchase not entered" />
        <Tile id="stockExpiring" label="Expiring soon" value={String(s.expiringCount)} tone={s.expiringCount > 0 ? 'text-warn' : 'text-fg'} />
        <Tile id="stockExpired" label="Expired" value={String(s.expiredCount)} tone={s.expiredCount > 0 ? 'text-danger' : 'text-fg'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div><p className="text-sm font-medium text-fg mb-2">Stock value by category</p><BarList id="stockValueList" empty="No stock items" rows={s.valueByCategory.map((c) => ({ key: c.label, label: c.label, value: c.amount, share: c.share, sub: `${c.orders} item${c.orders === 1 ? '' : 's'}` }))} /></div>
        <div><p className="text-sm font-medium text-fg mb-2">Waste in this period <span className="text-muted font-normal">· {inr0(s.wasteCost)}</span></p><BarList id="stockWasteList" empty="No waste recorded in this period" rows={s.wasteByReason.map((c) => ({ key: c.label, label: c.label, value: c.amount, share: c.share, sub: `${c.orders} entr${c.orders === 1 ? 'y' : 'ies'}` }))} /></div>
      </div>
    </div>
  );
}

export const InsightsEmpty = ({ text }: { text: string }) => <EmptyState icon="fa-chart-simple" title={text} />;
