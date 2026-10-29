import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { Badge, Field, SegmentedTabs } from '../../components/ui';
import type { InventoryItem } from '../inventory/api';
import { STOCK_UNITS, fmtNum } from '../inventory/rules';
import type { MenuItem } from '../menu/api';
import { createLink, createStockItem, deleteLink, updateLink } from './api';
import { useLinkAction } from './hooks';
import { saleEffect, stockText, unitsCompatible, usesText, linkIssue, type Link } from './rules';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Link a dish to a stock item that exists, or to a new one made right here (stock and cost are filled in by the first purchase). */
export function AddIngredientDialog({ dish, items, used, onClose }: { dish: MenuItem; items: InventoryItem[]; used: Set<number>; onClose: () => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [itemId, setItemId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [newUnit, setNewUnit] = useState('piece');
  const [hasPack, setHasPack] = useState(false);
  const [packName, setPackName] = useState('packet');
  const [packSize, setPackSize] = useState('');
  const [qty, setQty] = useState('1');
  const [unitOverride, setUnitOverride] = useState<string | null>(null);
  const chosen = items.find((i) => i.id === itemId) ?? null;
  const unit = unitOverride ?? (mode === 'new' ? newUnit : chosen?.unit ?? '');
  const q = norm(query);
  const list = items.filter((i) => i.active !== false && !used.has(i.id) && (!q || norm(i.name).includes(q))).slice(0, 40);
  const n = parseFloat(qty);
  const target = mode === 'new' ? newUnit : chosen?.unit ?? '';
  const mismatch = !!unit && !!target && !unitsCompatible(unit, target);
  const clash = mode === 'new' && items.some((i) => norm(i.name) === norm(name));
  const ready = n > 0 && !mismatch && (mode === 'existing' ? !!chosen : name.trim().length > 0 && !clash && (!hasPack || parseFloat(packSize) > 1));

  const save = useLinkAction(async () => {
    let id = chosen?.id ?? 0;
    if (mode === 'new') id = (await createStockItem({ name, unit: newUnit, packName: hasPack ? packName : null, packSize: hasPack ? parseFloat(packSize) : null })).id;
    return createLink(dish.id, id, n, unit);
  }, `${dish.name} linked`, 'Could not link');
  const submit = (e: FormEvent) => { e.preventDefault(); if (ready) save.mutate(undefined, { onSuccess: onClose }); };

  return (
    <Dialog id="addIngredientModal" open onClose={onClose} size="md" title={`What does ${dish.name} use?`} description="Selling this dish takes this much from stock when its bill is paid.">
      <form onSubmit={submit} className="space-y-4">
        <SegmentedTabs label="Stock item" value={mode} onChange={(m) => { setMode(m); setUnitOverride(null); }} options={[{ value: 'existing', label: 'Stock item that exists', id: 'linkModeExisting' }, { value: 'new', label: 'New stock item', id: 'linkModeNew' }]} />
        {mode === 'existing' ? (
          <div className="space-y-2">
            <Field id="linkItemSearch" label="Find the stock item"><input id="linkItemSearch" value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder="e.g. bun, bread, water" autoComplete="off" /></Field>
            <ul id="linkItemList" className="max-h-52 overflow-y-auto rounded-lg border border-line divide-y divide-line">
              {list.length === 0 && <li className="p-3 text-sm text-muted">No stock item matches. Use "New stock item" to add it now.</li>}
              {list.map((i) => (
                <li key={i.id}><button type="button" data-pick-item={i.id} aria-pressed={itemId === i.id} onClick={() => { setItemId(i.id); setUnitOverride(null); }}
                  className={`w-full text-left px-3 py-2 min-h-11 flex items-center justify-between gap-2 hover:bg-subtle ${itemId === i.id ? 'bg-brand/10' : ''}`}>
                  <span className="min-w-0"><span className="block text-sm font-medium text-fg truncate">{i.name}</span><span className="block text-xs text-muted">{stockText(i)}</span></span>
                  {i.autoDeduct === false && <Badge>MANUAL</Badge>}</button></li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg bg-subtle p-3">
            <Field id="newItemName" label="Stock item name" hint="For example: Mini Burger Bun, Sandwich Bread, Mineral Water Bottle">
              <input id="newItemName" value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="off" /></Field>
            {clash && <p className="text-xs text-danger">A stock item with this name already exists. Pick it from "Stock item that exists".</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field id="newItemUnit" label="Count it in"><select id="newItemUnit" value={newUnit} onChange={(e) => { setNewUnit(e.target.value); setUnitOverride(null); }} className="input">{STOCK_UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <label htmlFor="newItemHasPack" className="flex items-end gap-2 pb-2 text-sm text-fg cursor-pointer"><input id="newItemHasPack" type="checkbox" checked={hasPack} onChange={(e) => setHasPack(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />Comes in packs</label>
            </div>
            {hasPack && (
              <div className="grid grid-cols-2 gap-3">
                <Field id="newItemPackName" label="Pack name"><input id="newItemPackName" value={packName} onChange={(e) => setPackName(e.target.value)} className="input" /></Field>
                <Field id="newItemPackSize" label={`1 pack has (${newUnit})`}><input id="newItemPackSize" type="number" inputMode="decimal" min="2" step="any" value={packSize} onChange={(e) => setPackSize(e.target.value)} className="input" placeholder="e.g. 4" /></Field>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id="linkQty" label="Used per dish sold"><input id="linkQty" type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="input" /></Field>
          <Field id="linkUnit" label="Unit"><input id="linkUnit" value={unit} onChange={(e) => setUnitOverride(e.target.value)} className="input" placeholder="piece" /></Field>
        </div>
        {mismatch && <p id="linkUnitWarning" role="alert" className="text-sm text-warn bg-warn/10 rounded-lg px-3 py-2">The stock is counted in {target}, so the recipe unit must be {target} (or a unit that converts to it, like g with kg).</p>}
        {chosen && ready && <p className="text-xs text-muted">{saleEffect(n, unit, chosen) || `Takes ${usesText(n, unit)} per dish.`}</p>}
        <button type="submit" id="btnSaveLink" disabled={!ready || save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Linking…' : 'Link to this dish'}</button>
      </form>
    </Dialog>
  );
}

/** Link a stock item to one more dish. */
export function AddDishDialog({ item, dishes, used, onClose }: { item: InventoryItem; dishes: MenuItem[]; used: Set<number>; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [dishId, setDishId] = useState<number | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState(item.unit);
  const q = norm(query);
  const list = dishes.filter((d) => d.active !== false && !used.has(d.id) && (!q || norm(d.name).includes(q) || norm(d.categoryName ?? '').includes(q))).slice(0, 60);
  const n = parseFloat(qty);
  const mismatch = !unitsCompatible(unit, item.unit);
  const ready = n > 0 && !mismatch && dishId != null;
  const save = useLinkAction(() => createLink(dishId!, item.id, n, unit), `${item.name} linked`, 'Could not link');
  return (
    <Dialog id="addDishModal" open onClose={onClose} size="md" title={`Which dish uses ${item.name}?`} description="Selling the dish takes this much from stock when its bill is paid.">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (ready) save.mutate(undefined, { onSuccess: onClose }); }} className="space-y-4">
        <Field id="linkDishSearch" label="Find the dish"><input id="linkDishSearch" value={query} onChange={(e) => setQuery(e.target.value)} className="input" placeholder="e.g. burger" autoComplete="off" /></Field>
        <ul id="linkDishList" className="max-h-52 overflow-y-auto rounded-lg border border-line divide-y divide-line">
          {list.length === 0 && <li className="p-3 text-sm text-muted">No dish matches.</li>}
          {list.map((d) => (
            <li key={d.id}><button type="button" data-pick-dish={d.id} aria-pressed={dishId === d.id} onClick={() => setDishId(d.id)} className={`w-full text-left px-3 py-2 min-h-11 hover:bg-subtle ${dishId === d.id ? 'bg-brand/10' : ''}`}>
              <span className="block text-sm font-medium text-fg">{d.name}</span><span className="block text-xs text-muted">{d.categoryName}</span></button></li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <Field id="linkQty" label="Used per dish sold"><input id="linkQty" type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="input" /></Field>
          <Field id="linkUnit" label="Unit"><input id="linkUnit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input" /></Field>
        </div>
        {mismatch && <p id="linkUnitWarning" role="alert" className="text-sm text-warn bg-warn/10 rounded-lg px-3 py-2">{item.name} is counted in {item.unit}, so the recipe unit must be {item.unit}.</p>}
        <button type="submit" id="btnSaveLink" disabled={!ready || save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Linking…' : 'Link to this item'}</button>
      </form>
    </Dialog>
  );
}

/** The selected connector: change how much one dish takes, or remove the link. */
export function LinkInspector({ link, dishName, item, onClose, onFocusItem, onFocusDish }: { link: Link; dishName: string; item: InventoryItem | undefined; onClose: () => void; onFocusItem: () => void; onFocusDish: () => void }) {
  const [qty, setQty] = useState(String(link.quantityPerServing));
  const [unit, setUnit] = useState(link.unit);
  const n = parseFloat(qty);
  const changed = n !== link.quantityPerServing || unit.trim() !== link.unit;
  const issue = linkIssue({ unit }, item);
  const save = useLinkAction(() => updateLink(link.id, n, unit.trim()), 'Link updated', 'Could not update the link');
  const remove = useLinkAction(() => deleteLink(link.id), 'Link removed', 'Could not remove the link');
  return (
    <section id="linkInspector" aria-label="Selected link" className="card p-4 space-y-3 scroll-mt-20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-muted">Selected link</p>
          <p className="font-semibold text-fg"><button type="button" onClick={onFocusDish} className="hover:underline text-left">{dishName}</button> <i className="fa-solid fa-arrow-right text-xs text-faint mx-1" />
            <button type="button" onClick={onFocusItem} className="hover:underline text-left">{link.inventoryItemName ?? item?.name}</button></p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Field id="linkEditQty" label="Used per dish sold"><input id="linkEditQty" type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="input" /></Field>
        <Field id="linkEditUnit" label="Unit"><input id="linkEditUnit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input" /></Field>
      </div>
      {issue && <p role="alert" className="text-sm text-warn bg-warn/10 rounded-lg px-3 py-2">{issue}</p>}
      {item && !issue && n > 0 && (
        <ul className="text-sm text-muted space-y-0.5">
          <li>{saleEffect(n, unit, item, 1)}</li>
          {item.autoDeduct !== false && <li>{saleEffect(n, unit, item, 10)} In stock now: {fmtNum(item.quantity)} {item.unit}.</li>}
        </ul>
      )}
      {item?.nextExpiryDate && (
        <div className="rounded-lg border border-line bg-subtle p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-fg flex items-center gap-1.5"><i className="fa-solid fa-hourglass-half text-brand-text" />Earliest FIFO Batch</span>
            <Badge tone={item.expiryStatus === 'EXPIRED' ? 'danger' : item.expiryStatus === 'SOON' ? 'warn' : 'ok'}>
              {item.expiryStatus === 'EXPIRED' ? 'EXPIRED' : item.expiryStatus === 'SOON' ? 'EXPIRES SOON' : 'FRESH'}
            </Badge>
          </div>
          <p className="text-muted">
            Next expiry on <strong className={item.expiryStatus === 'EXPIRED' ? 'text-danger' : item.expiryStatus === 'SOON' ? 'text-warn' : 'text-fg'}>{item.nextExpiryDate}</strong>
            {item.expiringQuantity ? ` · ${fmtNum(item.expiringQuantity)} ${item.unit} in earliest batch` : ''}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" id="btnSaveLinkEdit" disabled={!changed || !(n > 0) || !!issue || save.isPending} onClick={() => save.mutate(undefined)} className="btn btn-primary"><i className="fa-solid fa-floppy-disk" />Save</button>
        <button type="button" id="btnRemoveLink" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove the link between ${dishName} and ${link.inventoryItemName ?? 'this item'}?\n\nSelling the dish will no longer change this stock.`)) remove.mutate(undefined, { onSuccess: onClose }); }} className="btn btn-soft-danger"><i className="fa-solid fa-link-slash" />Remove link</button>
      </div>
    </section>
  );
}
