import { formatDateTime, formatReadOnlyValue } from './date-time.js';

export interface TraitEventValues {
  archivedAt?: string | null; restoredAt?: string | null; archivedBy?: string | null; reason?: string | null;
  timestamp?: string | null; code?: string | null; history?: readonly unknown[]; status?: string | null;
  showActor?: boolean; showReason?: boolean;
}
export type TraitEventKind = 'archive' | 'cancellation' | 'transition';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;

/** Missing timestamps stay disclosed; history order and authored actor/reason are preserved. */
export function traitEventRows(kind: TraitEventKind, values: TraitEventValues) {
  const rows = kind === 'archive'
    ? [values.archivedAt && { title: 'Archived', at: values.archivedAt, actor: values.archivedBy, reason: values.reason }, values.restoredAt && { title: 'Restored', at: values.restoredAt }].filter(Boolean)
    : kind === 'cancellation'
      ? values.timestamp || values.reason || values.code ? [{ title: 'Cancellation requested', at: values.timestamp, reason: values.reason, code: values.code }] : []
      : (values.history ?? []).map(value => {
        const row = record(value);
        const from = text(row.from_state ?? row.from); const to = text(row.to_state ?? row.to) ?? values.status ?? 'State changed';
        const transition = from ? `${formatReadOnlyValue(from, 'string', true)} → ${formatReadOnlyValue(to, 'string', true)}` : formatReadOnlyValue(to, 'string', true);
        const title = text(row.title ?? row.label);
        return { title: title && title !== transition && !title.endsWith(` · ${transition}`) ? `${title} · ${transition}` : title ?? transition, at: text(row.transitioned_at ?? row.timestamp ?? row.at), actor: text(row.actor_id ?? row.actor), reason: text(row.reason) };
      });
  return rows.map(value => {
    const row = value as { title: string; at?: string; actor?: string; reason?: string; code?: string };
    const at = row.at && formatDateTime(row.at) ? row.at : undefined;
    return { ...row, code: row.code ? formatReadOnlyValue(row.code, 'string', true) : undefined, at, time: at ? formatDateTime(at) : 'Time not recorded', actor: values.showActor === false ? undefined : row.actor, reason: values.showReason === false ? undefined : row.reason };
  });
}

/** Catalog rows can be strings or named records; never stringify objects into [object Object]. */
export function recipeItemLabels(values: readonly unknown[] = []): string[] {
  return values.map(value => {
    if (typeof value === 'string') return value;
    const row = record(value);
    const label = text(row.label ?? row.name ?? row.title ?? row.field ?? row.id ?? row.type) ?? 'Unnamed entry';
    return text(row.status) ? `${label}: ${row.status}` : label;
  });
}

export const DEFAULT_COLOR_STATES = ['neutral', 'info', 'success', 'warning', 'critical'] as const;
export interface GeoFieldMappingValue { latitude: string; longitude: string; identifier: string; autoDetect: boolean }
export function geoFieldMapping(values: Partial<GeoFieldMappingValue>): GeoFieldMappingValue {
  return { latitude: values.latitude ?? '', longitude: values.longitude ?? '', identifier: values.identifier ?? '', autoDetect: values.autoDetect ?? true };
}
