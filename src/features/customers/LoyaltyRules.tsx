import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/ui';
import { showToast } from '../../components/toast';
import { fetchLoyaltySettings, loyaltySettingsKey, saveLoyaltySettings, type LoyaltySettings } from './api';
import { DEFAULT_MIN_REDEEM } from './loyalty';

/** The points settings the payment dialog and the server use. Falls back to the standard rules until they load. */
export function useLoyaltySettings(enabled = true) {
  const q = useQuery({ queryKey: loyaltySettingsKey, queryFn: fetchLoyaltySettings, staleTime: 60_000, enabled });
  const minRedeem = q.data?.minRedeemPoints ?? DEFAULT_MIN_REDEEM;
  return { settings: q.data, minRedeem, expiryDays: q.data?.expiryDays };
}

/** One line that says how points work. The admin can change how long they last and the least to redeem; everyone else only reads. */
export function LoyaltyRulesBar() {
  const isAdmin = useSession((s) => s.user?.role === 'ADMIN');
  const { settings } = useLoyaltySettings();
  const [open, setOpen] = useState(false);
  if (!settings) return null;
  return (
    <div id="loyaltyRulesBar" className="card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-sm text-fg space-y-0.5">
        <p className="font-semibold"><i className="fa-solid fa-star text-amber-500 mr-1.5" />Loyalty points</p>
        <p id="loyaltyRulesText" className="text-muted text-xs leading-relaxed">
          ₹{settings.rupeesPerPointEarned} spent = 1 point, and 1 point = ₹{settings.rupeesPerPointRedeemed}. Points are added only when the customer gives a phone number.
          Redeem from {settings.minRedeemPoints} points. Points expire after {settings.expiryDays} days without a purchase, and every purchase starts the count again.
        </p>
      </div>
      {isAdmin ? (
        <button type="button" id="btnEditLoyaltyRules" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm shrink-0">
          <i className="fa-solid fa-sliders" />Change rules
        </button>
      ) : (
        <span id="loyaltyRulesReadOnly" className="text-xs text-muted shrink-0">Only the admin can change these.</span>
      )}
      {open && <LoyaltyRulesDialog settings={settings} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LoyaltyRulesDialog({ settings, onClose }: { settings: LoyaltySettings; onClose: () => void }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(String(settings.expiryDays));
  const [min, setMin] = useState(String(settings.minRedeemPoints));
  const save = useMutation({
    mutationFn: saveLoyaltySettings,
    onSuccess: (s) => {
      qc.setQueryData(loyaltySettingsKey, s);
      showToast('Loyalty rules saved.', 'success');
      onClose();
    },
    onError: (e) => showToast((e as Error).message || 'Could not save the loyalty rules.', 'error'),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const expiryDays = Number(days);
    const minRedeemPoints = Number(min);
    if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 3650) return showToast('Points can last between 1 and 3650 days.', 'warning');
    if (!Number.isInteger(minRedeemPoints) || minRedeemPoints < 1) return showToast('Enter the least number of points that can be redeemed.', 'warning');
    save.mutate({ expiryDays, minRedeemPoints });
  };
  return (
    <Dialog id="loyaltyRulesModal" open onClose={onClose} size="sm" title="Loyalty rules" description="Applies to every customer from now on.">
      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field id="loyaltyExpiryDays" label="Points expire after (days without a purchase)">
          <input id="loyaltyExpiryDays" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} className="input" required />
        </Field>
        <Field id="loyaltyMinRedeem" label="Least points to redeem">
          <input id="loyaltyMinRedeem" type="number" min={1} value={min} onChange={(e) => setMin(e.target.value)} className="input" required />
        </Field>
        <p className="text-xs text-muted">
          A customer who has not bought for this many days loses all their points. Every purchase starts the count again from that day.
          Points already held keep the date they have; it moves on their next purchase.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" id="btnSaveLoyaltyRules" disabled={save.isPending} className="btn btn-primary">{save.isPending ? 'Saving…' : 'Save rules'}</button>
        </div>
      </form>
    </Dialog>
  );
}
