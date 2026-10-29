import { api, apiBlob, apiUpload } from '../../api/client';

export interface CafeProfile {
  id: number; name: string; code: string;
  contactEmail?: string | null; contactPhone?: string | null; address?: string | null; gstNumber?: string | null;
  tagline?: string | null; logoUrl?: string | null; subscriptionPlan?: string; maxOutlets?: number;
}
export type CafeProfileInput = Pick<CafeProfile, 'name' | 'contactEmail' | 'contactPhone' | 'address' | 'gstNumber' | 'tagline'>;

export type ImageKind = 'logo' | 'payment-qr';
/** Which images exist, per kind, as the branches they are set for: `null` is the cafe-wide image, a number is one branch's own. */
export interface BrandingOverview { assets: { LOGO: (number | null)[]; PAYMENT_QR: (number | null)[] } }

export const cafeKey = ['tenant', 'settings'] as const;
export const brandingKey = ['branding'] as const;
export const fetchCafe = () => api<CafeProfile>('/tenant/settings');
export const saveCafe = (b: CafeProfileInput) => api<CafeProfile>('/tenant/settings', { method: 'PUT', body: b });
export const fetchBranding = () => api<BrandingOverview>('/branding');

const withBranch = (path: string, outletId: number | null) => (outletId ? `${path}?outletId=${outletId}` : path);
export const uploadImage = (kind: ImageKind, file: File, outletId: number | null) => apiUpload(withBranch(`/branding/${kind}`, outletId), file, 'PUT');
export const removeImage = (kind: ImageKind, outletId: number | null) => api(withBranch(`/branding/${kind}`, outletId), { method: 'DELETE' });
/** The image in effect (as the server would print or show it) as an object URL, or null when there is none. */
export async function imageUrl(kind: ImageKind, outletId: number | null): Promise<string | null> {
  try { return URL.createObjectURL((await apiBlob(withBranch(`/branding/${kind}`, outletId))).blob); } catch { return null; }
}
