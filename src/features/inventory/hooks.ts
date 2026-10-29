import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { costAlertsKey, countsKey, expiryKey, fetchCostAlerts, fetchCount, fetchCounts, fetchExpiry, fetchInventory, fetchReorder, reorderKey, fetchSuppliers, fetchTransactions, inventoryKey, type HistoryFilters } from './api';

export const useInventory = () => useQuery({ queryKey: inventoryKey, queryFn: fetchInventory });
/** Expired and soon-to-expire stock; a failure just hides the expiry list (the stock table still works). */
export const useExpiry = () => useQuery({ queryKey: expiryKey, queryFn: fetchExpiry, retry: false });
export const useSuppliersList = (enabled: boolean) => useQuery({ queryKey: ['suppliers', 'refs'], queryFn: fetchSuppliers, enabled });
export const useTransactions = (filters: HistoryFilters, enabled: boolean) =>
  useQuery({ queryKey: ['inventory-transactions', filters], queryFn: () => fetchTransactions(filters), enabled });

/** Runs an inventory change, toasts the outcome and refreshes stock and history. */
export function useInventoryAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string, failure: string, toastOnError = true) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      showToast(success, 'success');
      void qc.invalidateQueries({ queryKey: inventoryKey });
      void qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
    },
    onError: (err) => { if (toastOnError) showToast(`${failure}: ${err.message}`, 'error'); },
  });
}

export const useReorder = () => useQuery({ queryKey: reorderKey, queryFn: fetchReorder });
export const useCostAlerts = () => useQuery({ queryKey: costAlertsKey, queryFn: fetchCostAlerts });
export const useCounts = () => useQuery({ queryKey: countsKey, queryFn: fetchCounts });
export const useCount = (id: number | null) => useQuery({ queryKey: [...countsKey, id], queryFn: () => fetchCount(id!), enabled: id !== null });
