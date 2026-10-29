/** How often a screen asks the server whether the menu changed (a tiny answer; the menu itself is reloaded only when it did). */
export const MENU_CHECK_MS = 5_000;

/**
 * Remembers the last menu fingerprint the server gave and says when a new one means the menu changed.
 * The first answer only sets the baseline: the screen just loaded the menu itself.
 */
export function createMenuWatcher(onChanged: () => void) {
  let last: string | null = null;
  return (version: string) => {
    if (last !== null && version !== last) onChanged();
    last = version;
  };
}
