import { asset } from '../lib/asset';
import { useActionState, useState } from 'react';
import { ApiError, loginRequest } from '../api/client';
import { useSession } from '../api/session';
import { useUi } from '../app/ui';
import { showToast } from '../components/toast';
import { rememberLoginPassword } from './passwordMemo';

interface LoginState { error: string }

const CAFE_CODE_KEY = 'arvi_cafe_code';
/** The cafe code from a shared link (?cafe=bluedoor), else the one used last time on this device. */
function initialCafeCode(): string {
  try {
    const fromLink = new URLSearchParams(window.location.search).get('cafe');
    if (fromLink) return fromLink.trim().toLowerCase();
    return localStorage.getItem(CAFE_CODE_KEY) ?? '';
  } catch { return ''; }
}

/**
 * Sign-in screen. Same ids as the classic app (#loginModal, #loginForm, #loginUsername, #loginPassword, #loginError).
 * Uses a React 19 form Action: the button disables itself while the request runs, so a double tap cannot sign in twice.
 */
export function LoginScreen() {
  const setUser = useSession((s) => s.setUser);
  const ui = useUi((s) => s.set);
  // Controlled inputs: a React 19 form Action resets uncontrolled fields after it finishes, which would wipe the username on a typo.
  const [cafeCode, setCafeCode] = useState(initialCafeCode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [state, action, pending] = useActionState<LoginState, FormData>(async () => {
    try {
      const session = await loginRequest(username.trim(), password, cafeCode);
      try { localStorage.setItem(CAFE_CODE_KEY, cafeCode.trim().toLowerCase()); } catch { /* remembering the code is optional */ }
      if (session.mustChangePassword) {
        rememberLoginPassword(password);
        ui({ changePasswordOpen: true, changePasswordForced: true });
        showToast('Temporary password detected. Please set your new secure password.', 'warning');
      } else {
        showToast(`Welcome back, ${session.employeeName || session.username}!`, 'success');
      }
      setUser(session);
      return { error: '' };
    } catch (e) {
      return { error: e instanceof ApiError || e instanceof Error ? e.message : 'Invalid username or password' };
    }
  }, { error: '' });

  return (
    <div id="loginModal" data-testid="login-screen" className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={asset('logo-05.png')} alt="ARVI POS Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">ARVI POS</h1>
          <p className="text-sm text-muted mt-1">Restaurants, cafes &amp; branches</p>
        </div>

        <form id="loginForm" action={action} className="card p-6 space-y-4">
          <div>
            <label htmlFor="loginCafe" className="label">Cafe code</label>
            <input type="text" id="loginCafe" name="cafe" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={cafeCode} onChange={(e) => setCafeCode(e.target.value)}
              className="input font-mono" placeholder="e.g. bluedoor" />
            <p className="text-xs text-faint mt-1">Leave empty if you are the platform owner.</p>
          </div>
          <div>
            <label htmlFor="loginUsername" className="label">Username</label>
            <input type="text" id="loginUsername" name="username" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
              className="input" placeholder="Enter your username" />
          </div>
          <div>
            <label htmlFor="loginPassword" className="label">Password</label>
            <input type="password" id="loginPassword" name="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="input" placeholder="Enter your password" />
          </div>
          {state.error && <div id="loginError" role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{state.error}</div>}
          <button type="submit" disabled={pending} className="btn btn-primary w-full h-10">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-faint mt-6">ARVI Cloud POS</p>
      </div>
    </div>
  );
}
