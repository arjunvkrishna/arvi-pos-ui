import { describe, expect, it } from 'vitest';
import { CAFE_CODE, passwordProblem, suggestCode } from './rules';

describe('cafe codes', () => {
  it('suggests a code from the name', () => {
    expect(suggestCode('Blue Door Café')).toBe('blue-door-cafe');
    expect(suggestCode('  --Green  Leaf!!  ')).toBe('green-leaf');
    expect(suggestCode('A'.repeat(40))).toHaveLength(30);
  });
  it('accepts what the server accepts and nothing else', () => {
    for (const ok of ['bluedoor', 'blue-door', 'cafe42', 'a1b']) expect(CAFE_CODE.test(ok)).toBe(true);
    for (const bad of ['ab', '-bluedoor', 'bluedoor-', 'Blue', 'blue door', 'blue_door', 'x'.repeat(31)]) expect(CAFE_CODE.test(bad)).toBe(false);
  });
});

describe('passwords (the server\'s rules, said in words)', () => {
  it('names what is missing', () => {
    expect(passwordProblem('Ab1!')).toMatch(/8 characters/);
    expect(passwordProblem('abcdefg1!')).toMatch(/upper/);
    expect(passwordProblem('ABCDEFG1!')).toMatch(/lower/);
    expect(passwordProblem('Abcdefgh!')).toMatch(/digit/);
    expect(passwordProblem('Abcdefg12')).toMatch(/symbol/);
  });
  it('accepts a good one', () => expect(passwordProblem('Str0ng!Passw0rd')).toBeNull());
});
