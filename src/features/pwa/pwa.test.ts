import { describe, expect, it } from 'vitest';
import { isIosDevice, listenForInstall, usePwa } from './pwa';

describe('pwa', () => {
  it('recognises iPhones and iPads', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
  it('keeps the browser install offer until the app is installed', () => {
    listenForInstall();
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    window.dispatchEvent(offer);
    expect(offer.defaultPrevented).toBe(true);
    expect(usePwa.getState().offer).not.toBeNull();
    window.dispatchEvent(new Event('appinstalled'));
    expect(usePwa.getState().offer).toBeNull();
    expect(usePwa.getState().installed).toBe(true);
  });
});
