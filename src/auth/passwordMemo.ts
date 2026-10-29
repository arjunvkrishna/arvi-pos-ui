/**
 * After a login with a temporary password the user must choose a new one; the dialog pre-fills the current password
 * from the login the user just typed. Kept in memory only and cleared as soon as it is read.
 */
let remembered = '';
export const rememberLoginPassword = (p: string) => { remembered = p; };
export const takeRememberedPassword = () => { const p = remembered; remembered = ''; return p; };
