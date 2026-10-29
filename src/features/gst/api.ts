import { api } from '../../api/client';
import { withOfflineCopy } from '../../offline/cache';

export interface GstConfig { enabled: boolean; gstin: string; cgstPercent: number; sgstPercent: number; totalGstPercent?: number; roundOffEnabled: boolean; updatedAt?: string | null; updatedByName?: string | null }
export const DEFAULT_GST: GstConfig = { enabled: true, gstin: '32CQRPS5214H3ZK', cgstPercent: 2.5, sgstPercent: 2.5, totalGstPercent: 5, roundOffEnabled: false };

export const gstKey = ['gst-config'] as const;
export const parcelKey = ['parcel-charge'] as const;
export const fetchGst = () => withOfflineCopy('gst-config', () => api<GstConfig>('/gst/config'));
export const saveGst = (c: Pick<GstConfig, 'enabled' | 'gstin' | 'cgstPercent' | 'sgstPercent' | 'roundOffEnabled'>) => api<GstConfig>('/gst/config', { method: 'PUT', body: c });
export const fetchParcel = () => withOfflineCopy('parcel-charge', () => api<{ defaultParcelCharge?: number | null }>('/settings/parcel-charge'));
export const saveParcel = (defaultParcelCharge: number) => api<{ defaultParcelCharge?: number }>('/settings/parcel-charge', { method: 'POST', body: { defaultParcelCharge } });
