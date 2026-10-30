import { api } from '../../api/client';
import { nativePrinter } from '../../native/printer';
import { deliverFromPhone, shouldPrintFromPhone } from './direct';

export interface PrinterConfig {
  host?: string; port?: number; enabled?: boolean;
  billHost?: string; billPort?: number; billEnabled?: boolean; kotHost?: string; kotPort?: number; kotEnabled?: boolean; juiceKotHost?: string; juiceKotPort?: number; juiceKotEnabled?: boolean;
  juiceKotCategoryIds?: string;
  headerTitle?: string; subheader?: string; subheader2?: string; footerMessage?: string; autoCut?: boolean; logoEnabled?: boolean;
  kotHeaderTitle?: string; kotSubheader?: string; kotFooterMessage?: string; juiceKotHeaderTitle?: string; juiceKotSubheader?: string; juiceKotFooterMessage?: string;
  /** UPI "scan to pay" QR (the payment QR) under the payment mode on the bill; on unless switched off */
  paymentQrEnabled?: boolean;
  /** Wi-Fi names (comma-separated) on which the Android app prints straight to the LAN printers; empty = off */
  directPrintSsids?: string;
  paperWidthMm?: number; logoSize?: number; logoGap?: number; lineSpacing?: number; headerSpacing?: number; footerSpacing?: number; fontSize?: string; printStyle?: string;
}
export interface BridgeStatus {
  bridgeOnline?: boolean; bridgeIp?: string; freePsramBytes?: number; pendingJobs?: number; uptimeSeconds?: number;
  billPrinterHost?: string; billPrinterPort?: number; billPrinterReachable?: boolean; billPrinterLatencyMs?: number;
  kotPrinterHost?: string; kotPrinterPort?: number; kotPrinterReachable?: boolean; kotPrinterLatencyMs?: number;
  juiceKotPrinterHost?: string; juiceKotPrinterPort?: number; juiceKotPrinterReachable?: boolean; juiceKotPrinterLatencyMs?: number;
}
export interface LanStatus { success?: boolean; message?: string }
export type PrinterType = 'BILL' | 'KOT' | 'JUICE_KOT';
/** A ticket the server holds for this phone to print itself. */
export interface DevicePrintJob { jobId: string; printType: string; host: string; port: number; dataBase64: string }
export interface PrintResponse { jobId?: string; status?: string; success?: boolean; host?: string; port?: number; message?: string; warning?: string; deviceJobs?: DevicePrintJob[] }
/** How to divide a bill by items: one entry per new bill, each listing how many of which line go on it. */
export interface SplitBillRequest { portions: { items: { billItemId: number; quantity: number }[] }[] }
export interface JobStatus { status: string; lastErrorMessage?: string | null }

export const printerKey = ['printer'] as const;
export const fetchPrinterConfig = () => api<PrinterConfig>('/printer/config');
/** The cafe Wi-Fi name(s) for direct printing. Readable by everyone who can print (the full config needs more rights). */
export const fetchDirectPrintSsids = () => api<{ ssids: string }>('/printer/direct-print').then((r) => r.ssids);
export const savePrinterConfig = (c: PrinterConfig) => api<PrinterConfig>('/printer/config', { method: 'PUT', body: c });
export const fetchBridgeStatus = () => api<BridgeStatus>('/printer/bridge/status').catch(() => null);
export const fetchLanStatus = (type: PrinterType, cached: boolean) => api<LanStatus>(`/printer/status?type=${type}${cached ? '&cached=1' : ''}`).catch((e: Error) => ({ success: false, message: e.message }) as LanStatus);

/** A short id for this phone, so the server can tell two phones of the same login apart. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('arvi_device_id');
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem('arvi_device_id', id); }
    return id;
  } catch { return 'unknown'; }
}

let ssidCache: { at: number; value: Promise<string | undefined> } | null = null;
/** The cafe Wi-Fi names from the server, remembered for a minute so a busy counter does not ask on every ticket. */
export const configuredSsids = (): Promise<string | undefined> => {
  if (!ssidCache || Date.now() - ssidCache.at > 60_000) {
    ssidCache = { at: Date.now(), value: fetchDirectPrintSsids().catch(() => undefined) };
  }
  return ssidCache.value;
};
export const forgetConfiguredSsids = () => { ssidCache = null; };

export const reportDeviceResult = (jobId: string, body: { outcome: string; message: string; bytesWritten: number }) =>
  api(`/printer/jobs/${encodeURIComponent(jobId)}/device-result`, { method: 'POST', body, headers: { 'X-Device-Id': deviceId() } });

/**
 * Every ticket goes through here. In the Android app on the cafe Wi-Fi the phone prints straight to the printer; otherwise
 * (a browser, other Wi-Fi, mobile data, printer not answering) it is the normal cloud print.
 */
export async function printVia(path: string, init: { headers?: Record<string, string>; body?: unknown } = {}): Promise<PrintResponse> {
  const native = nativePrinter();
  const deps = { native, configuredSsids, report: reportDeviceResult };
  if (!(await shouldPrintFromPhone(deps))) return api<PrintResponse>(path, { method: 'POST', ...init });
  const res = await api<PrintResponse>(path, { method: 'POST', body: init.body, headers: { ...init.headers, 'X-Print-Route': 'DEVICE', 'X-Device-Id': deviceId() } });
  return res.deviceJobs?.length ? deliverFromPhone(res, deps) : res;
}

export const printTestPage = (type: PrinterType) => printVia(`/printer/test?type=${encodeURIComponent(type)}`);
/** `redeemPoints` prints the bill as it will be once that many loyalty points are used (nothing is redeemed by printing). */
export const printBill = (id: number, redeemPoints?: number) => printVia(`/printer/print-bill/${id}${redeemPoints ? `?redeemPoints=${redeemPoints}` : ''}`);
/** One printed bill per group of items; see SplitBillDialog. */
export const printBillSplit = (id: number, body: SplitBillRequest, idempotencyKey?: string) =>
  printVia(`/printer/print-bill-split/${id}`, { body, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });
export const printKot = (id: number, idempotencyKey: string) => printVia(`/printer/print-kot/${id}`, { headers: { 'Idempotency-Key': idempotencyKey } });
export const jobStatus = (jobId: string) => api<JobStatus>(`/printer/jobs/${jobId}/status`);
export const markBillPrinted = (id: number) => api(`/bills/${id}/print`, { method: 'POST' });

/** "Find printers on the network": the print bridge scans the shop Wi-Fi for devices listening on the printer port. */
export interface ScannedPrinter { ip: string; port: number; latencyMs?: number | null; busy?: boolean }
export interface PrinterScan { id: string; status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'TIMED_OUT' | string; message?: string; subnet?: string; port?: number; scanned?: number; total?: number; printers?: ScannedPrinter[] }
export const startPrinterScanRequest = (port: number) => api<PrinterScan>(`/printer/scan?port=${port}`, { method: 'POST' });
export const fetchPrinterScan = (id: string) => api<PrinterScan>(`/printer/scan/${encodeURIComponent(id)}`);
