/** Receipt preview for a sample bill of ₹200, exactly like the printed bill: tax invoice with CGST / SGST, or a plain cash bill. */
export interface Preview { title: string; tag: string; showGstin: boolean; gstin: string; cgst: number; sgst: number; cgstAmt: number; sgstAmt: number; roundOff: number | null; grandTotal: number }

const r2 = (n: number) => Math.round(n * 100) / 100;
export const SAMPLE_SUBTOTAL = 200;

export function buildPreview(enabled: boolean, gstin: string, cgst: number, sgst: number, roundOff: boolean): Preview {
  if (!enabled) return { title: 'CASH BILL / RECEIPT', tag: 'GST DISABLED', showGstin: false, gstin: '', cgst: 0, sgst: 0, cgstAmt: 0, sgstAmt: 0, roundOff: null, grandTotal: SAMPLE_SUBTOTAL };
  const cgstAmt = r2((SAMPLE_SUBTOTAL * cgst) / 100);
  const sgstAmt = r2((SAMPLE_SUBTOTAL * sgst) / 100);
  const exact = SAMPLE_SUBTOTAL + cgstAmt + sgstAmt;
  const base = { title: 'TAX INVOICE', tag: 'TAX INVOICE', showGstin: true, gstin: gstin.trim() || '32CQRPS5214H3ZK', cgst, sgst, cgstAmt, sgstAmt };
  if (!roundOff) return { ...base, roundOff: null, grandTotal: r2(exact) };
  const rounded = Math.round(exact);
  return { ...base, roundOff: r2(rounded - exact), grandTotal: rounded };
}

export const totalPercent = (cgst: number, sgst: number) => r2(cgst + sgst);
