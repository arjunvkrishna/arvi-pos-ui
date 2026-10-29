import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from '../../api/session';
import { testSession } from '../../test/session';
import type { Bill } from '../bills/types';
import { billTax, brandName, cafeLogo, configFromForm, formFromConfig, hostFor, isUpdatedKot, kotTicketTime, kotTotals, orderKind, summariseHealth, uptimeText } from './rules';

afterEach(() => useSession.getState().clear());

const bill = (o: Partial<Bill> = {}): Bill => ({ id: 1, billNumber: 'NRM-0001', status: 'ACTIVE', items: [{ itemName: 'Tea', quantity: 2, price: 10, subtotal: 20 }], subtotal: 20, netAmount: 21, ...o });

describe('KOT', () => {
  it('shows the latest print / update time, not the creation time', () => {
    const t = kotTicketTime({ createdAt: '2026-10-21T13:00:00', kotPrintedAt: '2026-10-21T13:30:00', kotUpdatedAt: '2026-10-21T13:10:00' });
    expect((t as Date).toISOString()).toBe(new Date('2026-10-21T13:30:00').toISOString());
    expect(kotTicketTime({ createdAt: '2026-10-21T13:00:00' })).toBe('2026-10-21T13:00:00');
  });
  it('a later round lists only the changes and counts only what was added', () => {
    const b = bill({ kotUpdateCount: 1, latestKotItems: [{ itemName: 'Tea', quantity: 3, price: 10, subtotal: 30, updateType: 'INCREASED', deltaQuantity: 1 }, { itemName: 'Cake', quantity: 1, price: 5, subtotal: 5, updateType: 'REMOVED' }] });
    expect(isUpdatedKot(b)).toBe(true);
    expect(kotTotals(b)).toMatchObject({ count: 2, qty: 1 });
    expect(isUpdatedKot(bill())).toBe(false);
    expect(kotTotals(bill())).toMatchObject({ count: 1, qty: 2 });
  });
});

describe('bill receipt', () => {
  it('classifies the order', () => {
    expect([orderKind({ takeawayToken: 'T1' }), orderKind({ orderType: 'OUTDOOR' }), orderKind({ orderType: 'TABLE' })]).toEqual(['TAKEAWAY', 'OUTDOOR', 'TABLE']);
  });
  it('a taxed bill is a TAX INVOICE with CGST / SGST (halves when the split is missing), otherwise a cash bill', () => {
    expect(billTax(bill({ gstEnabled: true, taxPercent: 5, taxAmount: 1 }))).toMatchObject({ active: true, title: 'TAX INVOICE', cgstRate: 2.5, cgstAmt: 0.5 });
    expect(billTax(bill({ taxAmount: 2 }))).toMatchObject({ active: true });
    expect(billTax(bill({ gstEnabled: false }))).toMatchObject({ active: false, title: 'CASH BILL / RECEIPT' });
    expect(billTax(bill({ gstEnabled: true, roundOff: -0.4 })).roundOff).toBe(-0.4);
    expect(billTax(bill({ gstEnabled: true, roundOff: 0 })).roundOff).toBeNull();
  });
});

describe('printer health', () => {
  const lan = { BILL: { success: true }, KOT: { success: false }, JUICE_KOT: null };
  it('uses the bridge when it is online', () => {
    const h = summariseHealth({ bridgeOnline: true, billPrinterReachable: true, kotPrinterReachable: true, juiceKotPrinterReachable: false }, lan);
    expect(h).toMatchObject({ bridgeOnline: true, offline: ['Juice KOT'], allOnline: false });
  });
  it('falls back to direct LAN probes', () => {
    expect(summariseHealth(null, lan)).toMatchObject({ bridgeOnline: false, offline: ['Kitchen KOT', 'Juice KOT'] });
    expect(summariseHealth(null, { BILL: { success: true }, KOT: { success: true }, JUICE_KOT: { success: true } }).allOnline).toBe(true);
  });
  it('shows host:port with the right precedence and the uptime', () => {
    expect(hostFor('KOT', { kotPrinterHost: '10.0.0.5', kotPrinterPort: 9101 }, { kotHost: '1.1.1.1' })).toBe('10.0.0.5:9101');
    expect(hostFor('BILL', null, { host: '9.9.9.9' })).toBe('9.9.9.9:9100');
    expect(hostFor('JUICE_KOT', null, null)).toBe('192.168.1.42:9100');
    expect(uptimeText(125)).toBe('2m 5s');
    expect(uptimeText(40)).toBe('40s');
  });
});

describe('printer settings form', () => {
  it('round-trips and applies the defaults', () => {
    const f = formFromConfig({ billHost: '10.1.1.1', juiceKotCategoryIds: '3, 5,' });
    expect(f).toMatchObject({ billHost: '10.1.1.1', billPort: '9100', juiceCategories: ['3', '5'], headerTitle: 'ARVI POS', lineSpacing: 24, fontSize: 'DOUBLE_HEIGHT', printStyle: 'CRISP_DARK' });
    const c = configFromForm({ ...f, billPort: 'abc', kotHost: '  ' });
    expect(c).toMatchObject({ host: '10.1.1.1', billPort: 9100, kotHost: '192.168.1.47', juiceKotCategoryIds: '3,5', paperWidthMm: 80, headerSpacing: 1 });
  });
});

describe('what a bill says when the cafe has set nothing', () => {
  it('uses the signed-in cafe\'s own name and never another business\'s name or address', () => {
    useSession.getState().setUser(testSession('MANAGER', { tenantName: 'Blue Door', outletId: 1 }));
    const f = formFromConfig(null);
    expect(f.headerTitle).toBe('BLUE DOOR');
    expect(f.kotSubheader).toBe('BLUE DOOR - MAIN KITCHEN');
    expect(f.juiceKotSubheader).toBe('BLUE DOOR - JUICE BAR');
    expect(f.subheader).toBe('');
    expect(f.subheader2).toBe('');   // used to be another cafe's tagline and street address
    expect(configFromForm({ ...f, headerTitle: '  ' }).headerTitle).toBe('BLUE DOOR');
  });
  it('falls back to the product name before anyone is signed in', () => {
    useSession.getState().clear();
    expect(brandName()).toBe('ARVI POS');
    expect(cafeLogo()).toMatch(/logo-05\.png$/);
  });
  it('shows the cafe\'s own logo on bills once it has one', () => {
    useSession.getState().setUser(testSession('MANAGER', { logoUrl: '/api/public/bluedoor/logo?v=1' }));
    expect(cafeLogo()).toBe('/api/public/bluedoor/logo?v=1');
  });
});
