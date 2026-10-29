import { useUi } from '../../app/ui';
import { useBump } from '../../components/useBump';
import { useNotifications, useNotificationsEnabled } from './hooks';

/** The bell in the header (managers and admins only), with the unread badge. */
export function Bell() {
  const enabled = useNotificationsEnabled();
  const open = useUi((s) => s.set);
  const { data } = useNotifications();
  const unread = data?.unreadCount ?? 0;
  const badgeRef = useBump<HTMLSpanElement>(unread);
  if (!enabled) return null;
  return (
    <button id="headerNotificationsBtn" data-testid="bell" type="button" onClick={() => open({ notificationsOpen: true })} title="Alerts & Notifications" aria-label="Alerts and notifications"
      className="btn btn-ghost btn-icon relative">
      <i className="fa-solid fa-bell" />
      {unread > 0 && (
        <span id="headerNotificationBadge" data-testid="bell-badge" ref={badgeRef}
          className="absolute top-0.5 right-0.5 px-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold bg-danger text-white flex items-center justify-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
