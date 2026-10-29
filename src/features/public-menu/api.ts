export interface PublicItem { id: number; name: string; price: number; description?: string | null; imageUrl?: string | null; isVeg?: boolean | null; isAvailable?: boolean | null }
export interface PublicCategory { id: number; name: string; icon?: string | null; sortOrder?: number | null; items: PublicItem[] }
export interface PublicMenu {
  enabled: boolean; message?: string | null; categories: PublicCategory[];
  cafeName?: string | null; tagline?: string | null; logoUrl?: string | null; address?: string | null; phone?: string | null; currencySymbol?: string | null;
}

export class PublicMenuError extends Error {
  constructor(message: string, readonly kind: 'off' | 'unknown' | 'down') { super(message); }
}

/** The cafe (and optionally branch) a menu link names: /menu?cafe=bluedoor&branch=WF. */
export function menuTarget(search: string): { cafe: string; branch: string } {
  const q = new URLSearchParams(search);
  return { cafe: (q.get('cafe') ?? '').trim().toLowerCase(), branch: (q.get('branch') ?? '').trim() };
}

/** No login and no session header: this page is for customers. */
export async function fetchPublicMenu(cafe: string, branch: string, signal?: AbortSignal): Promise<PublicMenu> {
  const url = `/api/public/${encodeURIComponent(cafe)}/menu${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`;
  let res: Response;
  try { res = await fetch(url, { signal, headers: { Accept: 'application/json' } }); }
  catch (e) { if ((e as { name?: string }).name === 'AbortError') throw e; throw new PublicMenuError('The menu could not be reached. Please try again in a moment.', 'down'); }
  if (res.status === 403) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new PublicMenuError(body?.message || 'The menu is not available right now.', 'off');
  }
  if (res.status === 404 || res.status === 400) throw new PublicMenuError('We could not find this menu. Please check the link or QR code.', 'unknown');
  if (!res.ok) throw new PublicMenuError('The menu could not be loaded. Please try again in a moment.', 'down');
  return (await res.json()) as PublicMenu;
}
