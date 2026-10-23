export const PAGE_SIZE = 25;

/** Reads ?page= safely: always a whole number of at least 1. */
export function parsePage(value: string | undefined) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1;
}

/** Row range for Supabase's .range(from, to). */
export function pageRange(page: number, size = PAGE_SIZE) {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

/** Makes a search term safe to place inside a PostgREST or() filter: drops characters that have a meaning there. */
export function cleanSearch(value: string | undefined) {
  return (value ?? "").replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
