import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { Category, MenuItem, Bill, OrderType, PaymentMode, DiningTable } from '../types/pos';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CookingPot,
  CreditCard,
  QrCode,
  Banknote,
  UtensilsCrossed,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ShoppingBag,
  Percent,
} from 'lucide-react';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  parcel?: boolean;
}

export const POSBillingView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('TABLE');
  const [selectedTable, setSelectedTable] = useState<string>('T1');
  const [customerName, setCustomerName] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [applyParcelCharge, setApplyParcelCharge] = useState(false);
  const [parcelChargeRate] = useState<number>(10); // ₹10 per parcel or flat
  const [gstPercent] = useState<number>(5); // 5% GST (2.5% CGST + 2.5% SGST)

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const [cats, items, tbls] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<MenuItem[]>('/menu-items'),
        api.get<DiningTable[]>('/tables').catch(() => []),
      ]);
      setCategories(cats || []);
      setMenuItems((items || []).filter(i => i.active));
      setTables(tbls || []);
      if (tbls && tbls.length > 0) {
        setSelectedTable(tbls[0].name);
      }
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Could not load menu catalog' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVeg = !vegOnly || item.isVeg;
      return matchesCategory && matchesSearch && matchesVeg;
    });
  }, [menuItems, selectedCategory, searchQuery, vegOnly]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const parcelCharge = useMemo(() => {
    if (!applyParcelCharge && orderType !== 'TAKEAWAY') return 0;
    const count = cart.reduce((sum, item) => (item.parcel ? sum + item.quantity : sum), 0);
    return count > 0 ? count * parcelChargeRate : (orderType === 'TAKEAWAY' ? parcelChargeRate : 0);
  }, [cart, applyParcelCharge, orderType, parcelChargeRate]);

  const taxableAmount = Math.max(0, subtotal - discountAmount + parcelCharge);
  const taxAmount = (taxableAmount * gstPercent) / 100;
  const netAmount = Math.round(taxableAmount + taxAmount);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - netAmount);
  }, [cashTendered, netAmount]);

  // Cart actions
  const addToCart = (menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { menuItem, quantity: 1, parcel: orderType === 'TAKEAWAY' }];
    });
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.menuItem.id === menuItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((item) => item.menuItem.id !== menuItemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCustomerName('');
  };

  // Order & Billing Actions
  const handleSendKOT = async () => {
    if (cart.length === 0) {
      setAlert({ type: 'error', message: 'Cart is empty. Add items before sending KOT.' });
      return;
    }
    setIsProcessing(true);
    try {
      const billData = {
        tableNumber: orderType === 'TABLE' ? selectedTable : (orderType === 'TAKEAWAY' ? 'Takeaway' : 'Outdoor'),
        customerName: customerName || 'Walk-in Guest',
        orderType,
        subtotal,
        discountPercent,
        discountAmount,
        taxPercent: gstPercent,
        taxAmount,
        netAmount,
        items: cart.map(i => ({
          menuItemId: i.menuItem.id,
          itemName: i.menuItem.name,
          quantity: i.quantity,
          price: i.menuItem.price,
          subtotal: i.menuItem.price * i.quantity,
          notes: i.notes || '',
        })),
      };

      const savedBill = await api.post<Bill>('/bills/order', billData);
      // Trigger KOT print
      await api.post(`/bills/${savedBill.id}/print-kot`).catch(() => {});
      await api.post(`/printer/print-kot/${savedBill.id}`).catch(() => {});

      setAlert({ type: 'success', message: `KOT #${savedBill.kotNumber || savedBill.billNumber} sent to Kitchen!` });
      clearCart();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to dispatch KOT' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const billData = {
        tableNumber: orderType === 'TABLE' ? selectedTable : (orderType === 'TAKEAWAY' ? 'Takeaway' : 'Outdoor'),
        customerName: customerName || 'Walk-in Guest',
        orderType,
        paymentMode,
        subtotal,
        discountPercent,
        discountAmount,
        taxPercent: gstPercent,
        taxAmount,
        netAmount,
        items: cart.map(i => ({
          menuItemId: i.menuItem.id,
          itemName: i.menuItem.name,
          quantity: i.quantity,
          price: i.menuItem.price,
          subtotal: i.menuItem.price * i.quantity,
          notes: i.notes || '',
        })),
      };

      const savedBill = await api.post<Bill>('/bills/order', billData);
      const settled = await api.post<Bill>(`/bills/${savedBill.id}/confirm-payment`, { paymentMode });
      
      // Auto trigger print bill
      api.post(`/printer/print-bill/${settled.id}`).catch(() => {});

      setLastBill(settled);
      setAlert({ type: 'success', message: `Bill #${settled.billNumber} settled for ₹${settled.netAmount} via ${paymentMode}!` });
      setShowPaymentModal(false);
      clearCart();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Payment settlement failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-6rem)]">
      {/* Left & Middle: Menu Catalog & Categories */}
      <div className="flex-1 space-y-4">
        {/* Search, Filter & Veg Toggle Bar */}
        <div className="glass-panel p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 border-slate-800/80">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search dishes, coffees, shakes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                vegOnly
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Pure Veg</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
              selectedCategory === 'ALL'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'glass-panel text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            All Items ({menuItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'glass-panel text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="glass-panel glass-panel-hover p-3.5 rounded-2xl text-left flex flex-col justify-between border-slate-800/80 group active:scale-[0.98] transition duration-150 h-36"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span
                    className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border ${
                      item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    ></span>
                  </span>
                  <span className="text-sm font-extrabold text-amber-400 font-mono">
                    ₹{item.price.toFixed(2)}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-100 group-hover:text-amber-300 transition mt-2 line-clamp-2">
                  {item.name}
                </h4>
                {item.description && (
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                <span>{item.isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                <span className="w-5 h-5 rounded-lg bg-amber-500/10 group-hover:bg-amber-500 text-amber-400 group-hover:text-slate-950 flex items-center justify-center transition">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Live Order Cart & Settlement Drawer */}
      <div className="w-full lg:w-96 glass-panel rounded-2xl border-slate-800/80 flex flex-col justify-between p-4 shadow-2xl h-fit">
        {/* Order Header & Mode Toggle */}
        <div className="space-y-3 pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Current Order</span>
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-rose-400 hover:text-rose-300 transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* Order Type Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            {(['TABLE', 'TAKEAWAY', 'OUTDOOR'] as OrderType[]).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition uppercase ${
                  orderType === type
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'TABLE' ? 'Dine In' : type === 'TAKEAWAY' ? 'Parcel' : 'Quick'}
              </button>
            ))}
          </div>

          {/* Table or Customer Info */}
          <div className="grid grid-cols-2 gap-2">
            {orderType === 'TABLE' ? (
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Select Table</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                  {tables.length === 0 && <option value="T1">Table 1</option>}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Token / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Counter 1"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Customer Name</label>
              <input
                type="text"
                placeholder="Optional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 py-3 overflow-y-auto max-h-[360px] space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-slate-500 space-y-2">
              <UtensilsCrossed className="w-8 h-8 mx-auto stroke-1 text-slate-600" />
              <p className="text-xs">No items in cart</p>
              <p className="text-[10px] text-slate-600">Select items from the menu to start order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.menuItem.id}
                className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {item.menuItem.name}
                  </div>
                  <div className="text-[11px] text-amber-400 font-mono font-semibold">
                    ₹{(item.menuItem.price * item.quantity).toFixed(2)}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center space-x-1.5 bg-slate-800/80 rounded-lg px-1 py-0.5 border border-slate-700/60">
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, -1)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-white px-1 font-mono">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, 1)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.menuItem.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bill Summary & Totals */}
        <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Discount Pill */}
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center space-x-1">
              <Percent className="w-3 h-3 text-cyan-400" />
              <span>Discount</span>
            </span>
            <div className="flex items-center space-x-1">
              {[0, 5, 10, 15].map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscountPercent(d)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    discountPercent === d
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {d}%
                </button>
              ))}
              {discountPercent > 0 && (
                <span className="font-mono text-cyan-400 ml-1">-₹{discountAmount.toFixed(2)}</span>
              )}
            </div>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>GST ({gstPercent}%)</span>
            <span className="font-mono text-slate-200">₹{taxAmount.toFixed(2)}</span>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
            <span className="text-sm font-extrabold text-white">Net Payable</span>
            <span className="text-xl font-extrabold text-amber-400 font-mono">
              ₹{netAmount.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleSendKOT}
              disabled={cart.length === 0 || isProcessing}
              className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/20 disabled:opacity-50 transition"
            >
              <CookingPot className="w-4 h-4" />
              <span>KOT</span>
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0 || isProcessing}
              className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
            >
              <Banknote className="w-4 h-4" />
              <span>Pay &amp; Settle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Payment Settlement */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Settle Order Payment</h3>
                <p className="text-[11px] text-slate-400">Total Due: ₹{netAmount.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Payment Mode Selection */}
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'CARD'] as PaymentMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1.5 border transition ${
                      paymentMode === mode
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {mode === 'CASH' && <Banknote className="w-5 h-5" />}
                    {mode === 'UPI' && <QrCode className="w-5 h-5" />}
                    {mode === 'CARD' && <CreditCard className="w-5 h-5" />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>

              {/* Cash Change Calculator */}
              {paymentMode === 'CASH' && (
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Cash Received from Customer
                    </label>
                    <input
                      type="number"
                      placeholder={`Min ₹${netAmount}`}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  {parseFloat(cashTendered) >= netAmount && (
                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-800">
                      <span className="text-slate-300">Change to Return:</span>
                      <span className="text-emerald-400 font-mono text-base">₹{changeDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* UPI Dynamic QR Preview */}
              {paymentMode === 'UPI' && (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-center space-y-2">
                  <div className="w-36 h-36 bg-white p-2 rounded-xl mx-auto flex items-center justify-center shadow-lg">
                    {/* Simulated Dynamic UPI QR */}
                    <div className="w-full h-full border-2 border-slate-900 border-dashed rounded flex flex-col items-center justify-center text-slate-900">
                      <QrCode className="w-12 h-12 stroke-[1.5]" />
                      <span className="text-[10px] font-mono font-bold mt-1">₹{netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">Scan using any UPI App (GPay, PhonePe, Paytm)</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : `Confirm ₹${netAmount.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
