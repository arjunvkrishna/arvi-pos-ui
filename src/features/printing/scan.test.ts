import { describe, expect, it } from 'vitest';
import { formFromConfig, configFromForm, scanPort, scanProgress, scanRunning, scanTone, slotsUsing } from './rules';

describe('find printers on the network', () => {
  const hosts = { BILL: '192.168.1.41', KOT: '192.168.1.47', JUICE_KOT: '192.168.1.47' };
  it('says which printer slots already use an address', () => {
    expect(slotsUsing('192.168.1.47', hosts)).toEqual(['KOT Printer', 'Juice KOT Printer']);
    expect(slotsUsing('192.168.1.77', hosts)).toEqual([]);
    expect(slotsUsing('192.168.1.41', { ...hosts, BILL: ' 192.168.1.41 ' })).toEqual(['Bill Printer']);
  });
  it('knows when a scan is still going and how far it is', () => {
    expect(scanRunning('PENDING') && scanRunning('RUNNING')).toBe(true);
    expect(scanRunning('DONE') || scanRunning('FAILED') || scanRunning(undefined)).toBe(false);
    expect(scanProgress(120, 253)).toBe(47);
    expect(scanProgress(300, 253)).toBe(100);
    expect(scanProgress(5, 0)).toBe(0);
  });
  it('tones: failures red, done green, working blue', () => {
    expect(scanTone('FAILED')).toBe('danger'); expect(scanTone('TIMED_OUT')).toBe('danger');
    expect(scanTone('DONE')).toBe('ok'); expect(scanTone('RUNNING')).toBe('info');
  });
  it('only the printer ports 9100-9109 are scanned', () => {
    expect(scanPort('9101')).toBe(9101); expect(scanPort(9109)).toBe(9109);
    expect(scanPort('80')).toBe(9100); expect(scanPort('abc')).toBe(9100); expect(scanPort(undefined)).toBe(9100);
  });
});

describe('payment QR switch', () => {
  it('is on unless the saved settings say off, and is sent back as saved', () => {
    expect(formFromConfig(null).paymentQrEnabled).toBe(true);
    expect(formFromConfig({}).paymentQrEnabled).toBe(true);
    expect(formFromConfig({ paymentQrEnabled: false }).paymentQrEnabled).toBe(false);
    expect(configFromForm(formFromConfig({ paymentQrEnabled: false })).paymentQrEnabled).toBe(false);
    expect(configFromForm(formFromConfig({ paymentQrEnabled: true })).paymentQrEnabled).toBe(true);
  });
});
