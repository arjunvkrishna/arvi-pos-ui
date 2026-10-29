import { describe, expect, it } from 'vitest';
import { CAFE_CODE, passwordProblem, suggestCode, MODULES, PLAN_LIMITS, planIncludes, planLimitsText } from './rules';

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

describe('what each plan gives', () => {
  it('limits match the server\'s plans', () => {
    expect(PLAN_LIMITS.STARTER).toEqual({ branches: 1, logins: 5 });
    expect(PLAN_LIMITS.PRO).toEqual({ branches: 5, logins: 25 });
    expect(planLimitsText('STARTER')).toBe('1 branch, 5 staff logins');
    expect(planLimitsText('PRO')).toBe('5 branches, 25 staff logins');
    expect(planLimitsText('ENTERPRISE')).toBe('Unlimited branches, unlimited staff logins');
  });

  it('each plan has everything the plan below it has', () => {
    const count = (p: 'STARTER' | 'PRO' | 'ENTERPRISE') => MODULES.filter((m) => planIncludes(p, m)).length;
    expect(count('STARTER')).toBe(0);
    expect(count('PRO')).toBe(6);
    expect(count('ENTERPRISE')).toBe(MODULES.length);
  });
});
