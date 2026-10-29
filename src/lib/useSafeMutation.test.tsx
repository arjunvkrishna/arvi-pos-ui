import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSafeMutation } from './useSafeMutation';

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe('useSafeMutation', () => {
  it('ignores a second call while the first is still running, and works again afterwards', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const { result } = renderHook(() => useSafeMutation({ mutationFn: () => { calls++; return new Promise<void>((r) => { release = r; }); } }), { wrapper });
    act(() => { result.current.mutate(); result.current.mutate(); });     // a fast double click
    await waitFor(() => expect(calls).toBe(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(1);                                              // the second click was ignored
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => { result.current.mutate(); });
    await waitFor(() => expect(calls).toBe(2));
    await act(async () => { release(); });
  });
});
