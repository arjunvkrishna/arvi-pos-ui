import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CashierShift } from '../types/pos';
import { Clock, Banknote, DollarSign, ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const ShiftsView: React.FC = () => {
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const fetchShift = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<CashierShift>('/shifts/active');
      setCurrentShift(data || null);
    } catch {
      setCurrentShift(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShift();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const floatVal = parseFloat(openingFloat) || 0;
      const opened = await api.post<CashierShift>('/shifts/start', {
        openingFloat: floatVal,
        registerId: 'REG-01',
      });
      setCurrentShift(opened);
      setShowOpenModal(false);
      setOpeningFloat('');
    } catch (e: any) {
      alert(e.message || 'Could not open shift');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    try {
      const counted = parseFloat(countedCash) || 0;
      await api.post(`/shifts/${currentShift.id}/end`, {
        countedCash: counted,
        notes: closingNotes,
      });
      setShowCloseModal(false);
      setCountedCash('');
      setClosingNotes('');
      await fetchShift();
    } catch (e: any) {
      alert(e.message || 'Could not close shift');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Clock className="w-7 h-7 text-amber-400" />
            <span>Cashier Shifts &amp; Cash Drawer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage shift sessions, cash drawer float, and day-end reconciliation</p>
        </div>
        {!currentShift ? (
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20"
          >
            Open New Shift
          </button>
        ) : (
          <button
            onClick={() => setShowCloseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20"
          >
            Close Current Shift
          </button>
        )}
      </div>

      {/* Current Shift Status */}
      {currentShift ? (
        <div className="glass-panel p-6 rounded-2xl border-amber-500/30 bg-slate-900/80 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Shift Active ({currentShift.registerId})
              </span>
              <h3 className="text-base font-bold text-white mt-1">Cashier: {currentShift.cashierName}</h3>
              <p className="text-[11px] text-slate-400">
                Opened at {new Date(currentShift.openedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Opening Float</span>
              <div className="text-xl font-extrabold text-amber-400 font-mono">
                ₹{currentShift.openingFloat?.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Cash Sales</span>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                ₹{(currentShift.cashSales || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">UPI / QR Sales</span>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
                ₹{(currentShift.upiSales || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Card Sales</span>
              <div className="text-lg font-bold text-purple-400 font-mono mt-1">
                ₹{(currentShift.cardSales || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-10 rounded-2xl text-center text-slate-500 space-y-3">
          <Clock className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No Shift Currently Open</p>
          <p className="text-xs text-slate-500">Open a shift drawer with initial cash float before starting billing</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Start Shift
          </button>
        </div>
      )}

      {/* Modal: Open Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Open Cashier Shift</h3>
              <button onClick={() => setShowOpenModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Opening Cash Float (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 2000.00"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold"
                >
                  Confirm &amp; Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Shift */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Reconcile &amp; Close Shift</h3>
              <button onClick={() => setShowCloseModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCloseShift} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Physical Cash Counted (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Counted cash in drawer"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Closing Notes / Discrepancy</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or explanations"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold"
                >
                  Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
