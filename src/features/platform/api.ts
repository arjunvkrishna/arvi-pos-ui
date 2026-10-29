import { api } from '../../api/client';

export interface Cafe {
  id: number; name: string; code: string; status: string; subscriptionPlan: string; maxOutlets: number; maxUsers?: number;
  contactEmail?: string | null; contactPhone?: string | null; dbName?: string; schemaVersion?: string;
  outletsCount?: number; usersCount?: number; totalBillsCount?: number; totalGmv?: number; createdAt?: string;
}
export interface PlatformStats { totalCafes: number; activeCafes: number; totalOutlets: number; totalUsers: number; totalOrders: number; totalGmv: number }
export interface NewCafe {
  name: string; code: string; contactEmail?: string; contactPhone?: string; address?: string;
  subscriptionPlan: string; maxOutlets: number; adminUsername: string; adminPassword: string; adminFullName?: string;
}

export const cafesKey = ['platform', 'cafes'] as const;
export const statsKey = ['platform', 'stats'] as const;
export const fetchCafes = () => api<Cafe[]>('/super-admin/cafes');
export const fetchStats = () => api<PlatformStats>('/super-admin/analytics');
export const createCafe = (c: NewCafe) => api<Cafe>('/super-admin/cafes', { method: 'POST', body: c });
export const updateCafe = (id: number, patch: Partial<Pick<Cafe, 'status' | 'subscriptionPlan' | 'maxOutlets' | 'name'>>) =>
  api<Cafe>(`/super-admin/cafes/${id}`, { method: 'PUT', body: patch });
export const revealBridgeToken = (id: number) => api<{ tenantCode: string; bridgeToken: string }>(`/super-admin/cafes/${id}/bridge-token`);
export const rotateBridgeToken = (id: number) => api<{ tenantCode: string; bridgeToken: string }>(`/super-admin/cafes/${id}/bridge-token/rotate`, { method: 'POST' });
export const changePlatformPassword = (currentPassword: string, newPassword: string) =>
  api('/super-admin/change-password', { method: 'POST', body: { currentPassword, newPassword } });
