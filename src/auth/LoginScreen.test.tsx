import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginScreen } from './LoginScreen';
import { useSession } from '../api/session';
import { useToast } from '../components/toast';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); useSession.getState().clear(); useToast.setState({ visible: false }); });
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('LoginScreen', () => {
  it('signs in, stores the session and greets the user', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { token: 't', refreshToken: 'r', username: 'manager', role: 'MANAGER', employeeName: 'Cafe Manager' }));
    render(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/username/i), 'manager');
    await userEvent.type(screen.getByLabelText(/password/i), 'manager123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(useSession.getState().user?.username).toBe('manager'));
    expect(JSON.parse(localStorage.getItem('arvi_user')!).token).toBe('t');
    expect(useToast.getState().message).toMatch(/welcome back, cafe manager/i);
  });

  it('shows the server message on a wrong password and keeps what the user typed', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { message: 'Invalid username or password: Bad credentials' }));
    render(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/username/i), 'waiter');
    await userEvent.type(screen.getByLabelText(/password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid username or password/i);
    expect(screen.getByLabelText(/username/i)).toHaveValue('waiter');       // a React 19 form Action must not wipe the field
    expect(useSession.getState().user).toBeNull();
  });

  it('shows the lockout message', async () => {
    fetchMock.mockResolvedValueOnce(reply(429, { message: 'Too many failed login attempts. Try again in 15 minutes.' }));
    render(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/username/i), 'waiter');
    await userEvent.type(screen.getByLabelText(/password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many failed login attempts/i);
  });

  it('disables the button while signing in, so a double tap cannot send twice', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((res) => { release = res; }));
    render(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/username/i), 'manager');
    await userEvent.type(screen.getByLabelText(/password/i), 'manager123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    const busy = await screen.findByRole('button', { name: /signing in/i });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(reply(401, { message: 'no' }));
    await screen.findByRole('alert');
  });

  it('asks for a new password after a login with a temporary one', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { token: 't', username: 'admin', role: 'ADMIN', mustChangePassword: true }));
    render(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/username/i), 'admin');
    await userEvent.type(screen.getByLabelText(/password/i), 'temp');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(useSession.getState().user?.mustChangePassword).toBe(true));
    const { useUi } = await import('../app/ui');
    expect(useUi.getState().changePasswordOpen).toBe(true);
    expect(useUi.getState().changePasswordForced).toBe(true);
  });
});
