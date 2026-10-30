import { useEffect, useMemo, useRef } from 'react';
import { showToast } from '../../components/toast';
import type { Category, MenuItem } from '../menu/api';

export function VegDot({ veg, dim }: { veg?: boolean; dim?: boolean }) {
  const c = veg ? 'border-ok' : 'border-danger'; const d = veg ? 'bg-ok' : 'bg-danger';
  return <span aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'} className={`inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-sm border ${c} ${dim ? 'opacity-50' : ''}`}><span className={`w-1.5 h-1.5 rounded-full ${d}`} /></span>;
}

/** Category pills, search and the dishes to tap. Unavailable dishes stay visible but cannot be added. */
export function DishGrid({ items, categories, loading, category, onCategory, query, onQuery, onAdd }: {
  items: MenuItem[]; categories: Category[]; loading: boolean; category: number | null; onCategory: (id: number | null) => void; query: string; onQuery: (q: string) => void; onAdd: (id: number) => void;
}) {
  // Hotkeys for fast service: "/" jumps to the search box (unless typing somewhere), Esc in the box clears it.
  const clearRef = useRef(onQuery);
  useEffect(() => { clearRef.current = onQuery; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = document.getElementById('posSearchInput') as HTMLInputElement | null;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const a = document.activeElement as HTMLElement | null;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault(); box?.focus(); box?.select();
      } else if (e.key === 'Escape' && box && document.activeElement === box) { clearRef.current(''); box.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => (category === null || m.categoryId === category) && (!q || m.name.toLowerCase().includes(q)));
  }, [items, category, query]);
  const pill = (on: boolean) => `shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border transition ${on ? 'bg-brand text-gray-950 border-brand' : 'bg-surface text-muted border-line hover:text-fg'}`;
  return (
    <div className="card p-3 space-y-3 min-w-0">
      <div className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-faint text-sm" />
        <input id="posSearchInput" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search dishes (e.g. burger, tea)..." className="input pl-9 pr-9" autoComplete="off" />
        {query && <button type="button" id="posSearchClearBtn" onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-xmark" /></button>}
      </div>
      <div id="posCategoryPills" className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button type="button" className={pill(category === null)} onClick={() => onCategory(null)}>All items</button>
        {categories.map((c) => <button type="button" key={c.id} className={pill(category === c.id)} onClick={() => onCategory(c.id)}><i className={`fa-solid ${c.icon || 'fa-utensils'} mr-1.5 text-xs`} />{c.name}</button>)}
      </div>
      <div id="posDishesGrid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6 gap-2 pb-40 lg:pb-0">
        {loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 rounded-xl shimmer" />)}
        {!loading && shown.length === 0 && <p className="col-span-full text-center py-10 text-sm text-muted">No dishes found</p>}
        {!loading && shown.map((m) => {
          const ok = m.isAvailable !== false && m.active !== false;
          return ok ? (
            <button type="button" key={m.id} data-dish={m.id} onClick={() => onAdd(m.id)} className="anim-fade-in text-left rounded-xl border border-line bg-surface p-3 min-h-24 flex flex-col justify-between gap-2 transition hover:border-brand hover:-translate-y-0.5 hover:shadow-card active:scale-[0.97]">
              <div className="flex items-start justify-between gap-2"><VegDot veg={m.isVeg} /><span className="text-[10px] text-muted truncate max-w-[70%]">{m.categoryName}</span></div>
              <span className="font-medium text-sm text-fg leading-snug line-clamp-2 [overflow-wrap:anywhere]">{m.name}</span>
              <span className="flex items-center justify-between"><span className="font-semibold text-brand-text">₹{m.price.toFixed(2)}</span><span className="w-7 h-7 rounded-lg bg-brand/15 text-brand-text inline-flex items-center justify-center text-xs"><i className="fa-solid fa-plus" /></span></span>
            </button>
          ) : (
            <button type="button" key={m.id} data-dish-unavailable={m.id} onClick={() => showToast(`"${m.name}" is currently unavailable/out of stock and cannot be added to orders.`, 'warning')} className="text-left rounded-xl border border-line bg-subtle p-3 min-h-24 flex flex-col justify-between gap-2 opacity-60 cursor-not-allowed">
              <div className="flex items-start justify-between gap-2"><VegDot veg={m.isVeg} dim /><span className="badge badge-danger"><i className="fa-solid fa-ban text-[9px]" />Unavailable</span></div>
              <span className="font-medium text-sm text-muted leading-snug line-clamp-2 [overflow-wrap:anywhere]">{m.name}</span>
              <span className="font-semibold text-faint line-through">₹{m.price.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
