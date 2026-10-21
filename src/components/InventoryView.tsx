import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { InventoryItem } from '../types/pos';
import { Package, Plus, AlertTriangle, ArrowUpDown, X, Search } from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('');
  const [minimumStock, setMinimumStock] = useState('');

  const loadData = async () => {
    try {
      const data = await api.get<InventoryItem[]>('/inventory');
      setItems(data || []);
    } catch (e) {
      console.warn('Error loading inventory:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/inventory', {
        name: name.trim(),
        unit,
        currentStock: parseFloat(currentStock) || 0,
        minimumStock: parseFloat(minimumStock) || 5,
      });
      setShowAddModal(false);
      setName('');
      setCurrentStock('');
      setMinimumStock('');
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not save inventory item');
    }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Package className="w-7 h-7 text-amber-400" />
            <span>Raw Materials &amp; Stock Inventory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track store room ingredients, units &amp; reorder thresholds</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">Raw Material / Item</th>
                <th className="p-3.5">Unit</th>
                <th className="p-3.5">Current Stock</th>
                <th className="p-3.5">Reorder Level</th>
                <th className="p-3.5">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    No inventory records found
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.currentStock <= item.minimumStock;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5 font-bold text-white">{item.name}</td>
                      <td className="p-3.5 font-mono text-slate-400">{item.unit}</td>
                      <td className="p-3.5 font-extrabold font-mono text-sm text-slate-200">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{item.minimumStock} {item.unit}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 w-fit ${
                            isLow
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                          <span>{isLow ? 'Low Stock' : 'Adequate'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Stock Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Raw Material</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arabica Coffee Beans"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                    <option value="pcs">pcs</option>
                    <option value="packets">packets</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="25"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Minimum Alert Threshold</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="5"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
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
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
