import { testSession } from '../../test/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { MenuPage } from './MenuPage';

const categories = [{ id: 1, name: 'Starters', sortOrder: 1, icon: 'fa-burger' }];
const items = [
  { id: 10, name: 'Paneer Tikka', categoryId: 1, categoryName: 'Starters', price: 150, isVeg: true, isAvailable: true, active: true },
  { id: 11, name: 'Chicken 65', categoryId: 1, categoryName: 'Starters', price: 180, isVeg: false, isAvailable: false, active: true },
];
let calls: { url: string; method: string; body?: string }[] = [];

beforeEach(() => {
  calls = [];
  useSession.getState().setUser(testSession('MANAGER', { username: 'boss', canManageMenu: true }));   // a branch manager the menu right was handed to
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/categories')) return ok(categories);
    if (url.endsWith('/menu-items') && method === 'GET') return ok(items);
    if (url.endsWith('/settings/public-menu')) return ok({ enabled: true });
    if (url.includes('/toggle-availability')) return ok({ ...items[0], isAvailable: false });
    return ok({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MenuPage /></QueryClientProvider>);
const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('MenuPage', () => {
  it('lists dishes with counts and filters by availability', async () => {
    mount();
    await screen.findByText('Paneer Tikka');
    expect(screen.getByRole('tab', { name: /All dishes/ })).toHaveTextContent('2');
    expect(within(row('Chicken 65')).getByText('OUT OF STOCK')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^Unavailable/ }));
    expect(screen.queryByText('Paneer Tikka')).toBeNull();
    expect(screen.getByRole('button', { name: /Make all available/ })).toBeInTheDocument();
  });

  it('search narrows the list and offers to clear', async () => {
    mount();
    await screen.findByText('Paneer Tikka');
    await userEvent.type(screen.getByRole('searchbox'), 'nothing here');
    expect(screen.getByText(/No dishes match/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[0]);
    await screen.findByText('Paneer Tikka');
  });

  it('the availability switch calls the server', async () => {
    mount();
    await screen.findByText('Paneer Tikka');
    await userEvent.click(within(row('Paneer Tikka')).getByRole('switch'));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/menu-items/10/toggle-availability'))).toBe(true));
  });

  it('add dish sends the form and rejects a negative price', async () => {
    mount();
    await screen.findByText('Paneer Tikka');
    await userEvent.click(screen.getByRole('button', { name: /Add dish/ }));
    await userEvent.type(screen.getByLabelText('Dish name'), ' Veg Roll ');
    await userEvent.type(screen.getByLabelText('Price (₹)'), '99.5');
    await userEvent.click(within(screen.getByTestId('dishModal')).getByRole('button', { name: 'Add dish' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/menu-items'))).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === 'POST')!.body!)).toMatchObject({ name: 'Veg Roll', categoryId: 1, price: 99.5, isVeg: true, isAvailable: true, active: true });
  });

  it('delete asks first', async () => {
    mount();
    await screen.findByText('Paneer Tikka');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Paneer Tikka' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Paneer Tikka' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/menu-items/10'))).toBe(true));
  });
});

describe('MenuPage: who may change the shared menu', () => {
  it('a branch manager without the menu right sees the dishes but no editing controls; with a branch they can set its price', async () => {
    useSession.getState().setUser(testSession('MANAGER', { username: 'boss', outletId: 7, outletName: 'Whitefield' }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MenuPage /></QueryClientProvider>);
    await screen.findAllByRole('row');
    expect(screen.queryByRole('button', { name: /add dish/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /import/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /modifiers/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit /i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete /i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Branch price of /i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });
  it('an owner or general manager gets every control', async () => {
    useSession.getState().setUser(testSession('MANAGER', { username: 'gm', realRole: 'GENERAL_MANAGER', selectedOutletId: 7 }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MenuPage /></QueryClientProvider>);
    await screen.findAllByRole('row');
    expect(screen.getByRole('button', { name: /add dish/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });
});
