import { create } from 'zustand';

/** The browser's "install this app" offer (Chrome / Edge / Android). iPhones have no such offer: they get a how-to guide. */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

interface PwaState { offer: InstallPromptEvent | null; installed: boolean }
export const usePwa = create<PwaState>(() => ({ offer: null, installed: false }));

export const isIosDevice = (ua: string, hasMsStream = false) => /iPad|iPhone|iPod/.test(ua) && !hasMsStream;
export const isStandalone = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
};

/** Call once at start-up: the browser fires the offer once, early, so it must be captured before any screen mounts. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); usePwa.setState({ offer: e as InstallPromptEvent }); });
  window.addEventListener('appinstalled', () => usePwa.setState({ offer: null, installed: true }));
}

/** Show the browser's own install prompt. Returns whether the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const offer = usePwa.getState().offer;
  if (!offer) return false;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  usePwa.setState({ offer: null });
  return outcome === 'accepted';
}
