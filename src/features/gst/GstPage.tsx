import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { Badge, Field, PageHeader, Skeleton, Switch } from '../../components/ui';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { formatISTDateTime } from '../../lib/time';
import { DEFAULT_GST, fetchGst, fetchParcel, gstKey, parcelKey, saveGst, saveParcel, type GstConfig } from './api';
import { buildPreview, totalPercent } from './rules';

const inr = (n: number) => `₹${n.toFixed(2)}`;

export function GstPage() {
  const cfg = useQuery({ queryKey: gstKey, queryFn: fetchGst });
  const parcel = useQuery({ queryKey: parcelKey, queryFn: fetchParcel });
  const err = cfg.isError ? cfg.error.message : '';
  useEffect(() => { if (err) showToast(`Could not load GST settings: ${err}`, 'error'); }, [err]);
  if (cfg.isPending || parcel.isPending) return <section id="tab-gst" data-testid="tab-gst" className="space-y-5"><PageHeader title="GST management" /><div className="card"><Skeleton rows={4} /></div></section>;
  // The form starts from what the server has (or the standard defaults if it could not be read) and is remounted never, so typing is never overwritten.
  return <GstForm loaded={cfg.data ?? DEFAULT_GST} parcel={parcel.data?.defaultParcelCharge ?? 0} />;
}

