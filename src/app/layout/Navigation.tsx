import { NavLink } from 'react-router';
import { logout } from '../../api/client';
import { roleLabel } from '../../api/roles';
import { useSession } from '../../api/session';
import { bottomBarTabs, visibleTabs } from '../../auth/tabs';
import { isStandalone } from '../../features/pwa/pwa';
import { groupTabs } from './groups';
import { Logo } from './Logo';
import { useUi } from '../ui';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((s) => s.user)!;
  return (
    <div className="space-y-5" id="navTabsContainer">
      {groupTabs(visibleTabs(user)).map((g) => (
        <div key={g.label}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.label}</p>
          <div className="space-y-0.5">
            {g.tabs.map((t) => (
              <NavLink key={t.id} to={`/${t.id}`} onClick={onNavigate}
                className={({ isActive }) => `tab-btn flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium transition ${isActive ? 'active bg-brand/15 text-fg' : 'text-muted hover:text-fg hover:bg-subtle'}`}>
                {({ isActive }) => (<><i className={`fa-solid ${t.icon} w-4 text-center text-[13px] ${isActive ? 'text-brand-text' : 'text-faint'}`} /><span className="truncate">{t.label}</span></>)}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountCard({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((s) => s.user)!;
  const ui = useUi((s) => s.set);
  const name = user.employeeName || user.username;
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg border border-line">
      <button type="button" title="My Profile & Bank Details" onClick={() => { onNavigate?.(); ui({ profileOpen: true }); }} className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-md hover:bg-subtle">
        <span className="w-8 h-8 rounded-full bg-brand/15 text-brand-text flex items-center justify-center text-sm font-semibold shrink-0">{name.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0"><span className="block text-sm font-medium text-fg truncate">{name}</span><span className="block text-[11px] text-muted">{roleLabel(user)}</span></span>
      </button>
      {!isStandalone() && <button type="button" id="drawerPwaInstallBtn" title="Install ARVI POS as an app" aria-label="Install app" className="btn btn-ghost btn-icon btn-sm" onClick={() => { onNavigate?.(); ui({ pwaOpen: true }); }}><i className="fa-solid fa-download text-xs" /></button>}
      <button type="button" title="Change My Password" aria-label="Change my password" className="btn btn-ghost btn-icon btn-sm"
        onClick={() => { onNavigate?.(); ui({ changePasswordOpen: true, changePasswordForced: false }); }}>
        <i className="fa-solid fa-key text-xs" />
      </button>
      <button type="button" title="Sign Out" aria-label="Sign out" className="btn btn-ghost btn-icon btn-sm hover:!text-danger" onClick={logout}>
        <i className="fa-solid fa-right-from-bracket text-xs" />
      </button>
    </div>
  );
}

/** Desktop sidebar (lg and up). */
export function Sidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-surface border-r border-line z-30" aria-label="Main">
      <div className="h-14 px-4 flex items-center border-b border-line shrink-0"><Logo /></div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Screens"><NavItems /></nav>
      <div className="p-3 border-t border-line shrink-0 space-y-2"><AccountCard /><p className="text-[11px] text-faint text-center">ARVI Cloud POS · v{__APP_VERSION__}</p></div>
    </aside>
  );
}

/** Phone bottom bar: the main screens one tap away. */
export function BottomNav() {
  const user = useSession((s) => s.user)!;
  return (
    <nav id="mobileBottomNav" aria-label="Quick navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line flex justify-around px-1 pt-1.5 safe-bottom">
      {bottomBarTabs(user).map((t) => (
        <NavLink key={t.id} to={`/${t.id}`}
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active text-brand-text' : 'text-muted'} flex flex-col items-center gap-0.5 min-w-[56px] px-2 py-1 rounded-lg text-[11px] font-medium`}>
          <i className={`fa-solid ${t.icon} text-base`} /><span>{t.short}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Slide-out menu for phones and tablets: the same sections as the sidebar. */
export function MobileDrawer() {
  const open = useUi((s) => s.drawerOpen);
  const ui = useUi((s) => s.set);
  const close = () => ui({ drawerOpen: false });
  return (
    <div id="mobileNavDrawer" className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div onClick={close} className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface border-r border-line flex flex-col shadow-pop transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-line shrink-0">
          <Logo />
          <button type="button" onClick={close} aria-label="Close menu" className="btn btn-ghost btn-icon btn-sm"><i className="fa-solid fa-xmark" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" id="mobileNavDrawerTabs" aria-label="Screens"><NavItems onNavigate={close} /></nav>
        <div className="p-3 border-t border-line safe-bottom space-y-2"><AccountCard onNavigate={close} /><p className="text-[11px] text-faint text-center">ARVI Cloud POS · v{__APP_VERSION__}</p></div>
      </div>
    </div>
  );
}
