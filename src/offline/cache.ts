import { isNetworkProblem } from './connection';

const PREFIX = 'arvi_offline_cache_v1:';

export function remember(key: string, value: unknown, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try { storage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value })); } catch { /* storage full or blocked: offline copy is just not kept */ }
}
export function recall<T>(key: string, storage: Pick<Storage, 'getItem'> = localStorage): T | undefined {
  try { const raw = storage.getItem(PREFIX + key); return raw ? (JSON.parse(raw) as { value: T }).value : undefined; } catch { return undefined; }
}
export function forgetAll(storage: Storage = localStorage): void {
  try { Object.keys(storage).filter((k) => k.startsWith(PREFIX)).forEach((k) => storage.removeItem(k)); } catch { /* ignore */ }
}

/**
 * Loads data and keeps a copy on this device. When the server cannot be reached the last copy is used, so the menu and tables still show.
 * Only used for things that change rarely (menu, tables, tax settings).
 */
export async function withOfflineCopy<T>(key: string, load: () => Promise<T>): Promise<T> {
  try { const v = await load(); remember(key, v); return v; }
  catch (e) {
    if (isNetworkProblem(e)) { const c = recall<T>(key); if (c !== undefined) return c; }
    throw e;
  }
}
