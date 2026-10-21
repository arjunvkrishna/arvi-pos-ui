import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Category, MenuItem } from '../types/pos';
import { Coffee, Search, UtensilsCrossed } from 'lucide-react';

export const CustomerMenuView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState<number | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPublicMenu = async () => {
      try {
        const res = await fetch('/api/public/menu').then(r => r.json()).catch(() => null);
        if (res && res.categories && res.items) {
          setCategories(res.categories);
          setItems(res.items);
        } else {
          // fallback to standard catalog
          const [cats, menu] = await Promise.all([
            api.get<Category[]>('/categories').catch(() => []),
            api.get<MenuItem[]>('/menu-items').catch(() => []),
          ]);
          setCategories(cats || []);
          setItems((menu || []).filter(i => i.isAvailable));
        }
      } catch (e) {
        console.warn('Could not load public menu:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPublicMenu();
  }, []);

  const filtered = items.filter((it) => {
    const matchCat = activeCat === 'ALL' || it.categoryId === activeCat;
    const matchSearch = it.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-xl mx-auto min-h-screen bg-slate-950 text-slate-100 p-4 space-y-5">
      {/* Header */}
      <div className="text-center py-6 space-y-2 border-b border-slate-800">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
          <Coffee className="w-8 h-8 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-xl font-extrabold text-white">ARVI Cafe Menu</h1>
        <p className="text-xs text-slate-400">Fresh artisanal coffee, shakes, bites &amp; bakes</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Categories */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveCat('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeCat === 'ALL'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeCat === c.id
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Dishes */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3"
          >
            <div>
              <div className="flex items-center space-x-2">
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
                <span className="font-bold text-xs text-white">{item.name}</span>
              </div>
              {item.description && (
                <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
              )}
            </div>
            <span className="font-bold font-mono text-sm text-amber-400 flex-shrink-0">
              ₹{item.price.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
