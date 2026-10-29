import { api } from '../../api/client';

export interface TgSettings { enabled: boolean; dailySendTime?: string; timezone?: string; botConfigured?: boolean; botUsername?: string | null; lastRunDate?: string | null; verifiedRecipientsCount?: number }
export interface TgRecipient { userId: number; username: string; employeeName?: string | null; selected: boolean; status: 'VERIFIED' | 'PENDING_VERIFICATION' | string; telegramUsername?: string | null; telegramChatId?: string | null; telegramChatIdMasked?: string | null; verifiedAt?: string | null; lastTestSentAt?: string | null }
export interface TgPreview { itemCount: number; items?: unknown[]; formattedReport?: string }
export interface TgHistory { sentAt?: string | null; reportDate?: string; managerName?: string | null; chatIdMasked?: string | null; deliveryType: string; status: string; itemsCount?: number; errorDescription?: string | null }
export interface TgLink { managerName: string; username: string; linkCode: string; botUsername?: string | null; deepLink?: string | null }

export const tgKey = ['telegram'] as const;
export const fetchSettings = () => api<TgSettings>('/admin/telegram/settings');
export const fetchRecipients = () => api<TgRecipient[]>('/admin/telegram/recipients');
export const fetchPreview = () => api<TgPreview>('/admin/telegram/preview').catch(() => ({ itemCount: 0, items: [] }) as TgPreview);
export const fetchHistory = () => api<TgHistory[]>('/admin/telegram/history').catch(() => [] as TgHistory[]);
export const saveSettings = (enabled: boolean, dailySendTime: string) => api<TgSettings>('/admin/telegram/settings', { method: 'PUT', body: { enabled, dailySendTime, timezone: 'Asia/Kolkata' } });
export const toggleRecipient = (userId: number, selected: boolean) => api(`/admin/telegram/recipients/${userId}/toggle`, { method: 'PUT', body: { selected } });
export const linkCode = (userId: number) => api<TgLink>(`/admin/telegram/recipients/${userId}/link-code`, { method: 'POST' });
export const setChatId = (userId: number, chatId: string) => api(`/admin/telegram/recipients/${userId}/chat-id`, { method: 'PUT', body: { chatId } });
export const unlink = (userId: number) => api(`/admin/telegram/recipients/${userId}/unlink`, { method: 'DELETE' });
export const sendTest = (userId: number) => api<{ message?: string }>(`/admin/telegram/recipients/${userId}/test`, { method: 'POST' });
export const sendNow = () => api<{ sentCount: number; failedCount: number }>('/admin/telegram/send-now', { method: 'POST' });
