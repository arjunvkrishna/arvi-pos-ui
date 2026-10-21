import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Tenant } from '../types/pos';
import { Building2, Plus, Store, Users, DollarSign, CheckCircle2, AlertCircle, RefreshCw, X, Shield, Lock } from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const [cafes, setCafes] = useState<Tenant[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for creating a new cafe
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('PRO');
  const [maxOutlets, setMaxOutlets] = useState<number>(5);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cafesData, analyticsData] = await Promise.all([
        api.get<Tenant[]>('/super-admin/cafes'),
        api.get<any>('/super-admin/analytics'),
      ]);
      setCafes(cafesData || []);
      setAnalytics(analyticsData || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load Super Admin dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      setError('Cafe Name, Admin Username, and Admin Password are required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/super-admin/cafes', {
        name,
        code,
        contactEmail,
        contactPhone,
        address,
        subscriptionPlan,
        maxOutlets: Number(maxOutlets),
        adminUsername,
        adminPassword,
        adminFullName,
      });
      setSuccessMsg(`Cafe '${name}' and Admin '${adminUsername}' provisioned successfully!`);
      setShowAddModal(false);
      // Reset form
      setName('');
      setCode('');
      setContactEmail('');
      setContactPhone('');
      setAddress('');
      setAdminUsername('');
      setAdminPassword('');
      setAdminFullName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create cafe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cafe: Tenant) => {
    const newStatus = cafe.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.put(`/super-admin/cafes/${cafe.id}`, { status: newStatus });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update cafe status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center space-x-2">
            <Shield className="w-7 h-7 text-purple-400" />
            <span>SaaS Super Admin Console</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage Cafe Tenants, Franchises, Subscriptions &amp; Platform Growth
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Onboard New Cafe</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="glass-panel border-rose-500/40 p-3.5 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="glass-panel border-emerald-500/40 p-3.5 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Cafe Brands</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white">{analytics?.totalCafes ?? cafes.length}</span>
            <span className="text-[11px] text-emerald-400 font-medium ml-2">Active Tenants</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Franchises / Outlets</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white">{analytics?.totalOutlets ?? 0}</span>
            <span className="text-[11px] text-amber-400 font-medium ml-2">Across all brands</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Orders Processed</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white">
              {Number(analytics?.totalOrders || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-cyan-400 font-medium ml-2">Lifetime Orders</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Platform GMV Volume</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white">
              ₹{Number(analytics?.totalGmv || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-400 font-medium ml-2">Gross Volume</span>
          </div>
        </div>
      </div>

      {/* Cafes List Table */}
      <div className="glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Onboarded Cafes &amp; Restaurant Brands</h2>
            <p className="text-[11px] text-slate-500">Each brand operates independent franchise outlets &amp; catalogs</p>
          </div>
          <span className="text-xs font-mono text-slate-400 font-semibold">{cafes.length} Total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">Cafe Brand</th>
                <th className="p-3.5">Code / Slug</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Outlets Limit</th>
                <th className="p-3.5">GMV Volume</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cafes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No cafes found. Click &quot;Onboard New Cafe&quot; to add your first customer.
                  </td>
                </tr>
              ) : (
                cafes.map((cafe) => (
                  <tr key={cafe.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-slate-100 flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-extrabold text-xs border border-amber-500/20">
                        {cafe.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span>{cafe.name}</span>
                        <span className="block text-[10px] text-slate-500 font-normal">
                          Created {cafe.createdAt ? new Date(cafe.createdAt).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">{cafe.code}</td>
                    <td className="p-3.5 text-slate-300">
                      <div>{cafe.contactEmail || '-'}</div>
                      <div className="text-[10px] text-slate-500">{cafe.contactPhone || '-'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {cafe.subscriptionPlan}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-amber-400 font-bold font-mono">{cafe.outletsCount ?? 1}</span>
                      <span className="text-slate-500 font-mono"> / {cafe.maxOutlets}</span>
                    </td>
                    <td className="p-3.5 font-bold text-emerald-400 font-mono">
                      ₹{Number(cafe.totalGmv || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          cafe.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {cafe.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleToggleStatus(cafe)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                          cafe.status === 'ACTIVE'
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {cafe.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Onboard New Cafe */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Onboard New Cafe Brand</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCafe} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cafe Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Blue Tokai Cafe"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!code) setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Brand Slug / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. blue-tokai"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="owner@cafe.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Subscription Plan</label>
                  <select
                    value={subscriptionPlan}
                    onChange={(e) => setSubscriptionPlan(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BASIC">BASIC (Up to 2 Outlets)</option>
                    <option value="PRO">PRO (Up to 5 Outlets)</option>
                    <option value="ENTERPRISE">ENTERPRISE (Up to 20 Outlets)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Outlets Allowed</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxOutlets}
                    onChange={(e) => setMaxOutlets(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Initial Cafe Admin Credentials */}
              <div className="p-3.5 bg-slate-950/90 border border-purple-500/20 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-purple-300 text-xs font-bold">
                  <Lock className="w-4 h-4" />
                  <span>Initial Cafe Admin Credentials (For Cafe Owner)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rohan Patel"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Admin Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. rohan_cafe"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Admin Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Cafe...' : 'Provision Cafe & Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
