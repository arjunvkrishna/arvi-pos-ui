import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { fetchCurrent, fetchSettings, shiftKey, type Shift } from './api';
import { chipState } from './rules';

/** The open shift, or why there is none ("no shift" is a normal answer, not a failure). */
async function currentOrNone(): Promise<{ shift: Shift | null; error?: string }> {
  try { return { shift: await fetchCurrent() }; } catch (e) { return { shift: null, error: e instanceof Error ? e.message : String(e) }; }
}

/** Shift settings + the open shift, kept fresh. Only managers and admins have shifts. */
export function useShiftStatus() {
  const role = useSession((s) => s.user?.role);
  const eligible = role === 'ADMIN' || role === 'MANAGER';
  const settings = useQuery({ queryKey: [...shiftKey, 'settings'], queryFn: fetchSettings, enabled: eligible });
  const moduleOn = settings.data?.enabled !== false;
  const current = useQuery({ queryKey: [...shiftKey, 'current'], queryFn: currentOrNone, enabled: eligible && moduleOn, refetchInterval: 300_000 });
  const open = current.data?.shift ?? null;
  const chip = chipState({ enabled: moduleOn, isAdmin: role === 'ADMIN', open, error: current.data?.error });
  return { visible: eligible && !chip.hidden, chip, open, moduleOn };
}
