import { testSession } from '../test/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../api/session';
import { HashBridge } from './HashBridge';
import { AppRoutes } from './routes';

function mount(path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <HashBridge />
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const cleanupDeep = () => cleanup();
const signIn = (role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE', over = {}) => useSession.getState().setUser(testSession(role, over));

beforeEach(() => { window.location.hash = ''; });
afterEach(() => { window.location.hash = ''; });

describe('the customer menu link', () => {
  const menu = { enabled: true, cafeName: 'Blue Door', tagline: 'Good coffee', currencySymbol: '₹',
    categories: [{ id: 1, name: 'Coffee', items: [{ id: 5, name: 'Filter Coffee', price: 40, isVeg: true, isAvailable: true }, { id: 6, name: 'Cold Brew', price: 90, isVeg: true, isAvailable: false }] }] };
  const stubMenu = () => vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/api/public/bluedoor/menu') ? menu : {}), { status: url.includes('/api/public/bluedoor/menu') ? 200 : 404 })));
  afterEach(() => { vi.unstubAllGlobals(); useSession.getState().clear(); });

  it('/menu?cafe=<code> shows that cafe\'s menu with no sign-in, sold-out dishes marked', async () => {
    stubMenu();
    mount('/menu?cafe=bluedoor');
    expect(await screen.findByText('Blue Door', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByTestId('public-menu')).toBeInTheDocument();
    expect(screen.getByText('Filter Coffee')).toBeInTheDocument();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('asks the public endpoint of that cafe only, and never sends a login token', async () => {
    stubMenu();
    signIn('MANAGER');
    mount('/menu?cafe=bluedoor');
    await screen.findByTestId('public-menu', {}, { timeout: 8000 });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    expect(calls.map((c) => c[0])).toEqual(['/api/public/bluedoor/menu']);
    expect(JSON.stringify(calls[0][1]?.headers ?? {})).not.toMatch(/authorization/i);
  });

  it('a staff member\'s own /menu (no cafe code) is still the Menu & Pricing screen', async () => {
    signIn('MANAGER');
    mount('/menu');
    expect(await screen.findByTestId('tab-menu', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByTestId('public-menu')).not.toBeInTheDocument();
  });

  it('a link without a known cafe says so instead of a broken page', async () => {
    stubMenu();
    mount('/menu?cafe=nosuchcafe');
    expect(await screen.findByText(/could not find this menu/i, {}, { timeout: 8000 })).toBeInTheDocument();
  });
});

describe('routing and permissions', () => {
  it('shows the sign-in screen when nobody is signed in', () => {
    mount('/menu');
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('a manager lands on Analytics', async () => {
    signIn('MANAGER');
    mount('/');
    expect(await screen.findByTestId('tab-analytics', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('a link with #menu opens Menu & Pricing on first load (not the default screen)', async () => {
    signIn('MANAGER');
    window.location.hash = '#menu';
    mount('/');
    expect(await screen.findByTestId('tab-menu', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-analytics')).not.toBeInTheDocument();
  });

  it('a typed address of a screen the role may not open shows the staff-only page, never the screen', async () => {
    signIn('EMPLOYEE', { canTakeOrders: true, canManageInventory: false });
    mount('/audit');
    expect(await screen.findByText('Staff only: kitchen door', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-audit')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my screen' })).toHaveAttribute('href', '/pos');
  });

  it('an address that is not a screen shows the not-found page inside the app', async () => {
    signIn('MANAGER');
    mount('/no-such-screen');
    expect(await screen.findByText('Oops! This table is empty', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the counter' })).toHaveAttribute('href', '/analytics');
    cleanupDeep();
    mount('/menu/extra/path');
    expect(await screen.findByText('Oops! This table is empty', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('a forbidden #link falls back to the role default as well', async () => {
    signIn('EMPLOYEE');
    window.location.hash = '#audit';
    mount('/');
    expect(await screen.findByTestId('tab-pos', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('the bell and manager-only navigation are not rendered for staff', async () => {
    signIn('EMPLOYEE');
    mount('/');
    await screen.findByTestId('tab-pos', {}, { timeout: 8000 });
    expect(screen.queryByTestId('bell')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });
});
