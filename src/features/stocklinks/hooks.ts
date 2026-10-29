import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../components/toast';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { inventoryKey } from '../inventory/api';
import { fetchLinks, linksKey } from './api';

export const useLinks = () => useQuery({ queryKey: linksKey, queryFn: fetchLinks });

/** Runs a link change, toasts the outcome and refreshes links and stock (a new stock item may have been made). */
export function useLinkAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string | ((d: TData, v: TVars) => string), failure: string) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data, v) => {
      showToast(typeof success === 'function' ? success(data, v) : success, 'success');
      void qc.invalidateQueries({ queryKey: ['recipe'] });
      void qc.invalidateQueries({ queryKey: inventoryKey });
    },
    onError: (err) => showToast(`${failure}: ${err.message}`, 'error'),
  });
}
