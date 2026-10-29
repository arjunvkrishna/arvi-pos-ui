import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { brandingKey, fetchBranding, fetchCafe, imageUrl, removeImage, uploadImage, type ImageKind } from './api';
import { hasImage } from './rules';

const MAX_BYTES = 1_500_000;

/**
 * The cafe's own images. Owner and general manager set the cafe-wide logo and payment QR; a branch manager (or staff they delegate to)
 * may give their own branch a different payment QR. Nothing is shared between cafes.
 */
export function BrandingPanel() {
  const user = useSession((s) => s.user)!;
  const patchUser = useSession((s) => s.patchUser);
  const qc = useQueryClient();
  const wide = isCafeWide(user);
  const branchId = user.selectedOutletId ?? user.outletId ?? null;
  const [scope, setScope] = useState<'cafe' | 'branch'>(wide ? 'cafe' : 'branch');
  const outletForQr = scope === 'branch' ? branchId : null;
  const overview = useQuery({ queryKey: brandingKey, queryFn: fetchBranding });

  return (
    <div className="card p-5 space-y-4" data-testid="branding-panel">
      <div>
        <h2 className="font-medium text-fg">Logo &amp; payment QR</h2>
        <p className="text-sm text-muted">The logo shows on the sign-in page, the public menu and bills. The payment QR is printed on the customer's bill.</p>
      </div>
      {wide && branchId && (
        <div className="inline-flex rounded-lg border border-line p-0.5 text-sm" role="tablist" aria-label="QR applies to">
          {(['cafe', 'branch'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={scope === s} onClick={() => setScope(s)}
              className={`px-3 h-8 rounded-md ${scope === s ? 'bg-brand/15 text-fg font-medium' : 'text-muted'}`}>{s === 'cafe' ? 'Whole cafe' : 'This branch'}</button>))}
        </div>)}
      <div className="grid sm:grid-cols-2 gap-4">
        {wide && <ImageSlot kind="logo" title="Cafe logo" outletId={null} present={hasImage(overview.data?.assets.LOGO, null)}
          onChanged={async () => { await qc.invalidateQueries({ queryKey: brandingKey }); const c = await fetchCafe().catch(() => null); if (c) patchUser({ logoUrl: c.logoUrl ?? null }); }} />}
        <ImageSlot kind="payment-qr" title={outletForQr ? 'Payment QR for this branch' : 'Payment QR (default for every branch)'} outletId={outletForQr}
          present={hasImage(overview.data?.assets.PAYMENT_QR, outletForQr)}
          hint={outletForQr ? 'Used instead of the cafe-wide QR on this branch\'s bills.' : undefined}
          onChanged={() => qc.invalidateQueries({ queryKey: brandingKey })} />
      </div>
    </div>
  );
}

function ImageSlot({ kind, title, outletId, present, hint, onChanged }: { kind: ImageKind; title: string; outletId: number | null; present: boolean; hint?: string; onChanged: () => unknown }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true; let url: string | null = null;
    void imageUrl(kind, outletId).then((u) => { url = u; if (live) setPreview(u); else if (u) URL.revokeObjectURL(u); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [kind, outletId, version, present]);

  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(kind, file, outletId),
    onSuccess: async () => { showToast(`${title} updated.`, 'success'); setVersion((v) => v + 1); await onChanged(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: () => removeImage(kind, outletId),
    onSuccess: async () => { showToast(`${title} removed.`, 'success'); setVersion((v) => v + 1); await onChanged(); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const pick = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { showToast('Use a PNG or JPEG image.', 'error'); return; }
    if (file.size > MAX_BYTES) { showToast(`The image is too large (max ${Math.round(MAX_BYTES / 1000)} KB).`, 'error'); return; }
    upload.mutate(file);
  };
  return (
    <div className="rounded-lg border border-line p-3 space-y-2">
      <p className="text-sm font-medium text-fg">{title}</p>
      <div className="h-32 rounded-md bg-subtle flex items-center justify-center overflow-hidden">
        {preview ? <img src={preview} alt={title} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-faint">Not set</span>}
      </div>
      {hint && <p className="hint">{hint}</p>}
      <div className="flex gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} aria-label={`Choose ${title}`} />
        <button type="button" className="btn btn-secondary btn-sm" disabled={upload.isPending} onClick={() => input.current?.click()}><i className="fa-solid fa-upload" />{present ? 'Replace' : 'Upload'}</button>
        {present && <button type="button" className="btn btn-ghost btn-sm hover:!text-danger" disabled={remove.isPending} onClick={() => remove.mutate()}><i className="fa-solid fa-trash" />Remove</button>}
      </div>
    </div>
  );
}
