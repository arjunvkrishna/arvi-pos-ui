/** Is there an image set for exactly this branch (null = the cafe-wide one)? The server lists the branches an image is set for. */
export const hasImage = (setFor: readonly (number | null)[] | undefined, outletId: number | null): boolean => (setFor ?? []).includes(outletId);
