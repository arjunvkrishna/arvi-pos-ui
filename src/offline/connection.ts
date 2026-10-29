import { create } from 'zustand';

/** Whether the screen can reach the server right now. Updated by the browser's online/offline events, a light check, and any request that fails to connect. */
interface ConnectionState { online: boolean; markOffline: () => void; markOnline: () => void }
export const useConnection = create<ConnectionState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  markOffline: () => set((s) => (s.online ? { online: false } : s)),
  markOnline: () => set((s) => (s.online ? s : { online: true })),
}));

/** A request that never reached the server (no Wi-Fi, server down, timeout): status 0. A gateway error from the proxy means the server is not up yet. */
export const isNetworkProblem = (e: unknown) => {
  const status = (e as { status?: number } | null)?.status;
  return status === 0 || status === 502 || status === 503 || status === 504 || e instanceof TypeError;
};

const CHECK_URL = '/api/health';
const CHECK_TIMEOUT_MS = 4000;
export const OFFLINE_CHECK_MS = 8000;
export const ONLINE_CHECK_MS = 30000;

/** True when the server answers. Any answer counts (even an error page from the app); only silence or a gateway error means down. */
export async function serverReachable(fetchFn: typeof fetch = fetch): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetchFn(CHECK_URL, { cache: 'no-store', signal: ctl.signal });
    return ![502, 503, 504].includes(res.status);
  } catch { return false; } finally { clearTimeout(timer); }
}

/** Starts watching the connection; `onBack` runs each time it returns. Returns a function that stops watching. */
export function startConnectionMonitor(onBack: () => void): () => void {
  let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined;
  const set = (up: boolean) => {
    const was = useConnection.getState().online;
    if (up) useConnection.getState().markOnline(); else useConnection.getState().markOffline();
    if (up && !was) onBack();
  };
  const check = async () => {
    if (stopped) return;
    set(await serverReachable());
    if (!stopped) timer = setTimeout(() => void check(), useConnection.getState().online ? ONLINE_CHECK_MS : OFFLINE_CHECK_MS);
  };
  const onOffline = () => set(false);
  const onOnline = () => { void serverReachable().then(set); };
  window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline);
  timer = setTimeout(() => void check(), ONLINE_CHECK_MS);
  return () => { stopped = true; if (timer) clearTimeout(timer); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
}
