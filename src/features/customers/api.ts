import { api, ApiError } from '../../api/client';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  address?: string | null;
  allergies?: string | null;
  notes?: string | null;
  marketingConsent: boolean;
  pointsBalance: number;
  /** Last day the points are valid; every purchase moves it forward. */
  pointsExpireAt?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoyaltyLedger {
  id: number;
  customerId: number;
  billId?: number | null;
  type: 'EARN' | 'REDEEM' | 'REFUND' | 'ADJUST' | 'EXPIRE';
  points: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  anniversary?: string;
  address?: string;
  allergies?: string;
  notes?: string;
  marketingConsent?: boolean;
}

export const customersKey = ['customers'] as const;
export const customerKey = (id: number) => ['customers', id] as const;
export const loyaltyKey = (id: number) => ['customers', id, 'loyalty'] as const;

export const fetchCustomers = (q?: string) => {
  if (q && q.trim()) {
    return api<Customer[]>(`/customers/search?q=${encodeURIComponent(q.trim())}`);
  }
  return api<{ content: Customer[] } | Customer[]>('/customers?size=100').then((res) => {
    return Array.isArray(res) ? res : res.content || [];
  });
};

export const fetchCustomer = (id: number) => api<Customer>(`/customers/${id}`);

/** The member with this phone number, or null when there is none yet. */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  try {
    return await api<Customer>(`/customers?phone=${encodeURIComponent(phone.trim())}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export interface LoyaltySettings {
  /** Days without a purchase after which the points lapse. */
  expiryDays: number;
  /** Least points per redemption, and the least balance that can redeem. */
  minRedeemPoints: number;
  rupeesPerPointEarned: number;
  rupeesPerPointRedeemed: number;
  updatedByName?: string | null;
}

export const loyaltySettingsKey = ['loyalty', 'settings'] as const;
export const fetchLoyaltySettings = () => api<LoyaltySettings>('/loyalty/settings');
export const saveLoyaltySettings = (s: { expiryDays: number; minRedeemPoints: number }) =>
  api<LoyaltySettings>('/loyalty/settings', { method: 'PUT', body: s });

export const createCustomer = (c: CustomerInput) => api<Customer>('/customers', { method: 'POST', body: c });

export const updateCustomer = (id: number, c: CustomerInput) => api<Customer>(`/customers/${id}`, { method: 'PUT', body: c });

export const fetchLoyaltyLedger = (customerId: number) => api<LoyaltyLedger[]>(`/customers/${customerId}/loyalty`);

export interface Campaign {
  id: number;
  name: string;
  message: string;
  channel: 'EMAIL' | 'SMS';
  audienceType: 'ALL' | 'LOYALTY_MEMBERS' | 'INACTIVE_30_DAYS';
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  sentCount: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export const fetchCampaigns = () => api<Campaign[]>('/campaigns');
export const createCampaign = (data: Partial<Campaign>) => api<Campaign>('/campaigns', { method: 'POST', body: data });
export const sendCampaign = (id: number) => api<{ campaignId: number; status: string; sentCount: number }>('/campaigns/' + id + '/send', { method: 'POST' });
export const fetchAudienceCount = (audienceType: string) => api<{ audienceType: string; eligibleCount: number }>('/campaigns/audience-count?audienceType=' + audienceType);

