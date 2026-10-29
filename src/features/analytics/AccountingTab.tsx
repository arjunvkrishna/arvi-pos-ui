import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Field, Skeleton } from '../../components/ui';
import { fetchProfitAndLoss, fetchBalanceSheet } from './api';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AccountingTab() {
  const [dates, setDates] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const plQ = useQuery({
    queryKey: ['accounting-pl', dates.start, dates.end],
    queryFn: () => fetchProfitAndLoss(dates.start, dates.end),
  });

  const bsQ = useQuery({
    queryKey: ['accounting-bs'],
    queryFn: fetchBalanceSheet,
  });

  const pl = plQ.data;
  const bs = bsQ.data;

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <Field id="plStartDate" label="From">
          <input
            id="plStartDate"
            type="date"
            value={dates.start}
            onChange={(e) => setDates({ ...dates, start: e.target.value })}
            className="input"
          />
        </Field>
        <Field id="plEndDate" label="To">
          <input
            id="plEndDate"
            type="date"
            value={dates.end}
            onChange={(e) => setDates({ ...dates, end: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      {/* Statutory P&L Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-fg">Statutory Profit & Loss Statement</h3>
            <p className="text-xs text-muted">Statutory compliance (Net sales revenue excludes GST & tips)</p>
          </div>
          {pl && <Badge tone="neutral">{pl.period}</Badge>}
        </div>

        {plQ.isLoading ? (
          <Skeleton rows={6} />
        ) : pl ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg border-b border-line pb-2">Revenue & Gross Margin</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Gross Sales Recorded</span>
                  <span className="font-medium text-fg">{inr(pl.grossSales)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Less: GST Collected</span>
                  <span>− {inr(pl.gstCollected)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Less: Staff Tips Collected</span>
                  <span>− {inr(pl.tipsCollected)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-fg">
                  <span>= Net Sales Revenue</span>
                  <span className="text-brand-text">{inr(pl.netSalesRevenue)}</span>
                </div>
                <div className="flex justify-between text-danger pt-2">
                  <span>Less: Cost of Goods Sold (COGS)</span>
                  <span>− {inr(pl.cogs)}</span>
                </div>
                {pl.loyaltyPointsRedeemed > 0 && (
                  <div className="flex justify-between text-warn">
                    <span>Less: Loyalty Points Concession</span>
                    <span>− {inr(pl.loyaltyPointsRedeemed)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-ok">
                  <span>= Gross Operating Profit</span>
                  <span>{inr(pl.grossProfit)}</span>
                </div>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg border-b border-line pb-2">Overheads & Bottom Line</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Gross Profit Carried Over</span>
                  <span className="font-medium text-fg">{inr(pl.grossProfit)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Less: Operating Expenses (OpEx)</span>
                  <span>− {inr(pl.operatingExpenses)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Less: Salaries & Payroll Disbursed</span>
                  <span>− {inr(pl.salariesPaid)}</span>
                </div>
                <div className="flex justify-between border-t border-line-strong pt-3 text-base font-bold">
                  <span className={pl.netProfit >= 0 ? 'text-ok' : 'text-danger'}>
                    = Net Statutory Profit / (Loss)
                  </span>
                  <span className={pl.netProfit >= 0 ? 'text-ok' : 'text-danger'}>
                    {inr(pl.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Balance Sheet Section */}
      <div className="space-y-4 pt-4 border-t border-line">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-fg">Management Balance Sheet Snapshot</h3>
            <p className="text-xs text-muted">Real-time asset, liability, and equity snapshot</p>
          </div>
          {bs && <Badge tone="info">As of {bs.asOfDate}</Badge>}
        </div>

        {bsQ.isLoading ? (
          <Skeleton rows={4} />
        ) : bs ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg border-b border-line pb-2 flex items-center gap-2">
                <i className="fa-solid fa-vault text-ok" />
                Current Assets
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Cash in Drawers & Float</span>
                  <span className="font-medium">{inr(bs.assets.cashInDrawerAndBank)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Inventory at Cost</span>
                  <span className="font-medium">{inr(bs.assets.inventoryValuationAtCost)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-bold text-ok">
                  <span>Total Assets</span>
                  <span>{inr(bs.assets.totalAssets)}</span>
                </div>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg border-b border-line pb-2 flex items-center gap-2">
                <i className="fa-solid fa-scale-unbalanced text-danger" />
                Current Liabilities
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Unpaid Supplier Invoices</span>
                  <span className="font-medium">{inr(bs.liabilities.unpaidSupplierInvoices)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Active Gift Card Liability</span>
                  <span className="font-medium">{inr(bs.liabilities.giftCardLiability)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Unpaid Staff Tips</span>
                  <span className="font-medium">{inr(bs.liabilities.unpaidTips)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-bold text-danger">
                  <span>Total Liabilities</span>
                  <span>{inr(bs.liabilities.totalLiabilities)}</span>
                </div>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg border-b border-line pb-2 flex items-center gap-2">
                <i className="fa-solid fa-building-columns text-brand-text" />
                Owner's Equity
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total Assets</span>
                  <span>{inr(bs.assets.totalAssets)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Less: Liabilities</span>
                  <span>− {inr(bs.liabilities.totalLiabilities)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-bold text-lg text-brand-text">
                  <span>Net Worth / Equity</span>
                  <span>{inr(bs.netWorthOrEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
