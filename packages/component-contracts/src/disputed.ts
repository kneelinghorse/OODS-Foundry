import { formatDateTime } from './date-time.js';

export interface AuditSummaryValues {
  auditLog?: readonly unknown[];
  lastN?: number;
  showTransitionCount?: boolean;
  showLastTransitionTime?: boolean;
  showLastActor?: boolean;
}

/** Count actual transition records. Find the latest valid instant independently
 * of input order; invalid dates never become a plausible "latest" timestamp. */
export function auditSummary({ auditLog = [], lastN = 5 }: AuditSummaryValues) {
  const records = auditLog.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry));
  const dated = records.map((entry, index) => ({ entry, index, time: Date.parse(String(entry.transitioned_at ?? '')) }))
    .filter(row => Number.isFinite(row.time)).sort((a, b) => b.time - a.time || a.index - b.index);
  const latest = dated[0]?.entry;
  const at = latest ? String(latest.transitioned_at) : undefined;
  const actor = typeof latest?.actor_id === 'string' && latest.actor_id.trim() ? latest.actor_id : 'Not recorded';
  const limit = Number.isFinite(lastN) ? Math.max(0, Math.floor(lastN)) : 5;
  return { count: records.length, at, actor, timestamp: formatDateTime(at) || 'Not recorded', recent: dated.slice(0, limit).map(row => row.entry) };
}

export interface SortState { field: string; direction: 'asc' | 'desc'; active: boolean }
export interface SortIndicatorValues { sortField?: string; sortDirection?: string; sortActive?: boolean; triStateSort?: boolean; sortableFields?: readonly string[]; defaultSortField?: string; defaultSortDirection?: string }
export function initialSort(values: SortIndicatorValues): SortState {
  return { field: values.sortField ?? values.defaultSortField ?? values.sortableFields?.[0] ?? 'name', direction: (values.sortDirection ?? values.defaultSortDirection) === 'desc' ? 'desc' : 'asc', active: values.sortActive ?? false };
}
export function nextSort(state: SortState, triState = true): SortState {
  if (!state.active) return { ...state, direction: 'asc', active: true };
  if (state.direction === 'asc') return { ...state, direction: 'desc' };
  return { ...state, direction: 'asc', active: !triState };
}
export function ariaSort(state: SortState): 'none' | 'ascending' | 'descending' { return state.active ? state.direction === 'asc' ? 'ascending' : 'descending' : 'none'; }
