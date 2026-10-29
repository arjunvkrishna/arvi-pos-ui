import { useEffect, useState } from 'react';
import { roleLabel } from '../../api/roles';
import { useSession } from '../../api/session';
import { usePrinterHealth } from '../../features/printing/hooks';
import { useShiftStatus } from '../../features/shift/hooks';
import { Bell } from '../../features/notifications/Bell';
import { isStandalone, usePwa } from '../../features/pwa/pwa';
import { useTheme } from '../../lib/useTheme';
import { useUi } from '../ui';
import { BranchSwitcher } from './BranchSwitcher';
import { Logo } from './Logo';

const clockFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
});

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <span id="liveClock">{clockFormat.format(now)}</span>;
}

export function Header() {
  const user = useSession((s) => s.user)!;
  const ui = useUi((s) => s.set);
  const { theme, toggle } = useTheme();
  const shift = useShiftStatus();
  const printers = usePrinterHealth();
  const canInstall = usePwa((x) => x.offer !== null) && !isStandalone();
  const canPrinters = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    // Phone: the logo and the buttons on one row, the status chips on a row of their own beneath (so nothing can sit on top of
    // the logo at any width or text size). Large screens: everything on one row, as before.
    <header className="sticky top-0 z-30 px-3 sm:px-6 grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 bg-surface/90 backdrop-blur border-b border-line">
      <div className="col-start-1 row-start-1 h-12 lg:h-14 flex items-center gap-2 min-w-0">
        <button type="button" onClick={() => ui({ drawerOpen: true })} title="Open Menu" aria-label="Open menu" className="lg:hidden btn btn-ghost btn-icon shrink-0">
          <i className="fa-solid fa-bars" />
        </button>
        <div className="lg:hidden min-w-0"><Logo /></div>
        <p className="hidden lg:flex items-center gap-2 text-sm text-muted"><i className="fa-regular fa-clock text-faint" /><LiveClock /></p>
      </div>

      <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar pb-1.5 lg:pb-0 [&>*]:shrink-0 empty:hidden">
        {canPrinters && (
          <button id="headerPrinterStatusBtn" type="button" onClick={() => ui({ printerSettingsOpen: true })} title="Printer settings & status" className="btn btn-secondary btn-sm">
            <span id="headerPrinterDot" className={`w-2 h-2 rounded-full ${!printers.data ? 'bg-faint' : printers.data.health.allOnline ? 'bg-ok animate-pulse' : 'bg-danger'}`} />
            <i className="fa-solid fa-print" /><span id="headerPrinterLabel" className="hidden xl:inline">{printers.data?.bridge?.billPrinterHost || 'Printers'}</span>
          </button>)}
        <BranchSwitcher />
        {shift.visible && (
          <button id="headerShiftStatusBtn" type="button" onClick={() => ui({ shiftOpen: true })} title="Cashier shift & drawer" className="btn btn-secondary btn-sm">
            <span id="headerShiftDot" className={`w-2 h-2 rounded-full ${shift.chip.dot === 'green' ? 'bg-ok animate-pulse' : shift.chip.dot === 'red' ? 'bg-danger' : 'bg-faint'}`} />
            <span id="headerShiftLabel" className="hidden sm:inline">{shift.chip.label}</span><i className="fa-solid fa-cash-register sm:hidden" />
          </button>)}
      </div>

      <div className="col-start-2 row-start-1 lg:col-start-3 h-12 lg:h-14 flex items-center gap-1.5">
        {canInstall && <button id="btnPwaInstall" type="button" onClick={() => ui({ pwaOpen: true })} title="Install ARVI POS as an app" aria-label="Install app" className="btn btn-secondary btn-sm"><i className="fa-solid fa-download" /><span className="hidden md:inline">Install app</span></button>}
        <button id="btnThemeToggle" type="button" onClick={toggle} title="Toggle Light / Dark Mode" aria-label="Toggle light or dark mode" className="btn btn-ghost btn-icon">
          <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
        </button>
        <Bell />
        <button type="button" onClick={() => ui({ profileOpen: true })} title="My Profile & Bank Details" className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-line rounded-r-lg hover:bg-subtle">
          <div className="text-right leading-tight">
            <div id="headerUserName" data-testid="header-user" className="text-sm font-medium text-fg">{user.employeeName || user.username}</div>
            <div id="headerUserRole" className="text-[11px] text-muted">{roleLabel(user)}</div>
          </div>
        </button>
      </div>
    </header>
  );
}
