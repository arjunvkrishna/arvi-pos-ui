import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../inventory/api';
import { buildInvoiceBody, computeTotals, modeForInvoice, rowFromInventory, rowFromNewProduct, rowResult, totalMismatch, withMode, type InvoiceForm, type Row } from './invoiceMath';
import { DEFAULT_DIRECTORY_FILTERS, filterDirectory, filterOverview } from './rules';

const cola: InventoryItem = { id: 7, name: 'Cola', unit: 'bottle', quantity: 10, minQuantity: 2, costPerUnit: 20, packName: 'case', packSize: 12, volumeUnit: 'ltr', unitVolume: 0.5 };
const row = (o: Partial<Row> = {}): Row => ({ ...rowFromInventory({ ...cola, packSize: 0 }, 5), ...o });

describe('invoice rows', () => {
  it('items that come in packs start as one pack at the pack price', () => {
    const r = rowFromInventory(cola, 5);
    expect(r).toMatchObject({ purchaseMode: 'PACK', packName: 'case', packSize: 12, unitPrice: 240, quantity: 1, gstRate: 5 });
  });
  it('shows what the stock gets and the cost per unit and per litre', () => {
    const r = rowFromInventory(cola, 5);
    expect(rowResult({ ...r, quantity: 2 })).toEqual({ stock: '24 bottle (12 ltr)', cost: '₹20.00 / bottle · ₹40.00 / ltr' });
    expect(rowResult({ ...r, packSize: null }).stock).toMatch(/Enter how many bottle in a pack/);
  });
  it('switching pack <-> unit keeps the price per stock unit', () => {
    const unit = withMode(rowFromInventory(cola, 0), 'UNIT', [cola]);
    expect(unit.unitPrice).toBe(20);
    expect(withMode(unit, 'PACK', [cola]).unitPrice).toBe(240);
  });
  it('a new product starts unpriced; countable units ignore the size', () => {
    const r = rowFromNewProduct({ name: ' Napkins ', category: 'Consumable', unit: 'piece', volume: '700', volumeUnit: 'pieces' }, 12);
    expect(r).toMatchObject({ productName: 'Napkins', inventoryItemId: null, unitVolume: 1, unitPrice: 0, gstRate: 12 });
  });
});

describe('invoice totals', () => {
  const rows = [row({ quantity: 2, unitPrice: 100, gstRate: 5 }), row({ quantity: 1, unitPrice: 50, gstRate: 18 })];
  it('adds GST per row and groups it by slab', () => {
    const t = computeTotals(rows, 'AUTO', 0, 10, 5);
    expect(t.subtotal).toBe(250);
    expect(t.itemGst).toBe(19);                      // 10 + 9
    expect(t.calculated).toBe(274);                  // 250 + 19 + 10 - 5
    expect(t.breakdown).toEqual([{ rate: 5, base: 200, gst: 10 }, { rate: 18, base: 50, gst: 9 }]);
  });
  it('a typed GST amount replaces the row GST', () => {
    expect(computeTotals(rows, 'CUSTOM', 30, 0, 0).calculated).toBe(280);
  });
  it('flags a typed total that differs by more than 5 paise', () => {
    expect(totalMismatch(274, 274.04)).toBeNull();
    expect(totalMismatch(300, 274)).toBe(26);
    expect(totalMismatch(0, 274)).toBeNull();
  });
  it('knows the flat rate of an existing invoice', () => {
    const inv = { gstRate: 5, items: [{ gstRate: 18 }, { gstRate: 18 }] } as never;
    expect(modeForInvoice(inv)).toBe('18');
    expect(modeForInvoice({ gstRate: 5, items: [{ gstRate: 5 }, { gstRate: 12 }] } as never)).toBe('AUTO');
    expect(modeForInvoice(null)).toBe('AUTO');
  });
});

