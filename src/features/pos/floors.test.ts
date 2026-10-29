import { describe, expect, it } from 'vitest';
import { floorsIn } from './floors';

describe('floors of a branch', () => {
  it('lists each floor once, in a steady order', () => {
    expect(floorsIn({ T1: 'Terrace', T2: 'Ground', T3: 'Ground', T4: 'First floor' })).toEqual(['First floor', 'Ground', 'Terrace']);
  });
  it('is empty for a branch without floors', () => expect(floorsIn({})).toEqual([]));
});
