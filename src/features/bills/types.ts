export interface BillItem {
  id?: number; menuItemId?: number; itemName: string; menuItemName?: string; quantity: number; price: number; subtotal: number; totalPrice?: number;
  isTakeaway?: boolean; customization?: string | null; printedQuantity?: number;
  modifiersSnapshot?: string | null; comboSnapshot?: string | null;
  updateType?: 'ADDED' | 'INCREASED' | 'DECREASED' | 'REMOVED' | 'NOTE_UPDATED' | string; deltaQuantity?: number; updateMessage?: string | null;
}

export interface Bill {
  id: number; billNumber: string; kotNumber?: string | null; status: string; paymentStatus?: string; orderType?: 'TABLE' | 'OUTDOOR' | 'TAKEAWAY' | string;
  tableNumber?: string | null; outdoorToken?: string | null; takeawayToken?: string | null; customerName?: string | null; notes?: string | null;
  customerId?: number | null; customerPhone?: string | null; businessDate?: string | null;
  createdAt?: string | null; billedAt?: string | null; createdByName?: string | null; printedByName?: string | null;
  items: BillItem[]; latestKotItems?: BillItem[]; kotPrintedAt?: string | null; kotUpdatedAt?: string | null; kotUpdateCount?: number; kotNoticeType?: string | null; kotLastChanges?: string | null;
  paymentMode?: string; subtotal: number; discountPercent?: number; discountAmount?: number; taxPercent?: number; taxAmount?: number; gstEnabled?: boolean; gstin?: string | null;
  cgstPercent?: number; sgstPercent?: number; cgstAmount?: number; sgstAmount?: number; roundOff?: number; parcelCharge?: number;
  promotionName?: string | null; promotionPercentage?: number; promotionDiscountAmount?: number; netAmount: number; tipAmount?: number; paymentSummary?: string | null; payments?: { mode: string; amount: number; reference?: string | null }[] | null; totalRefunded?: number;
  deletedAt?: string | null; deletedByName?: string | null; deleteReason?: string | null;
}

/** One row of the Bill Log list (GET /bills/daily, /bills/monthly): the full bill comes from GET /bills/{id}. */
export interface BillLogRow {
  id: number; billNumber: string; status: string; orderType?: string; tableNumber?: string | null; outdoorToken?: string | null; takeawayToken?: string | null;
  customerName?: string | null; createdByName?: string | null; printedByName?: string | null; createdAt?: string | null; itemCount: number;
  paymentMode?: string; netAmount: number; totalRefunded?: number; deletedAt?: string | null; deletedByName?: string | null; deleteReason?: string | null;
}
