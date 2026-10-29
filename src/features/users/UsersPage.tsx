import { useEffect, useState } from 'react';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui';
import { deleteUser, toggleActive, unlockUser, type UserAccount } from './api';
import { CreateUserDialog, PermissionsDialog, ResetPasswordDialog } from './dialogs';
import { useUserAction, useUsers } from './hooks';
import { canDeleteAccount, canManageAccount, hasCancel, hasInventory, hasOrders, isStaffRole, roleName, subtitleFor } from './rules';

const ROLE_TONE = { SUPER_ADMIN: 'brand', ADMIN: 'brand', CAFE_ADMIN: 'brand', GENERAL_MANAGER: 'info', MANAGER: 'info', CASHIER: 'ok', CAPTAIN: 'ok', KITCHEN: 'warn', EMPLOYEE: 'ok' } as const;

const lockedTitle = (u: UserAccount) => {
  const until = u.lockedUntil ? new Date(u.lockedUntil).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  return `Locked after repeated failed logins until ${until}`;
};

type Modal = { kind: 'create' } | { kind: 'reset' | 'access'; user: UserAccount } | null;

export function UsersPage() {
  const me = useSession((s) => s.user)!;
  const { data: users, isError, error, isPending } = useUsers();
  const [modal, setModal] = useState<Modal>(null);
  const unlock = useUserAction(unlockUser, 'Account unlocked', 'Failed to unlock');
  const toggle = useUserAction(toggleActive, 'User status updated', 'Failed to toggle user status');
  const remove = useUserAction(deleteUser, 'User deleted', 'Failed to delete user');
  const close = () => setModal(null);

  const onDelete = (u: UserAccount) => {
    if (!window.confirm('Permanently delete this user account? This cannot be undone.')) return;
    remove.mutate(u.id);
  };

  const loadError = isError ? error.message : '';
  useEffect(() => { if (loadError) showToast(`Failed to load users: ${loadError}`, 'error'); }, [loadError]);

  return (
    <section id="tab-users" data-testid="tab-users" className="space-y-5">
      <PageHeader title="User accounts" id="userMgmtSubtitle" description={subtitleFor(me)}
        actions={<button type="button" onClick={() => setModal({ kind: 'create' })} className="btn btn-primary"><i className="fa-solid fa-plus" />Create user account</button>} />

      <div className="card overflow-hidden">
        {isPending ? <Skeleton /> : users?.length === 0 ? <EmptyState icon="fa-users" title="No users found" /> : (
          <table className="rtable">
            <thead>
              <tr><th>Username</th><th>Linked employee</th><th>Role</th><th>Branch</th><th>Feature access</th><th>Status</th><th>Created</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody id="usersTableBody">
              {users?.map((u) => {
                const manage = canManageAccount(me, u);
                return (
                  <tr key={u.id}>
                    <td data-label="" className="cell-title font-medium text-fg">{u.username}</td>
                    <td data-label="Employee" className="text-muted">{u.employeeName || '—'}</td>
                    <td data-label="Role"><Badge tone={ROLE_TONE[u.role]}>{roleName(u.role)}</Badge></td>
                    <td data-label="Branch" className="text-muted">{isStaffRole(u.role) || u.role === 'MANAGER' ? (u.outletName || '—') : 'All branches'}</td>
                    <td data-label="Access">
                      <span className="flex flex-wrap gap-1">
                        {hasOrders(u) ? <Badge tone="info" icon="fa-utensils" title="Can take table orders & send KOT/Bill">Orders</Badge> : <Badge>No Orders</Badge>}
                        {hasInventory(u) ? <Badge tone="warn" icon="fa-boxes-stacked" title="Can manage raw materials and reduce product stock">Inventory</Badge> : <Badge>No Inv</Badge>}
                        {hasCancel(u) ? <Badge tone="danger" icon="fa-ban" title="Can cancel orders that are not paid yet">Cancel</Badge> : <Badge>No Cancel</Badge>}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={u.active ? 'ok' : 'neutral'}>{u.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                        {u.locked && <Badge tone="danger" icon="fa-lock" title={lockedTitle(u)}>LOCKED</Badge>}
                      </span>
                    </td>
                    <td data-label="Created" className="text-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="cell-actions">
                      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full md:w-auto">
                        {u.locked && manage && (
                          <button type="button" onClick={() => unlock.mutate(u.id)} className="btn btn-soft-danger btn-sm" title="Remove the login lock so this user can sign in now">
                            <i className="fa-solid fa-lock-open" />Unlock
                          </button>
                        )}
                        {manage && (
                          <>
                            <button type="button" onClick={() => setModal({ kind: 'access', user: u })} className="btn btn-secondary btn-sm" title="Grant or remove feature access">
                              <i className="fa-solid fa-user-gear" />Access
                            </button>
                            <button type="button" onClick={() => setModal({ kind: 'reset', user: u })} className="btn btn-secondary btn-sm" title="Reset Password">
                              <i className="fa-solid fa-key" />Reset Pwd
                            </button>
                            <button type="button" onClick={() => toggle.mutate(u.id)} className={`btn btn-sm ${u.active ? 'btn-soft-danger' : 'btn-soft-ok'}`}
                              title={u.active ? 'Deactivate this account' : 'Activate this account'}>
                              {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                        {canDeleteAccount(me, u) && (
                          <button type="button" onClick={() => onDelete(u)} className="btn btn-ghost btn-icon btn-sm hover:!text-danger" title="Delete User" aria-label={`Delete ${u.username}`}>
                            <i className="fa-regular fa-trash-can" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal?.kind === 'create' && <CreateUserDialog onClose={close} />}
      {modal?.kind === 'reset' && <ResetPasswordDialog user={modal.user} onClose={close} />}
      {modal?.kind === 'access' && <PermissionsDialog user={modal.user} onClose={close} />}
    </section>
  );
}
