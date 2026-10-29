import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { inventoryKey } from '../inventory/api';
import { fetchInvoices, fetchPayments, fetchSupplierAnalytics, fetchSuppliers, invoicesKey, paymentsKey, suppliersKey } from './api';

export const useSuppliers = () => useQuery({ queryKey: suppliersKey, queryFn: fetchSuppliers });
export const useInvoices = (supplierId: string) => useQuery({ queryKey: [...invoicesKey, supplierId], queryFn: () => fetchInvoices(supplierId) });
export const usePayments = (supplierId: string) => useQuery({ queryKey: [...paymentsKey, supplierId], queryFn: () => fetchPayments(supplierId) });
export const useSupplierAnalytics = () => useQuery({ queryKey: ['supplier-analytics'], queryFn: fetchSupplierAnalytics });

/** Money screens share numbers (outstanding, paid, stock): after any change everything is refreshed. */
export function useSupplierAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string, failure?: string) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      showToast(success, 'success');
      for (const k of [suppliersKey, invoicesKey, paymentsKey, inventoryKey, ['supplier-analytics'], ['inventory-transactions']]) void qc.invalidateQueries({ queryKey: k });
    },
    onError: (err) => showToast(failure ? `${failure}: ${err.message}` : err.message, 'error'),
  });
}
