import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, Pager, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import { formatISTDateTime } from '../../lib/time';
import { usePrintUi } from '../printing/store';
import { billsKey, fetchBill, fetchBillStaff, fetchBillSummary, fetchBillsPage, fetchDeletableBillIds, type BillLogFilters, type Mode } from './api';
import { DeleteBillDialog, EditBillDialog, RefundDialog, VoidOrderDialog } from './BillDialogs';
import { SplitBillDialog } from './SplitBillDialog';
import { PromotionsSection } from './PromotionsSection';
import { billActions, statusTone, type Location } from './rules';
import type { Bill, BillLogRow } from './types';
import { orderKind } from '../printing/rules';

const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Modal = { kind: 'split'; bill: Bill } | { kind: 'edit'; id: number } | { kind: 'refund'; id: number } | { kind: 'void'; bill: BillLogRow } | { kind: 'delete'; bill: BillLogRow } | null;

/** The value after it has stopped changing for `ms`, so typing in a search box is not a request per key. */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function BillsPage() {
  const me = useSession((s) => s.user)!;
  const openReceipt = usePrintUi((s) => s.openReceipt);
  const [mode, setMode] = useState<Mode>('daily');
  const [dates, setDates] = useState({ daily: ymd(), monthly: ymd().slice(0, 7) });
  const [location, setLocation] = useState<Location>('ALL');
  const [staff, setStaff] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const value = dates[mode];
  const searchText = useDebounced(search);
  const staffNames = useQuery({ queryKey: [...billsKey, 'staff', mode, value], queryFn: () => fetchBillStaff(mode, value) });
  const filters: BillLogFilters = { mode, value, location, staff: staffNames.isSuccess && !staffNames.data.includes(staff) ? '' : staff, search: searchText };
  const staffList = staffNames.data ?? [];
  const bills = useQuery({ queryKey: [...billsKey, 'list', filters, page], queryFn: async () => { const r = await fetchBillsPage(filters, page); return r.items.length === 0 && page > 0 ? fetchBillsPage(filters, r.totalPages - 1) : r; }, placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: [...billsKey, 'summary', filters], queryFn: () => fetchBillSummary(filters), placeholderData: keepPreviousData });
  const deletable = useQuery({ queryKey: [...billsKey, 'deletable'], queryFn: fetchDeletableBillIds });
  const deletableIds = new Set(deletable.data ?? []);
  const rows = bills.data?.items ?? [];
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  const stats = { count: summary.data?.billCount ?? 0, revenue: Number(summary.data?.revenue ?? 0), avg: Number(summary.data?.average ?? 0) };
  const err = bills.isError ? bills.error.message : '';
  useEffect(() => { if (err) showToast(`Failed to load bills: ${err}`, 'error'); }, [err]);
  const canPromos = me.role === 'ADMIN' || me.role === 'MANAGER';

  const reprint = async (id: number) => { try { openReceipt(await fetchBill(id)); } catch (e) { showToast(`Failed to fetch bill receipt: ${e instanceof Error ? e.message : e}`, 'error'); } };
  const openSplit = async (id: number) => { try { setModal({ kind: 'split', bill: await fetchBill(id) }); } catch (e) { showToast(`Failed to load the bill: ${e instanceof Error ? e.message : e}`, 'error'); } };
  const loc = (b: BillLogRow) => { const k = orderKind(b); return k === 'OUTDOOR' ? <span><span className="flex items-center gap-1.5"><Badge tone="ok">OUTDOOR</Badge><span className="font-mono text-xs">{b.outdoorToken}</span></span>{b.customerName && <span className="block text-xs text-muted mt-0.5">{b.customerName}</span>}</span> : k === 'TAKEAWAY' ? <span><span className="flex items-center gap-1.5"><Badge tone="brand">TAKEAWAY</Badge><span className="font-mono text-xs">{b.takeawayToken}</span></span>{b.customerName && <span className="block text-xs text-muted mt-0.5">{b.customerName}</span>}</span> : <span><span className="font-medium text-fg">{b.tableNumber || '-'}</span>{b.customerName && <span className="block text-xs text-muted">{b.customerName}</span>}</span>; };

  return (
    <section id="tab-bills" data-testid="tab-bills" className="space-y-5">
      <PageHeader title="Bill log & history" description="Every bill with who took the order and who settled it."
        actions={<><SegmentedTabs label="Period" value={mode} onChange={resetPage(setMode)} options={[{ value: 'daily', label: 'Daily', id: 'btnBillDaily' }, { value: 'monthly', label: 'Monthly', id: 'btnBillMonthly' }]} />
          <input id="billsFilterDate" type={mode === 'daily' ? 'date' : 'month'} value={value} onChange={(e) => { setDates({ ...dates, [mode]: e.target.value }); setPage(0); }} className="input w-44" aria-label={mode === 'daily' ? 'Date' : 'Month'} /></>} />

      <div className="grid grid-cols-3 gap-3">{[['statBillCount', 'Total bills', String(stats.count)], ['statBillRevenue', 'Total net revenue', `₹${stats.revenue.toFixed(2)}`], ['statBillAvg', 'Average bill value', `₹${stats.avg.toFixed(2)}`]].map(([id, l, v]) => <div key={id} className="card p-4"><p className="text-xs text-muted">{l}</p><p id={id} className="text-xl font-semibold text-fg mt-1">{v}</p></div>)}</div>

      <div className="flex flex-wrap items-center gap-3">
        <div id="billsLocationFilterGroup" className="max-w-full overflow-x-auto no-scrollbar"><SegmentedTabs label="Place" value={location} onChange={resetPage(setLocation)} options={[{ value: 'ALL', label: 'All', id: 'btnBillLocAll' }, { value: 'TABLE', label: 'Tables', id: 'btnBillLocTable' }, { value: 'OUTDOOR', label: 'Outdoor', id: 'btnBillLocOutdoor' }, { value: 'TAKEAWAY', label: 'Takeaway', id: 'btnBillLocTakeaway' }]} /></div>
        <select id="billsStaffFilter" value={filters.staff} onChange={(e) => { setStaff(e.target.value); setPage(0); }} className="input w-48" aria-label="Staff"><option value="">All users / staff</option>{staffList.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <div className="flex-1 min-w-[220px] flex sm:justify-end"><SearchInput id="billsSearchInput" value={search} onChange={resetPage(setSearch)} placeholder="Search customer, token, bill #" /></div>
      </div>

      {canPromos && <PromotionsSection />}

      <div className="card overflow-hidden">
        {bills.isPending ? <Skeleton rows={6} /> : (
          <table className="rtable">
            <thead><tr><th>Bill no.</th><th>Date & time</th><th>Table</th><th>Staff attended</th><th>Cashier / settled by</th><th>Items</th><th>Payment</th><th>Net amount</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="billsTableBody">
              {rows.length === 0 && <tr><td colSpan={10}><EmptyState icon="fa-file-invoice-dollar" title="No bills found for the selected period" /></td></tr>}
              {rows.map((b) => {
                if (b.deletedAt) return (
                  <tr key={b.id} className="opacity-50" title="Deleted bill - inactive, not counted in totals or analytics">
                    <td data-label="" className="cell-title font-mono font-semibold line-through text-muted">{b.billNumber}</td>
                    <td data-label="When" className="text-xs whitespace-nowrap text-muted">{formatISTDateTime(b.createdAt)}</td><td data-label="Table" className="text-muted">{loc(b)}</td>
                    <td data-label="Staff" className="text-muted">{b.createdByName || 'Staff'}</td><td data-label="Cashier" className="text-muted">{b.printedByName || '-'}</td>
                    <td data-label="Items" className="text-muted">{b.itemCount} items</td><td data-label="Payment" className="text-muted">{b.paymentSummary || b.paymentMode}</td><td data-label="Net" className="line-through text-muted">₹{Number(b.netAmount || 0).toFixed(2)}</td>
                    <td data-label="Status"><Badge icon="fa-trash-can">DELETED</Badge></td>
                    <td className="text-right text-[11px] text-muted"><div>By {b.deletedByName || '-'} · {formatISTDateTime(b.deletedAt)}</div><div className="italic break-words">{b.deleteReason || ''}</div></td>
                  </tr>);
                const a = billActions(b);
                return (
                  <tr key={b.id}>
                    <td data-label="" className="cell-title font-mono font-semibold text-brand-text">{b.billNumber}</td>
                    <td data-label="When" className="text-xs whitespace-nowrap">{formatISTDateTime(b.createdAt)}</td><td data-label="Table">{loc(b)}</td>
                    <td data-label="Staff" className="text-brand-text"><i className="fa-solid fa-user-check text-[10px] mr-1" />{b.createdByName || 'Staff'}</td><td data-label="Cashier" className="text-info"><i className="fa-solid fa-user-shield text-[10px] mr-1" />{b.printedByName || 'Pending / Staff'}</td>
                    <td data-label="Items">{b.itemCount} items</td><td data-label="Payment"><Badge>{b.paymentSummary || b.paymentMode}</Badge></td><td data-label="Net" className="font-semibold text-fg">₹{Number(b.netAmount || 0).toFixed(2)}</td>
                    <td data-label="Status"><Badge tone={statusTone(b.status)}>{b.status}</Badge>{Number(b.totalRefunded) > 0 && <span className="block text-[11px] text-danger font-mono mt-0.5">Ref: ₹{Number(b.totalRefunded).toFixed(2)}</span>}</td>
                    <td className="cell-actions"><div className="flex flex-wrap items-center justify-end gap-1.5 w-full md:w-auto">
                      <button type="button" onClick={() => void reprint(b.id)} title="Print receipt" aria-label={`Print receipt ${b.billNumber}`} className="btn btn-soft-brand btn-icon btn-sm"><i className="fa-solid fa-print" /></button>
                      {a.split && <button type="button" onClick={() => void openSplit(b.id)} title="Split by items: a separate bill for each guest" aria-label={`Split bill ${b.billNumber}`} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-people-arrows" />Split</button>}
                      {a.edit && <button type="button" onClick={() => setModal({ kind: 'edit', id: b.id })} title="Edit bill details" aria-label={`Edit bill ${b.billNumber}`} className="btn btn-secondary btn-icon btn-sm"><i className="fa-solid fa-pen-to-square" /></button>}
                      {a.refund && <button type="button" onClick={() => setModal({ kind: 'refund', id: b.id })} title="Auditable refund" className="btn btn-soft-danger btn-sm"><i className="fa-solid fa-rotate-left" />Refund</button>}
                      {a.void && <button type="button" onClick={() => setModal({ kind: 'void', bill: b })} title="Void unpaid order" className="btn btn-soft-danger btn-sm"><i className="fa-solid fa-ban" />Void</button>}
                      {deletableIds.has(b.id) && <button type="button" onClick={() => setModal({ kind: 'delete', bill: b })} title="Delete bill (last 5 bills only)" aria-label={`Delete bill ${b.billNumber}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-solid fa-trash-can" /></button>}
                    </div></td>
                  </tr>);
              })}
            </tbody>
          </table>
        )}
        {bills.data && <Pager id="billsTableBodyPager" page={bills.data.page} size={bills.data.size} total={bills.data.total} totalPages={bills.data.totalPages} count={rows.length} onPage={setPage} />}
      </div>

      {modal?.kind === 'split' && <SplitBillDialog bill={modal.bill} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <EditBillDialog billId={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'refund' && <RefundDialog billId={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'void' && <VoidOrderDialog bill={modal.bill} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && <DeleteBillDialog bill={modal.bill} onClose={() => setModal(null)} />}
    </section>
  );
}
