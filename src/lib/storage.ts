// Web: the browser's own localStorage (undefined during static rendering).
export const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
