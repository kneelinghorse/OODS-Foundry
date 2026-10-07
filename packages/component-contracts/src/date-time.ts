import { billingSummary, formatBillingAmount } from './billing.js';

/** A stable display policy shared by generated screens, components, and SSR. */
export function formatDateTime(value: string | number | Date | null | undefined, options: { locale?: string; timeZone?: string; dateOnly?: boolean } = {}): string {
  if (value == null || value === '') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(options.locale ?? 'en-US', {
    dateStyle: 'medium', ...(options.dateOnly ? {} : { timeStyle: 'short' as const }), timeZone: options.timeZone ?? 'UTC',
  }).format(date);
}

/** UTC datetime-local controls round-trip the same instant as deterministic displays. */
export function dateTimeInputValue(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : '';
}

/** Absence stays absent; boolean summary terms use readable answers. */
export function summaryValue(value: unknown): string | undefined {
  return value == null ? undefined : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
}

export interface CollectionEvent {
  id: string;
  title: string;
  at: string;
  description: string;
  kind: 'state' | 'payment';
}

/** Invalid dates cannot participate in a chronological view; ties retain source order. */
export function chronologicalEvents(events: readonly CollectionEvent[]): CollectionEvent[] {
  return events.filter(event => Number.isFinite(Date.parse(event.at)))
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at) || a.index - b.index)
    .map(({ event }) => event);
}

/** A number's declared display format (a field's ui_hints.format). */
export type NumberDisplayFormat = 'percent' | 'quantity';

/**
 * s223-m01 (#2527 ruling 4): a declared number reads as a person writes it. percent holds percent units (12.5 reads
 * 12.5%, -41 reads -41%); quantity is grouped (86420 reads 86,420). Undefined for a value that is not a finite number.
 */
export function formatDeclaredNumber(value: unknown, format: NumberDisplayFormat): string | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return undefined;
  return format === 'percent'
    ? new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(number / 100)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(number);
}

/** Format declared scalar display fields without changing the underlying record. */
export function formatReadOnlyValue(value: unknown, type: string, code = false, format?: NumberDisplayFormat): string {
  if (value == null || value === '') return 'Not recorded';
  type = type.replace(/\?$/, '');
  if (type === 'date' || type === 'datetime') return formatDateTime(value as string | number | Date, { dateOnly: type === 'date' }) || 'Invalid date';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (format && !Array.isArray(value)) {
    const formatted = formatDeclaredNumber(value, format);
    if (formatted !== undefined) return formatted;
  }
  if (Array.isArray(value)) {
    if (value.some(item => item !== null && typeof item === 'object')) return `${value.length} ${value.length === 1 ? 'record' : 'records'}`;
    return value.map(item => summaryValue(item) ?? '').join(', ') || 'None recorded';
  }
  const text = String(value);
  return code ? text.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : text;
}

