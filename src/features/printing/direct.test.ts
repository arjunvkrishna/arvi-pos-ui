import { describe, expect, it, vi } from 'vitest';
import type { NativePrinter, NativeStatus, SendResult } from '../../native/printer';
import type { PrintResponse } from './api';
import { deliverFromPhone, onCafeWifi, readiness, shouldPrintFromPhone, ssidList } from './direct';

const ready: NativeStatus = { locationPermission: true, onWifi: true, locationOn: true, ssid: 'Cafe WiFi' };
const job = (id: string, host: string, type = 'KOT') => ({ jobId: id, printType: type, host, port: 9100, dataBase64: 'AQID' });
const noSleep = () => Promise.resolve();

function fakeNative(over: Partial<NativePrinter> = {}): NativePrinter {
  return {
    getStatus: async () => ready,
    probe: async () => ({ reachable: true, latencyMs: 4, message: 'reachable' }),
    send: async () => ({ outcome: 'PRINTED', bytesWritten: 3, message: 'printed' }),
    checkPermissions: async () => ({ location: 'granted' }),
    requestPermissions: async () => ({ location: 'granted' }),
    ...over,
  };
}

describe('cafe Wi-Fi matching', () => {
  it('reads a list, ignoring spaces, blanks and line breaks', () => {
    expect(ssidList(' Cafe WiFi , ,Cafe 5G\nStaff ')).toEqual(['Cafe WiFi', 'Cafe 5G', 'Staff']);
    expect(ssidList(undefined)).toEqual([]);
  });
  it('matches the name exactly but ignores case', () => {
    expect(onCafeWifi('cafe wifi', 'Cafe WiFi')).toBe(true);
    expect(onCafeWifi('Cafe WiFi 2', 'Cafe WiFi')).toBe(false);
    expect(onCafeWifi('Cafe 5G', 'Cafe WiFi, Cafe 5G')).toBe(true);
    expect(onCafeWifi(null, 'Cafe WiFi')).toBe(false);
    expect(onCafeWifi('Cafe WiFi', '')).toBe(false);
  });
});

describe('readiness', () => {
  it('is ready only on a listed Wi-Fi with permission and location on', () => {
    expect(readiness(ready, 'Cafe WiFi').state).toBe('ready');
  });
  it('says why it is not', () => {
    expect(readiness(ready, '').state).toBe('off');
    expect(readiness(null, 'Cafe WiFi').state).toBe('off');
    expect(readiness({ ...ready, onWifi: false, ssid: null }, 'Cafe WiFi').state).toBe('not-wifi');
    expect(readiness({ ...ready, locationPermission: false, ssid: null }, 'Cafe WiFi').state).toBe('no-permission');
    expect(readiness({ ...ready, locationOn: false, ssid: null }, 'Cafe WiFi').state).toBe('location-off');
    const other = readiness({ ...ready, ssid: 'Neighbour' }, 'Cafe WiFi');
    expect(other.state).toBe('other-wifi');
    expect(other.label).toContain('Neighbour');
  });
});

describe('choosing the route', () => {
  const ssids = async () => 'Cafe WiFi';
  it('prints from the phone on the cafe Wi-Fi', async () => {
    expect(await shouldPrintFromPhone({ native: fakeNative(), configuredSsids: ssids })).toBe(true);
  });
  it('uses the cloud in a normal browser, on other Wi-Fi, on mobile data, or when direct printing is off', async () => {
    expect(await shouldPrintFromPhone({ native: null, configuredSsids: ssids })).toBe(false);
    expect(await shouldPrintFromPhone({ native: fakeNative({ getStatus: async () => ({ ...ready, ssid: 'Home' }) }), configuredSsids: ssids })).toBe(false);
    expect(await shouldPrintFromPhone({ native: fakeNative({ getStatus: async () => ({ ...ready, onWifi: false, ssid: null }) }), configuredSsids: ssids })).toBe(false);
    expect(await shouldPrintFromPhone({ native: fakeNative(), configuredSsids: async () => '' })).toBe(false);
    expect(await shouldPrintFromPhone({ native: fakeNative(), configuredSsids: async () => undefined })).toBe(false);
  });
  it('uses the cloud when anything goes wrong asking', async () => {
    expect(await shouldPrintFromPhone({ native: fakeNative({ getStatus: async () => { throw new Error('boom'); } }), configuredSsids: ssids })).toBe(false);
    expect(await shouldPrintFromPhone({ native: fakeNative(), configuredSsids: async () => { throw new Error('offline'); } })).toBe(false);
  });
});

