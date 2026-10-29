import type { Session } from '../api/types';
import { canManageBranchSettings, canManageMenu, isCafeWide, isManagement, isOwner } from '../api/roles';

export const TAB_IDS = ['pos', 'kds', 'bills', 'customers', 'owner-dashboard', 'scheduling', 'documents', 'menu', 'inventory', 'staff', 'expenses', 'analytics', 'attendance', 'audit', 'telegram', 'users', 'suppliers', 'gst', 'stocklinks', 'outlets', 'settings', 'cafes'] as const;
export type TabId = (typeof TAB_IDS)[number];

export interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  /** Short label used by the phone bottom bar. */
  short: string;
  visible: (u: Session) => boolean;
}

// Every rule below mirrors the server's rule for that screen's data, so no tab leads to a page the server will refuse.
const cafeScreen = (rule: (u: Session) => boolean) => (u: Session) => !u.platform && rule(u);
const management = cafeScreen(isManagement);
export const canTakeOrders = (u: Session) => isManagement(u) || u.canTakeOrders !== false;
export const canManageInventory = (u: Session) => isManagement(u) || u.canManageInventory === true;
export const canPrintBill = (u: Session) => isManagement(u) || u.canPrintBill === true;
/** Kitchen staff see the kitchen display even without an order-taking right. */
const seesKitchen = (u: Session) => isManagement(u) || u.realRole === 'KITCHEN' || canTakeOrders(u);

/** The screens of the app. Platform owners (the SaaS operator) see only "Cafes"; cafe people never see it. */
export const TABS: TabDef[] = [
  { id: 'pos', label: 'Table Orders & POS', icon: 'fa-cash-register', short: 'POS', visible: cafeScreen(canTakeOrders) },
  { id: 'kds', label: 'Kitchen Display', icon: 'fa-kitchen-set', short: 'Kitchen', visible: cafeScreen(seesKitchen) },
  { id: 'bills', label: 'Bill Log & Printing', icon: 'fa-file-invoice-dollar', short: 'Bills', visible: management },
  { id: 'customers', label: 'Customers & CRM', icon: 'fa-user-group', short: 'CRM', visible: management },
  { id: 'owner-dashboard', label: 'Owner Dashboard', icon: 'fa-gauge-high', short: 'Owner', visible: management },
  { id: 'scheduling', label: 'Shift Scheduling & Tips', icon: 'fa-calendar-days', short: 'Shifts', visible: management },
  { id: 'documents', label: 'Documents & SOPs', icon: 'fa-folder-open', short: 'Docs', visible: management },
  { id: 'menu', label: 'Menu & Pricing', icon: 'fa-utensils', short: 'Menu', visible: management },
  { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked', short: 'Stock', visible: cafeScreen(canManageInventory) },
  { id: 'staff', label: 'Staff & Payroll', icon: 'fa-users-gear', short: 'Staff', visible: management },
  { id: 'expenses', label: 'Cafe Expenses & EMI', icon: 'fa-receipt', short: 'Cafe', visible: management },
  { id: 'analytics', label: 'Analytics', icon: 'fa-chart-pie', short: 'Analytics', visible: management },
  { id: 'attendance', label: 'Attendance & Leaves', icon: 'fa-calendar-check', short: 'Leaves', visible: cafeScreen(() => true) },
  { id: 'audit', label: 'Audit Log', icon: 'fa-shield-halved', short: 'Audit', visible: cafeScreen(isOwner) },
  { id: 'telegram', label: 'Telegram Alerts', icon: 'fa-paper-plane', short: 'Telegram', visible: cafeScreen(isCafeWide) },
  { id: 'users', label: 'User Accounts', icon: 'fa-id-badge', short: 'User', visible: management },
  { id: 'suppliers', label: 'Suppliers', icon: 'fa-truck', short: 'Suppliers', visible: management },
  { id: 'gst', label: 'GST Management', icon: 'fa-percent', short: 'GST', visible: cafeScreen(isCafeWide) },
  // Recipes are shared by every branch and change what stock a sale uses, so editing them needs the menu right.
  { id: 'stocklinks', label: 'Stock Links', icon: 'fa-diagram-project', short: 'Links', visible: cafeScreen((u) => isManagement(u) && canManageMenu(u)) },
  { id: 'outlets', label: 'Branches', icon: 'fa-store', short: 'Branches', visible: cafeScreen(isCafeWide) },
  { id: 'settings', label: 'Cafe & Branding', icon: 'fa-palette', short: 'Brand', visible: cafeScreen((u) => isManagement(u) || canManageBranchSettings(u)) },
  { id: 'cafes', label: 'Cafes (Platform)', icon: 'fa-building', short: 'Cafes', visible: (u) => u.platform === true },
];

export const isTabId = (v: string): v is TabId => (TAB_IDS as readonly string[]).includes(v);

/** "#menu" or "#tab-menu" -> "menu"; anything else -> null. Old bookmarks and links use this form. */
export function tabFromHash(hash: string): TabId | null {
  const raw = hash.replace(/^#/, '').replace(/^tab-/, '');
  return isTabId(raw) ? raw : null;
}

export function visibleTabs(u: Session): TabDef[] {
  return TABS.filter((t) => t.visible(u));
}

export function canOpenTab(u: Session, id: string): boolean {
  return isTabId(id) && TABS.find((t) => t.id === id)!.visible(u);
}

/** Landing screen: managers/admins -> Analytics; staff -> POS, else Inventory, else Attendance (as in the classic app). */
export function defaultTab(u: Session): TabId {
  if (u.platform) return 'cafes';
  if (isManagement(u)) return 'analytics';
  if (u.realRole === 'KITCHEN' && u.canTakeOrders !== true) return 'kds';
  if (u.canTakeOrders !== false) return 'pos';
  if (u.canManageInventory === true) return 'inventory';
  return 'attendance';
}

/** Phone bottom bar: the primary screens the user may open (first five), falling back to whatever they can open. */
export function bottomBarTabs(u: Session): TabDef[] {
  const primary: TabId[] = ['pos', 'kds', 'bills', 'menu', 'inventory', 'attendance', 'staff', 'cafes'];
  const all = visibleTabs(u);
  const picked = all.filter((t) => primary.includes(t.id));
  return (picked.length ? picked : all).slice(0, 5);
}
