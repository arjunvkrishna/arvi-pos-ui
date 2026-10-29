import { api } from '../../api/client';
import { withOfflineCopy } from '../../offline/cache';

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
  active?: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  categoryId: number;
  categoryName?: string | null;
  price: number;
  description?: string | null;
  isVeg: boolean;
  isAvailable?: boolean;
  active?: boolean;
  /** `price` / `isAvailable` are what the caller's branch sells at; these are the cafe-wide values and whether the branch overrides them. */
  basePrice?: number | null;
  baseAvailable?: boolean | null;
  branchOverride?: boolean;
}

export interface DishInput {
  name: string;
  categoryId: number;
  price: number;
  description: string;
  isVeg: boolean;
  isAvailable: boolean;
  active: true;
}

export interface CategoryInput { name: string; description: string; icon: string; sortOrder: number; active: boolean }

export type ImportStatus = 'CHANGED' | 'UNCHANGED' | 'NOT_FOUND' | 'INVALID' | 'DUPLICATE';
export interface ImportRow { index: number; id?: number | null; name?: string | null; categoryName?: string | null; status: ImportStatus; oldPrice?: number; newPrice?: number; message?: string | null }
export interface ImportPreview { changed: number; unchanged: number; rows: ImportRow[] }
export interface MenuExport { format: string; itemCount: number; items: unknown[] }

export const menuVersionKey = ['menu-version'] as const;
export const fetchMenuVersion = () => api<{ version: string }>('/menu-items/version');
export const categoriesKey = ['categories'] as const;
export const menuItemsKey = ['menu-items'] as const;
export const publicMenuKey = ['public-menu'] as const;

export const fetchCategories = () => withOfflineCopy('categories', () => api<Category[]>('/categories'));
export const fetchMenuItems = () => withOfflineCopy('menu-items', () => api<MenuItem[]>('/menu-items'));
export const saveDish = (id: number | null, dish: DishInput) =>
  id ? api(`/menu-items/${id}`, { method: 'PUT', body: dish }) : api('/menu-items', { method: 'POST', body: dish });
export const deleteDish = (id: number) => api(`/menu-items/${id}`, { method: 'DELETE' });
export const toggleAvailability = (id: number) => api<MenuItem>(`/menu-items/${id}/toggle-availability`, { method: 'PATCH' });
export const saveCategory = (id: number | null, c: CategoryInput) =>
  id ? api(`/categories/${id}`, { method: 'PUT', body: c }) : api('/categories', { method: 'POST', body: c });

/** The caller's branch's own price for a dish (needs a branch selected); null clears it, falling back to the cafe-wide price. */
export const setBranchPrice = (id: number, price: number | null) => api<MenuItem>(`/menu-items/${id}/branch`, { method: 'PUT', body: { price } });
export const resetBranchSetting = (id: number) => api<MenuItem>(`/menu-items/${id}/branch`, { method: 'DELETE' });

export const exportMenu = () => api<MenuExport>('/menu-items/export');
export const previewImport = (payload: unknown) => api<ImportPreview>('/menu-items/import/preview', { method: 'POST', body: payload });
export const applyImport = (payload: unknown) => api<{ changed: number }>('/menu-items/import/apply', { method: 'POST', body: payload });

export const fetchPublicMenu = () => api<{ enabled?: boolean }>('/settings/public-menu');
export const setPublicMenu = (enabled: boolean) => api<{ enabled?: boolean; message?: string }>('/settings/public-menu', { method: 'PUT', body: { enabled } });
