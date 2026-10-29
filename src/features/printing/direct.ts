import type { NativePrinter, NativeStatus, SendResult } from '../../native/printer';
import type { DevicePrintJob, PrintResponse } from './api';

/**
 * Printing straight from the phone. On the cafe Wi-Fi the staff app sends the ticket to the LAN printer itself; anywhere else
 * (or if the printer does not answer) the ticket goes the normal way, through the cloud bridge. The server builds every ticket
 * either way, and it is told what happened so the order's print status stays right.
 */

export const ssidList = (configured?: string | null): string[] => (configured ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

/** Wi-Fi names compare ignoring case; an empty list means direct printing is off. */
export const onCafeWifi = (ssid: string | null | undefined, configured?: string | null): boolean =>
  !!ssid && ssidList(configured).some((n) => n.toLowerCase() === ssid.toLowerCase());

export type DirectState = 'off' | 'no-permission' | 'location-off' | 'not-wifi' | 'other-wifi' | 'ready';
export interface Readiness { state: DirectState; ssid: string | null; label: string }

/** Why this phone will or will not print directly right now, in words for the staff. */
export function readiness(status: NativeStatus | null, configured?: string | null): Readiness {
  const ssid = status?.ssid ?? null;
  if (ssidList(configured).length === 0) return { state: 'off', ssid, label: 'Direct printing is off. Printing goes through the cloud.' };
  if (!status) return { state: 'off', ssid, label: 'Could not read the phone’s Wi-Fi. Printing goes through the cloud.' };
  if (!status.onWifi) return { state: 'not-wifi', ssid, label: 'Not on Wi-Fi. Printing goes through the cloud.' };
  if (!status.locationPermission) return { state: 'no-permission', ssid, label: 'Allow location access so the app can see the Wi-Fi name. Until then, printing goes through the cloud.' };
  if (!status.locationOn) return { state: 'location-off', ssid, label: 'Switch Location on in the phone settings so the Wi-Fi name can be read. Until then, printing goes through the cloud.' };
  if (!onCafeWifi(ssid, configured)) return { state: 'other-wifi', ssid, label: `On “${ssid ?? 'unknown'}”, which is not the cafe Wi-Fi. Printing goes through the cloud.` };
  return { state: 'ready', ssid, label: `On the cafe Wi-Fi (“${ssid}”). Printing goes straight to the printers.` };
}

export interface Deps {
  native: NativePrinter | null;
  /** The cafe Wi-Fi names saved on the server. */
  configuredSsids: () => Promise<string | undefined>;
  report: (jobId: string, body: { outcome: SendResult['outcome']; message: string; bytesWritten: number }) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
}

/** True when this print should be sent from the phone: in the app, on a listed Wi-Fi. Never throws: any doubt means the cloud. */
export async function shouldPrintFromPhone(deps: Pick<Deps, 'native' | 'configuredSsids'>): Promise<boolean> {
  if (!deps.native) return false;
  try {
    const configured = await deps.configuredSsids();
    if (ssidList(configured).length === 0) return false;
    return readiness(await deps.native.getStatus(), configured).state === 'ready';
  } catch { return false; }
}

const DELAYS_MS = [0, 500, 1500, 4000];
const QUICK_REFUSAL_MS = 1000;
const RETRY_AFTER_MS = 350;
const RETRY_JITTER_MS = 300;

/** One try at sending a ticket to its printer; a crash in the phone's helper counts as "nothing was sent". */
async function sendOnce(job: DevicePrintJob, deps: Deps): Promise<SendResult> {
  try {
    return deps.native
      ? await deps.native.send({ host: job.host, port: job.port, dataBase64: job.dataBase64, connectTimeoutMs: 2500, writeTimeoutMs: 6000 })
      : { outcome: 'NOT_SENT', bytesWritten: 0, message: 'Not running in the app' };
  } catch (e) {
    return { outcome: 'NOT_SENT', bytesWritten: 0, message: e instanceof Error ? e.message : String(e) };
  }
}
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tells the server what happened. Retried briefly: the server hands an unreported ticket to the cloud bridge after 45 s. */
async function reportWithRetry(deps: Deps, job: DevicePrintJob, r: SendResult): Promise<boolean> {
  const sleep = deps.sleep ?? realSleep;
  for (const wait of DELAYS_MS) {
    if (wait) await sleep(wait);
    try { await deps.report(job.jobId, { outcome: r.outcome, message: r.message, bytesWritten: r.bytesWritten }); return true; } catch { /* try again */ }
  }
  return false;
}

/** Sends each ticket the server handed over, one after another (a printer takes one connection at a time), and reports each result. */
export async function deliverFromPhone(res: PrintResponse, deps: Deps): Promise<PrintResponse> {
  const jobs = res.deviceJobs ?? [];
  const results: { job: DevicePrintJob; r: SendResult; reported: boolean }[] = [];
  for (const job of jobs) {
    let r = await sendOnce(job, deps);
    // A printer is busy with another phone (or its own job) when the connection is refused straight away. A second try a moment
    // later almost always gets through, and is much better than sending a ticket the long way round. A printer that is off or
    // out of range makes the phone wait for the timeout instead, and that is not retried.
    if (r.outcome === 'NOT_SENT' && (r.latencyMs ?? Infinity) < QUICK_REFUSAL_MS) {
      await (deps.sleep ?? realSleep)(RETRY_AFTER_MS + Math.floor(Math.random() * RETRY_JITTER_MS));
      r = await sendOnce(job, deps);
    }
    results.push({ job, r, reported: await reportWithRetry(deps, job, r) });
  }

  const unsure = results.find((x) => x.r.outcome === 'UNSURE');
  const notSent = results.find((x) => x.r.outcome === 'NOT_SENT');
  const unreported = results.find((x) => x.r.outcome === 'PRINTED' && !x.reported);
  const focus = unsure ?? notSent ?? results[0];
  const base: PrintResponse = { ...res, deviceJobs: undefined, jobId: focus?.job.jobId ?? res.jobId };

  if (unsure) {
    return { ...base, success: true, status: 'NEEDS_REVIEW', message: unsure.r.message,
      warning: 'The connection to the printer broke while printing. Check the paper: the ticket may have printed. It is marked for review so it is not printed twice.' };
  }
  if (notSent) {
    return { ...base, success: true, status: 'PENDING',
      warning: 'The printer did not answer from this phone, so the ticket was sent through the cloud instead.' };
  }
  return { ...base, success: true, status: 'COMPLETED', message: 'Printed directly from this phone',
    warning: unreported ? 'Printed, but the server could not be told in time. If a copy comes out again, ignore it.' : undefined };
}
