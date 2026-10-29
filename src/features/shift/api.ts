import { api } from '../../api/client';

export interface Movement { movementType: 'CASH_IN' | 'CASH_OUT' | string; amount: number; reason?: string | null; createdAt?: string | null }
export interface Shift {
  id: number; registerId?: string; cashierName?: string; cashierUsername?: string; closingUserName?: string | null; status?: string; openedAt?: string | null; closedAt?: string | null;
  openingFloat?: number; cashSales?: number; cashInTotal?: number; cashOutTotal?: number; cashRefunds?: number; expectedCash?: number; countedCash?: number; variance?: number;
  upiSales?: number; cardSales?: number; notes?: string | null; movements?: Movement[];
}
export interface ShiftSettings { enabled?: boolean }

export const shiftKey = ['shift'] as const;
export const fetchSettings = () => api<ShiftSettings>('/shifts/settings');
export const setModuleEnabled = (enabled: boolean) => api<ShiftSettings>('/shifts/settings', { method: 'PUT', body: { enabled } });
export const fetchCurrent = () => api<Shift>('/shifts/current');
export const fetchHistory = () => api<Shift[]>('/shifts');
export const openShift = (registerId: string, openingFloat: number, notes: string) => api<Shift>('/shifts/open', { method: 'POST', body: { registerId, openingFloat, notes } });
export const recordMovement = (id: number, movementType: string, amount: number, reason: string) => api(`/shifts/${id}/movements`, { method: 'POST', body: { movementType, amount, reason } });
export const closeShift = (id: number, countedCash: number, notes: string) => api<Shift>(`/shifts/${id}/close`, { method: 'POST', body: { countedCash, notes } });
