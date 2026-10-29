import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { PageHeader, SegmentedTabs } from '../../components/ui';
import { fetchInvoice, fetchSupplier, type Invoice, type Supplier } from './api';
import { SupplierAnalyticsTab } from './AnalyticsTab';
import { InvoiceDialog } from './InvoiceDialog';
import { InvoicesTab, PaymentDialog, PaymentsTab } from './InvoicesPayments';
import { useSuppliers } from './hooks';
import { DossierDialog, SupplierDialog } from './SupplierDialogs';
import { DirectoryTab, OverviewTab } from './SupplierTabs';

type Tab = 'overview' | 'details' | 'invoices' | 'payments' | 'analytics';
type Modal =
  | { kind: 'supplier'; supplier: Supplier | null } | { kind: 'dossier'; id: number }
  | { kind: 'invoice'; invoice: Invoice | null; supplierId?: number } | { kind: 'payment'; invoiceId: number | null } | null;

export function SuppliersPage() {
  const qc = useQueryClient();
  const suppliers = useSuppliers();
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);
  const list = suppliers.data ?? [];

  const loadError = suppliers.isError ? suppliers.error.message : '';
  useEffect(() => { if (loadError) showToast(`Failed to load suppliers: ${loadError}`, 'error'); }, [loadError]);

  const guard = async <T,>(fn: () => Promise<T>, then: (v: T) => void) => { try { then(await fn()); } catch (e) { showToast(e instanceof Error ? e.message : 'Something went wrong', 'error'); } };
  const edit = (id: number) => void guard(() => fetchSupplier(id), (supplier) => setModal({ kind: 'supplier', supplier }));
  const editInvoice = (id: number) => void guard(() => qc.fetchQuery({ queryKey: ['invoice', id], queryFn: () => fetchInvoice(id), staleTime: 0 }), (invoice) => setModal({ kind: 'invoice', invoice }));
  const newInvoice = (supplierId?: number) => setModal({ kind: 'invoice', invoice: null, supplierId });
  const actions = { onDossier: (id: number) => setModal({ kind: 'dossier', id }), onEdit: edit, onInvoice: (id: number) => newInvoice(id) };

  return (
    <section id="tab-suppliers" data-testid="tab-suppliers" className="space-y-5">
      <PageHeader title="Suppliers & payments" description="Suppliers, purchase invoices, partial payments and what you owe."
        actions={<button type="button" id="btnAddSupplier" onClick={() => setModal({ kind: 'supplier', supplier: null })} className="btn btn-primary"><i className="fa-solid fa-plus" />Add supplier</button>} />
      <SegmentedTabs label="Supplier sections" value={tab} onChange={setTab} options={[
        { value: 'overview', label: 'Overview', id: 'stab-overview' }, { value: 'details', label: 'Directory', id: 'stab-details' },
        { value: 'invoices', label: 'Invoices', id: 'stab-invoices' }, { value: 'payments', label: 'Payments', id: 'stab-payments' }, { value: 'analytics', label: 'Analytics', id: 'stab-analytics' },
      ]} />

      {tab === 'overview' && <OverviewTab suppliers={list} loading={suppliers.isPending} {...actions} />}
      {tab === 'details' && <DirectoryTab suppliers={list} loading={suppliers.isPending} {...actions} />}
      {tab === 'invoices' && <InvoicesTab suppliers={list} onNew={() => newInvoice()} onEdit={editInvoice} onPay={(id) => { setTab('payments'); setModal({ kind: 'payment', invoiceId: id }); }} />}
      {tab === 'payments' && <PaymentsTab suppliers={list} onNew={() => setModal({ kind: 'payment', invoiceId: null })} />}
      {tab === 'analytics' && <SupplierAnalyticsTab />}

      {modal?.kind === 'supplier' && <SupplierDialog key={modal.supplier?.id ?? 'new'} supplier={modal.supplier} onClose={close} />}
      {modal?.kind === 'dossier' && <DossierDialog supplierId={modal.id} onClose={close} onInvoice={(id) => newInvoice(id)} onEdit={edit} />}
      {modal?.kind === 'invoice' && <InvoiceDialog key={modal.invoice?.id ?? `new-${modal.supplierId ?? ''}`} invoice={modal.invoice} suppliers={list} presetSupplierId={modal.supplierId} onClose={close} />}
      {modal?.kind === 'payment' && <PaymentDialog key={modal.invoiceId ?? 'new'} presetInvoiceId={modal.invoiceId} onClose={close} />}
    </section>
  );
}
