import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { fetchUsers, usersKey } from './api';

export function useUsers() {
  return useQuery({ queryKey: usersKey, queryFn: fetchUsers });
}

/** Runs an account action, toasts the outcome (same wording as the classic app) and refreshes the list. */
export function useUserAction<TVars>(fn: (v: TVars) => Promise<unknown>, success: string, failure: string, refresh = true) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      showToast(success, 'success');
      if (refresh) void qc.invalidateQueries({ queryKey: usersKey });
    },
    onError: (err) => showToast(`${failure}: ${err.message}`, 'error'),
  });
}
