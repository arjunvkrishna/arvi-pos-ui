/** URL of a file in /public that respects the app's base path (/next/ now, / after the switchover). */
export const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
