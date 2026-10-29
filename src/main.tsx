import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { listenForInstall } from './features/pwa/pwa';
import { applyTheme, currentTheme } from './lib/theme';
import './styles/index.css';

applyTheme(currentTheme());
listenForInstall();

// Installable app + offline shell. Production only: in `npm run dev` a worker would serve stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
