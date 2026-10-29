import { api } from '../../api/client';
import type { RealRole } from '../../api/types';

export interface UserAccount {
  id: number;
  username: string;
  /** The exact role (OWNER is ADMIN or CAFE_ADMIN, then GENERAL_MANAGER, MANAGER, CASHIER, CAPTAIN, KITCHEN, EMPLOYEE). */
  role: RealRole;
  employeeId?: number | null;
  employeeName?: string | null;
  active: boolean;
  canTakeOrders?: boolean;
  canManageInventory?: boolean;
  canCancelOrder?: boolean;
  canPrintBill?: boolean;
  canManageMenu?: boolean;
  canManageSettings?: boolean;
  outletId?: number | null;
  outletName?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string | null;
  locked?: boolean;
  lockedUntil?: string | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: RealRole;
  /** The branch of a manager or staff member. Owners and general managers run every branch and have none. */
  outletId?: number | null;
  canTakeOrders?: boolean;
  canManageInventory?: boolean;
  canCancelOrder?: boolean;
}

export interface PermissionsInput {
  canTakeOrders?: boolean;
  canManageInventory?: boolean;
  canCancelOrder?: boolean;
  canPrintBill?: boolean;
  /** Handing on the right to change the shared menu / the branch's settings: only someone who holds it can. */
  canManageMenu?: boolean;
  canManageSettings?: boolean;
}

export const usersKey = ['users'] as const;

export const fetchUsers = () => api<UserAccount[]>('/users');
export const createUser = (input: CreateUserInput) => api('/users', { method: 'POST', body: input });
export const resetPassword = (id: number, newPassword: string) =>
  api(`/users/${id}/reset-password`, { method: 'PATCH', body: { newPassword } });
export const updatePermissions = (id: number, input: PermissionsInput) => api(`/users/${id}/permissions`, { method: 'PATCH', body: input });
export const toggleActive = (id: number) => api(`/users/${id}/toggle-active`, { method: 'PATCH' });
export const unlockUser = (id: number) => api(`/users/${id}/unlock`, { method: 'POST' });
export const deleteUser = (id: number) => api(`/users/${id}`, { method: 'DELETE' });
