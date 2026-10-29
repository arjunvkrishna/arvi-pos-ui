import { isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import { EmptyState, PageHeader } from '../../components/ui';
import { PosPage } from './PosPage';

/**
 * Orders belong to a branch. An owner or general manager who chose "All branches" is looking at the whole cafe, where an order
 * would belong to no branch at all, so the till asks for a branch first.
 */
export function PosGate() {
  const user = useSession((s) => s.user)!;
  const mustPick = isCafeWide(user) && !user.selectedOutletId;
  if (!mustPick) return <PosPage />;
  return (
    <section id="tab-pos" data-testid="pos-pick-branch" className="space-y-5">
      <PageHeader title="Table orders & POS" />
      <div className="card"><EmptyState icon="fa-store" title="Pick a branch to take orders" hint="Choose the branch in the top bar. Orders are always taken in one branch." /></div>
    </section>
  );
}
