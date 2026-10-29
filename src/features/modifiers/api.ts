import { api } from '../../api/client';

/** These types mirror ModifierGroupDTO / ComboGroupDTO on the server (field names included). */
export interface Modifier {
  id?: number;
  groupId?: number;
  name: string;
  priceAdjustment: number;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  inventoryItemId?: number | null;
  inventoryQuantity?: number | null;
}

export interface ModifierGroup {
  id?: number;
  name: string;
  description?: string | null;
  /** 0 = optional; 1 or more = the cashier must pick at least that many. */
  minSelections: number;
  /** 0 = no limit. */
  maxSelections: number;
  isActive?: boolean;
  modifiers: Modifier[];
}

export interface ComboItem {
  id?: number;
  menuItemId: number;
  menuItemName?: string;
  additionalPrice: number;
}

export interface ComboGroup {
  id?: number;
  comboMenuItemId: number;
  name: string;
  minChoices: number;
  maxChoices: number;
  sortOrder?: number;
  items: ComboItem[];
}

export const modifierGroupsKey = ['modifier-groups'] as const;
export const menuItemModifiersKey = (menuItemId: number) => ['menu-items', menuItemId, 'modifiers'] as const;
export const menuItemCombosKey = (menuItemId: number) => ['menu-items', menuItemId, 'combos'] as const;

export const fetchModifierGroups = () => api<ModifierGroup[]>('/modifier-groups');

export const createModifierGroup = (dto: ModifierGroup) =>
  api<ModifierGroup>('/modifier-groups', { method: 'POST', body: dto });

export const updateModifierGroup = (id: number, dto: ModifierGroup) =>
  api<ModifierGroup>(`/modifier-groups/${id}`, { method: 'PUT', body: dto });

export const deleteModifierGroup = (id: number) =>
  api(`/modifier-groups/${id}`, { method: 'DELETE' });

export const fetchModifiersForMenuItem = (menuItemId: number) =>
  api<ModifierGroup[]>(`/menu/${menuItemId}/modifier-groups`);

/** Replaces the dish's modifier groups with exactly these ones. */
export const setModifierGroupsForMenuItem = (menuItemId: number, groupIds: number[]) =>
  api(`/menu/${menuItemId}/modifier-groups`, { method: 'PUT', body: groupIds });

export const fetchCombosForMenuItem = (menuItemId: number) =>
  api<ComboGroup[]>(`/menu/${menuItemId}/combos`);

export const saveComboGroup = (dto: ComboGroup) =>
  api<ComboGroup>('/combo-groups', { method: 'POST', body: dto });

export const deleteComboGroup = (id: number) =>
  api(`/combo-groups/${id}`, { method: 'DELETE' });
