import { describe, expect, it } from 'vitest';
import { hasImage } from './rules';

describe('which images are set', () => {
  it('reads the server\'s list, where null means the cafe-wide image', () => {
    expect(hasImage([null, 2], null)).toBe(true);
    expect(hasImage([null, 2], 2)).toBe(true);
    expect(hasImage([null, 2], 3)).toBe(false);
    expect(hasImage([2], null)).toBe(false);
  });
  it('copes with nothing loaded yet', () => {
    expect(hasImage(undefined, null)).toBe(false);
    expect(hasImage([], 1)).toBe(false);
  });
});
