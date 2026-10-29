import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, Field, PageHeader, Skeleton, Switch } from '../../components/ui';
import { copyText } from '../../lib/clipboard';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { branchesKey, branchMenuLink, createBranch, fetchBranches, fetchFranchise, franchiseKey, updateBranch, type Branch, type BranchInput } from './api';

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const EMPTY: BranchInput = { name: '', code: '', address: '', phone: '', gstNumber: '', isActive: true };

/** Branches of the cafe: owner and general manager open, edit and close them and compare how each one trades. */
export function OutletsPage() {
  const cafe = useSession((s) => s.user?.tenantCode ?? '');
  const qc = useQueryClient();
  const branches = useQuery({ queryKey: branchesKey, queryFn: fetchBranches });
  const franchise = useQuery({ queryKey: franchiseKey, queryFn: fetchFranchise });
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);

  const statsOf = (id: number) => franchise.data?.outlets.find((o) => o.outletId === id);
  const refresh = () => { void qc.invalidateQueries({ queryKey: branchesKey }); void qc.invalidateQueries({ queryKey: franchiseKey }); };

  return (
    <section id="tab-outlets" data-testid="tab-outlets" className="space-y-5">
      <PageHeader title="Branches" description="Every branch of your cafe. Staff work in one branch; owners and general managers can switch between them from the top bar."
        actions={<button type="button" id="btnAddBranch" onClick={() => setEditing('new')} className="btn btn-primary"><i className="fa-solid fa-plus" />Add branch</button>} />

      {franchise.data && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Branches" value={String(franchise.data.totalOutlets)} />
          <Stat label="Orders (all time)" value={String(franchise.data.totalBrandOrders)} />
          <Stat label="Revenue (all time)" value={inr(franchise.data.totalBrandRevenue)} />
        </div>)}

      {branches.isPending && <div className="card"><Skeleton rows={4} /></div>}
      {branches.isError && <div role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">Could not load the branches: {branches.error.message}</div>}
      {branches.isSuccess && branches.data.length === 0 && <div className="card"><EmptyState icon="fa-store" title="No branches yet" hint="Add the first one." /></div>}

      <div className="grid md:grid-cols-2 gap-4">
        {(branches.data ?? []).map((b) => {
          const st = statsOf(b.id);
          return (
            <article key={b.id} data-testid="branch-card" className="card p-4 space-y-3">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-fg truncate">{b.name}</h2>
                  <p className="text-xs text-muted font-mono">{b.code}</p>
                </div>
                <Badge tone={b.isActive ? 'ok' : 'neutral'}>{b.isActive ? 'Open' : 'Closed'}</Badge>
              </header>
              {(b.address || b.phone) && <p className="text-sm text-muted">{[b.address, b.phone].filter(Boolean).join(' · ')}</p>}
              {b.gstNumber && <p className="text-xs text-muted">GSTIN <span className="font-mono">{b.gstNumber}</span></p>}
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">Orders</dt><dd className="font-medium text-fg">{st?.ordersCount ?? 0}</dd></div>
                <div><dt className="text-xs text-muted">Revenue</dt><dd className="font-medium text-fg">{inr(st?.totalRevenue ?? 0)}</dd></div>
                <div><dt className="text-xs text-muted">Avg order</dt><dd className="font-medium text-fg">{inr(st?.averageOrderValue ?? 0)}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => setEditing(b)} className="btn btn-secondary btn-sm"><i className="fa-solid fa-pen" />Edit</button>
                <button type="button" onClick={() => void copyText(branchMenuLink(window.location.origin, cafe, b.code), 'menu link')} className="btn btn-ghost btn-sm" title="The link (or QR code) customers use to see this branch's menu"><i className="fa-solid fa-qrcode" />Menu link</button>
              </div>
            </article>);
        })}
      </div>

      {editing && <BranchDialog branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card p-3"><p className="text-xs text-muted">{label}</p><p className="text-lg font-semibold text-fg">{value}</p></div>;
}

function BranchDialog({ branch, onClose, onSaved }: { branch: Branch | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<BranchInput>(branch ? { name: branch.name, code: branch.code, address: branch.address ?? '', phone: branch.phone ?? '', gstNumber: branch.gstNumber ?? '', isActive: branch.isActive } : EMPTY);
  const set = (p: Partial<BranchInput>) => setF({ ...f, ...p });
  const save = useMutation({
    mutationFn: () => {
      const body: BranchInput = { name: f.name.trim(), address: f.address?.trim(), phone: f.phone?.trim(), gstNumber: f.gstNumber?.trim() };
      return branch ? updateBranch(branch.id, { ...body, isActive: f.isActive }) : createBranch({ ...body, code: f.code?.trim() || undefined });
    },
    onSuccess: () => { showToast(branch ? 'Branch updated.' : 'Branch added.', 'success'); onSaved(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  return (
    <Dialog id="branchModal" open onClose={onClose} title={branch ? `Edit ${branch.name}` : 'Add branch'} description={branch ? undefined : 'You can add as many branches as your plan allows.'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) { showToast('The branch needs a name.', 'error'); return; } save.mutate(); }}>
        <Field id="branchName" label="Branch name"><input id="branchName" className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Indiranagar" autoFocus /></Field>
        {!branch && <Field id="branchCode" label="Code" hint="Short and unique, used in links. Leave empty to generate one."><input id="branchCode" className="input font-mono" value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="e.g. IND" /></Field>}
        <Field id="branchAddress" label="Address"><input id="branchAddress" className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="branchPhone" label="Phone"><input id="branchPhone" className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field id="branchGst" label="GSTIN" hint="If this branch has its own."><input id="branchGst" className="input font-mono" value={f.gstNumber} onChange={(e) => set({ gstNumber: e.target.value })} /></Field>
        </div>
        {branch && <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"><div><p className="text-sm font-medium text-fg">Open for business</p><p className="text-xs text-muted">A closed branch keeps its history but cannot take orders.</p></div><Switch checked={!!f.isActive} onChange={() => set({ isActive: !f.isActive })} label="Open for business" /></div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={save.isPending} className="btn btn-primary">{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}
