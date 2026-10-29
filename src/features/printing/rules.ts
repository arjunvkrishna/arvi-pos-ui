import { getSession } from '../../api/session';
import type { Bill } from '../bills/types';
import type { BridgeStatus, LanStatus, PrinterConfig, PrinterType } from './api';

/** Time on a kitchen ticket: the latest KOT print / order update, not when the order was first created. */
export function kotTicketTime(b: Pick<Bill, 'kotPrintedAt' | 'kotUpdatedAt' | 'createdAt'>): Date | string {
  const ms = (v?: string | null) => { const t = v ? new Date(v).getTime() : NaN; return Number.isNaN(t) ? null : t; };
  const latest = Math.max(ms(b.kotPrintedAt) ?? -Infinity, ms(b.kotUpdatedAt) ?? -Infinity);
  return Number.isFinite(latest) ? new Date(latest) : b.createdAt || new Date();
}

/** A KOT that lists only what changed (added / reduced / cancelled / note) after the first round. */
export const isUpdatedKot = (b: Bill) => (b.kotNoticeType === 'UPDATED' || (b.kotUpdateCount ?? 0) > 0) && (b.latestKotItems ?? []).some((i) => i.updateType);

export function kotTotals(b: Bill) {
  const items = b.latestKotItems && b.latestKotItems.length > 0 ? b.latestKotItems : b.items;
  let qty = 0;
  for (const it of items) {
    const q = it.quantity || 1;
    if (it.updateType === 'ADDED' || it.updateType === 'INCREASED') qty += it.deltaQuantity || q;
    else if (!it.updateType) qty += q;
  }
  return { items, count: items.length, qty };
}

export const orderKind = (b: Pick<Bill, 'orderType' | 'takeawayToken' | 'outdoorToken'>) =>
  b.orderType === 'TAKEAWAY' || b.takeawayToken ? 'TAKEAWAY' : b.orderType === 'OUTDOOR' || b.outdoorToken ? 'OUTDOOR' : 'TABLE';

/** Tax shown on the printed bill. A bill without the GST flag still counts as taxed if it carries a tax amount or rate. */
export function billTax(b: Bill, fallbackGstin = '32CQRPS5214H3ZK') {
  const active = b.gstEnabled != null ? b.gstEnabled : (b.taxAmount ?? 0) > 0 || (b.taxPercent ?? 0) > 0;
  const half = (v?: number) => (v != null ? v / 2 : undefined);
  return {
    active, title: active ? 'TAX INVOICE' : 'CASH BILL / RECEIPT', gstin: b.gstin || fallbackGstin,
    cgstRate: b.cgstPercent ?? half(b.taxPercent) ?? 2.5, sgstRate: b.sgstPercent ?? half(b.taxPercent) ?? 2.5,
    cgstAmt: b.cgstAmount ?? half(b.taxAmount) ?? 0, sgstAmt: b.sgstAmount ?? half(b.taxAmount) ?? 0,
    roundOff: b.roundOff != null && Math.abs(b.roundOff) > 0.001 ? b.roundOff : null,
  };
}

export const totalQty = (b: Bill) => b.items.reduce((a, i) => a + (i.quantity || 0), 0);

/** Overall printer health from the bridge (when online) or the direct LAN probes. */
export interface Health { online: Record<PrinterType, boolean>; offline: string[]; allOnline: boolean; bridgeOnline: boolean }
export function summariseHealth(bridge: BridgeStatus | null, lan: Record<PrinterType, LanStatus | null>): Health {
  const bridgeOnline = Boolean(bridge?.bridgeOnline);
  const online = {
    BILL: bridgeOnline ? !!bridge?.billPrinterReachable : !!lan.BILL?.success,
    KOT: bridgeOnline ? !!bridge?.kotPrinterReachable : !!lan.KOT?.success,
    JUICE_KOT: bridgeOnline ? !!bridge?.juiceKotPrinterReachable : !!lan.JUICE_KOT?.success,
  };
  const offline = ([['BILL', 'Bill'], ['KOT', 'Kitchen KOT'], ['JUICE_KOT', 'Juice KOT']] as const).filter(([k]) => !online[k]).map(([, n]) => n);
  return { online, offline, allOnline: offline.length === 0, bridgeOnline };
}

