export { passwordProblem } from '../../lib/password';

/** A cafe code: 3 to 30 characters, lower-case letters, digits and dashes, not starting or ending with a dash (it is part of every sign-in link). */
export const CAFE_CODE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** A code suggested from the cafe's name: "Blue Door Café" -> "blue-door-cafe". */
export function suggestCode(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '');
}

import { limitText, UNLIMITED } from '../../api/roles';
import type { FeatureId, PlanName } from '../../api/types';

export const PLANS = ['STARTER', 'PRO', 'ENTERPRISE'] as const;

/** What each plan allows by default. Mirrors the server's Plan; the server is what enforces it. */
export const PLAN_LIMITS: Record<PlanName, { branches: number; logins: number }> = {
  STARTER: { branches: 1, logins: 5 },
  PRO: { branches: 5, logins: 25 },
  ENTERPRISE: { branches: UNLIMITED, logins: UNLIMITED },
};

/** The modules a plan can switch on and the cheapest plan that has each. Everything else (till, tables, kitchen display, bills, menu, basic stock, analytics) is in every plan. */
export const MODULES: { id: FeatureId; label: string; plan: PlanName }[] = [
  { id: 'STOCK_CONTROL', label: 'Stock counts, expiry and reorder lists', plan: 'PRO' },
  { id: 'SUPPLIERS_EXPENSES', label: 'Suppliers, expenses and budgets', plan: 'PRO' },
  { id: 'CRM', label: 'Customers and loyalty points', plan: 'PRO' },
  { id: 'STAFF_PAYROLL', label: 'Staff records, attendance, leave and payroll', plan: 'PRO' },
  { id: 'TELEGRAM', label: 'Telegram alerts and daily reports', plan: 'PRO' },
  { id: 'EXPORTS', label: 'Report exports', plan: 'PRO' },
  { id: 'CAMPAIGNS', label: 'Marketing campaigns', plan: 'ENTERPRISE' },
  { id: 'SCHEDULING', label: 'Shift scheduling and tip pool', plan: 'ENTERPRISE' },
  { id: 'ACCOUNTING', label: 'Accounting and bank reconciliation', plan: 'ENTERPRISE' },
  { id: 'DOCUMENTS', label: 'Documents and SOPs', plan: 'ENTERPRISE' },
  { id: 'AUDIT', label: 'Audit log', plan: 'ENTERPRISE' },
];

export const planIncludes = (plan: PlanName, module: { plan: PlanName }) => PLANS.indexOf(plan) >= PLANS.indexOf(module.plan);

/** "5 branches, 25 staff logins" */
export function planLimitsText(plan: PlanName): string {
  const l = PLAN_LIMITS[plan];
  const branches = l.branches >= UNLIMITED ? 'Unlimited branches' : `${l.branches} ${l.branches === 1 ? 'branch' : 'branches'}`;
  return `${branches}, ${limitText(l.logins) === 'Unlimited' ? 'unlimited' : l.logins} staff logins`;
}
