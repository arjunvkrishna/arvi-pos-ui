import { describe, expect, it } from 'vitest';
import type { NativeStatus } from '../../native/printer';
import { wifiView } from './rules';

const on = (ssid: string | null, over: Partial<NativeStatus> = {}): NativeStatus => ({ locationPermission: true, onWifi: true, locationOn: true, ssid, ...over });

describe('what the phone says about its Wi-Fi', () => {
  it('is green and "Connected" on the cafe Wi-Fi, whatever the capitals', () => {
    const v = wifiView(on('cafe wifi'), 'Cafe WiFi');
    expect(v).toMatchObject({ tone: 'ok', name: 'cafe wifi', status: 'Connected', correct: true });
    expect(v.detail).toContain('straight to the printers');
  });
  it('matches any of several cafe networks', () => {
    expect(wifiView(on('Cafe 5G'), 'Cafe WiFi, Cafe 5G').correct).toBe(true);
  });
  it('warns on the wrong network and names both', () => {
    const v = wifiView(on('Home'), 'Cafe WiFi');
    expect(v).toMatchObject({ tone: 'warn', name: 'Home', status: 'Wrong network', correct: false });
    expect(v.detail).toContain('Home');
    expect(v.detail).toContain('Cafe WiFi');
  });
  it('says so when the phone is not on Wi-Fi', () => {
    expect(wifiView(on(null, { onWifi: false }), 'Cafe WiFi')).toMatchObject({ tone: 'warn', name: 'No Wi-Fi', status: 'Not connected', correct: false });
  });
  it('asks for the location permission, then for Location to be on, because Android hides the name without them', () => {
    expect(wifiView(on(null, { locationPermission: false }), 'Cafe WiFi')).toMatchObject({ status: 'Allow location', correct: null });
    expect(wifiView(on(null, { locationOn: false }), 'Cafe WiFi')).toMatchObject({ status: 'Location is off', correct: null });
  });
  it('shows the name neutrally while the admin has not set a cafe Wi-Fi', () => {
    expect(wifiView(on('Home'), '')).toMatchObject({ tone: 'neutral', name: 'Home', status: 'Cafe Wi-Fi not set', correct: null });
    expect(wifiView(on('Home'), undefined).status).toBe('Cafe Wi-Fi not set');
  });
  it('does not guess when the phone cannot be read', () => {
    expect(wifiView(null, 'Cafe WiFi')).toMatchObject({ tone: 'neutral', status: 'Unknown', correct: null });
    expect(wifiView(on(null), 'Cafe WiFi').status).toBe('Unknown');
  });
});
