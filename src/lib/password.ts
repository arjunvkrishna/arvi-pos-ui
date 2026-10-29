export const PASSWORD_HINT = 'At least 8 characters, with an upper-case letter, a lower-case letter, a digit and a symbol such as ! or #.';

/** The rules the server applies to a password, in words; null when it is acceptable. */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(p)) return 'Add an upper-case letter.';
  if (!/[a-z]/.test(p)) return 'Add a lower-case letter.';
  if (!/[0-9]/.test(p)) return 'Add a digit.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p)) return 'Add a symbol such as ! or #.';
  return null;
}
