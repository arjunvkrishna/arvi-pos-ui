import { api } from '../../api/client';

export interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  isActive: boolean;
}

export interface BranchStats {
  outletId: number;
  outletName: string;
  outletCode: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  isActive: boolean;
}

export interface Franchise {
  totalOutlets: number;
  totalBrandOrders: number;
  totalBrandRevenue: number;
  outlets: BranchStats[];
}

export interface BranchInput { name: string; code?: string; address?: string; phone?: string; gstNumber?: string; isActive?: boolean }

export const branchesKey = ['branches'] as const;
export const franchiseKey = ['franchise'] as const;
export const fetchBranches = () => api<Branch[]>('/outlets');
export const fetchFranchise = () => api<Franchise>('/franchise/analytics');
export const createBranch = (b: BranchInput) => api<Branch>('/outlets', { method: 'POST', body: b });
export const updateBranch = (id: number, b: BranchInput) => api<Branch>(`/outlets/${id}`, { method: 'PUT', body: b });

/** The link a customer scans for this branch's own menu (its prices and what is sold out there). */
export const branchMenuLink = (origin: string, cafeCode: string, branchCode: string) =>
  `${origin}/menu?cafe=${encodeURIComponent(cafeCode)}&branch=${encodeURIComponent(branchCode)}`;
