import type { Tone } from '../../components/ui';
import type { NativeStatus } from '../../native/printer';
import { onCafeWifi, ssidList } from '../printing/direct';

/** What the Wi-Fi chip, the phone strip and the Wi-Fi dialog say about this phone's network. */
export interface WifiView {
  tone: Tone;
  /** The network name to show (or a short stand-in such as "No Wi-Fi"). */
  name: string;
  /** One or two words: Connected, Wrong network, ... */
  status: string;
  /** A full sentence for the dialog and the tooltip. */
  detail: string;
  /** True on the cafe Wi-Fi, false on another network or none, null when it cannot be told. */
  correct: boolean | null;
}

export function wifiView(status: NativeStatus | null, configured?: string | null): WifiView {
  if (!status) return { tone: 'neutral', name: 'Wi-Fi', status: 'Unknown', detail: 'The app could not read this phone’s Wi-Fi.', correct: null };
  if (!status.onWifi) return { tone: 'warn', name: 'No Wi-Fi', status: 'Not connected', detail: 'This phone is not on Wi-Fi. Printing goes through the cloud.', correct: false };
  if (!status.locationPermission) return { tone: 'warn', name: 'Wi-Fi', status: 'Allow location', detail: 'Allow location access so the app can see the Wi-Fi name (Android needs it for this). Until then, printing goes through the cloud.', correct: null };
  if (!status.locationOn) return { tone: 'warn', name: 'Wi-Fi', status: 'Location is off', detail: 'Switch Location on in the phone settings so the Wi-Fi name can be read. Until then, printing goes through the cloud.', correct: null };
  const ssid = status.ssid;
  if (!ssid) return { tone: 'neutral', name: 'Wi-Fi', status: 'Unknown', detail: 'The Wi-Fi name could not be read.', correct: null };
  const wanted = ssidList(configured);
  if (wanted.length === 0) return { tone: 'neutral', name: ssid, status: 'Cafe Wi-Fi not set', detail: `Connected to “${ssid}”. An admin has not set the cafe Wi-Fi yet, so printing goes through the cloud.`, correct: null };
  if (onCafeWifi(ssid, configured)) return { tone: 'ok', name: ssid, status: 'Connected', detail: `Connected to the cafe Wi-Fi “${ssid}”. Printing goes straight to the printers.`, correct: true };
  return { tone: 'warn', name: ssid, status: 'Wrong network', detail: `Connected to “${ssid}”, not the cafe Wi-Fi (${wanted.join(', ')}). Printing goes through the cloud.`, correct: false };
}
