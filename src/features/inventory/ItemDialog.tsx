import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Field } from '../../components/ui';
import { saveInventoryItem, type InventoryInput, type InventoryItem } from './api';
import { useInventoryAction } from './hooks';
import { CATEGORIES, CATEGORY_HELP, STOCK_UNITS, VOLUME_UNITS, fmtNum, formFromItem, hasSize, packBreakdown, payloadFromForm, type ItemForm } from './rules';

/** Add (item = null) or edit a raw material / stock item. */
export function ItemDialog({ item, defaultCategory, onClose }: { item: InventoryItem | null; defaultCategory: string; onClose: () => void }) {
  const [f, setF] = useState<ItemForm>(() => formFromItem(item, defaultCategory));
  const save = useInventoryAction((p: InventoryInput) => saveInventoryItem(item?.id ?? null, p),
    item ? 'Inventory item updated successfully' : 'Inventory item added successfully', 'Failed to save inventory');
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((p) => ({ ...p, [k]: v }));

  // Picking a unit sets the sensible size defaults (pieces -> 1, meter -> measured in meters).
  const onUnit = (unit: string) => {
    setF((p) => {
      const next = { ...p, unit };
      if (['piece', 'pieces'].includes(unit)) { next.unitVolume = '1'; next.volumeUnit = 'pieces'; }
      else if (['meter', 'cm', 'mm', 'inch'].includes(unit)) next.volumeUnit = unit;
      return next;
    });
  };
  const onPack = (on: boolean) => setF((p) => ({ ...p, hasPack: on, packSize: on && !p.packSize ? '12' : p.packSize, packName: on && !p.packName.trim() ? 'case' : p.packName }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload = payloadFromForm(f);
    if (typeof payload === 'string') { showToast(payload, 'error'); return; }
    save.mutate(payload, { onSuccess: onClose });
  };

  // Live summary: what is in stock and what it costs, in every unit that applies.
  const qty = parseFloat(f.quantity) || 0;
  const unitVol = parseFloat(f.unitVolume) || 1;
  const cost = parseFloat(f.costPerUnit) || 0;
  const packSize = f.hasPack ? parseFloat(f.packSize) || 0 : 0;
  const probe = { unit: f.unit, volumeUnit: f.volumeUnit, unitVolume: unitVol, packName: f.packName.trim() || 'pack', packSize: packSize > 1 ? packSize : 0 };
  const brk = packBreakdown(probe, qty);
  const stockText = `${fmtNum(qty)} ${f.unit}${brk ? ` (${brk})` : ''}${hasSize(probe) ? ` · ${fmtNum(qty * unitVol)} ${f.volumeUnit}` : ''}`;
  const costParts = [`₹${cost.toFixed(2)} / ${f.unit}`];
  if (probe.packSize) costParts.push(`₹${(cost * probe.packSize).toFixed(2)} / ${probe.packName}`);
  if (hasSize(probe)) costParts.push(`₹${(unitVol > 0 ? cost / unitVol : cost).toFixed(2)} / ${f.volumeUnit}`);
  const units = STOCK_UNITS.includes(f.unit) ? STOCK_UNITS : [...STOCK_UNITS, f.unit];
  const volUnits = VOLUME_UNITS.includes(f.volumeUnit) ? VOLUME_UNITS : [...VOLUME_UNITS, f.volumeUnit];

  return (
    <Dialog id="inventoryModal" open onClose={onClose} size="lg" title={item ? 'Edit raw material / stock' : 'Add raw material / stock'}>
      <form id="inventoryForm" onSubmit={submit} className="space-y-4">
        <Field id="invName" label="Material name *">
          <input id="invName" required value={f.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="e.g. Coffee Beans" />
        </Field>
        <Field id="invCategory" label="Item category *">
          <select id="invCategory" required value={f.category} onChange={(e) => set('category', e.target.value)} className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_HELP[c]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="invUnit" label="Count it in *" hint="The unit you issue">
            <select id="invUnit" required value={f.unit} onChange={(e) => onUnit(e.target.value)} className="input">{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </Field>
          <Field id="invQuantity" label={`In stock now * (${f.unit})`}>
            <input id="invQuantity" required type="number" inputMode="decimal" step="any" min="0" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} className="input" placeholder="e.g. 120" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg cursor-pointer select-none">
          <input type="checkbox" id="invHasPack" checked={f.hasPack} onChange={(e) => onPack(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          Comes in packs (e.g. a case of 12 bottles)
        </label>
        {f.hasPack && (
          <div id="invPackBox" className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-subtle">
            <Field id="invPackName" label="Pack name">
              <input id="invPackName" maxLength={50} value={f.packName} onChange={(e) => set('packName', e.target.value)} className="input" placeholder="case" />
            </Field>
            <Field id="invPackSize" label={`1 pack has (${f.unit})`}>
              <input id="invPackSize" type="number" inputMode="decimal" step="any" min="2" value={f.packSize} onChange={(e) => set('packSize', e.target.value)} className="input" placeholder="e.g. 12" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field id="invUnitVolume" label={`Size of 1 ${f.unit} (optional)`}>
            <input id="invUnitVolume" type="number" inputMode="decimal" step="any" min="0" value={f.unitVolume} onChange={(e) => set('unitVolume', e.target.value)} className="input" placeholder="e.g. 1 or 400" />
          </Field>
          <Field id="invVolumeUnit" label="Measured in">
            <select id="invVolumeUnit" value={f.volumeUnit} onChange={(e) => set('volumeUnit', e.target.value)} className="input">
              {volUnits.map((u) => <option key={u} value={u}>{u === 'na' ? 'na (no volume)' : u}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="invCostPerUnit" label={`Cost per ${f.unit} (₹) *`}>
            <input id="invCostPerUnit" required type="number" inputMode="decimal" step="any" min="0" value={f.costPerUnit} onChange={(e) => set('costPerUnit', e.target.value)} className="input" placeholder="e.g. 10" />
          </Field>
          <Field id="invMinQuantity" label={`Alert when below (${f.unit})`}>
            <input id="invMinQuantity" required type="number" inputMode="decimal" step="any" min="0" value={f.minQuantity} onChange={(e) => set('minQuantity', e.target.value)} className="input" placeholder="e.g. 24" />
          </Field>
        </div>

        <div id="invCalcPreviewBox" className="rounded-lg bg-brand/10 px-3 py-2.5 text-sm space-y-1">
          <p><span className="text-xs uppercase font-semibold text-muted mr-1.5">In stock</span><span id="invCalcStock" className="font-semibold text-fg">{stockText}</span></p>
          <p><span className="text-xs uppercase font-semibold text-muted mr-1.5">Cost</span><span id="invCalcCost" className="font-semibold text-ok">{costParts.join(' · ')}</span></p>
        </div>

        <Field id="invSupplier" label="Supplier">
          <input id="invSupplier" value={f.supplier} onChange={(e) => set('supplier', e.target.value)} className="input" placeholder="Supplier name / contact" />
        </Field>

        <div className="rounded-lg border border-line p-3 space-y-3">
          <label htmlFor="invAutoDeduct" className="flex items-start gap-2.5 text-sm text-fg cursor-pointer select-none">
            <input type="checkbox" id="invAutoDeduct" checked={f.autoDeduct} onChange={(e) => set('autoDeduct', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span><span className="font-medium">Reduce this stock automatically when dishes sell</span>
              <span className="block text-xs text-muted">Keep it on for fixed amounts (1 bun per burger). Turn it off for things you take out by hand, like milk or oil: use Issue stock for those. A recipe can still be linked for cost.</span></span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field id="invShelfLifeDays" label="Shelf life (days)" hint="Optional. Used when a purchase has no expiry date">
              <input id="invShelfLifeDays" type="number" inputMode="numeric" step="1" min="0" max="3650" value={f.shelfLifeDays} onChange={(e) => set('shelfLifeDays', e.target.value)} className="input" placeholder="e.g. 5" />
            </Field>
            <Field id="invExpiryWarnDays" label="Warn before expiry (days)">
              <input id="invExpiryWarnDays" type="number" inputMode="numeric" step="1" min="0" max="365" value={f.expiryWarnDays} onChange={(e) => set('expiryWarnDays', e.target.value)} className="input" placeholder="2" />
            </Field>
          </div>
        </div>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button>
      </form>
    </Dialog>
  );
}