describe('invoice request', () => {
  const base = (): InvoiceForm => ({ supplierId: '3', invoiceNumber: ' INV-1 ', invoiceDate: '2026-10-21', dueDate: '', description: ' x ', rows: [row({ quantity: 2, unitPrice: 100, gstRate: 5 })], mode: 'AUTO', customGst: 0, otherCharges: 0, discount: 0, total: 210 });
  it('builds the body with totals and per-row money', () => {
    const b = buildInvoiceBody(base());
    expect(b).toMatchObject({ supplierId: 3, invoiceNumber: 'INV-1', subtotal: 200, gstAmount: 10, gstRate: 5, totalAmount: 210, dueDate: null, description: 'x' });
    expect(typeof b === 'object' && b.items[0]).toMatchObject({ totalPrice: 200, gstAmount: 10 });
  });
  it.each([
    [{ supplierId: '' }, /select a supplier/],
    [{ invoiceNumber: ' ' }, /Invoice number is required/],
    [{ rows: [] }, /at least one product/],
    [{ total: 999 }, /does not match calculation/],
    [{ rows: [row({ quantity: 0 })], total: 0 }, /Invalid quantity/],
    [{ rows: [row({ purchaseMode: 'PACK', packSize: null })], total: 21 }, /how many bottle are in one pack/],
  ])('refuses a bad form %#', (over, msg) => {
    expect(buildInvoiceBody({ ...base(), ...over })).toMatch(msg);
  });
});

describe('supplier filters', () => {
  const list = [
    { id: 1, name: 'Coorg Coffee', phone: '+91 98765 43210', category: 'Coffee', active: true, gstNumber: '29AAA' },
    { id: 2, name: 'Milk Co', contactPerson: 'Ravi', category: 'Dairy', active: false, bankAccount: '5020-0012' },
  ];
  it('directory shows active suppliers by default and matches phone digits', () => {
    expect(filterDirectory(list, DEFAULT_DIRECTORY_FILTERS).map((s) => s.id)).toEqual([1]);
    expect(filterDirectory(list, { ...DEFAULT_DIRECTORY_FILTERS, status: 'ALL' })).toHaveLength(2);
    expect(filterDirectory(list, { ...DEFAULT_DIRECTORY_FILTERS, status: 'ALL', phone: '98765' }).map((s) => s.id)).toEqual([1]);
    expect(filterDirectory(list, { ...DEFAULT_DIRECTORY_FILTERS, status: 'ALL', phone: '50200012' }).map((s) => s.id)).toEqual([2]);
    expect(filterDirectory(list, { ...DEFAULT_DIRECTORY_FILTERS, status: 'INACTIVE', category: 'dairy' }).map((s) => s.id)).toEqual([2]);
  });
  it('overview searches name, contact, phone, email and category', () => {
    expect(filterOverview(list, 'ravi').map((s) => s.id)).toEqual([2]);
    expect(filterOverview(list, 'coffee').map((s) => s.id)).toEqual([1]);
  });
});

describe('expiry date on a purchase line', () => {
  const form = (expiryDate: string): InvoiceForm => ({ supplierId: '3', invoiceNumber: 'INV-1', invoiceDate: '2026-10-25', dueDate: '', description: '', rows: [row({ quantity: 2, unitPrice: 100, gstRate: 0, expiryDate })], mode: '0', customGst: 0, otherCharges: 0, discount: 0, total: 200 });
  it('is sent with the line, empty means none', () => {
    const b = buildInvoiceBody(form('2026-11-02'));
    expect(typeof b === 'object' && b.items[0].expiryDate).toBe('2026-11-02');
    const none = buildInvoiceBody(form(''));
    expect(typeof none === 'object' && none.items[0].expiryDate).toBeNull();
  });
  it('cannot be before the invoice date; the same day is fine', () => {
    expect(buildInvoiceBody(form('2026-10-24'))).toMatch(/cannot be before the invoice date/);
    expect(typeof buildInvoiceBody(form('2026-10-25'))).toBe('object');
  });
});
