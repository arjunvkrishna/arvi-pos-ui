import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Bill } from '../types/pos';
import { CookingPot, CheckCircle2, Clock, AlertCircle, RefreshCw, X } from 'lucide-react';

export const KDSView: React.FC = () => {
  const [activeOrders, setActiveOrders] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveOrders = async () => {
    try {
      const bills = await api.get<Bill[]>('/bills/active');
      setActiveOrders(bills || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Could not fetch active kitchen orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOrders();
    const timer = setInterval(fetchActiveOrders, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleMarkReady = async (billId: number) => {
    try {
      await api.post(`/bills/${billId}/request-bill`);
      await fetchActiveOrders();
    } catch (e: any) {
      setError(e.message || 'Could not update order status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <CookingPot className="w-7 h-7 text-amber-400" />
            <span>Kitchen Display System (KDS)</span>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse ml-2">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time kitchen order tickets &amp; preparation status</p>
        </div>
        <button
          onClick={fetchActiveOrders}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="glass-panel border-rose-500/40 p-3 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {activeOrders.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 space-y-3">
          <CookingPot className="w-12 h-12 mx-auto stroke-1 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">Kitchen Queue is Empty</p>
          <p className="text-xs text-slate-500">Orders sent to kitchen from POS will appear here instantly</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {activeOrders.map((bill) => {
            const orderTime = new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={bill.id}
                className="glass-panel rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden shadow-xl"
              >
                <div>
                  <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-amber-400 text-base font-mono">
                        {bill.tableNumber || bill.takeawayToken || 'Counter'}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">#{bill.billNumber}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{orderTime}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-4 space-y-2.5">
                    {bill.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded bg-amber-500/10 text-amber-400 font-extrabold flex items-center justify-center font-mono">
                            {item.quantity}x
                          </span>
                          <span className="font-semibold text-slate-200">{item.itemName}</span>
                        </div>
                        {item.notes && (
                          <span className="text-[10px] text-amber-300/80 italic bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {item.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {bill.orderType}
                  </span>
                  <button
                    onClick={() => handleMarkReady(bill.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Ready</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
