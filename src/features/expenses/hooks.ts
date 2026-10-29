import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { expensesKey, fetchChecklist, fetchExpenses, fetchTemplates } from './api';

export const useExpenses = () => useQuery({ queryKey: expensesKey, queryFn: fetchExpenses });
export const useTemplates = () => useQuery({ queryKey: [...expensesKey, 'templates'], queryFn: fetchTemplates });
export const useChecklist = (month: number, year: number) => useQuery({ queryKey: [...expensesKey, 'checklist', month, year], queryFn: () => fetchChecklist(month, year) });

export function useExpenseAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string | ((d: TData) => string), failure: string, kind: 'success' | 'info' = 'success') {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (d) => { showToast(typeof success === 'function' ? success(d) : success, kind); void qc.invalidateQueries({ queryKey: expensesKey }); },
    onError: (e) => showToast(`${failure}: ${e.message}`, 'error'),
  });
}
