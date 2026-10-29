import { api } from '../../api/client';

export type ExpenseType = 'RENT' | 'EMI' | 'WATER' | 'ELECTRICITY' | 'INTERNET' | 'GAS' | 'MAINTENANCE' | 'MARKETING' | 'MISC';
export interface Expense {
  id: number; type: ExpenseType; description?: string | null; vendorOrPayee?: string | null; amount: number; expenseDate?: string | null; dueDate?: string | null;
  paymentMethod?: string | null; paidBy?: string | null; status?: 'PAID' | 'PENDING'; receiptRef?: string | null; notes?: string | null;
  templateId?: number | null; isRecurring?: boolean; month?: number; year?: number;
}
export interface Template {
  id: number; title: string; type: ExpenseType; amount: number; frequency?: string; dueDay?: number; vendorOrPayee?: string | null;
  paymentMethod?: string | null; notes?: string | null; isActive?: boolean;
}
export interface ChecklistItem {
  templateId: number; title: string; type: ExpenseType; vendorOrPayee?: string | null; expectedAmount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'UNRECORDED' | 'DUE_SOON'; dueDay?: number; isRecorded?: boolean; expenseDate?: string | null;
}
export interface ExpenseInput {
  type: string; description: string; vendorOrPayee: string; amount: number; expenseDate: string; dueDate: string | null; paymentMethod: string;
  paidBy: string; status: string; receiptRef: string; notes: string; templateId: number | null; isRecurring: boolean;
}
export interface TemplateInput { title: string; type: string; amount: number; frequency: string; dueDay: number; vendorOrPayee: string; paymentMethod: string; notes: string; isActive: boolean }

export const expensesKey = ['expenses'] as const;
export const fetchExpenses = () => api<Expense[]>('/expenses');
export const fetchTemplates = () => api<Template[]>('/expenses/templates');
export const fetchChecklist = (month: number, year: number) => api<ChecklistItem[]>(`/expenses/templates/monthly-status?month=${month}&year=${year}`).catch(() => [] as ChecklistItem[]);

export const saveExpense = (id: number | null, e: ExpenseInput) => (id ? api(`/expenses/${id}`, { method: 'PUT', body: e }) : api('/expenses', { method: 'POST', body: e }));
export const saveTemplate = (id: number | null, t: TemplateInput) => (id ? api(`/expenses/templates/${id}`, { method: 'PUT', body: t }) : api('/expenses/templates', { method: 'POST', body: t }));
export const deleteExpense = (id: number) => api(`/expenses/${id}`, { method: 'DELETE' });
export const deleteTemplate = (id: number) => api(`/expenses/templates/${id}`, { method: 'DELETE' });
export const toggleTemplate = (id: number) => api(`/expenses/templates/${id}/toggle-active`, { method: 'POST' });
export const markPaid = (id: number) => api(`/expenses/${id}/status`, { method: 'PUT', body: { status: 'PAID' } });
export const generateFromTemplate = (id: number, date: string) => api(`/expenses/templates/${id}/generate?expenseDate=${date}&status=PAID`, { method: 'POST' });
export const generateAllDue = (month: number, year: number) => api<unknown[]>(`/expenses/templates/generate-all?month=${month}&year=${year}`, { method: 'POST' });
