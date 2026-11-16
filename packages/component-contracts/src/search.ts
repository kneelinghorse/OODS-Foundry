/**
 * s249-m04 (Interface 12): one search rule for every renderer. A record matches a search when any string or number value
 * at any depth contains it, ignoring case and the search's surrounding spaces: its fields, the values in its lists, and
 * the entries of its history, whose lines say who did what under which grant. Key names never match, so a search for
 * "name" or "actor" finds no record by its keys, and true, false and empty values are not text a person searched for.
 * The generated store's list and HTML's own list script apply this same rule (HTML's script carries the same steps).
 */
export const SEARCH_DEPTH = 8;

export function recordMatchesSearch(record: unknown, search: string | null | undefined): boolean {
  const needle = (search ?? '').trim().toLowerCase();
  if (!needle) return true;
  const visit = (value: unknown, depth: number): boolean => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).toLowerCase().includes(needle);
    if (depth >= SEARCH_DEPTH || value === null || typeof value !== 'object') return false;
    return (Array.isArray(value) ? value : Object.values(value)).some(item => visit(item, depth + 1));
  };
  return visit(record, 0);
}
