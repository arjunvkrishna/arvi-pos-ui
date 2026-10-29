import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { useRef } from 'react';

/**
 * useMutation that ignores a second call while one is still running. React Query reports "pending" a moment after the
 * click, so a fast double click (or double Enter) could otherwise send the same request twice (two dishes, two payments).
 */
export function useSafeMutation<TData = unknown, TError = Error, TVars = void>(options: UseMutationOptions<TData, TError, TVars>): UseMutationResult<TData, TError, TVars> {
  const busy = useRef(false);
  const m = useMutation<TData, TError, TVars>({
    ...options,
    onSettled: (...args) => { busy.current = false; return options.onSettled?.(...args); },
  });
  const mutate = ((...args: Parameters<typeof m.mutate>) => {
    if (busy.current) return;
    busy.current = true;
    m.mutate(...args);
  }) as typeof m.mutate;
  return { ...m, mutate } as UseMutationResult<TData, TError, TVars>;
}
