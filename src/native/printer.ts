/** What the Android app's own code (Capacitor plugin "NeramPrinter") offers the web app. Absent in a normal browser. */
export interface NativeStatus {
  /** Android only reveals the Wi-Fi name to an app that holds the location permission. */
  locationPermission: boolean;
  onWifi: boolean;
  locationOn: boolean;
  ssid: string | null;
}
export type SendOutcome = 'PRINTED' | 'NOT_SENT' | 'UNSURE';
export interface SendResult { outcome: SendOutcome; bytesWritten: number; message: string; latencyMs?: number }
export interface ProbeResult { reachable: boolean; latencyMs: number; message: string }

export interface NativePrinter {
  getStatus(): Promise<NativeStatus>;
  probe(o: { host: string; port: number; timeoutMs?: number }): Promise<ProbeResult>;
  send(o: { host: string; port: number; dataBase64: string; connectTimeoutMs?: number; writeTimeoutMs?: number }): Promise<SendResult>;
  checkPermissions(): Promise<{ location: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>;
  requestPermissions(): Promise<{ location: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }>;
}

/** A page loaded from the web inside the app gets the plugins as `Capacitor.Plugins.<Name>`; `registerPlugin` exists only when the full Capacitor script is bundled. */
interface CapacitorGlobal { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown>; registerPlugin?: <T>(name: string) => T }

let cached: NativePrinter | null | undefined;

/** For tests: forget the remembered answer. */
export const resetNativePrinterCache = () => { cached = undefined; };

/** The phone's printing helper, or null when running in a normal browser. */
export function nativePrinter(): NativePrinter | null {
  if (cached !== undefined) return cached;
  const cap = (typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor);
  const plugin = cap?.isNativePlatform?.() ? (cap.Plugins?.NeramPrinter ?? cap.registerPlugin?.('NeramPrinter')) : undefined;
  cached = (plugin as NativePrinter | undefined) ?? null;
  return cached;
}

export const isAndroidApp = () => nativePrinter() !== null;
