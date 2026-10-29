import { setSystemBars } from '../native/shell';

const KEY = 'arvi_theme';
export type Theme = 'dark' | 'light';

/** The saved choice (shared with the classic app); otherwise the device setting. */
export function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, save = false): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0c10' : '#f6f7f9');
  setSystemBars(theme === 'dark');
  if (save) { try { localStorage.setItem(KEY, theme); } catch { /* ignore */ } }
}
