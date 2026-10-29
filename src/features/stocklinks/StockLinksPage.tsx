import { useState } from 'react';
import { Badge, EmptyState, PageHeader, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import type { InventoryItem } from '../inventory/api';
import { useInventory } from '../inventory/hooks';
import type { MenuItem } from '../menu/api';
import { useMenuItems } from '../menu/hooks';
import { FlowDiagram, type FlowEdge } from './FlowDiagram';
import { useLinks } from './hooks';
import { AddDishDialog, AddIngredientDialog, LinkInspector } from './LinkDialogs';
import { DishCard, ItemCard } from './Nodes';
import { SuggestDialog } from './SuggestDialog';
import {
  buildGraph, coverage, dishState, dishStateLabel, filterDishes, filterItems, groupByCategory, linkIssue, suggestLinks, usesText,
  type DishFilter, type ItemFilter, type Link,
} from './rules';

type Focus = { kind: 'dish' | 'item'; id: number } | null;
type Dialog = { kind: 'ingredient'; dish: MenuItem } | { kind: 'dish'; item: InventoryItem } | { kind: 'suggest' } | null;

const DISH_FILTERS: { value: DishFilter; label: string }[] = [
  { value: 'all', label: 'All dishes' }, { value: 'none', label: 'Not linked' }, { value: 'live', label: 'Reduces stock' }, { value: 'cost-only', label: 'Cost only' }, { value: 'problem', label: 'Check units' },
];
const ITEM_FILTERS: { value: ItemFilter; label: string }[] = [
  { value: 'all', label: 'All stock items' }, { value: 'unused', label: 'No dish uses it' }, { value: 'manual', label: 'Issued by hand' }, { value: 'low', label: 'Low stock' }, { value: 'expiring', label: 'Expiring' },
];

/**
 * Stock Links: which stock each dish takes when its bill is paid, drawn as a small flow diagram. Pick a dish to see the stock items
 * it uses; pick a stock item to see every dish that uses it. Links are added, changed and removed here.
 */
export function StockLinksPage() {
  const dishesQ = useMenuItems();
  const stockQ = useInventory();
  const linksQ = useLinks();
  const dishes = dishesQ.data ?? [];
  const items = stockQ.data ?? [];
  const links = linksQ.data ?? [];
  const graph = buildGraph(dishes, items, links);
  const cov = coverage(dishes, items, graph);

  const [focus, setFocus] = useState<Focus>(null);
  const [edgeId, setEdgeId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState<'dishes' | 'items'>('dishes');
  const [query, setQuery] = useState('');
  const [dishFilter, setDishFilter] = useState<DishFilter>('all');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [listOpen, setListOpen] = useState(true);               // on a phone the list folds away once something is picked
  const loading = dishesQ.isPending || stockQ.isPending || linksQ.isPending;
  const failed = dishesQ.error ?? stockQ.error ?? linksQ.error;

  const go = (f: Focus) => { setFocus(f); setEdgeId(null); if (f) setListOpen(false); };
  const showTab = (t: 'dishes' | 'items') => { setTab(t); setQuery(''); };
  const filterBy = (t: 'dishes' | 'items', f: DishFilter | ItemFilter) => { showTab(t); if (t === 'dishes') setDishFilter(f as DishFilter); else setItemFilter(f as ItemFilter); setListOpen(true); };

  const focusDish = focus?.kind === 'dish' ? graph.dishesById.get(focus.id) : undefined;
  const focusItem = focus?.kind === 'item' ? graph.itemsById.get(focus.id) : undefined;
  const sel = edgeId != null ? links.find((l) => l.id === edgeId) : undefined;

  const shownDishes = filterDishes(dishes, graph, query, dishFilter);
  const shownItems = filterItems(items, graph, query, itemFilter);
  const edgeFor = (l: Link, node: React.ReactNode): FlowEdge => ({ id: String(l.id), node, label: usesText(l.quantityPerServing, l.unit), selected: l.id === edgeId, warn: !!linkIssue(l, graph.itemsById.get(l.inventoryItemId)), onSelect: () => setEdgeId(l.id === edgeId ? null : l.id) });

  const dishEdges: FlowEdge[] = focusDish
    ? [...(graph.byDish.get(focusDish.id) ?? [])].sort((a, b) => (a.inventoryItemName ?? '').localeCompare(b.inventoryItemName ?? '')).flatMap((l) => {
      const it = graph.itemsById.get(l.inventoryItemId);
      return it ? [edgeFor(l, <ItemCard item={it} usedBy={graph.byItem.get(it.id)?.length ?? 0} onClick={() => go({ kind: 'item', id: it.id })} />)] : [];
    }) : [];
  const itemEdges: FlowEdge[] = focusItem
    ? [...(graph.byItem.get(focusItem.id) ?? [])].sort((a, b) => (a.menuItemName ?? '').localeCompare(b.menuItemName ?? '')).flatMap((l) => {
      const d = graph.dishesById.get(l.menuItemId);
      return d ? [edgeFor(l, <DishCard dish={d} state={dishState(graph.byDish.get(d.id) ?? [], graph.itemsById)} links={graph.byDish.get(d.id)?.length ?? 0} onClick={() => go({ kind: 'dish', id: d.id })} />)] : [];
    }) : [];

  const addButton = (label: string, onClick: () => void, id: string) => (
    <button type="button" id={id} onClick={onClick} className="w-full min-h-12 rounded-xl border-2 border-dashed border-line-strong text-sm font-medium text-muted hover:text-fg hover:border-brand transition flex items-center justify-center gap-2"><i className="fa-solid fa-plus" />{label}</button>
  );

  const kpi = (id: string, value: string, label: string, onClick: () => void, tone = '') => (
    <button type="button" id={id} onClick={onClick} className="card p-3 text-left hover:border-brand transition min-h-16">
      <span className={`block text-xl font-semibold ${tone || 'text-fg'}`}>{value}</span><span className="block text-xs text-muted">{label}</span>
    </button>
  );

  return (
    <section id="tab-stocklinks" data-testid="tab-stocklinks" className="space-y-4">
      <PageHeader title="Stock links" description="Which stock each dish takes when its bill is paid. Pick a dish or a stock item to see how it is connected."
        actions={<button type="button" id="btnSuggestLinks" onClick={() => setDialog({ kind: 'suggest' })} className="btn btn-secondary"><i className="fa-solid fa-wand-magic-sparkles" />Suggest links</button>} />

      {failed ? <p role="alert" className="card p-4 text-sm text-danger">Could not load: {failed.message}</p> : loading ? <div className="card"><Skeleton rows={6} /></div> : (
        <>
          <div id="stockLinksSummary" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {kpi('kpiLinked', `${cov.linked} / ${cov.dishes}`, 'dishes linked to stock', () => filterBy('dishes', 'all'), 'text-ok')}
            {kpi('kpiUnlinked', String(cov.unlinked), 'dishes not linked', () => filterBy('dishes', 'none'))}
            {kpi('kpiCostOnly', String(cov.manualOnly), 'dishes with cost only', () => filterBy('dishes', 'cost-only'))}
            {kpi('kpiProblems', String(cov.problems), 'dishes to check (units)', () => filterBy('dishes', 'problem'), cov.problems > 0 ? 'text-danger' : '')}
            {kpi('kpiItemsUsed', `${cov.used} / ${cov.items}`, 'stock items used by a dish', () => filterBy('items', 'unused'))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] gap-4 items-start">
            {/* Pick what to look at */}
            <div className="lg:sticky lg:top-20 space-y-2 min-w-0">
              <button type="button" id="btnChooseNode" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen} className="btn btn-secondary w-full lg:hidden"><i className="fa-solid fa-list" />{listOpen ? 'Hide the list' : focus ? 'Choose another dish or item' : 'Choose a dish or item'}</button>
              <div id="stockLinksRail" className={`card p-3 space-y-2.5 ${listOpen ? '' : 'hidden'} lg:block`}>
                <SegmentedTabs label="Look at" value={tab} onChange={showTab} options={[{ value: 'dishes', label: `Dishes (${dishes.filter((d) => d.active !== false).length})`, id: 'slTabDishes' }, { value: 'items', label: `Stock items (${items.length})`, id: 'slTabItems' }]} />
                <SearchInput id="stockLinksSearch" value={query} onChange={setQuery} placeholder={tab === 'dishes' ? 'Search dishes or categories' : 'Search stock items'} />
                {tab === 'dishes'
                  ? <select id="stockLinksFilter" aria-label="Show dishes" value={dishFilter} onChange={(e) => setDishFilter(e.target.value as DishFilter)} className="input">{DISH_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                  : <select id="stockLinksFilter" aria-label="Show stock items" value={itemFilter} onChange={(e) => setItemFilter(e.target.value as ItemFilter)} className="input">{ITEM_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>}
                <div id="stockLinksList" className="max-h-[26rem] overflow-y-auto -mx-1 px-1 space-y-2">
                  {tab === 'dishes' ? (shownDishes.length === 0 ? <p className="text-sm text-muted py-4 text-center">No dishes here.</p> : groupByCategory(shownDishes).map((g) => (
                    <div key={g.category}>
                      <p className="sticky top-0 bg-surface text-[11px] font-semibold uppercase tracking-wide text-muted py-1">{g.category} · {g.dishes.length}</p>
                      <ul>{g.dishes.map((d) => {
                        const st = dishState(graph.byDish.get(d.id) ?? [], graph.itemsById);
                        const on = focus?.kind === 'dish' && focus.id === d.id;
                        return <li key={d.id}><button type="button" data-list-dish={d.id} aria-pressed={on} onClick={() => go({ kind: 'dish', id: d.id })} className={`w-full text-left px-2 min-h-10 rounded-lg flex items-center justify-between gap-2 text-sm hover:bg-subtle ${on ? 'bg-brand/15 font-semibold' : ''}`}>
                          <span className="truncate text-fg">{d.name}</span>
                          <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${st === 'live' ? 'bg-ok' : st === 'problem' ? 'bg-danger' : st === 'cost-only' ? 'bg-warn' : 'bg-line-strong'}`} title={dishStateLabel(st)} aria-label={dishStateLabel(st)} /></button></li>;
                      })}</ul>
                    </div>
                  ))) : (shownItems.length === 0 ? <p className="text-sm text-muted py-4 text-center">No stock items here.</p> : (
                    <ul>{[...shownItems].sort((a, b) => a.name.localeCompare(b.name)).map((i) => {
                      const on = focus?.kind === 'item' && focus.id === i.id;
                      const n = graph.byItem.get(i.id)?.length ?? 0;
                      return <li key={i.id}><button type="button" data-list-item={i.id} aria-pressed={on} onClick={() => go({ kind: 'item', id: i.id })} className={`w-full text-left px-2 min-h-10 rounded-lg flex items-center justify-between gap-2 text-sm hover:bg-subtle ${on ? 'bg-brand/15 font-semibold' : ''}`}>
                        <span className="truncate text-fg">{i.name}</span><span className="shrink-0 text-xs text-muted">{n === 0 ? '-' : `${n} dish${n === 1 ? '' : 'es'}`}</span></button></li>;
                    })}</ul>
                  ))}
                </div>
              </div>
            </div>

            {/* The diagram */}
            <div className="space-y-4 min-w-0">
              <div id="stockLinksCanvas" className="card p-4 sm:p-5 overflow-x-auto">
                {focusDish ? (
                  <FlowDiagram flow="out" key={`d${focusDish.id}`}
                    focus={<DishCard dish={focusDish} focus state={dishState(graph.byDish.get(focusDish.id) ?? [], graph.itemsById)} links={graph.byDish.get(focusDish.id)?.length ?? 0} />}
                    edges={dishEdges} add={addButton('Add what it uses', () => setDialog({ kind: 'ingredient', dish: focusDish }), 'btnAddIngredient')} />
                ) : focusItem ? (
                  <FlowDiagram flow="in" key={`i${focusItem.id}`}
                    focus={<ItemCard item={focusItem} focus usedBy={graph.byItem.get(focusItem.id)?.length ?? 0} />}
                    edges={itemEdges} add={addButton('Link a dish', () => setDialog({ kind: 'dish', item: focusItem }), 'btnAddDish')} />
                ) : (
                  <EmptyState icon="fa-diagram-project" title="Pick a dish or a stock item" hint="You will see what it is connected to: which stock a dish takes, and which dishes use a stock item."
                    action={cov.unlinked > 0 ? <button type="button" onClick={() => filterBy('dishes', 'none')} className="btn btn-secondary btn-sm">{cov.unlinked} dishes have no link yet</button> : undefined} />
                )}
              </div>
              {sel && (
                <LinkInspector key={`${sel.id}:${sel.quantityPerServing}:${sel.unit}`} link={sel} dishName={graph.dishesById.get(sel.menuItemId)?.name ?? sel.menuItemName ?? 'Dish'} item={graph.itemsById.get(sel.inventoryItemId)}
                  onClose={() => setEdgeId(null)} onFocusItem={() => go({ kind: 'item', id: sel.inventoryItemId })} onFocusDish={() => go({ kind: 'dish', id: sel.menuItemId })} />
              )}
              {focusDish && dishEdges.length === 0 && suggestLinks([focusDish], items, graph).length > 0 && (
                <p id="stockLinksTip" className="text-sm text-muted"><Badge tone="info">Tip</Badge> <span className="ml-1">Suggest links can fill this dish in: it looks like a bun, bread, wrap or bottle dish.</span></p>
              )}
            </div>
          </div>
        </>
      )}

      {dialog?.kind === 'ingredient' && <AddIngredientDialog key={dialog.dish.id} dish={dialog.dish} items={items} used={new Set((graph.byDish.get(dialog.dish.id) ?? []).map((l) => l.inventoryItemId))} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'dish' && <AddDishDialog key={dialog.item.id} item={dialog.item} dishes={dishes} used={new Set((graph.byItem.get(dialog.item.id) ?? []).map((l) => l.menuItemId))} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'suggest' && <SuggestDialog dishes={dishes} items={items} graph={graph} onClose={() => setDialog(null)} />}
    </section>
  );
}
