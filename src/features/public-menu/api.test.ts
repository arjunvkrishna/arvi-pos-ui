import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicMenu, menuTarget, PublicMenuError } from './api';

afterEach(() => vi.unstubAllGlobals());
const reply = (status: number, body: unknown = {}) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe('the menu link a customer opens', () => {
  it('reads the cafe and the branch from it', () => {
    expect(menuTarget('?cafe=BlueDoor&branch=WF')).toEqual({ cafe: 'bluedoor', branch: 'WF' });
    expect(menuTarget('?cafe= bluedoor ')).toEqual({ cafe: 'bluedoor', branch: '' });
    expect(menuTarget('')).toEqual({ cafe: '', branch: '' });
  });
});

describe('loading the public menu', () => {
  it('asks for the cafe\'s menu, with the branch when the link names one, and sends no login', async () => {
    reply(200, { enabled: true, categories: [] });
    await fetchPublicMenu('bluedoor', 'WF');
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/public/bluedoor/menu?branch=WF');
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });
  it('says plainly when the menu is switched off, the cafe is unknown, or the server is down', async () => {
    reply(403, { message: 'Public customer menu is currently disabled by management.' });
    await expect(fetchPublicMenu('a', '')).rejects.toMatchObject({ kind: 'off', message: expect.stringContaining('disabled') });
    reply(404);
    await expect(fetchPublicMenu('nope', '')).rejects.toMatchObject({ kind: 'unknown' });
    reply(503);
    await expect(fetchPublicMenu('a', '')).rejects.toMatchObject({ kind: 'down' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    await expect(fetchPublicMenu('a', '')).rejects.toBeInstanceOf(PublicMenuError);
  });
});
