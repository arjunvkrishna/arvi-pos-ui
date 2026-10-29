import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Skeleton, EmptyState } from '../../components/ui';
import { fetchOwnerDashboard, type LowStockAlert } from './api';
import { ItemsSoldPanel } from './ItemsSoldPanel';

const fmtINR = (val?: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val ?? 0);

/** The low-stock list can be very long, so it stays closed until you click it (like the menu sections). */
function LowStockPanel({ items, count }: { items: LowStockAlert[]; count: number }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  // the emptiest first: current stock as a share of the level it should be reordered at
  const sorted = [...items].sort((a, b) => (a.currentStock / (a.reorderLevel || 1)) - (b.currentStock / (b.reorderLevel || 1)));
  const shown = sorted.filter((i) => i.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div id="lowStockPanel" data-testid="low-stock-panel" className="card border-l-4 border-l-rose-500 bg-rose-500/5 overflow-hidden">
      <button type="button" id="btnToggleLowStock" aria-expanded={open} aria-controls="lowStockList" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-rose-500/5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-rose-500">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Low Stock Warnings</span>
          <span id="lowStockCount" className="badge badge-danger">{count} {count === 1 ? 'item' : 'items'} under reorder level</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">{open ? 'Hide' : 'Click to see them'}</span>
          <i className={`fa-solid fa-chevron-down transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div id="lowStockList" className="px-5 pb-5 space-y-3 anim-rise-in">
          {items.length > 8 && (
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none" aria-hidden="true" />
              <input id="lowStockSearch" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find an item" aria-label="Find a low-stock item" className="input pl-10" autoComplete="off" />
            </div>
          )}
          {shown.length === 0 ? <p className="text-sm text-muted text-center py-4">No item matches.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {shown.map((item) => (
                <div key={item.id} className="bg-card p-3 rounded-lg border border-border flex justify-between items-center gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg truncate">{item.name}</p>
                    <p className="text-muted">Reorder: {item.reorderLevel} {item.unit}</p>
                  </div>
                  <span className="shrink-0 px-2 py-1 bg-rose-500/10 text-rose-500 font-bold rounded">{item.currentStock} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OwnerDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['owner-dashboard', selectedDate],
    queryFn: () => fetchOwnerDashboard(selectedDate || undefined),
    refetchInterval: 30000, // Real-time live auto-refresh every 30s
  });

  return (
    <section id="tab-owner-dashboard" data-testid="tab-owner-dashboard" className="space-y-6">
      <PageHeader
        title="Live Owner Dashboard"
        description="Real-time business date revenue, live table occupancy, inventory health and daily growth metrics."
        actions={
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input input-sm border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-fg"
              title="Select Business Date"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="btn btn-secondary text-xs px-2.5 py-1"
                title="Reset to current business date"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="btn btn-primary text-sm flex items-center gap-1.5"
            >
              <i className={`fa-solid fa-arrows-rotate ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {isPending ? (
        <div className="card p-6"><Skeleton rows={6} /></div>
      ) : isError ? (
        <div className="card p-6 text-center text-danger text-sm">
          Failed to load live dashboard: {error.message}
        </div>
      ) : !data ? (
        <EmptyState icon="fa-chart-pie" title="No dashboard data found" />
      ) : (
        <div className="space-y-6">
          {/* Business Date Banner */}
          <div className="flex flex-wrap items-center justify-between bg-primary/10 border border-primary/20 px-4 py-3 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-fg">Active Business Date:</span>
              <span className="font-semibold text-primary">{data.businessDate}</span>
              <span className="text-xs text-muted">(Cutoff: 04:00 AM IST)</span>
            </div>
            <div className="text-xs text-muted">
              Live updates every 30s • Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Primary KPI Grid (Today vs Yesterday) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Sales */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-muted text-xs mb-2">
                <span>Net Sales Today</span>
                <i className="fa-solid fa-indian-rupee-sign text-primary" />
              </div>
              <div className="text-2xl font-bold text-fg mb-1">{fmtINR(data.netSalesToday)}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-semibold flex items-center gap-0.5 ${data.netSalesGrowthPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <i className={`fa-solid ${data.netSalesGrowthPercent >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`} />
                  {Math.abs(data.netSalesGrowthPercent).toFixed(1)}%
                </span>
                <span className="text-muted">vs Yesterday ({fmtINR(data.netSalesYesterday)})</span>
              </div>
            </div>

            {/* Total Bills */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-muted text-xs mb-2">
                <span>Bills Settled</span>
                <i className="fa-solid fa-receipt text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-fg mb-1">{data.billsCountToday}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-semibold flex items-center gap-0.5 ${data.billsCountGrowthPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <i className={`fa-solid ${data.billsCountGrowthPercent >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`} />
                  {Math.abs(data.billsCountGrowthPercent).toFixed(1)}%
                </span>
                <span className="text-muted">vs Yesterday ({data.billsCountYesterday})</span>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-muted text-xs mb-2">
                <span>Avg Order Value</span>
                <i className="fa-solid fa-cart-shopping text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-fg mb-1">{fmtINR(data.avgOrderValueToday)}</div>
              <div className="text-xs text-muted">
                Yesterday: {fmtINR(data.avgOrderValueYesterday)}
              </div>
            </div>

            {/* Live Table Occupancy */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-muted text-xs mb-2">
                <span>Table Occupancy</span>
                <i className="fa-solid fa-chair text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-fg mb-1">
                {data.activeTablesOccupied} <span className="text-sm font-normal text-muted">/ {data.totalTables}</span>
              </div>
              <div className="w-full bg-border rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.tableOccupancyPercent)}%` }}
                />
              </div>
              <div className="text-xs text-muted mt-1.5">{data.tableOccupancyPercent}% occupied right now</div>
            </div>
          </div>

          {/* Secondary Financials & Tender Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tender Breakdown */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                <i className="fa-solid fa-wallet text-faint" />
                <span>Today's Collections by Mode</span>
              </h3>
              {Object.keys(data.tenderBreakdown || {}).length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No settled payments yet today.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.tenderBreakdown).map(([mode, amount]) => {
                    const pct = data.netSalesToday > 0 ? (amount / data.netSalesToday) * 100 : 0;
                    return (
                      <div key={mode} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-fg uppercase">{mode}</span>
                          <span className="text-muted">{fmtINR(amount)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              mode === 'CASH' ? 'bg-amber-500' :
                              mode === 'UPI' ? 'bg-sky-500' :
                              mode === 'CARD' ? 'bg-indigo-500' :
                              mode === 'GIFT_CARD' ? 'bg-pink-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top 5 Dishes Today */}
            <div className="card p-5 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                <i className="fa-solid fa-fire text-amber-500" />
                <span>Top Selling Dishes Today</span>
              </h3>
              {data.topSellingDishes?.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No food sales recorded yet today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="rtable">
                    <thead>
                      <tr>
                        <th>Dish Name</th>
                        <th>Qty Sold</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSellingDishes.map((dish, idx) => (
                        <tr key={dish.itemName} className="hover:bg-muted/10">
                          <td data-label="" className="font-medium text-fg flex items-center gap-2 cell-title">
                            <span className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-xs text-muted font-bold">
                              {idx + 1}
                            </span>
                            {dish.itemName}
                          </td>
                          <td data-label="Qty Sold" className="text-right font-semibold">{dish.quantitySold}</td>
                          <td data-label="Total Revenue" className="text-right text-emerald-500 font-medium">{fmtINR(dish.totalSales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* What sold: every dish, per day or week, with filters and search */}
          <ItemsSoldPanel />

          {/* Real-Time Low Stock Warning Panel: closed until clicked */}
          {data.lowStockAlerts && data.lowStockAlerts.length > 0 && <LowStockPanel items={data.lowStockAlerts} count={data.lowStockItemsCount} />}
        </div>
      )}
    </section>
  );
}
