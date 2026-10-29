import { afterEach, describe, expect, it } from 'vitest';
import { nativePrinter, resetNativePrinterCache } from './printer';

const setCapacitor = (cap: unknown) => { resetNativePrinterCache(); (window as unknown as { Capacitor?: unknown }).Capacitor = cap; };
afterEach(() => { setCapacitor(undefined); });

describe('finding the Android printing helper', () => {
  it('is absent in a normal browser', () => {
    setCapacitor(undefined);
    expect(nativePrinter()).toBeNull();
  });
  it('is absent when Capacitor says this is not a native app', () => {
    setCapacitor({ isNativePlatform: () => false, Plugins: { NeramPrinter: {} } });
    expect(nativePrinter()).toBeNull();
  });
  it('is read from Capacitor.Plugins, which is how a page loaded from the web sees it inside the app', () => {
    const plugin = { getStatus: () => Promise.resolve({}) };
    setCapacitor({ isNativePlatform: () => true, Plugins: { NeramPrinter: plugin } });
    expect(nativePrinter()).toBe(plugin);
  });
  it('falls back to registerPlugin when that is what is available', () => {
    const plugin = { getStatus: () => Promise.resolve({}) };
    setCapacitor({ isNativePlatform: () => true, registerPlugin: (n: string) => (n === 'NeramPrinter' ? plugin : null) });
    expect(nativePrinter()).toBe(plugin);
  });
  it('is absent in the app when the plugin is missing', () => {
    setCapacitor({ isNativePlatform: () => true, Plugins: {} });
    expect(nativePrinter()).toBeNull();
  });
});