describe('delivering the tickets the server handed over', () => {
  const res = (...jobs: ReturnType<typeof job>[]): PrintResponse => ({ success: true, status: 'CLAIMED', jobId: jobs[0].jobId, deviceJobs: jobs });

  it('prints each ticket to its own printer, in order, and reports each as printed', async () => {
    const sent: string[] = [];
    const report = vi.fn().mockResolvedValue({});
    const native = fakeNative({ send: async (o) => { sent.push(o.host); return { outcome: 'PRINTED', bytesWritten: 3, message: 'printed' }; } });

    const out = await deliverFromPhone(res(job('a', '192.168.1.41'), job('b', '192.168.1.42', 'JUICE_KOT')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(sent).toEqual(['192.168.1.41', '192.168.1.42']);
    expect(report).toHaveBeenNthCalledWith(1, 'a', { outcome: 'PRINTED', message: 'printed', bytesWritten: 3 });
    expect(report).toHaveBeenNthCalledWith(2, 'b', { outcome: 'PRINTED', message: 'printed', bytesWritten: 3 });
    expect(out.status).toBe('COMPLETED');
    expect(out.deviceJobs).toBeUndefined();
    expect(out.warning).toBeUndefined();
  });

  it('hands a printer that did not answer back to the cloud and says so, while the other still prints', async () => {
    const report = vi.fn().mockResolvedValue({});
    const native = fakeNative({
      send: async (o): Promise<SendResult> => (o.host === '192.168.1.41'
        ? { outcome: 'NOT_SENT', bytesWritten: 0, message: 'ConnectException: timed out' }
        : { outcome: 'PRINTED', bytesWritten: 3, message: 'printed' }),
    });

    const out = await deliverFromPhone(res(job('a', '192.168.1.41'), job('b', '192.168.1.42', 'JUICE_KOT')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(report).toHaveBeenCalledWith('a', expect.objectContaining({ outcome: 'NOT_SENT' }));
    expect(report).toHaveBeenCalledWith('b', expect.objectContaining({ outcome: 'PRINTED' }));
    expect(out.status).toBe('PENDING');
    expect(out.jobId).toBe('a');
    expect(out.warning).toMatch(/through the cloud/);
  });

  it('marks a broken connection for review instead of printing it twice', async () => {
    const native = fakeNative({ send: async () => ({ outcome: 'UNSURE', bytesWritten: 900, message: 'reset' }) });
    const report = vi.fn().mockResolvedValue({});

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(report).toHaveBeenCalledWith('a', expect.objectContaining({ outcome: 'UNSURE', bytesWritten: 900 }));
    expect(out.status).toBe('NEEDS_REVIEW');
    expect(out.warning).toMatch(/may have printed/);
  });

  it('treats a native error as "nothing was sent"', async () => {
    const native = fakeNative({ send: async () => { throw new Error('plugin crashed'); } });
    const report = vi.fn().mockResolvedValue({});

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(report).toHaveBeenCalledWith('a', expect.objectContaining({ outcome: 'NOT_SENT', message: 'plugin crashed' }));
    expect(out.status).toBe('PENDING');
  });

  it('retries telling the server, and still says it printed if the server cannot be reached', async () => {
    const report = vi.fn().mockRejectedValue(new Error('offline'));

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native: fakeNative(), report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(report).toHaveBeenCalledTimes(4);
    expect(out.status).toBe('COMPLETED');
    expect(out.warning).toMatch(/could not be told/);
  });

  it('succeeds on a later retry without complaint', async () => {
    const report = vi.fn().mockRejectedValueOnce(new Error('blip')).mockResolvedValue({});

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native: fakeNative(), report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(report).toHaveBeenCalledTimes(2);
    expect(out.warning).toBeUndefined();
  });

  it('tries a refused (busy) printer once more before handing the ticket to the cloud', async () => {
    let calls = 0;
    const native = fakeNative({ send: async () => (++calls === 1 ? { outcome: 'NOT_SENT', bytesWritten: 0, message: 'ECONNREFUSED', latencyMs: 4 } : { outcome: 'PRINTED', bytesWritten: 3, message: 'printed' }) });
    const report = vi.fn().mockResolvedValue({});

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(calls).toBe(2);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('a', expect.objectContaining({ outcome: 'PRINTED' }));
    expect(out.status).toBe('COMPLETED');
  });

  it('gives up after that one retry and falls back to the cloud', async () => {
    let calls = 0;
    const native = fakeNative({ send: async () => { calls++; return { outcome: 'NOT_SENT', bytesWritten: 0, message: 'ECONNREFUSED', latencyMs: 3 }; } });
    const report = vi.fn().mockResolvedValue({});

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report, configuredSsids: async () => 'x', sleep: noSleep });

    expect(calls).toBe(2);
    expect(out.status).toBe('PENDING');
  });

  it('does not retry a printer that took the full timeout (switched off or out of range)', async () => {
    let calls = 0;
    const native = fakeNative({ send: async () => { calls++; return { outcome: 'NOT_SENT', bytesWritten: 0, message: 'timed out', latencyMs: 2500 }; } });

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report: vi.fn().mockResolvedValue({}), configuredSsids: async () => 'x', sleep: noSleep });

    expect(calls).toBe(1);
    expect(out.status).toBe('PENDING');
  });

  it('never retries a connection that broke part-way: it may have printed', async () => {
    let calls = 0;
    const native = fakeNative({ send: async () => { calls++; return { outcome: 'UNSURE', bytesWritten: 500, message: 'reset', latencyMs: 20 }; } });

    const out = await deliverFromPhone(res(job('a', '192.168.1.41')), { native, report: vi.fn().mockResolvedValue({}), configuredSsids: async () => 'x', sleep: noSleep });

    expect(calls).toBe(1);
    expect(out.status).toBe('NEEDS_REVIEW');
  });
});
