import { atLimit, limitText } from '../../api/roles';
import type { PlanInfo } from '../../api/types';

/** One line under a page title: how much of the plan's limit is in use. Shown only where the list it counts is complete. */
export function PlanUsage({ plan, what, used, limit }: { plan: PlanInfo | undefined; what: string; used: number; limit: number }) {
  if (!plan) return null;
  const full = atLimit(used, limit);
  return (
    <p data-testid="plan-usage" className={`text-xs ${full ? 'text-warn' : 'text-muted'}`}>
      <span className="font-medium">{plan.name} plan:</span> {used} of {limitText(limit)} {what} in use{full ? '. To add more, ask your administrator to move to a bigger plan.' : '.'}
    </p>
  );
}
