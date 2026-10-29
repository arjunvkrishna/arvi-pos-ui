import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import { forgetAll } from '../../offline/cache';
import { outboxScope, useOutbox } from '../../offline/outboxStore';
import { showToast } from '../../components/toast';

interface BranchRow { id: number; name: string; code?: string; isActive?: boolean }

/**
 * Owners and general managers run every branch. This picks the branch to work in (sent as X-Outlet-Id with every request) or
 * "All branches" for the whole cafe. Branch managers and staff never see it: they work in their own branch only.
 */
export function BranchSwitcher() {
  const user = useSession((s) => s.user)!;
  const patchUser = useSession((s) => s.patchUser);
  const waiting = useOutbox((s) => s.items.filter((i) => i.scope === outboxScope() && i.status === 'WAITING').length);
  const wide = isCafeWide(user);
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api<BranchRow[]>('/outlets'), enabled: wide, staleTime: 5 * 60_000 });
  const list = (branches.data ?? []).filter((b) => b.isActive !== false);
  if (!wide || list.length < 2) return null;

  const change = (value: string) => {
    if (waiting > 0) {
      showToast('Orders taken offline are still waiting to be sent. Send them before changing branch.', 'warning');
      return;
    }
    patchUser({ selectedOutletId: value ? Number(value) : null });
    forgetAll();                       // the menu, tables and tax copies kept for offline use belong to the previous branch
    window.location.assign('/');       // a clean start: nothing from the previous branch stays on screen or in memory
  };

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted" title="Branch you are working in">
      <i className="fa-solid fa-store text-faint" aria-hidden />
      <select id="branchSwitcher" aria-label="Branch" value={user.selectedOutletId ?? ''} onChange={(e) => change(e.target.value)} className="input h-8 py-0 w-auto max-w-[11rem] text-sm">
        <option value="">All branches</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
