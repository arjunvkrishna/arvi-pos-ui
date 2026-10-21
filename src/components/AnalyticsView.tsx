import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Store, TrendingUp, DollarSign, ShoppingBag, PieChart, RefreshCw } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { user } = useAuth();
  const [franchiseData, setFranchiseData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [franchise, analytics] = await Promise.all([
        api.get<any>('/franchise/analytics').catch(() => null),
        api.get<any>('/analytics/dashboard').catch(() => null),
      ]);
      setFranchiseData(franchise);
      setAnalyticsData(analytics);
    } catch (e) {
      console.warn('Analytics load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <BarChart3 className="w-7 h-7 text-amber-400" />
            <span>Multi-Franchise &amp; POS Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Cross-branch sales volume, average ticket size &amp; top revenue drivers</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Brand Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-3">
            ₹{Number(franchiseData?.totalBrandRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Across all franchise outlets</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Orders</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-3">
            {franchiseData?.totalBrandOrders ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Settled invoices</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Franchise Outlets</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-3">
            {franchiseData?.totalOutlets ?? 1}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Operating locations</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Average Order Value (AOV)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-400 font-mono mt-3">
            ₹
            {franchiseData?.totalBrandOrders > 0
              ? (franchiseData.totalBrandRevenue / franchiseData.totalBrandOrders).toFixed(2)
              : '0.00'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Average ticket size</p>
        </div>
      </div>

      {/* Multi-Franchise Outlet Comparison Table (Petpooja Style) */}
      <div className="glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Store className="w-4 h-4 text-amber-400" />
              <span>Franchise Branch Performance Comparison</span>
            </h3>
            <p className="text-[11px] text-slate-500">Live sales metrics per outlet</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">Branch Name</th>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Orders</th>
                <th className="p-3.5">Revenue</th>
                <th className="p-3.5">Average Ticket (AOV)</th>
                <th className="p-3.5">Share of Brand Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(!franchiseData?.outlets || franchiseData.outlets.length === 0) ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No franchise data available
                  </td>
                </tr>
              ) : (
                franchiseData.outlets.map((o: any) => {
                  const share =
                    franchiseData.totalBrandRevenue > 0
                      ? ((o.totalRevenue / franchiseData.totalBrandRevenue) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={o.outletId} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5 font-bold text-white flex items-center space-x-2">
                        <Store className="w-4 h-4 text-slate-500" />
                        <span>{o.outletName}</span>
                      </td>
                      <td className="p-3.5 font-mono text-amber-400 text-xs">{o.outletCode}</td>
                      <td className="p-3.5 font-mono text-slate-300">{o.ordersCount}</td>
                      <td className="p-3.5 font-bold font-mono text-emerald-400 text-sm">
                        ₹{Number(o.totalRevenue || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 font-mono text-purple-400">
                        ₹{Number(o.averageOrderValue || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden w-24">
                            <div
                              className="bg-amber-400 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(5, parseFloat(share)))}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-xs text-slate-300">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
