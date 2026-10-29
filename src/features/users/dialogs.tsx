import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { canManageBranchSettings, canManageMenu, isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import type { RealRole } from '../../api/types';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { CheckRow, Field } from '../../components/ui';
import { createUser, resetPassword, updatePermissions, type PermissionsInput, type UserAccount } from './api';
import { useUserAction } from './hooks';
import { creatableRoles, isBranchRole, isStaffRole, PASSWORD_HINT, passwordProblem, roleName } from './rules';

const ORDERS_HINT = 'Can take table orders, send to kitchen and request the bill';
const INVENTORY_HINT = 'Can view stock and reduce / adjust product inventory';
const CANCEL_HINT = 'Can cancel an order that is not paid yet (paid bills go through refunds, which only managers do)';

interface BranchRow { id: number; name: string; isActive?: boolean }

export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const me = useSession((s) => s.user)!;
  const roles = creatableRoles(me);
  const wide = isCafeWide(me);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RealRole>(roles.includes('EMPLOYEE') ? 'EMPLOYEE' : roles[roles.length - 1]);
  const [branch, setBranch] = useState<string>(me.selectedOutletId ? String(me.selectedOutletId) : '');
  const [orders, setOrders] = useState(true);
  const [inventory, setInventory] = useState(false);
  const [cancel, setCancel] = useState(false);
  // Only owners and general managers see every branch; a branch manager adds people to their own branch (the server fixes it).
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<BranchRow[]>('/outlets'), enabled: wide, staleTime: 5 * 60_000 });
  const create = useUserAction(createUser, 'User account created successfully', 'Failed to create user');
  const needsBranch = wide && isBranchRole(role);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) { showToast(`Password: ${problem}`, 'error'); return; }
    if (needsBranch && !branch) { showToast('Choose the branch this person works in.', 'error'); return; }
    create.mutate({
      username: username.trim(), password, role,
      outletId: needsBranch ? Number(branch) : undefined,
      ...(isStaffRole(role) ? { canTakeOrders: orders, canManageInventory: inventory, canCancelOrder: cancel } : {}),
    }, { onSuccess: onClose });
  };

  return (
    <Dialog id="createUserModal" open onClose={onClose} title="Create user account" description="They sign in with this username and password (and the cafe code).">
      <form id="createUserForm" onSubmit={submit} className="space-y-4">
        <Field id="newUsername" label="Username">
          <input id="newUsername" required value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="e.g. john_doe" autoComplete="off" />
        </Field>
        <Field id="newPassword" label="Password" hint={`${PASSWORD_HINT} They must change it at their first sign-in.`}>
          <input id="newPassword" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />
        </Field>
        <Field id="newUserRole" label="Role">
          <select id="newUserRole" value={role} onChange={(e) => setRole(e.target.value as RealRole)} className="input">
            {roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
          </select>
        </Field>
        {needsBranch && (
          <Field id="newUserBranch" label="Branch" hint="The branch this person works in. They only ever see that branch.">
            <select id="newUserBranch" value={branch} onChange={(e) => setBranch(e.target.value)} className="input">
              <option value="">Choose a branch…</option>
              {(branches.data ?? []).filter((b) => b.isActive !== false).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>)}
        {isStaffRole(role) && (
          <fieldset className="rounded-lg border border-line p-3 space-y-1">
            <legend className="px-1 text-xs font-medium text-muted">Feature access</legend>
            <CheckRow id="newUserCanTakeOrders" checked={orders} onChange={setOrders} title="Table orders & POS" hint={ORDERS_HINT} />
            <CheckRow id="newUserCanManageInventory" checked={inventory} onChange={setInventory} title="Inventory management" hint={INVENTORY_HINT} />
            <CheckRow id="newUserCanCancelOrder" checked={cancel} onChange={setCancel} title="Cancel orders" hint={CANCEL_HINT} />
          </fieldset>)}
        <button type="submit" disabled={create.isPending || roles.length === 0} className="btn btn-primary w-full h-10">{create.isPending ? 'Creating…' : 'Create account'}</button>
      </form>
    </Dialog>
  );
}

export function ResetPasswordDialog({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const reset = useUserAction((p: string) => resetPassword(user.id, p), 'Password reset successfully', 'Failed to reset password', false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) { showToast(`Password: ${problem}`, 'error'); return; }
    reset.mutate(password, { onSuccess: onClose });
  };

  return (
    <Dialog id="resetPasswordModal" open onClose={onClose} size="sm" title="Reset password"
      description={<span id="resetUserLabel">Set a new password for <span className="font-medium text-fg">{user.username}</span></span>}>
      <form id="resetPasswordForm" onSubmit={submit} className="space-y-4">
        <Field id="resetNewPassword" label="New password" hint={PASSWORD_HINT}>
          <input id="resetNewPassword" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />
        </Field>
        <button type="submit" disabled={reset.isPending} className="btn btn-danger w-full h-10">{reset.isPending ? 'Saving…' : 'Reset password'}</button>
      </form>
    </Dialog>
  );
}

export function PermissionsDialog({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const me = useSession((s) => s.user)!;
  const patchUser = useSession((s) => s.patchUser);
  const staff = isStaffRole(user.role);
  const [orders, setOrders] = useState(user.canTakeOrders !== false);
  const [inventory, setInventory] = useState(user.canManageInventory === true);
  const [cancel, setCancel] = useState(user.canCancelOrder === true);
  const [printBill, setPrintBill] = useState(user.canPrintBill === true);
  const [menu, setMenu] = useState(user.canManageMenu === true);
  const [settings, setSettings] = useState(user.canManageSettings === true);
  // A right can only be handed on by someone who has it.
  const mayGiveMenu = canManageMenu(me);
  const mayGiveSettings = canManageBranchSettings(me);
  const save = useUserAction((body: PermissionsInput) => updatePermissions(user.id, body), 'User permissions updated successfully', 'Failed to update permissions');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: PermissionsInput = {
      ...(staff ? { canTakeOrders: orders, canManageInventory: inventory, canCancelOrder: cancel, canPrintBill: printBill } : {}),
      ...(mayGiveMenu ? { canManageMenu: menu } : {}),
      ...(mayGiveSettings ? { canManageSettings: settings } : {}),
    };
    save.mutate(body, {
      onSuccess: () => {
        // The caller changed their own account: the screens they may open change right away.
        if (me.username === user.username) patchUser(body);
        onClose();
      },
    });
  };

  return (
    <Dialog id="userPermissionsModal" open onClose={onClose} size="sm" title="Feature access"
      description={<span id="permModalUsername">{user.username} · {roleName(user.role)}{user.outletName ? ` · ${user.outletName}` : ''}</span>}>
      <form id="userPermissionsForm" onSubmit={submit} className="space-y-4">
        {staff && (
          <div className="rounded-lg border border-line p-3 space-y-1">
            <CheckRow id="editPermTakeOrders" checked={orders} onChange={setOrders} title="Table orders & POS" hint="View the menu, take table orders, send KOT and bill requests." />
            <CheckRow id="editPermManageInventory" checked={inventory} onChange={setInventory} title="Inventory management" hint="View raw materials and reduce / adjust product stock." />
            <CheckRow id="editPermCancelOrder" checked={cancel} onChange={setCancel} title="Cancel orders" hint={CANCEL_HINT} />
            <CheckRow id="editPermPrintBill" checked={printBill} onChange={setPrintBill} title="Print bill" hint="Show the Print bill button so this person can print the customer bill once it is requested." />
          </div>)}
        {(mayGiveMenu || mayGiveSettings) && (
          <div className="rounded-lg border border-line p-3 space-y-1">
            <p className="text-xs font-medium text-muted px-1">Handing on your own rights</p>
            {mayGiveMenu && <CheckRow id="editPermManageMenu" checked={menu} onChange={setMenu} title="Change the menu" hint="Add and edit dishes, add-ons and combos. The menu is shared by every branch." />}
            {mayGiveSettings && <CheckRow id="editPermManageSettings" checked={settings} onChange={setSettings} title="Change branch settings" hint="Printers, receipt text and the branch's payment QR." />}
          </div>)}
        {!staff && !mayGiveMenu && !mayGiveSettings && <p className="hint">This account always has the full set of day-to-day features.</p>}
        <p className="hint">Shift attendance and leave requests are always available to all staff.</p>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">Save feature access</button>
      </form>
    </Dialog>
  );
}
