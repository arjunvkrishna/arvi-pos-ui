import { useActionState, useState } from 'react';
import { api } from '../api/client';
import { useSession } from '../api/session';
import { useUi } from '../app/ui';
import { Dialog } from '../components/Dialog';
import { Field } from '../components/ui';
import { showToast } from '../components/toast';
import { takeRememberedPassword } from './passwordMemo';

interface Result { error: string }

/** Own-password change. Forced (cannot be dismissed) after a login with a temporary password. */
export function ChangePasswordDialog() {
  const open = useUi((s) => s.changePasswordOpen);
  const forced = useUi((s) => s.changePasswordForced);
  const ui = useUi((s) => s.set);
  const user = useSession((s) => s.user);
  const patchUser = useSession((s) => s.patchUser);
  const [current, setCurrent] = useState(() => takeRememberedPassword());
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const [state, action, pending] = useActionState<Result, FormData>(async () => {
    if (next !== confirm) return { error: 'The new passwords do not match.' };
    try {
      const res = await api<{ message?: string; refreshToken?: string }>('/users/me/change-password', {
        method: 'PATCH', body: { currentPassword: current, newPassword: next },
      });
      patchUser({ mustChangePassword: false, ...(res?.refreshToken ? { refreshToken: res.refreshToken } : {}) });
      showToast(res?.message || 'Password changed successfully! Welcome to ARVI POS.', 'success');
      setCurrent(''); setNext(''); setConfirm('');
      ui({ changePasswordOpen: false, changePasswordForced: false });
      return { error: '' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to change password.' };
    }
  }, { error: '' });

  if (!user) return null;
  const close = () => { if (!forced) ui({ changePasswordOpen: false }); };

  return (
    <Dialog id="changePasswordModal" open={open} onClose={close} dismissible={!forced} size="md"
      title={forced ? 'Set your new password' : 'Change my password'}
      description={<span id="changePwdUserLabel">Signed in as <span className="font-medium text-fg">{user.username}</span></span>}>
      {forced && (
        <div id="cpForcedNotice" className="mb-4 px-3 py-2.5 rounded-lg bg-warn/10 text-warn text-sm">
          You signed in with a temporary password. Choose a new password to continue.
        </div>
      )}
      <form action={action} className="space-y-4">
        <Field id="cpCurrentPassword" label="Current password">
          <input id="cpCurrentPassword" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="input" />
        </Field>
        <Field id="cpNewPassword" label="New password">
          <input id="cpNewPassword" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="input" />
        </Field>
        <Field id="cpConfirmPassword" label="Confirm new password">
          <input id="cpConfirmPassword" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
        </Field>
        {state.error && <div id="cpError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn btn-primary w-full h-10">
          <span id="cpSubmitBtnText">{pending ? 'Saving…' : 'Update password'}</span>
        </button>
      </form>
    </Dialog>
  );
}
