import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';
/** True from tablet width up: the diagram is drawn sideways with curved connectors; on a phone it is a vertical list. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
