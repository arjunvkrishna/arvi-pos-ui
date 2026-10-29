import { getSession, SESSION_KEY, useSession } from './session';
import { useConnection } from '../offline/connection';
import { forgetAll } from '../offline/cache';
import { normalizePatch, normalizeSession } from './roles';
import type { Session } from './types';

export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;
  constructor(message: string, status: number, body: unknown, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; error?: unknown };
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.error === 'string' && b.error) return b.error;
  }
  return fallback;
}

/**
 * The headers every authenticated request carries: the token, and the branch an owner or general manager picked to work in
 * (X-Outlet-Id; branch managers and staff are limited to their own branch by the server, whatever they send).
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const s = getSession();
  const headers: Record<string, string> = { ...extra };
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  if (s?.selectedOutletId) headers['X-Outlet-Id'] = String(s.selectedOutletId);
  return headers;
}

export const NO_CONNECTION = 'No connection to the server. Check the Wi-Fi and try again.';
/** fetch that turns "could not connect" into a clear ApiError (status 0) and tells the connection monitor. Aborted requests pass through. */
async function connect(input: string, init: RequestInit): Promise<Response> {
  try { return await fetch(input, init); }
  catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') throw e;
    useConnection.getState().markOffline();
    throw new ApiError(NO_CONNECTION, 0, null);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the (single-use) refresh token for new tokens. Concurrent callers share one request. If another browser
 * tab already rotated the tokens, those are adopted instead of spending the refresh token a second time.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = getSession();
    if (!current) return false;
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
      if (stored && stored.token && stored.token !== current.token) {
        useSession.setState({ user: { ...current, token: stored.token, refreshToken: stored.refreshToken } });
        return true;
      }
    } catch { /* ignore */ }
    if (!current.refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || !data.token) return false;
    useSession.getState().patchUser(normalizePatch(data));
    return true;
  })().catch(() => false).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

/** Ends the session (tells the server to revoke the refresh token, then forgets everything locally). */
export function logout(): void {
  const s = getSession();
  if (s?.refreshToken) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
      keepalive: true,
    }).catch(() => { /* best effort */ });
  }
  try { localStorage.removeItem('arvi_active_tab'); } catch { /* ignore */ }
  forgetAll();
  useSession.getState().clear();
}

/**
 * Authenticated JSON request. A 401 triggers one token refresh and one retry; if that fails the user is logged out.
 * Errors carry the server's message (and Retry-After for lockout / rate-limit responses).
 */
export async function api<T = unknown>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const session = getSession();
  const headers = authHeaders({ 'Content-Type': 'application/json', ...(opts.headers ?? {}) });

  const res = await connect(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  if (res.status === 401 && session) {
    if (!retried && (await refreshAccessToken())) return api<T>(path, opts, true);
    logout();
    throw new ApiError('Your session has expired. Please sign in again.', 401, null);
  }

  const body = await parse(res);
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError(messageOf(body, res.statusText || 'Request failed'), res.status, body, retryAfter);
  }
  return body as T;
}

export interface Page<T> { items: T[]; total: number; totalPages: number; page: number; size: number }

/**
 * One page of a list endpoint (`?page=0&size=15`, page is 0-based). The server answers with the usual JSON array and the paging
 * facts in X-Total-Count / X-Total-Pages. Same 401 refresh as `api`.
 */
export async function apiPage<T>(path: string, page: number, size: number, retried = false): Promise<Page<T>> {
  const session = getSession();
  const headers = authHeaders({ 'Content-Type': 'application/json' });
  const res = await connect(`${API_BASE}${path}${path.includes('?') ? '&' : '?'}page=${page}&size=${size}`, { method: 'GET', headers });
  if (res.status === 401 && session) {
    if (!retried && (await refreshAccessToken())) return apiPage<T>(path, page, size, true);
    logout();
    throw new ApiError('Your session has expired. Please sign in again.', 401, null);
  }
  const body = await parse(res);
  if (!res.ok) throw new ApiError(messageOf(body, res.statusText || 'Request failed'), res.status, body);
  const items = Array.isArray(body) ? (body as T[]) : [];
  const total = parseInt(res.headers.get('X-Total-Count') ?? '', 10);
  const totalPages = parseInt(res.headers.get('X-Total-Pages') ?? '', 10);
  return { items, total: Number.isFinite(total) ? total : items.length, totalPages: Number.isFinite(totalPages) ? Math.max(totalPages, 1) : 1, page, size };
}

/** Authenticated file download (PDF, Excel, CSV): returns the bytes and the file name the server suggested. Same 401 refresh as `api`. */
export async function apiBlob(path: string, retried = false): Promise<{ blob: Blob; filename: string | null }> {
  const session = getSession();
  const res = await connect(`${API_BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401 && session) {
    if (!retried && (await refreshAccessToken())) return apiBlob(path, true);
    logout();
    throw new ApiError('Your session has expired. Please sign in again.', 401, null);
  }
  if (res.status === 403) throw new ApiError('Access denied: you do not have permission for this download.', 403, null);
  if (!res.ok) throw new ApiError(`Export failed (${res.status}): ${await res.text().catch(() => res.statusText)}`, res.status, null);
  const m = (res.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/);
  return { blob: await res.blob(), filename: m ? m[1] : null };
}

/** Uploads one file as multipart/form-data (the browser adds the boundary). Same 401 refresh as `api`; errors carry the server's message. */
export async function apiUpload<T = unknown>(path: string, file: File, method: 'POST' | 'PUT' = 'PUT', retried = false): Promise<T> {
  const session = getSession();
  const form = new FormData();
  form.append('file', file);
  const res = await connect(`${API_BASE}${path}`, { method, headers: authHeaders(), body: form });
  if (res.status === 401 && session) {
    if (!retried && (await refreshAccessToken())) return apiUpload<T>(path, file, method, true);
    logout();
    throw new ApiError('Your session has expired. Please sign in again.', 401, null);
  }
  const body = await parse(res);
  if (!res.ok) throw new ApiError(messageOf(body, res.statusText || 'Upload failed'), res.status, body);
  return body as T;
}

/**
 * Login does not use the shared request helper: there is no session yet and a 401 means "wrong password".
 * Cafe staff sign in with their cafe's code; the platform owner leaves it empty.
 */
export async function loginRequest(username: string, password: string, cafeCode = ''): Promise<Session> {
  const code = cafeCode.trim().toLowerCase();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code ? { username, password, tenantCode: code } : { username, password }),
  });
  const body = await parse(res);
  if (!res.ok) {
    throw new ApiError(messageOf(body, 'Invalid username or password'), res.status, body, Number(res.headers.get('Retry-After')) || undefined);
  }
  return normalizeSession(body as Record<string, unknown>);
}
