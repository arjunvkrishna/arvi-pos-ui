import { create } from 'zustand';
import type { Session } from './types';

export const SESSION_KEY = 'arvi_user';

export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed && parsed.token && parsed.username && parsed.realRole ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable (private mode): the session lives in memory only */ }
}

interface SessionState {
  user: Session | null;
  setUser: (s: Session) => void;
  patchUser: (patch: Partial<Session>) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  user: readStoredSession(),
  setUser: (s) => { writeStoredSession(s); set({ user: s }); },
  patchUser: (patch) => {
    const cur = get().user;
    if (!cur) return;
    const next = { ...cur, ...patch };
    writeStoredSession(next);
    set({ user: next });
  },
  clear: () => { writeStoredSession(null); set({ user: null }); },
}));

/** Outside React (API client, stream hook). */
export const getSession = () => useSession.getState().user;

// Another browser tab logged in / out / rotated the tokens: follow it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY) useSession.setState({ user: readStoredSession() });
  });
}