/** Host shown for each printer: what the bridge reports, else the saved settings, else the factory default. */
export function hostFor(type: PrinterType, bridge: BridgeStatus | null, cfg: PrinterConfig | null): string {
  if (type === 'BILL') return `${bridge?.billPrinterHost || cfg?.billHost || cfg?.host || '192.168.1.37'}:${bridge?.billPrinterPort || cfg?.billPort || cfg?.port || 9100}`;
  if (type === 'KOT') return `${bridge?.kotPrinterHost || cfg?.kotHost || '192.168.1.47'}:${bridge?.kotPrinterPort || cfg?.kotPort || 9100}`;
  return `${bridge?.juiceKotPrinterHost || cfg?.juiceKotHost || '192.168.1.42'}:${bridge?.juiceKotPrinterPort || cfg?.juiceKotPort || 9100}`;
}

export const uptimeText = (sec = 0) => { const m = Math.floor(sec / 60); return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`; };

/** Settings form values <-> server config (strings while typing, numbers on save). */
export interface PrinterForm {
  billHost: string; billPort: string; billEnabled: boolean; kotHost: string; kotPort: string; kotEnabled: boolean; juiceKotHost: string; juiceKotPort: string; juiceKotEnabled: boolean;
  juiceCategories: string[]; headerTitle: string; subheader: string; subheader2: string; footerMessage: string; autoCut: boolean; logoEnabled: boolean;
  kotHeaderTitle: string; kotSubheader: string; kotFooterMessage: string; juiceKotHeaderTitle: string; juiceKotSubheader: string; juiceKotFooterMessage: string;
  logoSize: number; logoGap: number; lineSpacing: number; fontSize: string; printStyle: string; footerSpacing: number;
  paymentQrEnabled: boolean;
}
/** The name printed on bills and kitchen tickets when none was set: the signed-in cafe's own name, never another business's. */
export const brandName = (): string => (getSession()?.tenantName?.trim() || 'ARVI POS').toUpperCase();

export function formFromConfig(c: PrinterConfig | null): PrinterForm {
  const x = c ?? {};
  return {
    billHost: x.billHost || x.host || '192.168.1.37', billPort: String(x.billPort || x.port || 9100), billEnabled: x.billEnabled !== false && x.enabled !== false,
    kotHost: x.kotHost || '192.168.1.47', kotPort: String(x.kotPort || 9100), kotEnabled: x.kotEnabled !== false,
    juiceKotHost: x.juiceKotHost || '192.168.1.42', juiceKotPort: String(x.juiceKotPort || 9100), juiceKotEnabled: x.juiceKotEnabled !== false,
    juiceCategories: (x.juiceKotCategoryIds || '').split(',').map((s) => s.trim()).filter(Boolean),
    headerTitle: x.headerTitle || brandName(), subheader: x.subheader ?? '', subheader2: x.subheader2 ?? '',
    footerMessage: x.footerMessage || 'THANK YOU! VISIT AGAIN', autoCut: x.autoCut !== false, logoEnabled: x.logoEnabled !== false,
    kotHeaderTitle: x.kotHeaderTitle || '*** KITCHEN ORDER ***', kotSubheader: x.kotSubheader || `${brandName()} - MAIN KITCHEN`, kotFooterMessage: x.kotFooterMessage || '--- END OF KOT ---',
    juiceKotHeaderTitle: x.juiceKotHeaderTitle || '*** JUICE ORDER ***', juiceKotSubheader: x.juiceKotSubheader || `${brandName()} - JUICE BAR`, juiceKotFooterMessage: x.juiceKotFooterMessage || '--- END OF JUICE KOT ---',
    logoSize: x.logoSize || 48, logoGap: x.logoGap ?? 0, lineSpacing: x.lineSpacing || 24, fontSize: x.fontSize || 'DOUBLE_HEIGHT', printStyle: x.printStyle || 'CRISP_DARK', footerSpacing: x.footerSpacing ?? 1,
    paymentQrEnabled: x.paymentQrEnabled !== false,
  };
}
export function configFromForm(f: PrinterForm): PrinterConfig {
  const t = (v: string, d: string) => v.trim() || d;
  const port = (v: string) => parseInt(v, 10) || 9100;
  const billHost = t(f.billHost, '192.168.1.37');
  return {
    host: billHost, port: port(f.billPort), enabled: f.billEnabled, billHost, billPort: port(f.billPort), billEnabled: f.billEnabled,
    kotHost: t(f.kotHost, '192.168.1.47'), kotPort: port(f.kotPort), kotEnabled: f.kotEnabled,
    juiceKotHost: t(f.juiceKotHost, '192.168.1.42'), juiceKotPort: port(f.juiceKotPort), juiceKotEnabled: f.juiceKotEnabled, juiceKotCategoryIds: f.juiceCategories.join(','),
    headerTitle: t(f.headerTitle, brandName()), subheader: f.subheader.trim(), subheader2: f.subheader2.trim(), footerMessage: t(f.footerMessage, 'THANK YOU! VISIT AGAIN'), autoCut: f.autoCut, logoEnabled: f.logoEnabled,
    kotHeaderTitle: t(f.kotHeaderTitle, '*** KITCHEN ORDER ***'), kotSubheader: t(f.kotSubheader, `${brandName()} - MAIN KITCHEN`), kotFooterMessage: t(f.kotFooterMessage, '--- END OF KOT ---'),
    juiceKotHeaderTitle: t(f.juiceKotHeaderTitle, '*** JUICE ORDER ***'), juiceKotSubheader: t(f.juiceKotSubheader, `${brandName()} - JUICE BAR`), juiceKotFooterMessage: t(f.juiceKotFooterMessage, '--- END OF JUICE KOT ---'),
    paperWidthMm: 80, logoSize: f.logoSize, logoGap: f.logoGap, lineSpacing: f.lineSpacing, headerSpacing: 1, footerSpacing: f.footerSpacing, fontSize: f.fontSize, printStyle: f.printStyle,
    paymentQrEnabled: f.paymentQrEnabled,
  };
}

/** The printer slots a scan result can be assigned to. */
export const SCAN_SLOTS: { type: PrinterType; label: string; short: string }[] = [
  { type: 'BILL', label: 'Bill Printer', short: 'Bill' }, { type: 'KOT', label: 'KOT Printer', short: 'KOT' }, { type: 'JUICE_KOT', label: 'Juice KOT Printer', short: 'Juice KOT' },
];

/** Which slots already use this address (so a result can say "Current: Bill Printer") given the host fields on screen. */
export const slotsUsing = (ip: string, hosts: Record<PrinterType, string>) => SCAN_SLOTS.filter((s) => (hosts[s.type] || '').trim() === ip).map((s) => s.label);

export const scanRunning = (status?: string) => status === 'PENDING' || status === 'RUNNING';
export const scanProgress = (scanned?: number, total?: number) => (total && total > 0 ? Math.min(100, Math.round(((scanned ?? 0) / total) * 100)) : 0);
export const scanTone = (status?: string) => (status === 'FAILED' || status === 'TIMED_OUT' ? 'danger' : status === 'DONE' ? 'ok' : 'info') as 'danger' | 'ok' | 'info';
/** Only ports 9100-9109 are scanned (the server refuses anything else); a bad value falls back to 9100. */
export const scanPort = (v: string | number | undefined) => { const p = typeof v === 'number' ? v : parseInt(v ?? '', 10); return p >= 9100 && p <= 9109 ? p : 9100; };

/** The cafe's own logo for the receipt (served without a login); the product logo until the cafe uploads one. */
export const cafeLogo = (): string => getSession()?.logoUrl || `${import.meta.env.BASE_URL}logo-05.png`;
