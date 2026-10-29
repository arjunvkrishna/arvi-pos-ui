import { useState } from 'react';
import { Badge, EmptyState, Field, Skeleton } from '../../components/ui';
import type { InventoryItem, StockTransaction } from './api';
import { useSuppliersList, useTransactions } from './hooks';
import { reasonLabel, toHistoryFilters, type HistoryPreset } from './rules';

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-');

function TypeBadge({ type }: { type: string }) {
  if (type === 'STOCK_IN') return <Badge tone="ok">STOCK IN</Badge>;
  if (type === 'STOCK_OUT') return <Badge tone="danger">STOCK OUT</Badge>;
  return <Badge tone="info">{type}</Badge>;
}

export function HistoryView({ items }: { items: InventoryItem[] }) {
  const [preset, setPreset] = useState<HistoryPreset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [itemId, setItemId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  // Filters apply on "Apply", like the classic screen; the list loads once with no filters first.
  const [applied, setApplied] = useState(() => toHistoryFilters('all', '', '', '', '', ''));
  const suppliers = useSuppliersList(true);
  const txns = useTransactions(applied, true);
  const list: StockTransaction[] = txns.data ?? [];

  return (
    <div className="space-y-4">
      <form className="card p-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(toHistoryFilters(preset, from, to, type, itemId, supplierId)); }}>
        <Field id="invHistPreset" label="Date preset">
          <select id="invHistPreset" value={preset} onChange={(e) => setPreset(e.target.value as HistoryPreset)} className="input">
            <option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option>
            <option value="this_week">This week</option><option value="this_month">This month</option><option value="custom">Custom range</option>
          </select>
        </Field>
        {preset === 'custom' && (
          <div id="invHistCustomDates" className="flex items-end gap-2">
            <Field id="invHistFromDate" label="From"><input id="invHistFromDate" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></Field>
            <Field id="invHistToDate" label="To"><input id="invHistToDate" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></Field>
          </div>
        )}
        <Field id="invHistTypeFilter" label="Transaction type">
          <select id="invHistTypeFilter" value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="">All types</option><option value="STOCK_IN">Stock in (purchases)</option><option value="STOCK_OUT">Stock out (issued / used)</option><option value="ADJUSTMENT">Adjustments / reversals</option>
          </select>
        </Field>
        <Field id="invHistProductFilter" label="Product">
          <select id="invHistProductFilter" value={itemId} onChange={(e) => setItemId(e.target.value)} className="input">
            <option value="">All products</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field id="invHistSupplierFilter" label="Supplier">
          <select id="invHistSupplierFilter" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
            <option value="">All suppliers</option>{(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <button type="submit" id="btnApplyHistory" className="btn btn-primary h-10"><i className="fa-solid fa-filter" />Apply filters</button>
      </form>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between text-sm">
          <span className="font-medium text-fg"><i className="fa-solid fa-timeline mr-1.5 text-faint" />Stock transaction history</span>
          <span id="invHistCount" className="text-muted">{txns.isSuccess ? `${list.length} records found` : ''}</span>
        </div>
        {txns.isPending ? <Skeleton rows={5} /> : txns.isError ? (
          <p className="p-6 text-center text-sm text-danger">{txns.error.message}</p>
        ) : list.length === 0 ? <EmptyState icon="fa-timeline" title="No stock movements found" hint="Try other filters." /> : (
          <table className="rtable">
            <thead><tr><th>Date / time</th><th>Product</th><th>Type</th><th>Quantity</th><th>Prev → new</th><th>User (role)</th><th>Supplier / ref</th><th>Price</th><th>Reason / notes</th></tr></thead>
            <tbody id="inventoryHistoryTableBody">
              {list.map((t, idx) => {
                const inbound = t.transactionType === 'STOCK_IN';
                return (
                  <tr key={t.id ?? idx}>
                    <td data-label="When" className="whitespace-nowrap text-muted">{when(t.createdAt)}</td>
                    <td data-label="" className="cell-title font-medium text-fg">{t.itemName || '-'}</td>
                    <td data-label="Type"><TypeBadge type={t.transactionType} /></td>
                    <td data-label="Quantity" className={`font-semibold ${inbound ? 'text-ok' : 'text-danger'}`}>{inbound ? '+' : '-'}{t.quantity} {t.unit || 'pcs'}</td>
                    <td data-label="Stock" className="text-muted"><span>{t.previousStock}</span> → <span className="font-semibold text-fg">{t.newStock}</span></td>
                    <td data-label="User"><span className="font-medium text-fg">{t.userName || 'SYSTEM'}</span>{t.userRole && <span className="ml-1 text-xs text-muted">({t.userRole})</span>}</td>
                    <td data-label="Supplier">
                      {t.supplierName && <div className="font-medium text-brand-text">{t.supplierName}</div>}
                      {t.invoiceReference ? <div className="text-xs text-muted">Ref: {t.invoiceReference}</div> : (!t.supplierName && '-')}
                    </td>
                    <td data-label="Price">{t.unitPrice ? `₹${t.unitPrice.toFixed(2)}` : '-'}</td>
                    <td data-label="Notes" className="text-muted text-xs max-w-xs" title={t.notes || ''}>{t.reasonType && t.reasonType !== 'USAGE' && <Badge tone={t.reasonType === 'EXPIRED' || t.reasonType === 'SPOILED' || t.reasonType === 'BREAKAGE' ? 'danger' : 'neutral'}>{reasonLabel(t.reasonType)}</Badge>} <span className="truncate align-middle">{t.notes || '-'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