/** Workflow apps and standalone previews project the same actual record events. */
export function recordCollectionEvents(record: Record<string, unknown>, options: { historyField?: string; payments?: Array<{ field: string; title: string }>; minorUnits?: number } = {}): CollectionEvent[] {
  const source = record[options.historyField ?? 'state_history'];
  const events: CollectionEvent[] = Array.isArray(source) ? source.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const at = entry.at ?? entry.transitioned_at;
    const state = entry.to ?? entry.to_state;
    if (typeof at !== 'string' || typeof state !== 'string') return [];
    return [{ id: 'state-' + index, title: String(entry.title ?? state.split(/[_-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')), at, description: String(entry.reason ?? ''), kind: 'state' as const }];
  }) : [];
  // s220-m01 (#2461): a payment the record has recorded is described by its own amount, never the current price. After an
  // edit to the price, "Last payment Sep 3" read the new "€19.99 · yearly" beside a chart of the €149.00 actually paid.
  const recorded = Array.isArray(record.payment_history) ? record.payment_history : [];
  for (const source of options.payments ?? []) {
    const at = record[source.field];
    if (typeof at !== 'string') continue;
    const paid = recorded.find(row => row && typeof row === 'object' && Date.parse(row.at) === Date.parse(at) && typeof row.amount === 'number');
    const description = paid
      ? formatBillingAmount(paid.amount, String(paid.currency ?? record.currency), options.minorUnits ?? 100)
      : billingSummary(Number(record.amount), String(record.currency), options.minorUnits ?? 100, String(record.billing_interval));
    events.push({ id: 'payment-' + source.field, title: source.title, at, description, kind: 'payment' });
  }
  // A typed date has its own meaning; never invent a creation event for a period. A record with no recorded history or
  // payment shows its first dated fact; s222-m03 (#2502 ruling 14): when it has both, that is when it was created and its
  // last event, unless the last event is the creation itself.
  if (!chronologicalEvents(events).length) {
    const lastEvent = String(record.last_event ?? 'Updated');
    const dated = [{ field: 'created_at', title: 'Created' }, { field: 'last_event_at', title: lastEvent.split(/[_-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') }, { field: 'issued_at', title: 'Issued' }, { field: 'period_start', title: 'Period started' }, { field: 'ownership_transferred_at', title: 'Ownership transferred' }]
      .filter(source => typeof record[source.field] === 'string' && Number.isFinite(Date.parse(record[source.field] as string)));
    const both = dated[0]?.field === 'created_at' && dated[1]?.field === 'last_event_at' && lastEvent !== 'created';
    for (const source of dated.slice(0, both ? 2 : 1)) events.push({ id: 'record-' + source.field, kind: 'state', title: source.title, at: record[source.field] as string, description: '' });
  }
  // s222-m03 (#2502 ruling 13): an archive, a restore and a cancellation request are events of the record too (the
  // Archivable and Cancellable fields). The timeline shows them on this rail instead of in a card of their own, which read
  // "No events recorded." on every record that was never archived or cancelled.
  for (const [field, title, reason] of [['archived_at', 'Archived', 'archive_reason'], ['restored_at', 'Restored', undefined], ['cancellation_requested_at', 'Cancellation requested', 'cancellation_reason']] as const) {
    const at = record[field];
    if (typeof at === 'string' && Number.isFinite(Date.parse(at))) events.push({ id: 'record-' + field, kind: 'state', title, at, description: reason && typeof record[reason] === 'string' ? String(record[reason]) : '' });
  }
  return chronologicalEvents(events);
}

/**
 * s223-m02 (#2527 ruling 13i, #2521): the summary an AddressCollectionPanel shows of a record's addresses, one line per
 * entry (its role, street lines, city, region and postal code) with the entries separated by semicolons, for example
 * "home, 8 Lake Road, Madison, WI, 53703". A generated workflow's store prints the same line (collectionSummary); a single
 * screen and the HTML renderer print it from here. A record with no addresses reads as an empty string.
 */
export function addressCollectionSummary(entries: unknown): string {
  const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return (Array.isArray(entries) ? entries : []).map(entry => {
    const address = asRecord(asRecord(entry).address);
    const street = Array.isArray(address.addressLines) ? address.addressLines.map(String).join(', ') : '';
    return [asRecord(entry).role, street, String(address.locality ?? ''), String(address.administrativeArea ?? ''), String(address.postalCode ?? '')].filter(Boolean).join(', ');
  }).join('; ');
}

const UUID_REFERENCE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A label is authoritative only alongside its actual reference; never infer a related entity. */
export function formatReferenceLabel(identifier: unknown, label?: unknown, subject = 'Reference'): string {
  if (identifier == null || identifier === '') return `${subject} unavailable`;
  if (typeof label === 'string' && label.trim() && !UUID_REFERENCE.test(label.trim())) return label;
  return `${subject} reference not resolved`;
}

/** The two fallbacks formatReferenceLabel writes when a reference has no name to show. */
const UNRESOLVED_REFERENCE_LABEL = / (?:unavailable|reference not resolved)$/;

/**
 * s223-m01 (#2527 ruling 6): ownership on a card as one phrase, "Owned by Pricing and packaging · team", or by its type
 * alone when the owner has no name to show ("Team-owned"). Undefined when there is nothing to say.
 */
export function ownershipPhrase(ownerLabel?: unknown, ownerType?: unknown, role?: unknown): string | undefined {
  const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const name = text(ownerLabel) && !UNRESOLVED_REFERENCE_LABEL.test(text(ownerLabel)!) ? text(ownerLabel) : undefined;
  const type = text(ownerType)?.replace(/[_-]+/g, ' ');
  const parts = name ? [`Owned by ${name}`, type, text(role)] : type ? [`${type.charAt(0).toUpperCase()}${type.slice(1)}-owned`, text(role)] : [];
  return parts.filter(Boolean).join(' · ') || undefined;
}

/** Keep authored record keys and the Transaction fallback; UUIDs belong in technical inspection. */
export function formatRecordLabel(value: unknown, readableIdentifier = false): string {
  return typeof value === 'string' && UUID_REFERENCE.test(value.trim()) ? readableIdentifier ? `Record …${value.trim().slice(-8)}` : 'Record name unavailable' : String(value ?? '');
}
