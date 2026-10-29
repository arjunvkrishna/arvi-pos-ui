import { describe, expect, it, vi } from 'vitest';
import { createMenuWatcher } from './menuWatch';

describe('menu change watcher', () => {
  it('does nothing for the first answer, it is only the baseline', () => {
    const changed = vi.fn(); const see = createMenuWatcher(changed);
    see('aaa');
    expect(changed).not.toHaveBeenCalled();
  });
  it('does nothing while the fingerprint stays the same', () => {
    const changed = vi.fn(); const see = createMenuWatcher(changed);
    see('aaa'); see('aaa'); see('aaa');
    expect(changed).not.toHaveBeenCalled();
  });
  it('reports each real change once', () => {
    const changed = vi.fn(); const see = createMenuWatcher(changed);
    see('aaa'); see('bbb'); see('bbb'); see('ccc');
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
