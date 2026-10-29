/** /menu?cafe=bluedoor is what a customer scans; /menu alone is the staff screen of that name. */
export const isPublicMenuLink = (pathname: string, search: string) => pathname.replace(/\/+$/, '') === '/menu' && new URLSearchParams(search).has('cafe');
