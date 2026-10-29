import type { AuditLog } from './api';
import type { Tone } from '../../components/ui';

export type AuditMode = 'all' | 'bills';
export interface AuditFilters { mode: AuditMode; date: string; user: string; category: string; action: string; search: string }
export const NO_FILTERS: AuditFilters = { mode: 'all', date: '', user: 'ALL', category: 'ALL', action: 'ALL', search: '' };

export const CATEGORIES: [string, string][] = [['BILL', 'Bills & invoices'], ['INVENTORY', 'Inventory & stock'], ['SUPPLIER', 'Suppliers & payables'], ['USER', 'User accounts & auth'], ['LEAVE', 'Leave requests'],
  ['ATTENDANCE', 'Attendance'], ['SALARY', 'Payroll / salary'], ['MENU_ITEM', 'Menu items'], ['CATEGORY', 'Menu categories'], ['EXPENSE', 'Expenses'], ['SHIFT', 'Register & manager shifts']];
export const ACTIONS: [string, string][] = [['LOGIN', 'User sign in'], ['CHECK_IN', 'Shift check-in'], ['CHECK_OUT', 'Shift check-out'], ['CREATE_BILL', 'New bill'], ['EDIT_BILL', 'Edited bill'], ['CANCEL_BILL', 'Cancelled bill'],
  ['DELETE_BILL', 'Deleted bill'], ['PRINT_BILL', 'Printed bill'], ['APPLY_LEAVE', 'Leave application'], ['REVIEW_LEAVE', 'Leave reviewed'], ['STOCK_ADJUST', 'Stock adjusted'], ['OPEN_SHIFT', 'Shift started'],
  ['CLOSE_SHIFT', 'Shift ended / handover'], ['CASH_MOVEMENT', 'Drawer float / payout']];

const up = (v?: string | null) => (v || '').toUpperCase();
const isBillLog = (l: AuditLog) => up(l.entityType) === 'BILL' || up(l.action).includes('BILL');

export function filterAudit(logs: AuditLog[], f: AuditFilters): AuditLog[] {
  const q = f.search.trim().toLowerCase();
  return logs.filter((l) => {
    if (f.mode === 'bills' ? !isBillLog(l) : f.category !== 'ALL' && up(l.entityType) !== f.category) return false;
    if (f.date && !(l.performedAt || '').startsWith(f.date)) return false;
    if (f.user !== 'ALL' && (l.performedByName || '').toLowerCase() !== f.user.toLowerCase()) return false;
    if (f.action !== 'ALL' && up(l.action) !== f.action) return false;
    if (q && ![l.action, l.performedByName, l.entityType, l.oldValue, l.newValue, String(l.entityId ?? '')].some((v) => (v || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

export function auditStats(logs: AuditLog[]) {
  return {
    total: logs.length,
    billOps: logs.filter(isBillLog).length,
    billEdits: logs.filter((l) => ['EDIT_BILL', 'CANCEL_BILL', 'DELETE_BILL'].includes(up(l.action))).length,
    users: new Set(logs.map((l) => (l.performedByName || 'System').toLowerCase())).size,
  };
}

/** Everyone seen in the log, plus the standard roles, for the user filter. */
export const auditUsers = (logs: AuditLog[]) => [...new Set(['admin', 'manager', 'employee', ...logs.map((l) => (l.performedByName || '').trim()).filter(Boolean)])].sort();

export const actionBadge = (action?: string | null): { tone: Tone; icon: string } => {
  const a = up(action);
  if (a === 'CREATE_BILL' || a === 'CREATE' || a === 'CHECK_IN') return { tone: 'ok', icon: 'fa-plus' };
  if (a === 'EDIT_BILL' || a === 'UPDATE_BILL' || a === 'UPDATE') return { tone: 'warn', icon: 'fa-pen-to-square' };
  if (a === 'CANCEL_BILL') return { tone: 'danger', icon: 'fa-ban' };
  if (a === 'DELETE_BILL' || a === 'DELETE' || a === 'CHECK_OUT') return { tone: 'danger', icon: 'fa-trash-can' };
  if (a === 'PRINT_BILL') return { tone: 'info', icon: 'fa-print' };
  if (a === 'LOGIN') return { tone: 'brand', icon: 'fa-key' };
  if (a.includes('LEAVE') || a === 'MARK_ATTENDANCE') return { tone: 'info', icon: 'fa-calendar-check' };
  if (a.includes('INVENTORY') || a === 'STOCK_ADJUST') return { tone: 'info', icon: 'fa-boxes-stacked' };
  if (a.includes('SUPPLIER') || a.includes('INVOICE') || a.includes('PAYMENT')) return { tone: 'info', icon: 'fa-truck-field' };
  return { tone: 'neutral', icon: 'fa-circle' };
};

/** "Diff: -₹40.00" inside a bill edit: shown as a flag, and a reduction is marked as an anomaly. */
export function billDiff(newValue?: string | null): { text: string; negative: boolean } | null {
  const m = (newValue || '').match(/Diff:\s*([+-]?₹[0-9.]+|₹[+-]?[0-9.]+)/i);
  return m ? { text: m[1], negative: m[1].includes('-') } : null;
}
