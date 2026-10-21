import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Bill } from '../types/pos';
import { Receipt, Search, Printer, RotateCcw, Eye, X, Filter } from 'lucide-react';

export const BillsView: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBills = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Bill[]>('/bills/history');
      setBills(data || []);
    } catch {
      // fallback
      try {
        const active = await api.get<Bill[]>('/bills/active');
        setBills(active || []);
      } catch (err) {
        console.warn('Error fetching bills:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleReprint = async (billId: number) => {
    try {
      await api.post(`/printer/print-bill/${billId}`);
      alert(`Receipt for Bill #${billId} sent to Thermal Printer`);
    } catch (e: any) {
      alert(e.message || 'Reprint failed');
    }
  };

  const filteredBills = bills.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.billNumber?.toLowerCase().includes(q) ||
      b.tableNumber?.toLowerCase().includes(q) ||
      b.customerName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Receipt className="w-7 h-7 text-amber-400" />
            <span>Orders &amp; Bills History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Audit transactions, reprint receipts, and process refunds</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search bill, table, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Mobile Bills Card View (Small Screens) */}
      <div className="space-y-3 md:hidden">
        {filteredBills.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl border-slate-800">
            No matching bills found
          </div>
        ) : (
          filteredBills.map((bill) => (
            <div
              key={bill.id}
              className="glass-panel p-4 rounded-2xl border-slate-800/90 space-y-3 shadow-lg"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">#{bill.billNumber}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    bill.status === 'PAID'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {bill.status}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {bill.createdAt ? new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Table / Order</span>
                  <span className="font-bold text-white">{bill.tableNumber || bill.takeawayToken || 'Counter'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Mode</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                    {bill.paymentMode}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Net Total</span>
                  <span className="font-mono font-extrabold text-emerald-400 text-base">
                    ₹{bill.netAmount?.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-[11px] text-slate-400">
                  {bill.items?.length || 0} item{(bill.items?.length || 0) > 1 ? 's' : ''} • {bill.customerName || 'Walk-in'}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedBill(bill)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleReprint(bill.id)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Reprint</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Bills Table */}
      <div className="hidden md:block glass-panel rounded-2xl border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5">Bill #</th>
                <th className="p-3.5">Table / Token</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Items</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Net Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500">
                    No matching bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-mono font-bold text-amber-400">{bill.billNumber}</td>
                    <td className="p-3.5 font-bold text-slate-200">
                      {bill.tableNumber || bill.takeawayToken || '-'}
                    </td>
                    <td className="p-3.5 text-slate-400">{bill.customerName || 'Walk-in'}</td>
                    <td className="p-3.5 text-slate-300 font-mono">{bill.items?.length || 0}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {bill.paymentMode}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold font-mono text-emerald-400 text-sm">
                      ₹{bill.netAmount?.toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        bill.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        title="View Receipt"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReprint(bill.id)}
                        title="Reprint Bill"
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Receipt Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Receipt #{selectedBill.billNumber}</h3>
              <button onClick={() => setSelectedBill(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Simulated Thermal Receipt Preview */}
            <div className="thermal-receipt p-4 rounded-xl mt-4 text-xs space-y-2">
              <div className="text-center pb-2 border-b border-slate-300">
                <h4 className="font-bold text-sm">ARVI CAFE</h4>
                <p className="text-[10px] text-slate-600">POS TAX INVOICE</p>
                <p className="text-[9px] text-slate-500">{new Date(selectedBill.createdAt).toLocaleString()}</p>
              </div>

              <div className="flex justify-between text-[11px] font-semibold">
                <span>{selectedBill.tableNumber ? `Table: ${selectedBill.tableNumber}` : 'Takeaway'}</span>
                <span>Bill: {selectedBill.billNumber}</span>
              </div>

              <div className="py-2 border-t border-b border-dashed border-slate-300 space-y-1">
                {selectedBill.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>{it.quantity}x {it.itemName}</span>
                    <span>₹{it.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{selectedBill.subtotal?.toFixed(2)}</span>
                </div>
                {selectedBill.taxAmount ? (
                  <div className="flex justify-between">
                    <span>GST:</span>
                    <span>₹{selectedBill.taxAmount?.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-900">
                  <span>TOTAL:</span>
                  <span>₹{selectedBill.netAmount?.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500">
                Thank you for visiting!
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                onClick={() => handleReprint(selectedBill.id)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
