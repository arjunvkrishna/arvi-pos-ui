import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Category, MenuItem } from '../types/pos';
import { UtensilsCrossed, Plus, Edit, Trash2, Check, X, Search } from 'lucide-react';

export const MenuView: React.FC = () => {
  const { user, activeOutlet } = useAuth();
  const canSetBranchPrice = !!activeOutlet && (['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER'].includes(user?.role || '') || !!user?.canManageSettings);
  // Owner and main manager always may; a branch manager or staff member only when delegated the menu right.
  const canEditMenu = ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER'].includes(user?.role || '') || !!user?.canManageMenu;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  // Form states
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCatId, setItemCatId] = useState<number>(1);
  const [itemVeg, setItemVeg] = useState(true);
  const [itemDesc, setItemDesc] = useState('');

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const loadData = async () => {
    try {
      const [cats, menu] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<MenuItem[]>('/menu-items'),
      ]);
      setCategories(cats || []);
      setItems(menu || []);
      if (cats && cats.length > 0) {
        setItemCatId(cats[0].id);
      }
    } catch (e) {
      console.warn('Error loading menu:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice) return;
    try {
      await api.post('/menu-items', {
        name: itemName.trim(),
        price: parseFloat(itemPrice),
        categoryId: itemCatId,
        isVeg: itemVeg,
        description: itemDesc,
        isAvailable: true,
      });
      setShowAddItem(false);
      setItemName('');
      setItemPrice('');
      setItemDesc('');
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not save menu item');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await api.post('/categories', {
        name: catName.trim(),
        description: catDesc,
        active: true,
      });
      setShowAddCat(false);
      setCatName('');
      setCatDesc('');
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not save category');
    }
  };

  // Sold out / available. With a branch selected this changes that branch only; in "All branches" it sets the cafe default.
  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.patch(`/menu-items/${item.id}/toggle-availability`);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not update item availability');
    }
  };

  const setBranchPrice = async (item: MenuItem) => {
    const input = window.prompt(
      `Price for ${activeOutlet?.name} (cafe-wide price is ₹${(item.basePrice ?? item.price).toFixed(2)}). Leave empty to use the cafe-wide price.`,
      item.branchOverride ? String(item.price) : ''
    );
    if (input === null) return;
    try {
      if (input.trim() === '') {
        await api.delete(`/menu-items/${item.id}/branch`);
      } else {
        const value = Number(input);
        if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid price');
        await api.put(`/menu-items/${item.id}/branch`, { price: value });
      }
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Could not set the branch price');
    }
  };

  const filteredItems = items.filter((it) => {
    const matchesCat = selectedCat === 'ALL' || it.categoryId === selectedCat;
    const matchesSearch = it.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <UtensilsCrossed className="w-7 h-7 text-amber-400" />
            <span>Menu &amp; Catalog Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Configure categories, prices, dishes and availability</p>
        </div>
        {canEditMenu && (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddCat(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            + Add Category
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Menu Item</span>
          </button>
        </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3 rounded-2xl border-slate-800">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              selectedCat === 'ALL'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                selectedCat === c.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-48">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="glass-panel p-4 rounded-2xl border-slate-800/80 flex items-center justify-between gap-3"
          >
            <div className="flex items-start space-x-3">
              <span
                className={`w-4 h-4 rounded-sm flex items-center justify-center border mt-0.5 flex-shrink-0 ${
                  item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <div>
                <h4 className="font-bold text-xs text-white">{item.name}</h4>
                <p className="font-mono text-xs font-extrabold text-amber-400 mt-0.5">
                  ₹{item.price.toFixed(2)}
                  {item.branchOverride && item.basePrice !== undefined && item.basePrice !== item.price && (
                    <span className="ml-1 text-[10px] text-slate-500 line-through">₹{item.basePrice.toFixed(2)}</span>
                  )}
                </p>
                {canSetBranchPrice && (
                  <button type="button" onClick={() => setBranchPrice(item)} className="text-[10px] text-sky-400 hover:text-sky-300">
                    {item.branchOverride ? 'Edit branch price' : 'Set branch price'}
                  </button>
                )}
                {item.description && (
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => toggleAvailability(item)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                item.isAvailable
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {item.isAvailable ? 'Available' : 'Sold Out'}
            </button>
          </div>
        ))}
      </div>

      {/* Modal: Add Menu Item */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Menu Item</h3>
              <button onClick={() => setShowAddItem(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateItem} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazelnut Cappuccino"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="180.00"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Category</label>
                  <select
                    value={itemCatId}
                    onChange={(e) => setItemCatId(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="vegCheck"
                  checked={itemVeg}
                  onChange={(e) => setItemVeg(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
                />
                <label htmlFor="vegCheck" className="text-xs text-slate-300 cursor-pointer">
                  Vegetarian Dish
                </label>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description or ingredients"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
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

      {/* Modal: Add Category */}
      {showAddCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Menu Category</h3>
              <button onClick={() => setShowAddCat(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Specialty Coffees"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
