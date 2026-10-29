import { useEffect } from 'react';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { nativePrinter } from '../../native/printer';
import { configuredSsids } from './api';
import { ssidList } from './direct';

const ASKED = 'arvi_asked_wifi_permission';

/**
 * In the Android app, once direct printing is set up on the server, ask once for the permission Android needs to read the Wi-Fi name.
 * (If the answer is no, printing simply keeps going through the cloud; the printer settings screen explains and offers the button again.)
 */
export function useDirectPrintSetup() {
  const signedIn = useSession((s) => !!s.user);
  useEffect(() => {
    const native = nativePrinter();
    if (!native || !signedIn) return;
    let stopped = false;
    void (async () => {
      try {
        if (ssidList(await configuredSsids()).length === 0 || stopped) return;
        const status = await native.getStatus();
        if (status.locationPermission || localStorage.getItem(ASKED)) return;
        localStorage.setItem(ASKED, '1');
        showToast('To print straight to the printers on the cafe Wi-Fi, allow location access on the next screen. Android needs it to see the Wi-Fi name.', 'info');
        await native.requestPermissions();
      } catch { /* printing just keeps going through the cloud */ }
    })();
    return () => { stopped = true; };
  }, [signedIn]);
}
