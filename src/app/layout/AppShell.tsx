import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router';
import { ChangePasswordDialog } from '../../auth/ChangePasswordDialog';
import { ShiftHost } from '../../features/shift/ShiftHost';
import { ProfileDialog } from '../../features/profile/ProfileDialog';
import { NotificationsDialog } from '../../features/notifications/NotificationsDialog';
import { PrinterSettingsDialog } from '../../features/printing/PrinterSettingsDialog';
import { PrintHost } from '../../features/printing/Receipts';
import { useDirectPrintSetup } from '../../features/printing/useDirectPrintSetup';
import { PwaInstallDialog } from '../../features/pwa/PwaInstallDialog';
import { startConnectionMonitor, useConnection } from '../../offline/connection';
import { OfflineBanner } from '../../offline/OfflineBanner';
import { useOutbox } from '../../offline/outboxStore';
import { useUi } from '../ui';
import { usePlanSync } from '../usePlanSync';
import { Header } from './Header';
import { BottomNav, MobileDrawer, Sidebar } from './Navigation';

/** Everything around a screen: sidebar (desktop) or drawer + bottom bar (phone), top bar, global dialogs. */
export function AppShell() {
  usePlanSync();
  const pwaOpen = useUi((s) => s.pwaOpen);
  const ui = useUi((s) => s.set);
  const qc = useQueryClient();
  const { pathname } = useLocation();
  useDirectPrintSetup();
  useEffect(() => {
    const sendWaiting = () => { void useOutbox.getState().flushNow(qc); };
    const stop = startConnectionMonitor(() => { void qc.invalidateQueries(); sendWaiting(); });
    const again = window.setInterval(() => { if (useConnection.getState().online) sendWaiting(); }, 30000);   // picks up orders left waiting after an interrupted send
    sendWaiting();
    return () => { stop(); window.clearInterval(again); };
  }, [qc]);
  return (
    <div className="min-h-screen lg:pl-60">
      <Sidebar />
      <MobileDrawer />
      <Header />
      <OfflineBanner />
      <main className="w-full px-3 sm:px-6 py-5 sm:py-7 pb-24 lg:pb-8">   {/* fills all the space beside the sidebar, whatever the screen size or browser zoom: no gap and no cap */}
        <div key={pathname} className="anim-rise-in"><Outlet /></div>   {/* each screen eases in when you switch to it */}
      </main>
      <BottomNav />
      <NotificationsDialog />
      <PrinterSettingsDialog />
      <PrintHost />
      <ChangePasswordDialog />
      <ProfileDialog />
      <ShiftHost />
      <PwaInstallDialog open={pwaOpen} onClose={() => ui({ pwaOpen: false })} />
    </div>
  );
}