function GstForm({ loaded, parcel }: { loaded: GstConfig; parcel: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ enabled: loaded.enabled, gstin: loaded.gstin || '', cgst: String(loaded.cgstPercent ?? 2.5), sgst: String(loaded.sgstPercent ?? 2.5), roundOff: Boolean(loaded.roundOffEnabled), parcel: String(parcel) });
  const save = useMutation({
    mutationFn: async (f: typeof form) => {
      const updated = await saveGst({ enabled: f.enabled, gstin: f.gstin.trim() || DEFAULT_GST.gstin, cgstPercent: parseFloat(f.cgst), sgstPercent: parseFloat(f.sgst), roundOffEnabled: f.roundOff });
      const pc = parseFloat(f.parcel);
      if (!isNaN(pc) && pc >= 0) { try { await saveParcel(pc); } catch { /* the GST part is already saved */ } }
      return updated;
    },
    onSuccess: (updated: GstConfig) => { qc.setQueryData(gstKey, updated); void qc.invalidateQueries({ queryKey: parcelKey }); showToast('GST & Parcel charge settings updated successfully! Applied to all future bills.', 'success'); },
    onError: (e: Error) => showToast(`Failed to save GST settings: ${e.message}`, 'error'),
  });

  const cgst = parseFloat(form.cgst) || 0;
  const sgst = parseFloat(form.sgst) || 0;
  const pv = buildPreview(form.enabled, form.gstin, cgst, sgst, form.roundOff);
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  const submit = () => {
    if (isNaN(parseFloat(form.cgst)) || parseFloat(form.cgst) < 0) { showToast('Invalid CGST percentage rate', 'error'); return; }
    if (isNaN(parseFloat(form.sgst)) || parseFloat(form.sgst) < 0) { showToast('Invalid SGST percentage rate', 'error'); return; }
    save.mutate(form);
  };
  const reset = () => { setForm({ ...form, enabled: true, gstin: DEFAULT_GST.gstin, cgst: '2.5', sgst: '2.5', roundOff: false }); showToast('Reset GST fields to standard 2.5% CGST + 2.5% SGST defaults. Click Save changes to apply.', 'info'); };

  return (
    <section id="tab-gst" data-testid="tab-gst" className="space-y-5">
      <PageHeader title="GST management" description="Tax rates, GSTIN, round-off and the default parcel charge used on every new bill."
        actions={<>
          <span id="gstActiveStatusBadge"><Badge tone={form.enabled ? 'ok' : 'danger'} icon={form.enabled ? 'fa-circle-check' : 'fa-circle-xmark'}><span id="gstActiveStatusBadgeText">{form.enabled ? 'GST ENABLED' : 'GST DISABLED'}</span></Badge></span>
          <button type="button" onClick={reset} className="btn btn-secondary"><i className="fa-solid fa-rotate-left" />Reset defaults</button>
          <button type="button" id="btnSaveGstTop" onClick={submit} disabled={save.isPending} className="btn btn-primary"><i className="fa-solid fa-floppy-disk" />{save.isPending ? 'Saving…' : 'Save changes'}</button>
        </>} />

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="font-medium text-fg">Charge GST on bills</h2><p className="text-sm text-muted">Off = plain cash bill without tax lines.</p></div>
              <span id="gstEnabledToggleWrap"><Switch checked={form.enabled} onChange={() => set({ enabled: !form.enabled })} label="GST enabled" /></span>
              <input id="gstEnabledToggle" type="checkbox" className="sr-only" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} aria-label="GST enabled (checkbox)" tabIndex={-1} />
            </div>
            <Field id="gstinInput" label="GSTIN"><input id="gstinInput" value={form.gstin} onChange={(e) => set({ gstin: e.target.value })} className="input font-mono" placeholder="e.g. 32CQRPS5214H3ZK" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="cgstPercentInput" label="CGST %" hint="Usually 2.5% for restaurant services."><input id="cgstPercentInput" type="number" min="0" step="0.1" value={form.cgst} onChange={(e) => set({ cgst: e.target.value })} className="input" /></Field>
              <Field id="sgstPercentInput" label="SGST %" hint="Usually 2.5% for restaurant services."><input id="sgstPercentInput" type="number" min="0" step="0.1" value={form.sgst} onChange={(e) => set({ sgst: e.target.value })} className="input" /></Field>
            </div>
            <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-fg">Total GST: <strong id="totalGstPercentDisplay">{totalPercent(cgst, sgst).toFixed(1)}% (CGST {cgst.toFixed(1)}% + SGST {sgst.toFixed(1)}%)</strong></p>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="font-medium text-fg">Round the bill to a whole rupee</h2><p className="text-sm text-muted">The difference is shown as a round-off line.</p></div>
              <Switch checked={form.roundOff} onChange={() => set({ roundOff: !form.roundOff })} label="Round off" />
              <input id="gstRoundOffToggle" type="checkbox" className="sr-only" checked={form.roundOff} onChange={(e) => set({ roundOff: e.target.checked })} aria-label="Round off (checkbox)" tabIndex={-1} />
            </div>
            <Field id="defaultParcelChargeInput" label="Default parcel charge (₹)" hint="Added to takeaway orders unless changed at billing."><input id="defaultParcelChargeInput" type="number" min="0" step="0.5" value={form.parcel} onChange={(e) => set({ parcel: e.target.value })} className="input w-40" /></Field>
            <p className="text-xs text-muted">Last updated: <span id="gstLastUpdatedAt">{loaded.updatedAt ? formatISTDateTime(loaded.updatedAt) : 'Default'}</span> by <span id="gstLastUpdatedBy">{loaded.updatedByName || 'System'}</span></p>
          </div>
          <button type="button" id="btnSaveGstBottom" onClick={submit} disabled={save.isPending} className="btn btn-primary w-full h-10 lg:hidden">{save.isPending ? 'Saving…' : 'Save changes'}</button>
        </div>

        <aside className="lg:col-span-2">
          <div className="card p-5 lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Bill preview (sample ₹200)</h2><Badge tone={form.enabled ? 'ok' : 'neutral'}><span id="previewModeTag">{pv.tag}</span></Badge></div>
            <div className="rounded-lg border border-dashed border-line-strong bg-subtle/50 p-4 font-mono text-sm space-y-1.5">
              <p className="text-center font-semibold text-fg" id="previewReceiptTitle">{pv.title}</p>
              {pv.showGstin && <p id="previewGstinRow" className="text-center text-xs text-muted">GSTIN: <span id="previewGstinText">{pv.gstin}</span></p>}
              <div className="border-t border-dashed border-line-strong my-2" />
              <p className="flex justify-between"><span>Subtotal</span><span>{inr(200)}</span></p>
              {form.enabled && <>
                <p id="previewCgstRow" className="flex justify-between"><span>CGST <span id="previewCgstRateText">{pv.cgst.toFixed(1)}</span>%</span><span id="previewCgstAmtText">{inr(pv.cgstAmt)}</span></p>
                <p id="previewSgstRow" className="flex justify-between"><span>SGST <span id="previewSgstRateText">{pv.sgst.toFixed(1)}</span>%</span><span id="previewSgstAmtText">{inr(pv.sgstAmt)}</span></p>
              </>}
              {pv.roundOff !== null && <p id="previewRoundOffRow" className="flex justify-between"><span>Round off</span><span id="previewRoundOffText">{pv.roundOff >= 0 ? '+' : ''}{inr(pv.roundOff)}</span></p>}
              <div className="border-t border-dashed border-line-strong my-2" />
              <p className="flex justify-between font-semibold text-fg"><span>Grand total</span><span id="previewGrandTotalText">{inr(pv.grandTotal)}</span></p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
