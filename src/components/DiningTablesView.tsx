import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DiningTable, Bill } from '../types/pos';
import { Layers, Plus, Users, Receipt, RefreshCw, X } from 'lucide-react';

export const DiningTablesView: React.FC = () => {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [activeBills, setActiveBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableName, setTableName] = useState('');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tableList, bills] = await Promise.all([
        api.get<DiningTable[]>('/tables'),
        api.get<Bill[]>('/bills/active').catch(() => []),
      ]);
      setTables(tableList || []);
      setActiveBills(bills || []);
    } catch (e) {
      console.warn('Error loading tables:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    try {
      await api.post('/tables', { name: tableName.trim() });
      setShowAddModal(false);
      setTableName('');
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not add table');
    }
  };

  const getTableBill = (tbl: DiningTable) => {
    return activeBills.find((b) => b.tableNumber === tbl.name);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Layers className="w-7 h-7 text-amber-400" />
            <span>Dining Tables &amp; Floor Plan</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Live table occupancy, active orders &amp; dining layout</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((table) => {
          const bill = getTableBill(table);
          const isOccupied = Boolean(bill);
          return (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`glass-panel p-4 rounded-2xl flex flex-col justify-between text-left transition h-36 border relative ${
                isOccupied
                  ? 'border-amber-500/50 bg-amber-500/5 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800/80 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-base text-white">{table.name}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOccupied ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                ></span>
              </div>

              {isOccupied ? (
                <div className="space-y-1">
                  <div className="text-[11px] text-amber-300 font-bold font-mono">
                    ₹{bill?.netAmount?.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {bill?.items?.length || 0} items
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Available</div>
              )}

              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {isOccupied ? 'Occupied' : 'Vacant'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal: Add Table */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Dining Table</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddTable} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Table Name / Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 5 or Patio 1"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
