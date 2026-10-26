import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Image as ImageIcon, QrCode, Upload, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

type Kind = 'logo' | 'payment-qr';
type Overview = { LOGO: (number | null)[]; PAYMENT_QR: (number | null)[] };

const CAFE_LEVEL_ROLES = ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER'];

/**
 * The cafe's own images. Owner and main manager set the cafe-wide logo and payment QR; a branch manager (or staff
 * they delegate to) may give their own branch a different payment QR. Nothing is shared between cafes.
 */
export const BrandingPanel: React.FC = () => {
  const { user, activeOutlet, updateTenantLogo } = useAuth();
  const cafeLevel = !!user && CAFE_LEVEL_ROLES.includes(user.role);
  const branchLevel = cafeLevel || user?.role === 'MANAGER' || !!user?.canManageSettings;

  const [overview, setOverview] = useState<Overview>({ LOGO: [], PAYMENT_QR: [] });
  const [scope, setScope] = useState<'cafe' | 'branch'>(cafeLevel ? 'cafe' : 'branch');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const branchId = activeOutlet?.id ?? user?.outletId ?? null;
  const qrOutletParam = scope === 'branch' && branchId ? `?outletId=${branchId}` : '';

  const refresh = useCallback(async () => {
    try {
      const o = await api.get<{ assets: Overview }>('/branding');
      setOverview(o.assets);
    } catch {
      /* the panel still works without the overview */
    }
    setLogoPreview(await api.imageUrl('/branding/logo?cb=' + Date.now()));
    setQrPreview(await api.imageUrl('/branding/payment-qr' + (qrOutletParam ? qrOutletParam + '&' : '?') + 'cb=' + Date.now()));
  }, [qrOutletParam]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const branchHasOwnQr = branchId != null && overview.PAYMENT_QR.includes(branchId);
  const cafeHasQr = overview.PAYMENT_QR.includes(null);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus({ ok: true, text: okText });
      await refresh();
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || 'Something went wrong' });
    } finally {
      setBusy(false);
    }
  };

  const pick = (kind: Kind, outletParam: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setStatus({ ok: false, text: 'Please choose a PNG or JPEG picture.' });
      return;
    }
    if (file.size > 1_500_000) {
      setStatus({ ok: false, text: 'The picture is larger than 1.5 MB.' });
      return;
    }
    run(async () => {
      await api.upload(`/branding/${kind}${outletParam}`, file);
      if (kind === 'logo' && !outletParam) {
        const t = await api.get<any>('/tenant/settings');
        updateTenantLogo(t.logoUrl || '');
      }
    }, kind === 'logo' ? 'Logo updated.' : 'Payment QR updated. It prints on bills when "Print payment QR" is on.');
  };

  const remove = (kind: Kind, outletParam: string, text: string) =>
    run(async () => {
      await api.delete(`/branding/${kind}${outletParam}`);
      if (kind === 'logo' && !outletParam) updateTenantLogo('');
    }, text);

  if (!cafeLevel && !branchLevel) return null;

  return (
    <div className="glass-panel p-6 rounded-2xl border-slate-800/80 space-y-6">
      <div>
        <h2 className="text-base font-bold text-white">Logo &amp; Payment QR</h2>
        <p className="text-xs text-slate-400">
          Your own pictures, used on your bills and customer menu. They are never shown to other cafes.
        </p>
      </div>

      {status && (
        <div className={`flex items-center space-x-2 text-xs rounded-xl px-3 py-2 border ${
          status.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {status.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{status.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cafeLevel && (
          <div className="p-5 bg-surface-950/60 border border-slate-800 rounded-2xl space-y-3 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cafe logo</span>
            <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-700 bg-surface-900 flex items-center justify-center overflow-hidden">
              {logoPreview ? <img src={logoPreview} alt="Cafe logo" className="w-full h-full object-contain p-2" />
                : <ImageIcon className="w-8 h-8 text-slate-500" />}
            </div>
            <label className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>{logoPreview ? 'Replace logo' : 'Upload logo'}</span>
              <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy} onChange={pick('logo', '')} />
            </label>
            {logoPreview && (
              <button type="button" disabled={busy} onClick={() => remove('logo', '', 'Logo removed.')}
                className="text-[11px] text-rose-400 hover:text-rose-300 inline-flex items-center space-x-1">
                <Trash2 className="w-3 h-3" /><span>Remove logo</span>
              </button>
            )}
          </div>
        )}

        <div className="p-5 bg-surface-950/60 border border-slate-800 rounded-2xl space-y-3 text-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment QR (UPI)</span>

          {cafeLevel && branchLevel && (
            <div className="flex justify-center gap-1 text-[11px]">
              <button type="button" onClick={() => setScope('cafe')}
                className={`px-3 py-1 rounded-lg border ${scope === 'cafe' ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400'}`}>
                Whole cafe
              </button>
              <button type="button" onClick={() => setScope('branch')} disabled={!branchId}
                className={`px-3 py-1 rounded-lg border ${scope === 'branch' ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400'}`}>
                {activeOutlet?.name || 'This branch'}
              </button>
            </div>
          )}

          <div className="w-32 h-32 mx-auto rounded-2xl border-2 border-dashed border-slate-700 bg-white flex items-center justify-center overflow-hidden">
            {qrPreview ? <img src={qrPreview} alt="Payment QR" className="w-full h-full object-contain" />
              : <QrCode className="w-8 h-8 text-slate-400" />}
          </div>

          <p className="text-[11px] text-slate-400">
            {scope === 'branch'
              ? branchHasOwnQr ? 'This branch uses its own QR.' : cafeHasQr ? 'This branch uses the cafe-wide QR until it uploads its own.' : 'No QR yet: bills print without one.'
              : cafeHasQr ? 'Used by every branch without its own QR.' : 'No QR yet: bills print without one.'}
          </p>

          <label className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>{scope === 'branch' ? 'Upload branch QR' : 'Upload cafe QR'}</span>
            <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy} onChange={pick('payment-qr', qrOutletParam)} />
          </label>
          {((scope === 'branch' && branchHasOwnQr) || (scope === 'cafe' && cafeHasQr)) && (
            <button type="button" disabled={busy}
              onClick={() => remove('payment-qr', qrOutletParam, scope === 'branch' ? 'Branch QR removed.' : 'Cafe QR removed.')}
              className="text-[11px] text-rose-400 hover:text-rose-300 inline-flex items-center space-x-1">
              <Trash2 className="w-3 h-3" /><span>{scope === 'branch' ? 'Use the cafe-wide QR instead' : 'Remove QR'}</span>
            </button>
          )}
          <p className="text-[10px] text-slate-500">Upload a clear picture of the QR (PNG or JPEG, up to 1.5 MB).</p>
        </div>
      </div>
    </div>
  );
};
