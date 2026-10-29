import { asset } from '../../lib/asset';
import { useSession } from '../../api/session';

/** The cafe's own name and logo once signed in (with the branch for branch-level people); the product name on the sign-in page. */
export function Logo() {
  const user = useSession((s) => s.user);
  const cafe = user?.platform ? 'ARVI Platform' : user?.tenantName;
  const branch = user && !user.platform && user.outletName && user.outletId ? user.outletName : null;
  const logo = user?.logoUrl && !user.platform ? user.logoUrl : asset('logo-05.png');
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <img src={logo} alt={cafe ?? 'ARVI'} className="w-8 h-8 shrink-0 object-contain" />
      <span className="min-w-0 leading-tight">
        <span className="block text-base font-semibold tracking-tight text-fg whitespace-nowrap truncate">{cafe ?? <>ARVI <span className="text-brand-text">POS</span></>}</span>
        {branch && <span className="block text-[11px] text-muted truncate">{branch}</span>}
      </span>
    </div>
  );
}
