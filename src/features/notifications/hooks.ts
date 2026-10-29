import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { useEventStream } from '../../lib/useEventStream';
import { useSession } from '../../api/session';
import type { NotificationSummary } from '../../api/types';
import {
  deleteNotification, deleteReadNotifications, fetchNotifications,
  markAllNotificationsRead, markNotificationRead, notificationsKey,
} from './api';

/** Only managers and admins have notifications (the server enforces it too). */
export function useNotificationsEnabled(): boolean {
  const role = useSession((s) => s.user?.role);
  return role === 'ADMIN' || role === 'MANAGER';
}

/**
 * The bell's data, kept fresh by the live stream (plus a slow poll as a safety net).
 * Brand-new unread notifications also pop a toast, like the classic app.
 */
export function useNotifications() {
  const enabled = useNotificationsEnabled();
  const qc = useQueryClient();
  const known = useRef<Set<number> | null>(null);

  const query = useQuery({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    enabled,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });

  useEventStream({
    path: '/notifications/stream',
    event: 'notifications-changed',
    enabled,
    onSignal: () => { void qc.invalidateQueries({ queryKey: notificationsKey }); },
    onConnected: () => { void qc.invalidateQueries({ queryKey: notificationsKey }); },
  });

  const list = query.data?.notifications;
  useEffect(() => {
    if (!list) return;
    if (known.current) {
      for (const n of list) {
        if (n.status === 'UNREAD' && !known.current.has(n.id)) showToast(`🔔 ${n.title}`, 'info');
      }
    }
    known.current = new Set(list.map((n) => n.id));
  }, [list]);

  return query;
}

function useSummaryMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, update?: (s: NotificationSummary, v: TVars) => NotificationSummary) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      if (update) qc.setQueryData<NotificationSummary>(notificationsKey, (s) => (s ? update(s, vars) : s));
      void qc.invalidateQueries({ queryKey: notificationsKey });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'Something went wrong', 'error'),
  });
}

const countUnread = (list: NotificationSummary['notifications']) => list.filter((n) => n.status === 'UNREAD').length;

export const useMarkRead = () => useSummaryMutation(markNotificationRead, (s, id: number) => {
  const notifications = s.notifications.map((n) => (n.id === id ? { ...n, status: 'READ' as const } : n));
  return { ...s, notifications, unreadCount: countUnread(notifications) };
});

export const useMarkAllRead = () => useSummaryMutation(markAllNotificationsRead, (s) => ({
  ...s, unreadCount: 0, notifications: s.notifications.map((n) => ({ ...n, status: 'READ' as const })),
}));

export const useDeleteOne = () => useSummaryMutation(deleteNotification, (s, id: number) => {
  const notifications = s.notifications.filter((n) => n.id !== id);
  return { ...s, notifications, unreadCount: countUnread(notifications) };
});

export const useDeleteRead = () => useSummaryMutation<void, { deleted: number }>(deleteReadNotifications);
