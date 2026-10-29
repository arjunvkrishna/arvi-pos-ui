import { Suspense } from 'react';
import { logout } from '../../api/client';
import { Logo } from '../../app/layout/Logo';
import { Skeleton } from '../../components/ui';
import { useTheme } from '../../lib/useTheme';
import { PlatformPage } from './PlatformPage';

/**
 * The frame for the SaaS owner. It deliberately shares nothing with the cafe screens (no shift, printer, notification or order
 * requests): a platform sign-in has no cafe, so every cafe request would be refused anyway.
 */
export function PlatformShell() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 h-14 px-3 sm:px-6 flex items-center justify-between bg-surface/90 backdrop-blur border-b border-line">
        <Logo />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggle} title="Toggle light / dark mode" aria-label="Toggle light or dark mode" className="btn btn-ghost btn-icon"><i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} /></button>
          <button type="button" onClick={logout} title="Sign out" aria-label="Sign out" className="btn btn-ghost btn-icon hover:!text-danger"><i className="fa-solid fa-right-from-bracket" /></button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
        <Suspense fallback={<div className="card"><Skeleton rows={5} /></div>}><PlatformPage /></Suspense>
      </main>
    </div>
  );
}
