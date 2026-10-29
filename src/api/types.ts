/**
 * The three tiers the server's rules are written in (hasRole ADMIN / MANAGER / EMPLOYEE): owners are ADMIN; general managers and
 * branch managers are MANAGER; cashiers, captains, kitchen and other staff are EMPLOYEE. `realRole` keeps the exact role.
 */
export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type RealRole = 'SUPER_ADMIN' | 'ADMIN' | 'CAFE_ADMIN' | 'GENERAL_MANAGER' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN' | 'EMPLOYEE';

/** The login response as the server sends it, with the role mapped to a tier (see api/roles.ts), stored as-is under `arvi_user`. */
export interface Session {
  token: string;
  refreshToken?: string;
  username: string;
  role: Role;
  realRole: RealRole;
  /** The SaaS owner: signed in without a cafe, sees only the platform screens. */
  platform?: boolean;
  employeeId?: number | null;
  employeeName?: string | null;
  canTakeOrders?: boolean;
  canManageInventory?: boolean;
  canPrintBill?: boolean;
  canCancelOrder?: boolean;
  canManageMenu?: boolean;
  canManageSettings?: boolean;
  mustChangePassword?: boolean;
  tenantId?: number | null;
  tenantName?: string | null;
  tenantCode?: string | null;
  logoUrl?: string | null;
  /** The branch the person works in (null for owners and general managers, who run every branch). */
  outletId?: number | null;
  outletName?: string | null;
  outletCode?: string | null;
  /** A branch an owner or general manager picked to work in; sent as X-Outlet-Id. Null = the whole cafe. */
  selectedOutletId?: number | null;
  message?: string;
}

export type NotificationType = 'LOW_STOCK' | 'LEAVE_REQUEST' | 'GENERAL' | 'PRINTER_ALERT' | 'PRINT_JOB_FAILED' | 'SECURITY_ALERT';

export interface SystemNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: number | null;
  createdBy?: string | null;
  status: 'UNREAD' | 'READ';
  createdAt: string;
}

export interface NotificationSummary {
  unreadCount: number;
  pendingLeavesCount: number;
  lowStockAlertsCount: number;
  notifications: SystemNotification[];
}
