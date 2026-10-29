import { useEffect, useRef } from 'react';

/**
 * A small "it changed" pulse: attach the returned ref to an element and it bumps whenever `value` changes
 * (not on first show). Done with a class swap, so the element is never re-created.
 */
export function useBump<T extends HTMLElement = HTMLElement>(value: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('anim-bump');
    void el.offsetWidth;   // restart the animation if it is already running
    el.classList.add('anim-bump');
  }, [value]);
  return ref;
}
