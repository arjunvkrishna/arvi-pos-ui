import { testSession } from '../../test/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../../api/session';
import { UsersPage } from './UsersPage';

const users = [
  { id: 1, username: 'root', role: 'ADMIN', active: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, username: 'boss', role: 'MANAGER', active: true, outletId: 10, outletName: 'Main' },
  { id: 3, username: 'waiter', role: 'CASHIER', active: true, outletId: 10, outletName: 'Main', canTakeOrders: true, canManageInventory: false, locked: true, lockedUntil: '2026-10-21T10:00:00Z' },
  { id: 4, username: 'far_waiter', role: 'CASHIER', active: true, outletId: 11, outletName: 'Whitefield', canTakeOrders: true },
];
let calls: { url: string; method: string; body?: string }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
    return (init?.method ?? 'GET') === 'GET' ? ok(users) : ok({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount(role: 'ADMIN' | 'MANAGER') {
  // ADMIN = the cafe owner; MANAGER = the manager of branch 10 (their own branch is the only one they see in real life)
  useSession.getState().setUser(testSession(role, { username: role === 'ADMIN' ? 'root' : 'boss', outletId: role === 'MANAGER' ? 10 : null }));
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><UsersPage /></QueryClientProvider>);
}
const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('UsersPage', () => {
  it('admin sees every action, including delete', async () => {
    mount('ADMIN');
    await screen.findByText('waiter');
    expect(screen.getByText(/every branch/)).toBeInTheDocument();
    expect(within(row('waiter')).getByText('LOCKED')).toBeInTheDocument();
    expect(within(row('waiter')).getByRole('button', { name: /Unlock/ })).toBeInTheDocument();
    expect(within(row('root')).getByRole('button', { name: /Delete root/ })).toBeInTheDocument();
  });

  it('a branch manager only gets actions on staff of their own branch, and never Delete', async () => {
    mount('MANAGER');
    await screen.findByText('waiter');
    expect(screen.getByText(/your branch/)).toBeInTheDocument();
    expect(within(row('boss')).queryByRole('button')).toBeNull();                       // a peer
    expect(within(row('root')).queryByRole('button')).toBeNull();                       // the owner
    expect(within(row('far_waiter')).queryByRole('button')).toBeNull();                 // another branch
    expect(within(row('waiter')).getByRole('button', { name: /Reset Pwd/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('Unlock calls the server and reloads the list', async () => {
    mount('MANAGER');
    await screen.findByText('waiter');
    await userEvent.click(within(row('waiter')).getByRole('button', { name: /Unlock/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/users/3/unlock'))).toBe(true));
  });

  it('create: refuses a weak password, sends the form otherwise; a branch manager can only add staff', async () => {
    mount('MANAGER');
    await screen.findByText('waiter');
    await userEvent.click(screen.getByRole('button', { name: /create user account/i }));
    expect(screen.queryByRole('option', { name: /manager/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /owner/i })).toBeNull();
    expect(screen.getByRole('option', { name: 'Cashier' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch')).toBeNull();                               // a branch manager's people join their own branch
    await userEvent.type(screen.getByLabelText('Username'), ' ann ');
    await userEvent.type(screen.getByLabelText('Password'), 'weakpass');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Secret@123456');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/users'))).toBe(true));
    const sent = JSON.parse(calls.find((c) => c.method === 'POST')!.body!);
    expect(sent).toMatchObject({ username: 'ann', password: 'Secret@123456', role: 'EMPLOYEE', canTakeOrders: true, canManageInventory: false, canCancelOrder: false });
    await waitFor(() => expect(screen.queryByTestId('createUserModal')).toBeNull());
  });

  it('delete asks for confirmation first', async () => {
    mount('ADMIN');
    await screen.findByText('waiter');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(within(row('waiter')).getByRole('button', { name: /Delete waiter/ }));
    expect(confirm).toHaveBeenCalled();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    confirm.mockReturnValue(true);
    await userEvent.click(within(row('waiter')).getByRole('button', { name: /Delete waiter/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/users/3'))).toBe(true));
  });
});
