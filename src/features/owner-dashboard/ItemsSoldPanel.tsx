import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { categoriesKey, fetchCategories } from '../menu/api';
import { businessToday } from '../customers/loyalty';
import { fetchItemsSold, itemsSoldKey } from './api';
import {
  activeFilterCount, ORDER_TYPES, periodLabel, rangeFor, rangeProblem, RANGES, searchSentence, type GroupBy, type RangeKey,
} from './itemsSold';

const inr = (n?: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);
const DISHES_SHOWN = 10;
/** The columns of the dish list: name, sold, sales. One line per dish on every screen size. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_3rem_6.25rem] sm:grid-cols-[minmax(0,1fr)_4rem_7rem] gap-2 px-3 py-2.5';

const chip = (on: boolean) => `shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border transition active:scale-95 ${on ? 'bg-brand text-gray-950 border-brand' : 'bg-surface text-muted border-line hover:text-fg hover:border-brand'}`;

/** "What sold": every dish sold in a range of days, narrowed by search, category and order type, per day or per week. */
export function ItemsSoldPanel() {
  const [range, setRange] = useState<RangeKey>('last7');
  const [custom, setCustom] = useState(() => { const t = businessToday(); return { from: rangeFor('last7', t).from, to: t }; });
  const [groupBy, setGroupBy] = useState<GroupBy>('DAY');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = window.setTimeout(() => setQ(text), 300); return () => window.clearTimeout(t); }, [text]);   // search as you type, without a request per key
  useEffect(() => {
    if (!catsOpen) return;
    const onDown = (e: MouseEvent) => { if (!catsRef.current?.contains(e.target as Node)) setCatsOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCatsOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [catsOpen]);

  const dates = range === 'custom' ? custom : rangeFor(range);
  const problem = range === 'custom' ? rangeProblem(custom.from, custom.to) : null;
  const filters = { from: dates.from, to: dates.to, groupBy, q, categoryIds, orderTypes };
  const cats = useQuery({ queryKey: categoriesKey, queryFn: fetchCategories, staleTime: 5 * 60_000 });
  const sold = useQuery({ queryKey: [...itemsSoldKey, filters], queryFn: () => fetchItemsSold(filters), enabled: !problem, placeholderData: keepPreviousData });
  const data = sold.data;
  const dishes = useMemo(() => data?.items ?? [], [data]);
  const shown = showAll ? dishes : dishes.slice(0, DISHES_SHOWN);
  const peak = Math.max(1, ...(data?.periods ?? []).map((p) => p.quantity));
  const sentence = data ? searchSentence(q, data.totalQuantity, data.dishCount, inr(data.totalRevenue)) : null;
  const filterCount = activeFilterCount({ q, categories: categoryIds.length, orderTypes: orderTypes.length, range, groupBy });

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const reset = () => { setRange('last7'); setGroupBy('DAY'); setCategoryIds([]); setOrderTypes([]); setText(''); setQ(''); setShowAll(false); };
  const toggleOpen = (key: string) => setOpen((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <section id="itemsSoldPanel" data-testid="items-sold" className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg flex items-center gap-2"><i className="fa-solid fa-chart-column text-brand-text" /><span>What sold</span></h3>
          <p className="text-xs text-muted mt-0.5">Every dish sold, day by day or week by week. Type a dish to see how many sold. Amounts are item sales before tax and bill discounts.</p>
        </div>
        {filterCount > 0 && <button type="button" id="btnResetSoldFilters" onClick={reset} className="btn btn-ghost btn-sm"><i className="fa-solid fa-rotate-left" />Reset filters</button>}
      </div>

      <div className="space-y-3">
        <div role="group" aria-label="Date range" className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          {RANGES.map((r) => <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)} className={chip(range === r.key)}>{r.label}</button>)}
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted" htmlFor="soldFrom">From</label>
            <input id="soldFrom" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="input h-9 w-40" />
            <label className="text-xs text-muted" htmlFor="soldTo">To</label>
            <input id="soldTo" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="input h-9 w-40" />
            {problem && <span className="text-xs text-danger" role="alert">{problem}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Group by" className="inline-flex rounded-lg bg-subtle p-1">
            {(['DAY', 'WEEK'] as const).map((g) => (
              <button key={g} type="button" aria-pressed={groupBy === g} onClick={() => { setGroupBy(g); setOpen(new Set()); }}
                className={`h-8 px-3 rounded-md text-sm font-medium transition ${groupBy === g ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}>{g === 'DAY' ? 'Day-wise' : 'Week-wise'}</button>
            ))}
          </div>

          <div className="relative" ref={catsRef}>
            <button type="button" id="btnSoldCategories" aria-expanded={catsOpen} onClick={() => setCatsOpen((o) => !o)} className={`${chip(categoryIds.length > 0)} inline-flex items-center gap-1.5`}>
              <i className="fa-solid fa-layer-group text-xs" />{categoryIds.length === 0 ? 'All categories' : `${categoryIds.length} ${categoryIds.length === 1 ? 'category' : 'categories'}`}<i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${catsOpen ? 'rotate-180' : ''}`} />
            </button>
            {catsOpen && (
              <div className="absolute z-20 mt-1.5 w-64 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-pop p-2 anim-rise-in" role="group" aria-label="Categories">
                {(cats.data ?? []).length === 0 && <p className="text-xs text-muted p-2">No categories.</p>}
                {(cats.data ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm cursor-pointer hover:bg-subtle">
                    <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => setCategoryIds(toggle(categoryIds, c.id))} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                    <span className="min-w-0 truncate">{c.name}</span>
                  </label>
                ))}
                {categoryIds.length > 0 && <button type="button" onClick={() => setCategoryIds([])} className="w-full text-left text-xs font-medium text-brand-text px-2 py-2">Clear categories</button>}
              </div>
            )}
          </div>

          {ORDER_TYPES.map((t) => <button key={t.v} type="button" aria-pressed={orderTypes.includes(t.v)} onClick={() => setOrderTypes(toggle(orderTypes, t.v))} className={chip(orderTypes.includes(t.v))}>{t.label}</button>)}
        </div>

        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none" aria-hidden="true" />
          <input id="soldSearch" value={text} onChange={(e) => { setText(e.target.value); setShowAll(false); }} placeholder="Search a dish, e.g. biryani" aria-label="Search dishes sold" className="input pl-10 pr-10" autoComplete="off" />
          {text && <button type="button" onClick={() => { setText(''); setQ(''); }} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-xmark" /></button>}
        </div>
      </div>

      {sold.isError ? (
        <p className="text-sm text-danger text-center py-6" role="alert">Could not load the sales: {sold.error.message}</p>
      ) : !data ? (
        <div className="h-40 rounded-xl shimmer" aria-busy="true" aria-label="Loading" />
      ) : (
        <div className={`space-y-4 transition-opacity ${sold.isFetching ? 'opacity-60' : ''}`}>
          {sentence && <p id="soldSentence" className="rounded-xl bg-brand/10 border border-brand/25 px-4 py-3 text-sm font-medium text-fg">{sentence}</p>}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
            <div className="rounded-xl bg-subtle px-2.5 sm:px-3 py-2.5 min-w-0"><p className="text-[11px] uppercase tracking-wide text-muted">Sold</p><p id="soldTotalQty" className="text-base sm:text-xl font-bold text-fg">{data.totalQuantity.toLocaleString('en-IN')}</p></div>
            <div className="rounded-xl bg-subtle px-2.5 sm:px-3 py-2.5 min-w-0"><p className="text-[11px] uppercase tracking-wide text-muted">Sales</p><p id="soldTotalRevenue" className="text-base sm:text-xl font-bold text-emerald-500 whitespace-nowrap">{inr(data.totalRevenue)}</p></div>
            <div className="rounded-xl bg-subtle px-2.5 sm:px-3 py-2.5 min-w-0"><p className="text-[11px] uppercase tracking-wide text-muted">Dishes</p><p id="soldDishCount" className="text-base sm:text-xl font-bold text-fg">{data.dishCount}</p></div>
          </div>

          {data.dishCount === 0 ? (
            <p id="soldEmpty" className="text-sm text-muted text-center py-8">Nothing was sold for these filters.</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <div className="space-y-2 min-w-0">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">By dish</h4>
                <div id="soldDishTable" role="table" aria-label="Sold by dish" className="rounded-xl border border-line overflow-hidden">
                  <div role="row" className={`${ROW} text-[11px] font-semibold uppercase tracking-wide text-muted bg-subtle/60 border-b border-line`}>
                    <span role="columnheader">Dish</span><span role="columnheader" className="text-right">Sold</span><span role="columnheader" className="text-right">Sales</span>
                  </div>
                  {shown.map((d, i) => (
                    <div key={`${d.menuItemId ?? d.itemName}`} role="row" data-dish-row className={`${ROW} items-center border-b border-line last:border-0 anim-fade-in`}>
                      <div role="cell" className="min-w-0 flex items-center gap-2">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-subtle flex items-center justify-center text-[10px] text-muted font-bold">{i + 1}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-fg">{d.itemName}</span><span className="block truncate text-[11px] text-muted">{d.categoryName} · {d.sharePercent}%</span></span>
                      </div>
                      <div role="cell" className="text-right text-sm font-semibold text-fg">{d.quantity.toLocaleString('en-IN')}</div>
                      <div role="cell" className="text-right text-sm font-medium text-emerald-500">{inr(d.revenue)}</div>
                    </div>
                  ))}
                </div>
                {dishes.length > DISHES_SHOWN && (
                  <button type="button" id="btnSoldShowAll" onClick={() => setShowAll((v) => !v)} className="btn btn-ghost btn-sm w-full">{showAll ? 'Show fewer dishes' : `Show all ${dishes.length} dishes`}</button>
                )}
              </div>

              <div className="space-y-2 min-w-0">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{data.groupBy === 'DAY' ? 'Day by day' : 'Week by week'}</h4>
                <ul id="soldPeriods" className="space-y-1.5">
                  {data.periods.map((p) => {
                    const key = p.start;
                    const expanded = open.has(key);
                    const label = periodLabel(p.start, p.end, data.groupBy);
                    return (
                      <li key={key} data-period={key} className="rounded-xl border border-line bg-surface">
                        <button type="button" aria-expanded={expanded} aria-label={`${label}: ${p.quantity} sold`} disabled={p.quantity === 0} onClick={() => toggleOpen(key)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default">
                          <i className={`fa-solid fa-chevron-right text-[10px] text-faint transition-transform ${expanded ? 'rotate-90' : ''} ${p.quantity === 0 ? 'opacity-30' : ''}`} aria-hidden="true" />
                          <span className="w-32 shrink-0 text-sm font-medium text-fg">{label}</span>
                          <span className="flex-1 min-w-0 h-2 rounded-full bg-subtle overflow-hidden"><span className="block h-2 rounded-full bg-brand transition-all duration-500" style={{ width: `${(p.quantity / peak) * 100}%` }} /></span>
                          <span className="text-sm font-semibold text-fg w-14 text-right">{p.quantity.toLocaleString('en-IN')}</span>
                          <span className="hidden sm:block text-xs text-muted w-24 text-right">{inr(p.revenue)}</span>
                        </button>
                        {expanded && (
                          <ul className="border-t border-line px-3 py-2 space-y-1 anim-rise-in">
                            {p.items.map((i) => (
                              <li key={i.itemName} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-fg/90">{i.itemName}</span><span className="shrink-0 text-muted"><span className="font-semibold text-fg">{i.quantity}</span> · {inr(i.revenue)}</span></li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
