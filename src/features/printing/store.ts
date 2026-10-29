import { create } from 'zustand';
import type { Bill } from '../bills/types';

interface PrintUi {
  receipt: Bill | null;
  kot: Bill | null;
  openReceipt: (b: Bill) => void;
  openKot: (b: Bill) => void;
  closeReceipt: () => void;
  closeKot: () => void;
}
/** Which printed document is on screen: the customer bill or the kitchen ticket. */
export const usePrintUi = create<PrintUi>((set) => ({
  receipt: null, kot: null,
  openReceipt: (receipt) => set({ receipt }), openKot: (kot) => set({ kot }),
  closeReceipt: () => set({ receipt: null }), closeKot: () => set({ kot: null }),
}));
