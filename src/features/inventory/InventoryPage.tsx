import { useEffect, useState } from 'react';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { PageHeader, SegmentedTabs } from '../../components/ui';
import { deleteInventoryItem, type ExpiryBatch, type InventoryItem } from './api';
import { useExpiry, useInventory, useInventoryAction } from './hooks';
import { CostView } from './CostView';
import { CountView } from './CountView';
import { HistoryView } from './HistoryView';
import { ItemDialog } from './ItemDialog';
import type { CategoryFilter } from './rules';
import { AlertManagerDialog, IssueStockDialog } from './StockDialogs';
import { ReorderView } from './ReorderView';
import { StockView } from './StockView';

type Modal = { kind: 'item'; item: InventoryItem | null } | { kind: 'issue'; item: InventoryItem; initial?: { qty: number; reasonType: string } } | { kind: 'alert'; item: InventoryItem } | null;

export function InventoryPage() {
  const me = useSession((s) => s.user)!;
  const canManage = me.role === 'ADMIN' || me.role === 'MANAGER';
  const inv = useInventory();
  const expiry = useExpiry();
  const [view, setView] = useState<'stock' | 'reorder' | 'count' | 'costs' | 'history'>('stock');
  const [category, setCategory] = useState<CategoryFilter>('Stock');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const remove = useInventoryAction(deleteInventoryItem, 'Item deleted', 'Failed to delete item');
  const close = () => setModal(null);
  const items = inv.data ?? [];

  const loadError = inv.isError ? inv.error.message : '';
  useEffect(() => { if (loadError) showToast(`Failed to load inventory: ${loadError}`, 'error'); }, [loadError]);

  /** Write off an expired delivery: the Issue dialog opens with its quantity and the reason Expired already chosen. */
  const writeOff = (b: ExpiryBatch) => { const item = items.find((i) => i.id === b.itemId); if (item) setModal({ kind: 'issue', item, initial: { qty: b.quantity, reasonType: 'EXPIRED' } }); };
  const onDelete = (i: InventoryItem) => { if (window.confirm('Remove this inventory item?')) remove.mutate(i.id); };

  return (
    <section id="tab-inventory" data-testid="tab-inventory" className="space-y-5">
      <PageHeader title="Inventory" description="Track stock levels, record usage and audit stock movements."
        actions={<>
          {canManage && <button type="button" id="btnAddRawMaterial" onClick={() => setModal({ kind: 'item', item: null })} className="btn btn-primary"><i className="fa-solid fa-plus" />Add raw material</button>}
        </>} />

      {canManage && (
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <SegmentedTabs label="Inventory view" value={view} onChange={setView} options={[
            { value: 'stock', label: 'Stock', id: 'inv-subtab-stock' }, { value: 'reorder', label: 'Reorder list', id: 'inv-subtab-reorder' },
            { value: 'count', label: 'Stock count', id: 'inv-subtab-count' }, { value: 'costs', label: 'Cost alerts', id: 'inv-subtab-costs' }, { value: 'history', label: 'History', id: 'inv-subtab-history' },
          ]} />
        </div>
      )}

      {view === 'history' && canManage ? <HistoryView items={items} /> : view === 'reorder' && canManage ? <ReorderView /> : view === 'count' && canManage ? <CountView canApply /> : view === 'costs' && canManage ? <CostView /> : (
        <StockView items={items} loading={inv.isPending} canManage={canManage} category={category} onCategory={setCategory} query={query} onQuery={setQuery}
          onIssue={(i) => setModal({ kind: 'issue', item: i })} onAlert={(i) => setModal({ kind: 'alert', item: i })}
          onEdit={(i) => setModal({ kind: 'item', item: i })} onDelete={onDelete}
          batches={expiry.data ?? []} onWriteOff={writeOff} />
      )}

      {modal?.kind === 'item' && <ItemDialog key={modal.item?.id ?? 'new'} item={modal.item} defaultCategory={category !== 'ALL' ? category : 'Stock'} onClose={close} />}
      {modal?.kind === 'issue' && <IssueStockDialog key={modal.item.id} item={modal.item} initial={modal.initial} onClose={close} />}
      {modal?.kind === 'alert' && <AlertManagerDialog key={modal.item.id} item={modal.item} onClose={close} />}
    </section>
  );
}
