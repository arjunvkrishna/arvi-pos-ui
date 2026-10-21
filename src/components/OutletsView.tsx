import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Outlet } from '../types/pos';
import { Store, Plus, MapPin, Phone, FileText, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';

export const OutletsView: React.FC = () => {
  const { outlets, activeOutlet, switchOutlet, refreshOutlets, user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Outlet name is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/outlets', {
        name,
        code,
        address,
        phone,
        gstNumber,
      });
      setSuccess(`Franchise outlet '${name}' created successfully!`);
      setShowAddModal(false);
      setName('');
      setCode('');
      setAddress('');
      setPhone('');
      setGstNumber('');
      await refreshOutlets();
    } catch (err: any) {
      setError(err.message || 'Failed to create franchise outlet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center space-x-2">
            <Store className="w-7 h-7 text-amber-400" />
            <span>Multi-Franchise Outlets Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your brand&apos;s branches, franchise outlets, and locations
          </p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'CAFE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Franchise Outlet</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="glass-panel border-rose-500/40 p-3.5 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="glass-panel border-emerald-500/40 p-3.5 rounded-xl flex items-center justify-between text-emerald-300 text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Outlets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {outlets.map((outlet) => {
          const isCurrent = activeOutlet?.id === outlet.id;
          return (
            <div
              key={outlet.id}
              className={`glass-panel p-5 rounded-2xl relative transition border ${
                isCurrent
                  ? 'border-amber-500/50 bg-slate-900/90 shadow-xl shadow-amber-500/10'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                    {outlet.code}
                  </span>
                  <h3 className="text-base font-bold text-white mt-2">{outlet.name}</h3>
                </div>
                {isCurrent ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active Terminal
                  </span>
                ) : (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    outlet.isActive ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/10 text-rose-300'
                  }`}>
                    {outlet.isActive ? 'Ready' : 'Inactive'}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{outlet.address || 'Address not configured'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>{outlet.phone || 'No phone set'}</span>
                </div>
                {outlet.gstNumber && (
                  <div className="flex items-center space-x-2 font-mono text-[11px]">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>GSTIN: {outlet.gstNumber}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                {!isCurrent ? (
                  <button
                    onClick={() => switchOutlet(outlet.id)}
                    className="flex items-center space-x-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
                  >
                    <span>Switch to this Outlet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic">Currently operating here</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Franchise Outlet */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Store className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Add Franchise Outlet</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Outlet / Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indiranagar Flagship"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!code) setCode(e.target.value.substring(0, 3).toUpperCase() + '-01');
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Branch Code (Unique) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IND-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Address</label>
                <textarea
                  rows={2}
                  placeholder="Full street address and landmark"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">GST Number</label>
                  <input
                    type="text"
                    placeholder="29AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Franchise Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
