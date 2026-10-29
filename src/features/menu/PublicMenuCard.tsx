import { useQueryClient } from '@tanstack/react-query';
import { isCafeWide } from '../../api/roles';
import { useSession } from '../../api/session';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { showToast } from '../../components/toast';
import { Badge } from '../../components/ui';
import { publicMenuKey, setPublicMenu } from './api';
import { usePublicMenu } from './hooks';

/** Switch for the customer-facing menu page, with copy link and preview. Switching it on or off is a cafe-wide decision. */
export function PublicMenuCard() {
  const qc = useQueryClient();
  const user = useSession((s) => s.user)!;
  const mayToggle = isCafeWide(user);
  const menuPath = `/menu?cafe=${encodeURIComponent(user.tenantCode ?? '')}`;
  const { data } = usePublicMenu();
  const enabled = data?.enabled === true;
  const toggle = useMutation({
    mutationFn: (next: boolean) => setPublicMenu(next),
    onSuccess: (res, next) => {
      qc.setQueryData(publicMenuKey, { enabled: res?.enabled === true });
      showToast(res?.message || `Public menu ${next ? 'enabled' : 'disabled'}`, 'success');
    },
    onError: (e: Error) => showToast(`Failed to update public menu: ${e.message}`, 'error'),
  });

  const onToggle = () => {
    if (!window.confirm(`Are you sure you want to ${enabled ? 'DISABLE' : 'ENABLE'} the public customer menu?`)) return;
    toggle.mutate(!enabled);
  };
  const copy = async () => {
    const url = `${window.location.origin}${menuPath}`;
    try { await navigator.clipboard.writeText(url); showToast(`Public menu link copied: ${url}`, 'success'); }
    catch { window.prompt('Copy public menu URL:', url); }
  };

  return (
    <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-brand/15 text-brand-text flex items-center justify-center"><i className="fa-solid fa-globe" /></div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg flex items-center gap-2">
            Public customer menu
            <Badge tone={enabled ? 'ok' : 'danger'} className="" ><span id="publicMenuStatusBadge">{enabled ? 'Live & online' : 'Disabled / offline'}</span></Badge>
          </p>
          <p className="text-xs text-muted">Read-only page for customers at <a href={menuPath} target="_blank" rel="noreferrer" className="text-brand-text hover:underline inline-block py-1">{menuPath}</a>, no login needed.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={copy} className="btn btn-secondary btn-sm"><i className="fa-solid fa-copy" />Copy link</button>
        <a href={menuPath} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="fa-solid fa-arrow-up-right-from-square" />Preview</a>
        {mayToggle && <button type="button" id="btnTogglePublicMenu" disabled={toggle.isPending || !data} onClick={onToggle} className={`btn btn-sm ${enabled ? 'btn-soft-danger' : 'btn-soft-ok'}`}>
          <i className={`fa-solid ${enabled ? 'fa-power-off' : 'fa-circle-check'}`} />{enabled ? 'Disable menu' : 'Enable menu'}
        </button>}
      </div>
    </div>
  );
}
