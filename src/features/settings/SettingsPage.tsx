import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { canManageBranchSettings, isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import { useUi } from '../../app/ui';
import { showToast } from '../../components/toast';
import { Field, PageHeader, Skeleton } from '../../components/ui';
import { copyText } from '../../lib/clipboard';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { branchesKey, branchMenuLink, fetchBranches, updateBranch } from '../outlets/api';
import { BrandingPanel } from './BrandingPanel';
import { cafeKey, fetchCafe, saveCafe, type CafeProfile, type CafeProfileInput } from './api';

/** Cafe profile, logo and payment QR, the branch's own details, printers and the public menu links. */
export function SettingsPage() {
  const user = useSession((s) => s.user)!;
  const ui = useUi((s) => s.set);
  const wide = isCafeWide(user);
  const cafe = useQuery({ queryKey: cafeKey, queryFn: fetchCafe });
  const link = `${window.location.origin}/menu?cafe=${encodeURIComponent(user.tenantCode ?? '')}`;

  return (
    <section id="tab-settings" data-testid="tab-settings" className="space-y-5">
      <PageHeader title="Cafe & branding" description={wide ? 'Your cafe\'s name, contact details, logo and payment QR.' : 'Your branch\'s details and payment QR. The cafe-wide details are set by the owner.'} />
      {cafe.isPending && <div className="card"><Skeleton rows={5} /></div>}
      {cafe.isError && <div role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">Could not load the cafe details: {cafe.error.message}</div>}
      {cafe.isSuccess && <CafeCard cafe={cafe.data} editable={wide} />}
      {!wide && user.outletId ? <BranchCard branchId={user.outletId} /> : null}
      <BrandingPanel />
      {canManageBranchSettings(user) && (
        <div className="card p-5 space-y-3">
          <h2 className="font-medium text-fg">Printers</h2>
          <p className="text-sm text-muted">Bill, kitchen and juice-bar printers {wide ? 'and the print bridge' : 'of your branch'}.</p>
          <button type="button" className="btn btn-secondary" onClick={() => ui({ printerSettingsOpen: true })}><i className="fa-solid fa-print" />Open printer settings</button>
        </div>)}
      <div className="card p-5 space-y-3">
        <h2 className="font-medium text-fg">Public menu</h2>
        <p className="text-sm text-muted">Customers scan a QR code that opens this link. Branches can have their own link with their own prices (see Branches).</p>
        <div className="flex gap-2"><input readOnly aria-label="Public menu link" className="input font-mono text-sm" value={link} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-secondary shrink-0" onClick={() => void copyText(link, 'menu link')}><i className="fa-solid fa-copy" />Copy</button></div>
      </div>
    </section>
  );
}

function CafeCard({ cafe, editable }: { cafe: CafeProfile; editable: boolean }) {
  const qc = useQueryClient();
  const patchUser = useSession((s) => s.patchUser);
  const [f, setF] = useState<CafeProfileInput>({ name: cafe.name, contactEmail: cafe.contactEmail ?? '', contactPhone: cafe.contactPhone ?? '', address: cafe.address ?? '', gstNumber: cafe.gstNumber ?? '', tagline: cafe.tagline ?? '' });
  const set = (p: Partial<CafeProfileInput>) => setF({ ...f, ...p });
  const save = useMutation({
    mutationFn: () => saveCafe(f),
    onSuccess: (saved) => { qc.setQueryData(cafeKey, saved); patchUser({ tenantName: saved.name, logoUrl: saved.logoUrl ?? null }); showToast('Cafe details saved.', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const input = (id: string, label: string, key: keyof CafeProfileInput, hint?: string) => (
    <Field id={id} label={label} hint={hint}><input id={id} className="input" value={f[key] ?? ''} disabled={!editable} onChange={(e) => set({ [key]: e.target.value })} /></Field>);
  return (
    <form className="card p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) { showToast('The cafe needs a name.', 'error'); return; } save.mutate(); }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-fg">Cafe details</h2>
        <span className="text-xs text-muted font-mono">code: {cafe.code}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {input('cafeName', 'Cafe name', 'name')}
        {input('cafeTagline', 'Tagline', 'tagline', 'A short line under the name on bills and the menu.')}
        {input('cafeEmail', 'Contact email', 'contactEmail')}
        {input('cafePhone', 'Contact phone', 'contactPhone')}
        {input('cafeAddress', 'Address', 'address')}
        {input('cafeGst', 'GSTIN', 'gstNumber')}
      </div>
      {editable && <div className="flex justify-end"><button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save cafe details'}</button></div>}
    </form>
  );
}

function BranchCard({ branchId }: { branchId: number }) {
  const qc = useQueryClient();
  const cafeCode = useSession((s) => s.user?.tenantCode ?? '');
  const branches = useQuery({ queryKey: branchesKey, queryFn: fetchBranches });
  const branch = branches.data?.find((b) => b.id === branchId);
  const [edit, setEdit] = useState<{ address: string; phone: string; gstNumber: string } | null>(null);
  const form = edit ?? { address: branch?.address ?? '', phone: branch?.phone ?? '', gstNumber: branch?.gstNumber ?? '' };
  const save = useMutation({
    mutationFn: () => updateBranch(branchId, { name: branch!.name, ...form }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: branchesKey }); setEdit(null); showToast('Branch details saved.', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  if (!branch) return null;
  const set = (p: Partial<typeof form>) => setEdit({ ...form, ...p });
  return (
    <form className="card p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-medium text-fg">Your branch: {branch.name}</h2><span className="text-xs text-muted font-mono">{branch.code}</span></div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field id="branchAddr" label="Address"><input id="branchAddr" className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field id="branchTel" label="Phone"><input id="branchTel" className="input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field id="branchGstin" label="GSTIN"><input id="branchGstin" className="input font-mono" value={form.gstNumber} onChange={(e) => set({ gstNumber: e.target.value })} /></Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyText(branchMenuLink(window.location.origin, cafeCode, branch.code), 'menu link')}><i className="fa-solid fa-qrcode" />Copy my branch's menu link</button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending || edit === null}>{save.isPending ? 'Saving…' : 'Save branch details'}</button>
      </div>
    </form>
  );
}
