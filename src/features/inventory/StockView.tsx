import { useState } from 'react';
import { Badge, EmptyState, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import type { ExpiryBatch, InventoryItem } from './api';
import { CATEGORY_LABEL, NEGATIVE_HINT, categoryCounts, categoryTone, categoryOf, daysText, expiryTone, fmtNum, hasSize, isNegative, packBreakdown, packNameOf, packSizeOf, visibleItems, type CategoryFilter } from './rules';

interface Props {
  items: InventoryItem[];
  loading: boolean;
  canManage: boolean;
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  onIssue: (i: InventoryItem) => void;
  onAlert: (i: InventoryItem) => void;
  onEdit: (i: InventoryItem) => void;
  onDelete: (i: InventoryItem) => void;
  /** expired and soon-to-expire deliveries (earliest first) */
  batches: ExpiryBatch[];
  onWriteOff: (b: ExpiryBatch) => void;
}

export function StockView({ items, loading, canManage, category, onCategory, query, onQuery, onIssue, onAlert, onEdit, onDelete, batches, onWriteOff }: Props) {
  const [lowOnly, setLowOnly] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [negativeOnly, setNegativeOnly] = useState(false);
  const negative = items.filter(isNegative);
  const negativeFilter = negativeOnly && negative.length > 0;
  const expiringItemCount = new Set(batches.map((b) => b.itemId)).size;
  const expiringFilter = expiringOnly && expiringItemCount > 0;
  const low = items.filter((i) => i.lowStock);
  const lowFilter = lowOnly && low.length > 0;
  const counts = categoryCounts(items);
  const inCategory = visibleItems(items, category, '', false);
  const rows = visibleItems(items, category, query, lowFilter, expiringFilter, negativeFilter);
  const filtered = Boolean(query.trim()) || lowFilter || expiringFilter || negativeFilter;
  const elsewhere = query.trim() && category !== 'ALL' ? visibleItems(items, 'ALL', query, lowFilter, expiringFilter, negativeFilter).length : 0;

  // From a low-stock chip: show that item in All items.
  const focus = (i: InventoryItem) => { setLowOnly(false); setExpiringOnly(false); setNegativeOnly(false); onQuery(i.name); onCategory('ALL'); document.getElementById('inventoryTableBody')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="space-y-4" id="inventory-view-stock">
      {negative.length > 0 && (
        <div id="negativeStockBanner" className="rounded-xl border border-danger/40 bg-danger/10 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="flex items-start gap-2 font-medium text-danger min-w-0"><i className="fa-solid fa-circle-minus mt-0.5" /><span id="negativeStockMessage">{negative.length} item{negative.length === 1 ? ' is' : 's are'} below zero: used before the purchase was entered. Add the purchase and the number corrects itself.</span></span>
            <button type="button" id="btnNegativeOnly" aria-pressed={negativeFilter} onClick={() => setNegativeOnly(!negativeOnly)} className={`btn btn-sm shrink-0 ${negativeFilter ? 'btn-danger' : 'btn-secondary'}`}><i className="fa-solid fa-filter" />{negativeFilter ? 'Showing them only' : 'Show them'}</button>
          </div>
        </div>
      )}

      {low.length > 0 && (
        <div id="lowStockBanner" className="rounded-xl border border-danger/30 bg-danger/5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="flex items-center gap-2 font-medium text-danger"><i className="fa-solid fa-triangle-exclamation" /><span id="lowStockMessage">{low.length} item{low.length === 1 ? ' is' : 's are'} low on stock</span></span>
            <span className="flex items-center gap-2">
              <button type="button" id="btnLowStockOnly" aria-pressed={lowFilter} onClick={() => setLowOnly(!lowOnly)} className={`btn btn-sm ${lowFilter ? 'btn-danger' : 'btn-secondary'}`}>
                <i className="fa-solid fa-filter" /><span id="btnLowStockOnlyLabel">{lowFilter ? 'Showing low stock only' : 'Show only low stock'}</span>
              </button>
              <button type="button" id="btnLowStockList" aria-expanded={listOpen} aria-controls="lowStockList" onClick={() => setListOpen(!listOpen)} className="btn btn-secondary btn-sm">
                <span id="btnLowStockListLabel">{listOpen ? 'Hide list' : 'View list'}</span><i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${listOpen ? 'rotate-180' : ''}`} />
              </button>
            </span>
          </div>
          {listOpen && (
            <div id="lowStockList" className="border-t border-danger/20 p-3 max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
              {low.map((i) => (
                <button key={i.id} type="button" onClick={() => focus(i)} title={`Find ${i.name} in the table`} className="px-2 py-0.5 rounded-full bg-danger/10 text-danger hover:bg-danger/20 text-xs max-w-full truncate">
                  {i.name} <span className="opacity-75">{fmtNum(i.quantity)}/{fmtNum(i.minQuantity)} {i.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {batches.length > 0 && (
        <div id="expiryBanner" className="rounded-xl border border-warn/40 bg-warn/10 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="flex items-center gap-2 font-medium text-warn"><i className="fa-solid fa-hourglass-half" /><span id="expiryMessage">{expiringItemCount} item{expiringItemCount === 1 ? ' is' : 's are'} expired or expiring soon</span></span>
            <span className="flex items-center gap-2">
              <button type="button" id="btnExpiringOnly" aria-pressed={expiringFilter} onClick={() => setExpiringOnly(!expiringOnly)} className={`btn btn-sm ${expiringFilter ? 'btn-primary' : 'btn-secondary'}`}>
                <i className="fa-solid fa-filter" />{expiringFilter ? 'Showing expiring only' : 'Show only expiring'}
              </button>
              <button type="button" id="btnExpiryList" aria-expanded={expiryOpen} aria-controls="expiryList" onClick={() => setExpiryOpen(!expiryOpen)} className="btn btn-secondary btn-sm">
                {expiryOpen ? 'Hide list' : 'View list'}<i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${expiryOpen ? 'rotate-180' : ''}`} />
              </button>
            </span>
          </div>
          {expiryOpen && (
            <ul id="expiryList" className="border-t border-warn/30 p-3 space-y-1.5 max-h-72 overflow-y-auto">
              {batches.map((b, n) => (
                <li key={`${b.itemId}-${b.invoiceId ?? 'x'}-${n}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface/60 px-3 py-2">
                  <span className="min-w-0 text-fg"><span className="font-medium">{b.itemName}</span> <span className="text-muted">· {fmtNum(b.quantity)} {b.unit}</span>
                    <span className={`block text-xs ${b.status === 'EXPIRED' ? 'text-danger' : 'text-warn'}`}>{b.status === 'EXPIRED' ? 'Expired' : 'Expires'} {daysText(b.daysLeft)} ({b.expiryDate}){b.invoiceNumber ? ` · invoice ${b.invoiceNumber}` : ''}</span></span>
                  {canManage && b.status === 'EXPIRED' && <button type="button" data-write-off={b.itemId} onClick={() => onWriteOff(b)} className="btn btn-soft-danger btn-sm"><i className="fa-solid fa-trash-can" />Write off</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full">
          <SegmentedTabs wrap label="Item category" value={category} onChange={onCategory} options={(['Stock', 'Consumable', 'Small equipment', 'Fixed asset', 'ALL'] as CategoryFilter[]).map((c) => ({
            value: c, label: CATEGORY_LABEL[c], count: counts[c], id: `inv-cat-tab-${c.replace(/ /g, '')}`,
          }))} />
        </div>
        <SearchInput id="inventorySearchInput" value={query} onChange={onQuery} placeholder="Search items, category, supplier or unit" />
      </div>
      <p id="inventoryResultCount" className="text-xs text-muted empty:hidden">
        {filtered ? `Showing ${rows.length} of ${inCategory.length} item${inCategory.length === 1 ? '' : 's'}${category === 'ALL' ? '' : ` in ${category}`}` : ''}
      </p>

      <div className="card overflow-hidden">
        {loading ? <Skeleton rows={6} /> : rows.length === 0 ? (
          <EmptyState icon="fa-boxes-stacked"
            title={query.trim() ? `No items match "${query.trim()}"` : lowFilter ? 'No low stock items here' : `No ${category === 'ALL' ? '' : `${category} `}items yet`}
            action={elsewhere > 0 ? <button type="button" onClick={() => onCategory('ALL')} className="btn btn-secondary btn-sm">{elsewhere} match{elsewhere === 1 ? '' : 'es'} in other categories</button> : undefined} />
        ) : (
          <table className="rtable">
            <thead><tr><th>Item name</th><th>Category</th><th>In stock</th><th className="text-right">Cost</th><th className="text-center">Min. level</th><th>Supplier</th><th className="text-center">Stock action</th><th className="text-center">Low stock alert</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="inventoryTableBody">
              {rows.map((i) => {
                const unitVol = i.unitVolume ?? i.volume ?? 1;
                const volUnit = i.volumeUnit || i.unit || 'kg';
                const totalVol = i.totalVolume ?? (i.quantity || 0) * unitVol;
                const cost = i.costPerUnit || 0;
                const costPerVol = i.costPerVolume ?? (unitVol > 0 ? cost / unitVol : cost);
                const brk = packBreakdown(i, i.quantity);
                const sized = hasSize(i);
                return (
                  <tr key={i.id}>
                    <td data-label="" className="cell-title font-medium text-fg"><span className="flex flex-wrap items-center gap-1.5">{i.name}{isNegative(i) ? <Badge tone="danger" title={NEGATIVE_HINT}>ADD PURCHASE</Badge> : i.lowStock && <Badge tone="danger">LOW</Badge>}
                      {i.expiryStatus === 'EXPIRED' && <Badge tone="danger" title={`${fmtNum(i.expiringQuantity)} ${i.unit} expired`}>EXPIRED</Badge>}
                      {i.expiryStatus === 'SOON' && <Badge tone="warn" title={`${fmtNum(i.expiringQuantity)} ${i.unit} expire${i.nextExpiryDate ? ` on ${i.nextExpiryDate}` : ' soon'}`}>EXPIRES SOON</Badge>}
                      {i.autoDeduct === false && <Badge tone="neutral" title="Issued by hand: selling dishes does not reduce this stock">MANUAL</Badge>}</span></td>
                    <td data-label="Category"><Badge tone={categoryTone(i.itemCategory)}>{categoryOf(i)}</Badge></td>
                    <td data-label="In stock">
                      <div className={`font-semibold ${i.lowStock ? 'text-danger' : 'text-ok'}`}>{fmtNum(i.quantity)} {i.unit}</div>
                      {brk && <div className="text-xs text-muted">= {brk}</div>}
                      {sized && <div className="text-xs text-brand-text">{fmtNum(totalVol)} {volUnit} total · {fmtNum(unitVol)} {volUnit} each</div>}
                      {i.nextExpiryDate && i.expiryStatus && <div className={`text-xs ${i.expiryStatus === 'OK' ? 'text-muted' : expiryTone(i.expiryStatus) === 'danger' ? 'text-danger' : 'text-warn'}`}>Expiry {i.nextExpiryDate}</div>}
                    </td>
                    <td data-label="Cost" className="md:text-right">
                      <div className="font-medium text-fg">₹{cost.toFixed(2)} / {i.unit || 'unit'}</div>
                      {packSizeOf(i) > 0 && <div className="text-xs text-muted">₹{(cost * packSizeOf(i)).toFixed(2)} / {packNameOf(i)}</div>}
                      {sized && <div className="text-xs text-ok">₹{costPerVol.toFixed(2)} / {volUnit}</div>}
                    </td>
                    <td data-label="Min. level" className="md:text-center text-muted">{fmtNum(i.minQuantity)} {i.unit}</td>
                    <td data-label="Supplier" className="text-muted">{i.supplier || '-'}</td>
                    <td data-label="" className="md:text-center"><button type="button" onClick={() => onIssue(i)} className="btn btn-soft-danger btn-sm"><i className="fa-solid fa-arrow-down text-[10px]" />Issue stock</button></td>
                    <td data-label="" className="md:text-center">
                      <button type="button" onClick={() => onAlert(i)} title="Notify Manager about low stock for this item" className={`btn btn-sm ${i.lowStock ? 'btn-soft-danger' : 'btn-secondary'}`}>
                        <i className="fa-solid fa-triangle-exclamation text-[11px]" />Alert Mgr
                      </button>
                    </td>
                    <td className="cell-actions">
                      <div className="flex items-center justify-end gap-1 w-full md:w-auto">
                        {canManage ? (
                          <>
                            <button type="button" onClick={() => onEdit(i)} title="Edit item details" aria-label={`Edit ${i.name}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-regular fa-pen-to-square" /></button>
                            <button type="button" onClick={() => onDelete(i)} title="Delete" aria-label={`Delete ${i.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>
                          </>
                        ) : <span className="text-faint text-sm hidden md:inline">-</span>}
                      </div>
                    </td>
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
