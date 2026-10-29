export { passwordProblem } from '../../lib/password';

/** A cafe code: 3 to 30 characters, lower-case letters, digits and dashes, not starting or ending with a dash (it is part of every sign-in link). */
export const CAFE_CODE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** A code suggested from the cafe's name: "Blue Door Café" -> "blue-door-cafe". */
export function suggestCode(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '');
}

export const PLANS = ['STARTER', 'PRO', 'ENTERPRISE'] as const;
