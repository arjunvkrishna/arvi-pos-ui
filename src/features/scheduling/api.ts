import { api } from '../../api/client';

export interface ShiftSchedule {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeRole?: string;
  startsAt: string;
  endsAt: string;
  roleNote?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdBy?: number;
  createdAt?: string;
}

export type ShiftScheduleInput = Omit<ShiftSchedule, 'id' | 'createdAt' | 'employeeName' | 'employeeRole'>;

export interface TipPoolEmployeeShare {
  id: number;
  employeeId: number;
  employeeName?: string;
  hoursWorked: number;
  tipAmount: number;
  paid: boolean;
  paidAt?: string;
}

export interface TipPoolDistribution {
  id: number;
  distributionDate: string;
  totalTips: number;
  totalHours: number;
  ratePerHour: number;
  createdBy?: number;
  createdAt?: string;
  shares: TipPoolEmployeeShare[];
}

export interface TipPoolCalculateRequest {
  distributionDate?: string;
  overrideTotalTips?: number;
  customHours?: { employeeId: number; hoursWorked: number }[];
}

export const fetchSchedules = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return api<ShiftSchedule[]>(`/shifts/schedules${q ? `?${q}` : ''}`);
};

export const createSchedule = (body: ShiftScheduleInput) =>
  api<ShiftSchedule>('/shifts/schedules', { method: 'POST', body });

export const updateSchedule = (id: number, body: Partial<ShiftScheduleInput>) =>
  api<ShiftSchedule>(`/shifts/schedules/${id}`, { method: 'PUT', body });

export const deleteSchedule = (id: number) =>
  api<void>(`/shifts/schedules/${id}`, { method: 'DELETE' });

export const fetchTipPool = (date?: string) =>
  api<TipPoolDistribution | null>(date ? `/shifts/tip-pool?date=${encodeURIComponent(date)}` : '/shifts/tip-pool');

export const calculateTipPool = (body?: TipPoolCalculateRequest) =>
  api<TipPoolDistribution>('/shifts/tip-pool/calculate', { method: 'POST', body: body ?? {} });

export const markTipSharePaid = (shareId: number) =>
  api<TipPoolEmployeeShare>(`/shifts/tip-pool/shares/${shareId}/pay`, { method: 'POST' });
