import { useState } from 'react';
import { useSession } from '../../api/session';
import { Badge, EmptyState, Field, SearchInput, SegmentedTabs, Skeleton } from '../../components/ui';
import { deactivateSupplier, type Supplier } from './api';
import { copyText } from '../../lib/clipboard';
import { useSupplierAction } from './hooks';
import { DEFAULT_DIRECTORY_FILTERS, filterDirectory, filterOverview, fmtINR, supplierCategories, type DirectoryFilters } from './rules';

interface Actions { onDossier: (id: number) => void; onEdit: (id: number) => void; onInvoice: (id: number) => void }

const owed = (s: Supplier) => (s.totalOutstanding || 0) > 0;

/** All suppliers with their balances. */
export function OverviewTab({ suppliers, loading, onDossier, onEdit }: { suppliers: Supplier[]; loading: boolean } & Actions) {
  const isAdmin = useSession((s) => s.user?.role) === 'ADMIN';
  const [query, setQuery] = useState('');
  const deactivate = useSupplierAction(deactivateSupplier, 'Supplier deactivated');
  const rows = filterOverview(suppliers, query);
  const onDelete = (s: Supplier) => { if (window.confirm('Deactivate this supplier? Their invoices and payment history will be kept.')) deactivate.mutate(s.id); };
  return (
    <div id="supplier-sub-overview" className="space-y-4">
      <SearchInput id="supplierOverviewSearchInput" value={query} onChange={setQuery} placeholder="Search suppliers by name, phone, contact" />
      <div className="card overflow-hidden">
        {loading ? <Skeleton rows={5} /> : rows.length === 0 ? <EmptyState icon="fa-truck" title={query ? 'No suppliers match your search' : 'No suppliers added yet'} /> : (
          <table className="rtable">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Category</th><th>Terms</th><th className="text-right">Invoiced</th><th className="text-right">Paid</th><th className="text-right text-danger">Outstanding</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="supplierTableBody">
              {rows.map((s) => (
                <tr key={s.id} className={s.active === false ? 'opacity-50' : ''}>
                  <td data-label="" className="cell-title"><span className="font-medium text-fg block">{s.name}</span><span className="text-xs text-muted">{s.email || ''} {s.phone ? `· ${s.phone}` : ''}</span></td>
                  <td data-label="Contact">{s.contactPerson || '-'}</td>
                  <td data-label="Category"><Badge tone="info">{s.category || '-'}</Badge></td>
                  <td data-label="Terms">{s.paymentTerms || 30} days</td>
                  <td data-label="Invoiced" className="md:text-right">{fmtINR(s.totalInvoiced)}</td>
                  <td data-label="Paid" className="md:text-right text-ok">{fmtINR(s.totalPaid)}</td>
                  <td data-label="Outstanding" className={`md:text-right font-semibold ${owed(s) ? 'text-danger' : 'text-muted'}`}>{fmtINR(s.totalOutstanding)}</td>
                  <td className="cell-actions"><div className="flex flex-wrap justify-end gap-1.5 w-full md:w-auto">
                    <button type="button" onClick={() => onDossier(s.id)} className="btn btn-soft-brand btn-sm">Dossier</button>
                    <button type="button" onClick={() => onEdit(s.id)} className="btn btn-secondary btn-sm">Edit</button>
                    {isAdmin && <button type="button" onClick={() => onDelete(s)} className="btn btn-soft-danger btn-sm">Delete</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CopyBtn({ text, label }: { text?: string | null; label: string }) {
  if (!text) return null;
  return <button type="button" onClick={(e) => { e.stopPropagation(); void copyText(text, label); }} title={`Copy ${label}`} aria-label={`Copy ${label}`} className="btn btn-ghost btn-icon btn-sm shrink-0"><i className="fa-regular fa-copy text-xs" /></button>;
}

function SupplierCard({ s, onDossier, onEdit, onInvoice }: { s: Supplier } & Actions) {
  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-brand/50 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-semibold text-fg flex items-center gap-1.5"><i className="fa-solid fa-building text-xs text-brand-text" /><span className="truncate">{s.name}</span></h3>
          <p className="text-xs text-muted mt-0.5"><i className="fa-regular fa-user mr-1" />{s.contactPerson || 'General contact'}</p></div>
        <div className="flex flex-col items-end gap-1 shrink-0"><Badge tone={s.active !== false ? 'ok' : 'neutral'}>{s.active !== false ? 'Active' : 'Inactive'}</Badge>{s.category && <Badge tone="brand">{s.category}</Badge>}</div>
      </div>
      <div className="rounded-lg bg-subtle p-2.5 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-2"><span className="truncate">{s.phone ? <a href={`tel:${s.phone}`} className="font-mono font-medium text-ok hover:underline">{s.phone}</a> : <span className="text-muted">No phone</span>}</span><CopyBtn text={s.phone} label="Phone number" /></div>
        {s.email && <p className="truncate text-xs text-muted"><i className="fa-regular fa-envelope mr-1" /><a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a></p>}
        {s.address && <p className="truncate text-xs text-muted" title={s.address}><i className="fa-solid fa-location-dot mr-1" />{s.address}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-line p-2 flex items-center justify-between gap-1 min-w-0"><span className="min-w-0"><span className="block text-[10px] uppercase text-muted">GSTIN</span><span className="font-mono text-fg truncate block">{s.gstNumber || '-'}</span></span><CopyBtn text={s.gstNumber} label="GSTIN" /></div>
        <div className="rounded-lg border border-line p-2 flex items-center justify-between gap-1 min-w-0"><span className="min-w-0"><span className="block text-[10px] uppercase text-muted">UPI ID</span><span className="font-mono text-info truncate block">{s.upiId || '-'}</span></span><CopyBtn text={s.upiId} label="UPI ID" /></div>
      </div>
      <div className="border-t border-line pt-2 space-y-1.5 mt-auto">
        <p className="flex justify-between text-sm"><span className="text-muted">Outstanding due</span><span className={`font-mono font-semibold ${owed(s) ? 'text-danger' : 'text-muted'}`}>{fmtINR(s.totalOutstanding)}</span></p>
        <p className="flex justify-between text-xs text-muted"><span>Invoiced: <strong className="text-fg">{fmtINR(s.totalInvoiced)}</strong></span><span>Paid: <strong className="text-ok">{fmtINR(s.totalPaid)}</strong></span></p>
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button type="button" onClick={() => onDossier(s.id)} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-eye" />Dossier</button>
          <button type="button" onClick={() => onInvoice(s.id)} className="btn btn-secondary btn-sm"><i className="fa-solid fa-file-invoice" />Invoice</button>
          <button type="button" onClick={() => onEdit(s.id)} className="btn btn-secondary btn-sm"><i className="fa-solid fa-pen" />Edit</button>
        </div>
      </div>
    </div>
  );
}

/** Directory: richer filters, card or table view, totals of what is shown. */
export function DirectoryTab({ suppliers, loading, ...actions }: { suppliers: Supplier[]; loading: boolean } & Actions) {
  const [f, setF] = useState<DirectoryFilters>(DEFAULT_DIRECTORY_FILTERS);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const list = filterDirectory(suppliers, f);
  const invoiced = list.reduce((a, s) => a + (s.totalInvoiced || 0), 0);
  const outstanding = list.reduce((a, s) => a + (s.totalOutstanding || 0), 0);
  const empty = <EmptyState icon="fa-truck-ramp-box" title="No suppliers found matching the search criteria" action={<button type="button" onClick={() => setF(DEFAULT_DIRECTORY_FILTERS)} className="btn btn-secondary btn-sm">Clear search filters</button>} />;
  return (
    <div id="supplier-sub-details" className="space-y-4">
      <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2"><Field id="supplierDetailSearchInput" label="Supplier"><input id="supplierDetailSearchInput" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} className="input" placeholder="Search supplier, contact, email, GST, UPI" /></Field></div>
        <Field id="supplierPhoneSearchInput" label="Phone / account"><input id="supplierPhoneSearchInput" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" placeholder="Phone, mobile or a/c #" /></Field>
        <Field id="supplierCategoryFilter" label="Category"><select id="supplierCategoryFilter" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input"><option value="">All categories</option>{supplierCategories(suppliers).map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field id="supplierStatusFilter" label="Status"><select id="supplierStatusFilter" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as DirectoryFilters['status'] })} className="input"><option value="ACTIVE">Active only</option><option value="ALL">All status</option><option value="INACTIVE">Deactivated</option></select></Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p className="flex flex-wrap gap-x-5 gap-y-1"><span>Total found: <strong id="supplierDirCount" className="text-fg">{list.length}</strong></span><span>Invoiced: <strong id="supplierDirTotalInvoiced" className="text-fg">{fmtINR(invoiced)}</strong></span><span>Outstanding: <strong id="supplierDirTotalOutstanding" className="text-danger">{fmtINR(outstanding)}</strong></span></p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setF(DEFAULT_DIRECTORY_FILTERS)} className="btn btn-ghost btn-sm">Reset filters</button>
          <SegmentedTabs label="Directory view" value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', id: 'btnSupplierViewCards' }, { value: 'table', label: 'Table', id: 'btnSupplierViewTable' }]} />
        </div>
      </div>
      {loading ? <div className="card"><Skeleton rows={4} /></div> : view === 'cards' ? (
        <div id="supplierDirectoryCardsView" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.length === 0 ? <div className="col-span-full card">{empty}</div> : list.map((s) => <SupplierCard key={s.id} s={s} {...actions} />)}</div>
      ) : (
        <div id="supplierDirectoryTableView" className="card overflow-hidden">
          {list.length === 0 ? empty : (
            <table className="rtable">
              <thead><tr><th>Supplier name</th><th>Contact person & phone</th><th>Category</th><th>GSTIN / tax</th><th>UPI / banking</th><th className="text-right">Invoiced</th><th className="text-right text-danger">Outstanding</th><th className="text-center">Actions</th></tr></thead>
              <tbody id="supplierDirectoryTableBody">{list.map((s) => (
                <tr key={s.id} className={s.active === false ? 'opacity-50' : ''}>
                  <td data-label="" className="cell-title"><span className="font-medium text-fg block">{s.name}</span><span className="text-xs text-muted truncate block max-w-xs">{s.address || s.email || ''}</span></td>
                  <td data-label="Contact"><span className="block text-fg">{s.contactPerson || '-'}</span><span className="flex items-center gap-1">{s.phone ? <><a href={`tel:${s.phone}`} className="font-mono text-xs text-ok hover:underline">{s.phone}</a><CopyBtn text={s.phone} label="Phone" /></> : <span className="text-muted">-</span>}</span></td>
                  <td data-label="Category"><Badge tone="info">{s.category || '-'}</Badge></td>
                  <td data-label="GSTIN" className="font-mono text-xs">{s.gstNumber ? <span className="flex items-center gap-1">{s.gstNumber}<CopyBtn text={s.gstNumber} label="GSTIN" /></span> : <span className="text-muted">-</span>}</td>
                  <td data-label="UPI / bank" className="text-xs"><span className="block font-mono text-info truncate max-w-[140px]">{s.upiId || '-'}</span><span className="block font-mono text-muted truncate max-w-[140px]">{s.bankAccount ? `A/C: ${s.bankAccount}` : ''}</span></td>
                  <td data-label="Invoiced" className="md:text-right font-mono">{fmtINR(s.totalInvoiced)}</td>
                  <td data-label="Outstanding" className={`md:text-right font-mono font-semibold ${owed(s) ? 'text-danger' : 'text-muted'}`}>{fmtINR(s.totalOutstanding)}</td>
                  <td className="cell-actions"><div className="flex justify-center gap-1.5 w-full md:w-auto"><button type="button" onClick={() => actions.onDossier(s.id)} className="btn btn-soft-brand btn-sm">Dossier</button><button type="button" onClick={() => actions.onEdit(s.id)} className="btn btn-secondary btn-sm">Edit</button></div></td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
