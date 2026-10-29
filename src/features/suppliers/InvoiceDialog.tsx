import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Field } from '../../components/ui';
import { useInventory } from '../inventory/hooks';
import { CATEGORIES, STOCK_UNITS, VOLUME_UNITS, fmtNum, isCountableUnit, packNameOf, packSizeOf } from '../inventory/rules';
import { saveInvoice, type Invoice, type InvoiceBody, type Supplier } from './api';
import { useSupplierAction } from './hooks';
import {
  GST_RATES, buildInvoiceBody, computeTotals, lineGst, lineNet, lineSubtotal, modeForInvoice, rowFromInventory, rowFromInvoiceItem,
  rowFromNewProduct, rowResult, totalMismatch, withMode, type GstMode, type NewProduct, type Row,
} from './invoiceMath';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const money = (n: number) => n.toFixed(2);
const num = (v: string) => parseFloat(v) || 0;
const cell = 'input h-8 px-2 text-sm';

interface Props { invoice: Invoice | null; suppliers: Supplier[]; presetSupplierId?: number | null; onClose: () => void }

/** Add / edit a supplier invoice: products, packs, per-row GST, charges, discount, and a total that must add up. */
export function InvoiceDialog({ invoice, suppliers, presetSupplierId, onClose }: Props) {
  const inventory = useInventory().data ?? [];
  const [supplierId, setSupplierId] = useState(String(invoice?.supplierId ?? presetSupplierId ?? ''));
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? '');
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate ?? today());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? '');
  const [description, setDescription] = useState(invoice?.description ?? '');
  const [rows, setRows] = useState<Row[]>(() => (invoice?.items ?? []).map((it) => rowFromInvoiceItem(it, invoice!)));
  const [mode, setMode] = useState<GstMode>(() => modeForInvoice(invoice));
  const [customGst, setCustomGst] = useState(invoice?.gstAmount != null ? money(invoice.gstAmount) : '0.00');
  const [other, setOther] = useState(invoice?.otherCharges != null ? money(invoice.otherCharges) : '0.00');
  const [discount, setDiscount] = useState(invoice?.discount != null ? money(invoice.discount) : '0.00');
  const [manualTotal, setManualTotal] = useState<string | null>(invoice && invoice.totalAmount > 0 ? money(invoice.totalAmount) : null);
  const [bulkGst, setBulkGst] = useState('5');
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newProd, setNewProd] = useState<NewProduct>({ name: '', category: 'Stock', unit: 'packet', volume: '1', volumeUnit: 'na' });
  const [error, setError] = useState('');
  const save = useSupplierAction((body: InvoiceBody) => saveInvoice(invoice?.id ?? null, body),
    invoice ? 'Invoice updated successfully' : 'Invoice saved & inventory stock automatically updated');

  const totals = computeTotals(rows, mode, num(customGst), num(other), num(discount));
  const totalText = manualTotal ?? (totals.calculated > 0 ? money(totals.calculated) : '0.00');
  const mismatch = totalMismatch(num(totalText), totals.calculated);
  const defaultGst = parseFloat(bulkGst) || 0;

  const patch = (key: string, p: Partial<Row>, anyGst = false) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    if (anyGst && mode !== 'CUSTOM') setMode('AUTO');
  };
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const focus = (key: string, field: string) => { setTimeout(() => { const el = document.getElementById(`${field}_${rows.findIndex((r) => r.key === key)}`) as HTMLInputElement | null; el?.focus(); el?.select(); }, 50); };

  // Add a product from the search box (or jump to its row when it is already there).
  const addProduct = (id: number) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    const existing = rows.find((r) => r.inventoryItemId === id || r.productName.toLowerCase() === item.name.toLowerCase());
    if (existing) { showToast(`"${item.name}" is already in the invoice. Focused for editing.`, 'info'); focus(existing.key, 'invItemQty'); }
    else { const r = rowFromInventory(item, defaultGst); setRows((rs) => [...rs, r]); setTimeout(() => { const el = document.getElementById(`invItemQty_${rows.length}`) as HTMLInputElement | null; el?.focus(); el?.select(); }, 50); }
    setSearch('');
  };
  const addNew = () => {
    if (!newProd.name.trim()) { showToast('Please enter the new product name', 'error'); return; }
    if (rows.some((r) => r.productName.toLowerCase() === newProd.name.trim().toLowerCase())) { showToast(`"${newProd.name.trim()}" is already in the invoice table.`, 'error'); setNewOpen(false); return; }
    setRows((rs) => [...rs, rowFromNewProduct(newProd, defaultGst)]);
    setNewOpen(false);
    setNewProd({ name: '', category: 'Stock', unit: 'packet', volume: '1', volumeUnit: 'na' });
    setTimeout(() => { const el = document.getElementById(`invItemRate_${rows.length}`) as HTMLInputElement | null; el?.focus(); el?.select(); }, 50);
  };
  const onNewUnit = (unit: string) => setNewProd((p) => ({ ...p, unit, ...(['piece', 'pieces'].includes(unit) ? { volume: '1', volumeUnit: 'pieces' } : ['meter', 'cm', 'mm', 'inch'].includes(unit) ? { volumeUnit: unit } : {}) }));

  const onFlatRate = (value: string) => {
    setMode(value);
    if (GST_RATES.map(String).includes(value)) setRows((rs) => rs.map((r) => ({ ...r, gstRate: parseFloat(value) })));
  };
  const applyBulk = () => {
    if (!rows.length) { showToast('Add products first before applying bulk GST', 'info'); return; }
    setRows((rs) => rs.map((r) => ({ ...r, gstRate: defaultGst })));
    if (GST_RATES.map(String).includes(bulkGst)) setMode(bulkGst);
    showToast(`Applied ${defaultGst}% GST to all ${rows.length} products`, 'info');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const body = buildInvoiceBody({ supplierId, invoiceNumber, invoiceDate, dueDate, description, rows, mode, customGst: num(customGst), otherCharges: num(other), discount: num(discount), total: parseFloat(totalText) });
    if (typeof body === 'string') { setError(body); return; }
    save.mutate(body, { onSuccess: onClose, onError: (err) => setError(err.message) });
  };

  const q = search.trim().toLowerCase();
  const matches = q ? inventory.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const inTable = new Set(rows.map((r) => r.productName.toLowerCase()));
  const supplierOptions = suppliers.filter((s) => s.active !== false || s.id === invoice?.supplierId);

  return (
    <Dialog id="invoiceModal" open onClose={onClose} size="xl" title={invoice ? 'Edit supplier invoice' : 'Add supplier invoice'}>
      <form id="invoiceForm" onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field id="invoiceSupplierId" label="Supplier *">
            <select id="invoiceSupplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input"><option value="">Select supplier</option>{supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
          <Field id="invoiceNumber" label="Invoice number *"><input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" placeholder="e.g. INV-001" /></Field>
          <Field id="invoiceDate" label="Invoice date *"><input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input" /></Field>
          <Field id="invoiceDueDate" label="Due date"><input id="invoiceDueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" /></Field>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <label htmlFor="invoiceProductSearch" className="label">Add products</label>
              <input id="invoiceProductSearch" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" className="input" placeholder="Search a product by name (e.g. Tomato, Coffee, Milk)"
                onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); else if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) addProduct(matches[0].id); } }} />
              {q && (
                <div id="invoiceProductSearchResults" className="absolute z-10 left-0 right-0 mt-1 card shadow-pop max-h-64 overflow-y-auto">
                  {matches.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted">No matching products found.
                      <button type="button" onClick={() => { setNewOpen(true); setNewProd((p) => ({ ...p, name: search.trim() })); setSearch(''); }} className="block mx-auto mt-1 text-brand-text font-medium underline">+ Create “{search.trim()}” as a new product</button></div>
                  ) : matches.map((m) => {
                    const added = inTable.has(m.name.toLowerCase());
                    const unitVol = m.unitVolume ?? m.volume ?? 1;
                    const volUnit = m.volumeUnit || m.unit || 'kg';
                    return (
                      <button type="button" key={m.id} data-product-id={m.id} onClick={() => addProduct(m.id)} className={`w-full text-left px-3 py-2 hover:bg-subtle flex items-center justify-between gap-3 ${added ? 'opacity-70' : ''}`}>
                        <span className="text-sm"><span className="font-medium text-fg">{m.name}</span> <span className="text-xs text-muted">{m.unit || 'pcs'}</span>
                          <span className="text-xs text-brand-text ml-2">{isCountableUnit(m.unit, volUnit) ? 'Countable' : `Vol: ${unitVol} ${volUnit}`}</span>
                          {packSizeOf(m) > 0 && <span className="text-xs text-info ml-2">{packNameOf(m)} = {fmtNum(m.packSize)} {m.unit}</span>}
                          <span className="text-xs text-muted ml-2">Stock: {fmtNum(m.quantity)}</span></span>
                        <span className="text-right shrink-0"><span className="text-sm font-medium text-ok">₹{(m.costPerUnit || 0).toFixed(2)}</span><span className="block text-[11px] text-muted">{added ? '(Already in table)' : 'Click to add'}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setNewOpen(!newOpen)} className="btn btn-secondary h-10"><i className="fa-solid fa-plus" />New product</button>
            <div className="flex items-end gap-2">
              <Field id="invoiceBulkGstSelect" label="GST for new rows"><select id="invoiceBulkGstSelect" value={bulkGst} onChange={(e) => setBulkGst(e.target.value)} className="input w-24">{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></Field>
              <button type="button" id="btnApplyBulkGst" onClick={applyBulk} className="btn btn-secondary h-10">Apply to all</button>
            </div>
          </div>

          {newOpen && (
            <div id="invoiceNewProductInlineBox" className="rounded-lg border border-brand/40 bg-brand/5 p-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <Field id="invoiceNewItemName" label="Product name *"><input id="invoiceNewItemName" autoFocus value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} className="input" placeholder="e.g. Basmati Rice / Milk" /></Field>
              <Field id="invoiceNewItemCategory" label="Category *"><select id="invoiceNewItemCategory" value={newProd.category} onChange={(e) => setNewProd({ ...newProd, category: e.target.value })} className="input">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field id="invoiceNewItemUnit" label="Count it in *"><select id="invoiceNewItemUnit" value={newProd.unit} onChange={(e) => onNewUnit(e.target.value)} className="input">{STOCK_UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
                <Field id="invoiceNewItemVolume" label="Size of 1"><input id="invoiceNewItemVolume" type="number" step="any" min="0" value={newProd.volume} onChange={(e) => setNewProd({ ...newProd, volume: e.target.value })} className="input" /></Field>
                <Field id="invoiceNewItemVolUnit" label="Measured in"><select id="invoiceNewItemVolUnit" value={newProd.volumeUnit} onChange={(e) => setNewProd({ ...newProd, volumeUnit: e.target.value })} className="input">{VOLUME_UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              </div>
              <div className="flex gap-2"><button type="button" id="btnAddNewProduct" onClick={addNew} className="btn btn-primary h-10 flex-1">Add to invoice</button><button type="button" onClick={() => setNewOpen(false)} className="btn btn-secondary h-10">Cancel</button></div>
            </div>
          )}
        </div>

        <div className="card overflow-x-auto">
          <table id="invoiceItemsTable" className="rtable md:min-w-[900px]">
            <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Bought as</th><th>Size of 1</th><th>Rate (₹)</th><th>You get</th><th>Expires</th><th>GST</th><th className="text-right">Line total</th><th /></tr></thead>
            <tbody id="invoiceItemsTableBody">
              {rows.length === 0 && <tr><td colSpan={11} className="text-center py-5 text-sm text-muted">No products added. Use the search box above to add products.</td></tr>}
              {rows.map((r, idx) => {
                const res = rowResult(r);
                const byPack = r.purchaseMode === 'PACK';
                return (
                  <tr key={r.key}>
                    <td data-label="" className="cell-title"><span className="font-medium text-fg block">{r.productName}</span><span className="text-xs text-muted">counted in {r.unit}</span>{r.inventoryItemId == null && <span className="ml-1 badge badge-brand">+ New item</span>}</td>
                    <td data-label="Category"><select id={`invItemCat_${idx}`} value={r.itemCategory} onChange={(e) => patch(r.key, { itemCategory: e.target.value })} className={`${cell} w-28`}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                    <td data-label="Qty"><input id={`invItemQty_${idx}`} type="number" min="0.01" step="any" value={r.quantity} onChange={(e) => patch(r.key, { quantity: parseFloat(e.target.value) || 0 })} className={`${cell} w-20 text-center font-semibold`} /></td>
                    <td data-label="Bought as">
                      <select id={`invItemMode_${idx}`} value={r.purchaseMode} onChange={(e) => { setRows((rs) => rs.map((x) => (x.key === r.key ? withMode(x, e.target.value as 'UNIT' | 'PACK', inventory) : x))); }} className={`${cell} w-28`}>
                        <option value="UNIT">{r.unit}</option><option value="PACK">{r.packName || 'Pack…'}</option>
                      </select>
                      {byPack && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                          {!r.packName && <input id={`invItemPackName_${idx}`} maxLength={50} placeholder="case" onChange={(e) => patch(r.key, { packName: e.target.value.trim() })} className={`${cell} w-16`} />}
                          <span>×</span><input id={`invItemPackSize_${idx}`} type="number" min="2" step="any" placeholder="12" value={r.packSize ?? ''} onChange={(e) => { const v = parseFloat(e.target.value); patch(r.key, { packSize: v > 1 ? v : null }); }} className={`${cell} w-16 text-center`} /><span>{r.unit}</span>
                        </div>
                      )}
                    </td>
                    <td data-label="Size of 1">
                      <span className="flex items-center gap-1">
                        <input id={`invItemVol_${idx}`} type="number" min="0.01" step="any" value={r.unitVolume} onChange={(e) => patch(r.key, { unitVolume: parseFloat(e.target.value) || 1 })} className={`${cell} w-16 text-center`} />
                        <select id={`invItemVolUnit_${idx}`} value={r.volumeUnit} onChange={(e) => patch(r.key, { volumeUnit: e.target.value, ...(['na', 'piece', 'pieces'].includes(e.target.value.toLowerCase()) && !(r.unitVolume > 0) ? { unitVolume: 1 } : {}) })} className={`${cell} w-20`}>
                          {(VOLUME_UNITS.includes(r.volumeUnit.toLowerCase()) ? VOLUME_UNITS : [...VOLUME_UNITS, r.volumeUnit]).map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </span>
                    </td>
                    <td data-label="Rate (₹)"><input id={`invItemRate_${idx}`} type="number" min="0" step="any" value={r.unitPrice} onChange={(e) => patch(r.key, { unitPrice: parseFloat(e.target.value) || 0 })} className={`${cell} w-24 text-right font-semibold`} /><span className="block text-[11px] text-muted mt-0.5">per {byPack ? r.packName || 'pack' : r.unit}</span></td>
                    <td data-label="You get"><span className="inline-block px-2 py-1 rounded bg-brand/10 text-xs min-w-[130px]"><span className="block font-semibold text-brand-text">{res.stock}</span><span className="block text-ok">{res.cost}</span></span></td>
                    <td data-label="Expires"><input id={`invItemExpiry_${idx}`} type="date" value={r.expiryDate} onChange={(e) => patch(r.key, { expiryDate: e.target.value })} aria-label={`Expiry date of ${r.productName}`} className={`${cell} w-36`} /><span className="block text-[11px] text-muted mt-0.5">optional</span></td>
                    <td data-label="GST"><select id={`invItemGst_${idx}`} value={r.gstRate} onChange={(e) => patch(r.key, { gstRate: parseFloat(e.target.value) || 0 }, true)} className={`${cell} w-20`}>
                      {(GST_RATES.includes(r.gstRate) ? GST_RATES : [...GST_RATES, r.gstRate]).map((g) => <option key={g} value={g}>{g}%</option>)}</select><span className="block text-[11px] text-muted mt-0.5">+₹{money(lineGst(r))} tax</span></td>
                    <td data-label="Line total" className="md:text-right"><span className="font-semibold text-ok block">₹{money(lineSubtotal(r))}</span><span className="text-[11px] text-muted block">Net: ₹{money(lineNet(r))}</span></td>
                    <td className="cell-actions"><button type="button" onClick={() => remove(r.key)} title="Remove" aria-label={`Remove ${r.productName}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-solid fa-xmark" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Field id="invoiceDescription" label="Notes"><textarea id="invoiceDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="input h-auto py-2" placeholder="Optional notes about this invoice" /></Field>
          <div className="card p-4 space-y-3 text-sm">
            <p className="flex justify-between"><span className="text-muted">Subtotal</span><span id="invoiceSubtotalDisplay" className="font-semibold text-fg">₹{money(totals.subtotal)}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <Field id="invoiceGstRateSelect" label="Total GST">
                <select id="invoiceGstRateSelect" value={mode} onChange={(e) => onFlatRate(e.target.value)} className="input">
                  <option value="AUTO">Auto (sum of items)</option><option value="0">None (0%)</option>{[5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}% flat</option>)}<option value="CUSTOM">Custom ₹</option>
                </select>
              </Field>
              <Field id="invoiceGstAmountInput" label="GST amount (₹)"><input id="invoiceGstAmountInput" type="number" step="0.01" min="0" value={mode === 'CUSTOM' ? customGst : money(totals.itemGst)} onChange={(e) => { setMode('CUSTOM'); setCustomGst(e.target.value); }} className="input" placeholder="0.00" /></Field>
            </div>
            {totals.breakdown.length > 0 && totals.itemGst > 0 && (
              <div id="invoiceGstBreakdownBadge" className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-muted uppercase font-semibold">Slabs:</span>
                {totals.breakdown.filter((b) => b.base > 0).map((b) => <span key={b.rate} className="badge badge-neutral">GST {b.rate}%: ₹{money(b.gst)} (on ₹{money(b.base)})</span>)}</div>)}
            <div className="grid grid-cols-2 gap-3">
              <Field id="invoiceOtherChargesInput" label="Other charges (+)"><input id="invoiceOtherChargesInput" type="number" step="0.01" min="0" value={other} onChange={(e) => setOther(e.target.value)} className="input" placeholder="0.00" /></Field>
              <Field id="invoiceDiscountInput" label="Discount (−)"><input id="invoiceDiscountInput" type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" placeholder="0.00" /></Field>
            </div>
            <Field id="invoiceTotal" label="Invoice total (₹) *"><input id="invoiceTotal" type="number" step="0.01" min="0" value={totalText} onChange={(e) => setManualTotal(e.target.value)} className="input font-semibold" placeholder="0.00" /></Field>
            {mismatch !== null && (
              <p id="invoiceMismatchHint" className="text-xs text-warn bg-warn/10 rounded-lg px-3 py-2"><span id="invoiceMismatchBadge" className="font-semibold">Total does not match.</span> Calculated: ₹{money(totals.calculated)} (difference <span className="font-semibold">{mismatch > 0 ? '+' : '-'}₹{Math.abs(mismatch).toFixed(2)}</span>).{' '}
                <button type="button" onClick={() => setManualTotal(null)} className="underline font-medium">Use calculated total</button></p>)}
          </div>
        </div>

        {error && <p id="invoiceFormError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}{error.startsWith('Invoice total does not match') && <> <button type="button" onClick={() => { setManualTotal(null); setError(''); }} className="underline font-medium">Use calculated total</button></>}</p>}
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-11">{save.isPending ? 'Saving…' : invoice ? 'Save changes' : 'Save invoice & update stock'}</button>
      </form>
    </Dialog>
  );
}
