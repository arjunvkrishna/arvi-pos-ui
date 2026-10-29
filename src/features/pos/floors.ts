/** Floors (or sections) of the branch in a stable order, empty when the branch does not use floors. */
export const floorsIn = (floorOf: Record<string, string>): string[] => [...new Set(Object.values(floorOf))].sort((a, b) => a.localeCompare(b));
