import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CafeExpense } from '../types/pos';
import { Wallet, Plus, Calendar, DollarSign, X } from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<CafeExpense[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Supplies');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  const loadExpenses = async () => {
    try {
      const data = await api.get<CafeExpense[]>('/expenses');
      setExpenses(data || []);
    } catch (e) {
      console.warn('Error loading expenses:', e);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    try {
      await api.post('/expenses', {
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        paymentMode,
        expenseDate: new Date().toISOString().split('T')[0],
        notes,
      });
      setShowAddModal(false);
      setTitle('');
      setAmount('');
      setNotes('');
      await loadExpenses();
    } catch (e: any) {
      alert(e.message || 'Could not record expense');
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Wallet className="w-7 h-7 text-amber-400" />
            <span>Cafe Expenses &amp; Petty Cash</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track store operational costs, milk, gas, ice &amp; petty payments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Record Expense</span>
        </button>
      </div>

      <div className="glass-panel p-5 rounded-2xl border-slate-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400">Total Recorded Expenses</span>
          <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
            ₹{totalExpenseAmount.toFixed(2)}
          </div>
        </div>
        <span className="text-xs font-mono text-slate-500">{expenses.length} Entries</span>
      </div>

      {/* Mobile Expense Cards (Small Screens) */}
      <div className="space-y-3 md:hidden">
        {expenses.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl border-slate-800">
            No expense records found
          </div>
        ) : (
          expenses.map((exp) => (
            <div
              key={exp.id}
              className="glass-panel p-4 rounded-2xl border-slate-800/90 space-y-2.5 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">{exp.title}</h4>
                  {exp.notes && <p className="text-[10px] text-slate-500 mt-0.5">{exp.notes}</p>}
                </div>
                <span className="font-mono font-extrabold text-rose-400 text-sm">
                  ₹{exp.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                  {exp.category}
                </span>
                <span>Paid via {exp.paymentMode}</span>
                <span>{exp.expenseDate}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Expenses Table */}
      <div className="hidden md:block glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">Title / Description</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Paid Via</th>
                <th className="p-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    No expense records found
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-white">
                      <div>{exp.title}</div>
                      {exp.notes && <div className="text-[10px] text-slate-500">{exp.notes}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono">{exp.expenseDate}</td>
                    <td className="p-3.5 font-bold text-slate-300">{exp.paymentMode}</td>
                    <td className="p-3.5 text-right font-bold font-mono text-rose-400 text-sm">
                      ₹{exp.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Record Expense</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milk & Dairy Daily Supply"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="450.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Supplies">Daily Supplies</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Utility">Utility / Bills</option>
                    <option value="Packaging">Parcel Packaging</option>
                    <option value="Other">Other Expense</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="UPI">UPI / Bank</option>
                  <option value="CARD">Card</option>
                </select>
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
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
