import { api, apiBlob } from '../../api/client';

export interface Movement { createdAt?: string; movementType: string; transferType?: string; amount: number; destinationAccount?: string; referenceNumber?: string; reason?: string; userName?: string }
export interface ShiftRow {
  id: number; status: 'OPEN' | 'CLOSED' | string; cashierId?: number; cashierName?: string; registerId?: string; previousShiftId?: number | null; carryForwardRef?: string | null;
  openedAt?: string | null; closedAt?: string | null; openingFloat?: number; cashSales?: number; cashInTotal?: number; cashRefunds?: number; cashOutTotal?: number;
  transfersOutTotal?: number; transfersInTotal?: number; expectedCash?: number; countedCash?: number; variance?: number; isCorrected?: boolean; correctedCountedCash?: number;
  correctedVariance?: number; correctedAt?: string | null; correctionReason?: string | null; upiSales?: number; cardSales?: number; totalSales?: number; notes?: string | null; movements?: Movement[];
}
export interface AnomalyFlag { severity: string; flagType: string; description: string }
export interface ShiftItem { shift: ShiftRow; anomalyFlags?: AnomalyFlag[]; durationMinutes?: number }
export interface Daily { date: string; shiftCount: number; openingTotal?: number; cashSales?: number; upiSales?: number; cardSales?: number; cashRefunds?: number; cashIn?: number; cashOut?: number; transfersOut?: number; transfersIn?: number; expectedTotal?: number; countedTotal?: number; netVariance?: number; shortageCount: number; surplusCount: number }
export interface Monthly { monthYear: string; shiftCount: number; openingTotal?: number; cashSales?: number; expectedTotal?: number; countedTotal?: number; netVariance?: number; shortageCount?: number; surplusCount?: number }
export interface Analysis {
  startDate?: string; endDate?: string; shifts?: ShiftItem[]; dailySummaries?: Daily[]; monthlySummaries?: Monthly[];
  summary?: Record<string, number | undefined> & { distinctions?: Record<string, number | undefined> };
}
export interface DrawerQuery { period: string; start: string; end: string; cashierId: string; registerId: string; status: string }
export interface AnomalySettings { varianceThreshold?: number; largeMovementThreshold?: number; flagMissingCount?: boolean; flagTransfersWithoutRef?: boolean }

const qs = (q: DrawerQuery) => {
  const p = new URLSearchParams();
  if (q.period) p.append('period', q.period);
  if (q.period === 'CUSTOM' && q.start) p.append('startDate', q.start);
  if (q.period === 'CUSTOM' && q.end) p.append('endDate', q.end);
  if (q.cashierId) p.append('cashierId', q.cashierId);
  if (q.registerId) p.append('registerId', q.registerId);
  if (q.status && q.status !== 'ALL') p.append('status', q.status);
  return p.toString();
};
export const fetchAnalysis = (q: DrawerQuery) => api<Analysis>(`/shifts/analysis?${qs(q)}`);
export const exportCsv = (q: DrawerQuery) => apiBlob(`/shifts/analysis/export/csv?${qs(q)}`);
export const recordTransfer = (shiftId: number, b: { amount: number; transferType: string; destinationAccount: string; referenceNumber: string; reason: string; approvedBy: string }) => api(`/shifts/${shiftId}/transfers`, { method: 'POST', body: b });
export const correctVariance = (shiftId: number, countedCash: number, reason: string) => api<ShiftRow>(`/shifts/${shiftId}/correct-variance`, { method: 'POST', body: { countedCash, reason } });
export const fetchAnomalySettings = () => api<AnomalySettings>('/shifts/settings');
export const saveAnomalySettings = (s: Required<AnomalySettings>) => api('/shifts/settings', { method: 'PUT', body: s });
