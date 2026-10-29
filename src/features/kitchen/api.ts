import { api } from '../../api/client';

export interface KitchenLine {
  name: string;
  quantity: number;
  /** How many of them an earlier kitchen ticket already covered; the rest are new in this round. */
  printedQuantity?: number | null;
  note?: string | null;
  extras?: string[];
  takeaway?: boolean | null;
}

export interface KitchenTicket {
  id: number;
  billNumber: string;
  orderType: 'TABLE' | 'OUTDOOR' | 'TAKEAWAY' | string;
  tableNumber?: string | null;
  outdoorToken?: string | null;
  takeawayToken?: string | null;
  status: string;
  createdAt: string;
  kotPrintedAt?: string | null;
  items: KitchenLine[];
}

export const kitchenKey = ['kitchen', 'tickets'] as const;
export const fetchTickets = () => api<KitchenTicket[]>('/kitchen/tickets');
