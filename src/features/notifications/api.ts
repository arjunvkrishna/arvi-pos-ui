import { api } from '../../api/client';
import type { NotificationSummary } from '../../api/types';

export const notificationsKey = ['notifications'] as const;

export const fetchNotifications = () => api<NotificationSummary>('/notifications');
export const markNotificationRead = (id: number) => api(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () => api('/notifications/mark-all-read', { method: 'POST' });
export const deleteNotification = (id: number) => api(`/notifications/${id}`, { method: 'DELETE' });
export const deleteReadNotifications = () => api<{ deleted: number }>('/notifications/read', { method: 'DELETE' });
