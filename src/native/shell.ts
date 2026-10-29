interface Shell {
  setBars(o: { dark: boolean }): Promise<void>;
  getAppInfo(): Promise<{ versionName: string; versionCode: number }>;
  openExternal(o: { url: string }): Promise<void>;
}
interface CapacitorGlobal { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> }

/** The phone's own helper in the Android app; null in a browser. */
function shell(): Shell | null {
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    return cap?.isNativePlatform?.() ? ((cap.Plugins?.NeramShell as Shell | undefined) ?? null) : null;
  } catch { return null; }
}

/** In the Android app, colours the status and navigation bars like the page. A no-op in a browser. */
export function setSystemBars(dark: boolean): void {
  void shell()?.setBars({ dark }).catch(() => undefined);
}

/** The installed app's version, or null in a browser. */
export const appInfo = () => shell()?.getAppInfo().catch(() => null) ?? Promise.resolve(null);

/** Opens a link in the phone's browser (the app only allows links on its own server). */
export const openExternal = (url: string) => shell()?.openExternal({ url }) ?? Promise.reject(new Error('not in the app'));
