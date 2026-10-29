import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { employeesKey, fetchEmployees, fetchSalaries, salariesKey } from './api';

export const useEmployees = () => useQuery({ queryKey: employeesKey, queryFn: fetchEmployees });
export const useSalaries = () => useQuery({ queryKey: salariesKey, queryFn: fetchSalaries });

export function useStaffAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string, failure: string) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      showToast(success, 'success');
      for (const k of [employeesKey, salariesKey, ['employee-salaries'], ['monthly-summary'], ['attendance-summary']]) void qc.invalidateQueries({ queryKey: k });
    },
    onError: (err) => showToast(`${failure}: ${err.message}`, 'error'),
  });
}
