import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, SegmentedTabs, Skeleton } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { useInventory } from '../inventory/hooks';
import { useMenuItems } from '../menu/hooks';
import {
  createModifierGroup, deleteComboGroup, deleteModifierGroup, fetchCombosForMenuItem, fetchModifierGroups,
  fetchModifiersForMenuItem, menuItemCombosKey, menuItemModifiersKey, modifierGroupsKey, saveComboGroup,
  setModifierGroupsForMenuItem, updateModifierGroup, type ComboGroup, type ModifierGroup,
} from './api';

type Tab = 'groups' | 'dishes' | 'combos';

/** Menu page: create option groups (milk, size, extras), put them on dishes, and build combo meals. */
export function ModifiersAdminDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('groups');
  return (
    <Dialog id="modifiersAdminModal" open onClose={onClose} size="lg" title="Modifiers & combos" description="Add-ons and choices that appear when a dish is tapped on the POS.">
      <div className="space-y-4">
        <SegmentedTabs<Tab> label="Modifiers and combos" value={tab} onChange={setTab} options={[
          { value: 'groups', label: 'Option groups', id: 'modTabGroups' },
          { value: 'dishes', label: 'On dishes', id: 'modTabDishes' },
          { value: 'combos', label: 'Combo meals', id: 'modTabCombos' },
        ]} />
        {tab === 'groups' && <GroupsTab />}
        {tab === 'dishes' && <DishesTab />}
        {tab === 'combos' && <CombosTab />}
      </div>
    </Dialog>
  );
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

/* ───────────── option groups ───────────── */

type OptionRow = { id?: number; name: string; price: string; isDefault: boolean; stockItem: string; stockQty: string };

function GroupsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: modifierGroupsKey, queryFn: fetchModifierGroups });
  const [editing, setEditing] = useState<ModifierGroup | 'new' | null>(null);
  const remove = useMutation<unknown, Error, number>({
    mutationFn: (id) => deleteModifierGroup(id),
    onSuccess: () => { showToast('Option group removed', 'success'); void qc.invalidateQueries({ queryKey: ['modifier-groups'] }); void qc.invalidateQueries({ queryKey: ['menu-items'] }); },
    onError: (e) => showToast(`Could not remove the group: ${e.message}`, 'error'),
  });

  if (editing) return <GroupForm group={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  if (q.isPending) return <Skeleton rows={3} />;
  const groups = q.data ?? [];
  return (
    <div className="space-y-3" id="modGroupsList">
      <div className="flex justify-end"><button type="button" id="btnNewModGroup" onClick={() => setEditing('new')} className="btn btn-primary btn-sm"><i className="fa-solid fa-plus" />New group</button></div>
      {groups.length === 0 && <EmptyState icon="fa-layer-group" title="No option groups yet" hint="Create one (for example Milk: whole, oat, soy) and put it on the dishes that use it." />}
      {groups.map((g) => (
        <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg border border-line">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{g.name}</p>
            <p className="text-xs text-muted">
              {g.modifiers.map((m) => m.name).join(', ') || 'No options'} · {g.minSelections > 0 ? `pick ${g.minSelections}` : 'optional'}{g.maxSelections > 0 ? `, up to ${g.maxSelections}` : ', any number'}
            </p>
          </div>
          <button type="button" onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`} title={`Edit ${g.name}`} className="btn btn-secondary btn-icon btn-sm"><i className="fa-regular fa-pen-to-square" /></button>
          <button type="button" onClick={() => { if (window.confirm(`Remove the group "${g.name}"? Dishes stop offering it.`)) remove.mutate(g.id!); }} aria-label={`Remove ${g.name}`} title={`Remove ${g.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>
        </div>
      ))}
    </div>
  );
}

function GroupForm({ group, onDone }: { group: ModifierGroup | null; onDone: () => void }) {
  const qc = useQueryClient();
  const inv = useInventory();
  const stock = (inv.data ?? []).filter((i) => i.active !== false);
  const [name, setName] = useState(group?.name ?? '');
  const [min, setMin] = useState(String(group?.minSelections ?? 0));
  const [max, setMax] = useState(String(group?.maxSelections ?? 1));
  const [rows, setRows] = useState<OptionRow[]>(group?.modifiers.length
    ? group.modifiers.map((m) => ({ id: m.id, name: m.name, price: String(m.priceAdjustment ?? 0), isDefault: !!m.isDefault, stockItem: m.inventoryItemId ? String(m.inventoryItemId) : '', stockQty: m.inventoryQuantity ? String(m.inventoryQuantity) : '' }))
    : [{ name: '', price: '0', isDefault: false, stockItem: '', stockQty: '' }]);
  const setRow = (i: number, patch: Partial<OptionRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = useMutation<unknown, Error, ModifierGroup>({
    mutationFn: (dto) => (group?.id ? updateModifierGroup(group.id, dto) : createModifierGroup(dto)),
    onSuccess: () => { showToast(group ? 'Option group updated' : 'Option group created', 'success'); void qc.invalidateQueries({ queryKey: ['modifier-groups'] }); void qc.invalidateQueries({ queryKey: ['menu-items'] }); onDone(); },
    onError: (e) => showToast(e.message, 'error'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const options = rows.filter((r) => r.name.trim());
    if (!name.trim()) { showToast('Give the group a name', 'error'); return; }
    if (options.length === 0) { showToast('Add at least one option', 'error'); return; }
    save.mutate({
      id: group?.id, name: name.trim(), minSelections: Math.max(0, Math.floor(num(min))), maxSelections: Math.max(0, Math.floor(num(max))),
      modifiers: options.map((r, i) => ({
        id: r.id, name: r.name.trim(), priceAdjustment: num(r.price), isDefault: r.isDefault, sortOrder: i,
        inventoryItemId: r.stockItem ? Number(r.stockItem) : null, inventoryQuantity: r.stockItem ? num(r.stockQty) : 0,
      })),
    });
  };

  return (
    <form id="modGroupForm" onSubmit={submit} className="space-y-4">
      <Field id="modGroupName" label="Group name *"><input id="modGroupName" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Milk, Size, Extras" maxLength={100} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="modGroupMin" label="Must pick at least" hint="0 = optional"><input id="modGroupMin" type="number" min={0} className="input" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
        <Field id="modGroupMax" label="Can pick up to" hint="0 = any number"><input id="modGroupMax" type="number" min={0} className="input" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        <p className="label">Options</p>
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-line p-2.5 space-y-2" data-testid="mod-option-row">
            <div className="flex gap-2">
              <input aria-label="Option name" className="input flex-1 min-w-0" placeholder="Option (e.g. Oat milk)" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={100} />
              <input aria-label="Extra price" type="number" step="0.01" className="input w-24 shrink-0" placeholder="+₹" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
              <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Remove option" title="Remove option" className="btn btn-ghost btn-icon btn-sm hover:!text-danger shrink-0"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={r.isDefault} onChange={(e) => setRow(i, { isDefault: e.target.checked })} />Pre-selected</label>
              <select aria-label="Stock item used" className="input h-9 text-xs flex-1 min-w-[10rem]" value={r.stockItem} onChange={(e) => setRow(i, { stockItem: e.target.value })}>
                <option value="">Uses no stock</option>
                {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
              </select>
              {r.stockItem && <input aria-label="Stock used per serving" type="number" step="0.001" min="0" className="input h-9 w-24 text-xs" placeholder="qty" value={r.stockQty} onChange={(e) => setRow(i, { stockQty: e.target.value })} />}
            </div>
          </div>
        ))}
        <button type="button" id="btnAddModOption" onClick={() => setRows((r) => [...r, { name: '', price: '0', isDefault: false, stockItem: '', stockQty: '' }])} className="btn btn-secondary btn-sm"><i className="fa-solid fa-plus" />Add option</button>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn btn-secondary flex-1 h-10">Back</button>
        <button type="submit" id="btnSaveModGroup" disabled={save.isPending} className="btn btn-primary flex-1 h-10">{save.isPending ? 'Saving…' : 'Save group'}</button>
      </div>
    </form>
  );
}

/* ───────────── groups on a dish ───────────── */

function DishesTab() {
  const qc = useQueryClient();
  const items = useMenuItems();
  const groups = useQuery({ queryKey: modifierGroupsKey, queryFn: fetchModifierGroups });
  const [dishId, setDishId] = useState<number | null>(null);
  const dishes = [...(items.data ?? [])].filter((d) => d.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  if (items.isPending || groups.isPending) return <Skeleton rows={3} />;
  return (
    <div className="space-y-4">
      <Field id="modDishPick" label="Dish">
        <select id="modDishPick" className="input" value={dishId ?? ''} onChange={(e) => setDishId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a dish…</option>
          {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {dishId && <DishGroups key={dishId} dishId={dishId} groups={groups.data ?? []} onSaved={() => { void qc.invalidateQueries({ queryKey: menuItemModifiersKey(dishId) }); }} />}
      {!dishId && <p className="text-sm text-muted">Pick a dish to choose which option groups it offers.</p>}
    </div>
  );
}

function DishGroups({ dishId, groups, onSaved }: { dishId: number; groups: ModifierGroup[]; onSaved: () => void }) {
  const current = useQuery({ queryKey: menuItemModifiersKey(dishId), queryFn: () => fetchModifiersForMenuItem(dishId) });
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const selected = picked ?? new Set((current.data ?? []).map((g) => g.id!));
  const save = useMutation<unknown, Error, number[]>({
    mutationFn: (ids) => setModifierGroupsForMenuItem(dishId, ids),
    onSuccess: () => { showToast('Dish options saved', 'success'); onSaved(); },
    onError: (e) => showToast(`Could not save: ${e.message}`, 'error'),
  });
  if (current.isPending) return <Skeleton rows={2} />;
  if (groups.length === 0) return <p className="text-sm text-muted">Create an option group first.</p>;
  return (
    <div className="space-y-2" id="modDishGroups">
      {groups.map((g) => (
        <label key={g.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-line cursor-pointer">
          <input type="checkbox" checked={selected.has(g.id!)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(g.id!); else n.delete(g.id!); setPicked(n); }} />
          <span className="text-sm text-fg flex-1 min-w-0 truncate">{g.name}</span>
          <Badge>{g.modifiers.length} option{g.modifiers.length === 1 ? '' : 's'}</Badge>
        </label>
      ))}
      <button type="button" id="btnSaveDishGroups" disabled={save.isPending} onClick={() => save.mutate([...selected])} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : 'Save for this dish'}</button>
    </div>
  );
}

/* ───────────── combo meals ───────────── */

type ComboItemRow = { menuItemId: string; price: string };

function CombosTab() {
  const items = useMenuItems();
  const [comboId, setComboId] = useState<number | null>(null);
  const dishes = [...(items.data ?? [])].filter((d) => d.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  if (items.isPending) return <Skeleton rows={3} />;
  return (
    <div className="space-y-4">
      <Field id="comboDishPick" label="Combo dish" hint="The dish that is sold as a bundle (its price is the bundle price).">
        <select id="comboDishPick" className="input" value={comboId ?? ''} onChange={(e) => setComboId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a dish…</option>
          {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {comboId ? <ComboGroups key={comboId} comboId={comboId} dishes={dishes.map((d) => ({ id: d.id, name: d.name }))} /> : <p className="text-sm text-muted">Pick the combo dish to define what the customer chooses from.</p>}
    </div>
  );
}

function ComboGroups({ comboId, dishes }: { comboId: number; dishes: { id: number; name: string }[] }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: menuItemCombosKey(comboId), queryFn: () => fetchCombosForMenuItem(comboId) });
  const [adding, setAdding] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: menuItemCombosKey(comboId) }); };
  const remove = useMutation<unknown, Error, number>({
    mutationFn: (id) => deleteComboGroup(id),
    onSuccess: () => { showToast('Combo group removed', 'success'); refresh(); },
    onError: (e) => showToast(`Could not remove: ${e.message}`, 'error'),
  });
  if (q.isPending) return <Skeleton rows={2} />;
  const groups: ComboGroup[] = q.data ?? [];
  return (
    <div className="space-y-3" id="comboGroupsList">
      {groups.map((g) => (
        <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg border border-line">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{g.name}</p>
            <p className="text-xs text-muted">{g.items.map((i) => i.menuItemName + (i.additionalPrice > 0 ? ` (+₹${i.additionalPrice})` : '')).join(', ')} · choose {g.minChoices === g.maxChoices ? g.maxChoices : `${g.minChoices}-${g.maxChoices}`}</p>
          </div>
          <button type="button" onClick={() => { if (window.confirm(`Remove the combo group "${g.name}"?`)) remove.mutate(g.id!); }} aria-label={`Remove ${g.name}`} title={`Remove ${g.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>
        </div>
      ))}
      {groups.length === 0 && !adding && <p className="text-sm text-muted">No choices defined yet for this dish.</p>}
      {adding
        ? <ComboGroupForm comboId={comboId} dishes={dishes} onDone={() => { setAdding(false); refresh(); }} />
        : <button type="button" id="btnAddComboGroup" onClick={() => setAdding(true)} className="btn btn-primary btn-sm"><i className="fa-solid fa-plus" />Add a choice (e.g. Side, Drink)</button>}
    </div>
  );
}

function ComboGroupForm({ comboId, dishes, onDone }: { comboId: number; dishes: { id: number; name: string }[]; onDone: () => void }) {
  const [name, setName] = useState('');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('1');
  const [rows, setRows] = useState<ComboItemRow[]>([{ menuItemId: '', price: '0' }, { menuItemId: '', price: '0' }]);
  const setRow = (i: number, patch: Partial<ComboItemRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = useMutation<unknown, Error, ComboGroup>({
    mutationFn: (dto) => saveComboGroup(dto),
    onSuccess: () => { showToast('Combo choice added', 'success'); onDone(); },
    onError: (e) => showToast(e.message, 'error'),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const items = rows.filter((r) => r.menuItemId);
    if (!name.trim()) { showToast('Give the choice a name', 'error'); return; }
    if (items.length === 0) { showToast('Pick at least one dish', 'error'); return; }
    save.mutate({ comboMenuItemId: comboId, name: name.trim(), minChoices: Math.max(0, Math.floor(num(min))), maxChoices: Math.max(1, Math.floor(num(max))), items: items.map((r) => ({ menuItemId: Number(r.menuItemId), additionalPrice: num(r.price) })) });
  };
  return (
    <form id="comboGroupForm" onSubmit={submit} className="space-y-3 rounded-lg border border-line p-3">
      <Field id="comboGroupName" label="Choice name *"><input id="comboGroupName" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Side, Drink" maxLength={100} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="comboGroupMin" label="Choose at least"><input id="comboGroupMin" type="number" min={0} className="input" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
        <Field id="comboGroupMax" label="Choose up to"><input id="comboGroupMax" type="number" min={1} className="input" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        <p className="label">Dishes to choose from</p>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <select aria-label="Dish" className="input flex-1 min-w-0" value={r.menuItemId} onChange={(e) => setRow(i, { menuItemId: e.target.value })}>
              <option value="">Choose a dish…</option>
              {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input aria-label="Extra price" type="number" step="0.01" className="input w-24 shrink-0" placeholder="+₹" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
            <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Remove dish" title="Remove dish" className="btn btn-ghost btn-icon btn-sm hover:!text-danger shrink-0"><i className="fa-solid fa-xmark" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { menuItemId: '', price: '0' }])} className="btn btn-secondary btn-sm"><i className="fa-solid fa-plus" />Add dish</button>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="btn btn-secondary flex-1 h-10">Cancel</button>
        <button type="submit" id="btnSaveComboGroup" disabled={save.isPending} className="btn btn-primary flex-1 h-10">{save.isPending ? 'Saving…' : 'Add choice'}</button>
      </div>
    </form>
  );
}
