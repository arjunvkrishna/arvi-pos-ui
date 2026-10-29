import { useNavigate } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/ui';
import { showToast } from '../../components/toast';
import { useUi } from '../../app/ui';
import { formatISTDateTime } from '../../lib/time';
import type { SystemNotification } from '../../api/types';
import { useDeleteOne, useDeleteRead, useMarkAllRead, useMarkRead, useNotifications } from './hooks';

interface Style { icon: string; tone: string; navLabel: string }

/** Icon, colour and the "go to" button for each notification type (same as the classic app). */
function styleOf(n: SystemNotification): Style {
  switch (n.type) {
    case 'LOW_STOCK': return { icon: 'fa-boxes-stacked', tone: 'bg-danger/10 text-danger', navLabel: 'Go to Inventory' };
    case 'PRINTER_ALERT': return { icon: 'fa-print', tone: 'bg-warn/10 text-warn', navLabel: 'Open Printer Settings' };
    case 'PRINT_JOB_FAILED': return { icon: 'fa-triangle-exclamation', tone: 'bg-danger/10 text-danger', navLabel: 'Go to Bill Log' };
    case 'SECURITY_ALERT': return { icon: 'fa-user-lock', tone: 'bg-danger/10 text-danger', navLabel: 'Go to User Accounts' };
    default: return { icon: 'fa-calendar-check', tone: 'bg-info/10 text-info', navLabel: 'Go to Leaves' };
  }
}

const TARGET: Record<SystemNotification['type'], string | null> = {
  LOW_STOCK: '/inventory', LEAVE_REQUEST: '/attendance', GENERAL: '/attendance',
  PRINTER_ALERT: null,                       // opens the printer settings dialog instead
  PRINT_JOB_FAILED: '/bills', SECURITY_ALERT: '/users',
};

export function NotificationsDialog() {
  const open = useUi((s) => s.notificationsOpen);
  const set = useUi((s) => s.set);
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const deleteOne = useDeleteOne();
  const deleteRead = useDeleteRead();

  const list = data?.notifications ?? [];
  const hasRead = list.some((n) => n.status !== 'UNREAD');
  const close = () => set({ notificationsOpen: false });

  const goTo = (n: SystemNotification) => {
    const target = TARGET[n.type];
    close();
    if (target) navigate(target);
    else set({ printerSettingsOpen: true });
  };

  const onDeleteRead = () => {
    if (!window.confirm('Delete all notifications that are marked as read? Unread notifications are kept. This only clears them from your own list; other managers still have theirs.')) return;
    deleteRead.mutate(undefined, {
      onSuccess: (res) => {
        const n = res?.deleted ?? 0;
        showToast(n > 0 ? `Cleared ${n} read notification${n === 1 ? '' : 's'} from your list` : 'No read notifications to delete', 'success');
      },
    });
  };

  return (
    <Dialog id="notificationsModal" open={open} onClose={close} size="lg" title="Notifications & alerts"
      description="Low stock, leave requests, printer and security alerts. Reading or clearing is only for you; other managers keep their own list.">
      <div className="flex items-center justify-between gap-2 pb-3">
        <button type="button" onClick={() => markAll.mutate(undefined)} className="btn btn-secondary btn-sm">
          <i className="fa-solid fa-check-double" />Mark all read
        </button>
        <button type="button" id="btnDeleteReadNotifications" data-testid="notifications-delete-read" disabled={!hasRead || deleteRead.isPending} onClick={onDeleteRead}
          className="btn btn-soft-danger btn-sm">
          <i className="fa-solid fa-trash-can" />Delete read
        </button>
      </div>

      <div id="notificationsModalList" data-testid="notifications-list" className="space-y-2">
        {list.length === 0 ? (
          <EmptyState icon="fa-bell-slash" title="All clear" hint="No pending notifications right now." />
        ) : (
          list.map((n) => {
            const st = styleOf(n);
            const unread = n.status === 'UNREAD';
            return (
              <div key={n.id} className={`rounded-xl border p-3 ${unread ? 'border-brand/50 bg-brand/5' : 'border-line opacity-75'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm ${st.tone}`}><i className={`fa-solid ${st.icon}`} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg flex items-center gap-1.5">
                      <span>{n.title}</span>
                      {unread && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-label="Unread" />}
                    </p>
                    <p className="text-sm text-muted mt-0.5">{n.message}</p>
                    <p className="text-xs text-faint mt-1">{n.createdBy || 'Staff'} · {formatISTDateTime(n.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => goTo(n)} className="btn btn-secondary btn-sm flex-1">{st.navLabel}</button>
                  {unread && (
                    <button type="button" onClick={() => markRead.mutate(n.id)} className="btn btn-soft-brand btn-sm"><i className="fa-solid fa-check" />Mark read</button>
                  )}
                  <button type="button" onClick={() => deleteOne.mutate(n.id)} title="Clear this from your list (other managers keep it)" aria-label="Delete this notification" className="btn btn-soft-danger btn-icon btn-sm">
                    <i className="fa-solid fa-trash-can text-xs" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Dialog>
  );
}
