import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, loginRequest, logout, refreshAccessToken } from './client';
import { SESSION_KEY, useSession } from './session';
import type { Session } from './types';
import { testSession } from '../test/session';

const session = (over: Partial<Session> = {}): Session => testSession('MANAGER', { token: 'old-token', refreshToken: 'refresh-1', username: 'manager', ...over });
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  useSession.getState().setUser(session());
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('api()', () => {
  it('sends the bearer token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    expect(await api('/menu-items')).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/menu-items');
    expect(init.headers.Authorization).toBe('Bearer old-token');
  });

  it('returns null for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api('/notifications/1', { method: 'DELETE' })).toBeNull();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, null))                                              // first call
      .mockResolvedValueOnce(json(200, { token: 'new-token', refreshToken: 'refresh-2' })) // refresh
      .mockResolvedValueOnce(json(200, { data: 1 }));                                      // retry
    expect(await api('/bills')).toEqual({ data: 1 });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token');
    expect(useSession.getState().user?.refreshToken).toBe('refresh-2');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).token).toBe('new-token');         // shared with the classic app
  });

  it('shares ONE refresh between concurrent 401s (the refresh token is single use)', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === '/api/auth/refresh') { refreshCalls++; await new Promise((r) => setTimeout(r, 10)); return json(200, { token: 'new-token', refreshToken: 'refresh-2' }); }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-token' ? json(200, { ok: true }) : json(401, null);
    });
    const results = await Promise.all([api('/a'), api('/b'), api('/c')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('adopts tokens another browser tab already rotated instead of spending the refresh token again', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session({ token: 'tab2-token', refreshToken: 'refresh-from-tab2' })));
    fetchMock.mockResolvedValueOnce(json(401, null)).mockResolvedValueOnce(json(200, { ok: true }));
    expect(await api('/bills')).toEqual({ ok: true });
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/refresh')).toBe(false);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tab2-token');
  });

  it('logs out and throws when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, null))
      .mockResolvedValueOnce(json(401, { message: 'expired' }))   // refresh refused
      .mockResolvedValue(new Response(null, { status: 204 }));    // logout call
    await expect(api('/bills')).rejects.toMatchObject({ status: 401 });
    expect(useSession.getState().user).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('raises ApiError with the server message and Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { message: 'Too many failed login attempts. Try again in 15 minutes.' }, { 'Retry-After': '900' }));
    const err = (await api('/x').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/Too many failed login attempts/);
    expect(err.retryAfterSeconds).toBe(900);
  });
});

describe('loginRequest()', () => {
  it('returns the session on success', async () => {
    fetchMock.mockResolvedValueOnce(json(200, session({ token: 't' })));
    expect((await loginRequest('manager', 'pw')).token).toBe('t');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ username: 'manager', password: 'pw' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('turns a lockout into a readable error (no refresh attempt)', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { message: 'Too many failed login attempts. Try again in 1 minute.', retryAfterSeconds: 60 }, { 'Retry-After': '60' }));
    await expect(loginRequest('waiter', 'x')).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/Too many failed/), retryAfterSeconds: 60 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the wrong-password message', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: 'Invalid username or password: Bad credentials' }));
    await expect(loginRequest('waiter', 'x')).rejects.toThrow(/Invalid username or password/);
  });
});

describe('logout()', () => {
  it('tells the server to revoke the refresh token and forgets the session', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    logout();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-1' });
    expect(useSession.getState().user).toBeNull();
  });
});

describe('refreshAccessToken()', () => {
  it('returns false when there is no session', async () => {
    useSession.getState().clear();
    expect(await refreshAccessToken()).toBe(false);
  });
});

describe('no connection', () => {
  it('a request that cannot connect fails with a clear message and status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api('/x')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('No connection to the server') });
  });
  it('an aborted request is not reported as a lost connection', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(api('/x')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
