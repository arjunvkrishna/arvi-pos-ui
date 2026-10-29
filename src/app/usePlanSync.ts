import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, PLAN_REFRESH_EVENT } from '../api/client';
import { useSession } from '../api/session';
import type { PlanInfo } from '../api/types';

const samePlan = (a?: PlanInfo, b?: PlanInfo) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Keeps the cafe's plan in the session current. The login already carries it; this re-reads it when the app opens, when the
 * window comes back into focus after a few minutes, and straight away when the server refuses a module as "not in your plan"
 * (the platform owner may have changed the plan since this person signed in).
 */
export function usePlanSync(): void {
  const user = useSession((s) => s.user);
  const patchUser = useSession((s) => s.patchUser);
  const signedInCafe = !!user && !user.platform;
  const q = useQuery({
    queryKey: ['my-plan', user?.tenantCode ?? '', user?.username ?? ''],
    queryFn: () => api<{ plan?: PlanInfo }>('/users/me').then((p) => p.plan ?? null),
    enabled: signedInCafe,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const { refetch } = q;
  const plan = q.data ?? undefined;
  const current = user?.plan;

  useEffect(() => {
    if (plan && !samePlan(plan, current)) patchUser({ plan });
  }, [plan, current, patchUser]);

  useEffect(() => {
    const again = () => { void refetch(); };
    window.addEventListener(PLAN_REFRESH_EVENT, again);
    return () => window.removeEventListener(PLAN_REFRESH_EVENT, again);
  }, [refetch]);
}
