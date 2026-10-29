import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { categoriesKey, fetchCategories, fetchMenuItems, fetchMenuVersion, fetchPublicMenu, menuItemsKey, menuVersionKey, publicMenuKey } from './api';
import { createMenuWatcher, MENU_CHECK_MS } from './menuWatch';

export const useCategories = () => useQuery({ queryKey: categoriesKey, queryFn: fetchCategories });
export const useMenuItems = () => useQuery({ queryKey: menuItemsKey, queryFn: fetchMenuItems });
/**
 * Keeps dishes, prices, categories, option groups and combos current: asks the server every few seconds whether the menu changed
 * (only while this screen is open and visible) and reloads the menu only when it did.
 */
export function useMenuAutoRefresh() {
  const qc = useQueryClient();
  const [watch] = useState(() => createMenuWatcher(() => {
    for (const key of [menuItemsKey, categoriesKey, ['modifier-groups']]) void qc.invalidateQueries({ queryKey: key });
  }));
  useQuery({
    queryKey: menuVersionKey,
    queryFn: async () => { const { version } = await fetchMenuVersion(); watch(version); return version; },
    refetchInterval: MENU_CHECK_MS, staleTime: 0, retry: false,
  });
}

export const usePublicMenu = () => useQuery({ queryKey: publicMenuKey, queryFn: fetchPublicMenu });

/** Runs a menu change, toasts the outcome and refreshes the dishes and categories. */
export function useMenuAction<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, success: string | ((d: TData) => string), failure: string) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data) => {
      showToast(typeof success === 'function' ? success(data) : success, 'success');
      void qc.invalidateQueries({ queryKey: menuItemsKey });
      void qc.invalidateQueries({ queryKey: categoriesKey });
    },
    onError: (err) => showToast(`${failure}: ${err.message}`, 'error'),
  });
}
