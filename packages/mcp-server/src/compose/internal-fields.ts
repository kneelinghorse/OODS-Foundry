import type { FieldSchemaEntry } from '../schemas/generated.js';

/**
 * Fields a record keeps for itself: derived counters, version and mutation counters, hint copy
 * and machine-maintained lists. They are seeded and stored like any other field, but they are
 * not edited in forms and not listed as record details (Sprint 198 craft carry: internal fields
 * in forms, `#2046`).
 */
const INTERNAL_FIELD_NAMES = new Set([
  'placeholder', 'tag_count', 'tag_preview', 'preference_version', 'preference_mutations', 'preference_metadata',
  'classification_metadata', 'allowed_transitions', 'state_history', 'payment_history',
]);

export function isInternalField(name: string, fields: Record<string, FieldSchemaEntry> = {}): boolean {
  if (INTERNAL_FIELD_NAMES.has(name)) return true;
  // A `<thing>_count` beside a `<thing>s` collection is derived from that collection.
  const counted = /^(.+)_count$/.exec(name)?.[1];
  return Boolean(counted && (fields[`${counted}s`] ?? fields[counted])?.type.match(/\[\]$|^array$/));
}

/**
 * s213-m01 (Sprint 212 review finding 2): a field its object declares `unavailable` is one the object's data contract
 * never supplies (an upstream API withholds a record's owner). It keeps its place in the record's shape, but it is not
 * listed as a record detail, edited in a form or offered as a reference; its trait views are dropped at composition.
 */
export function isUnavailableField(name: string, fields: Record<string, FieldSchemaEntry> = {}): boolean {
  return fields[name]?.unavailable === true;
}

/** Display wording never changes an enum's stored value; an authored label wins. */
export function enumOptionLabel(value: string, labels?: Record<string, string>): string {
  if (labels && Object.hasOwn(labels, value)) return labels[value]!;
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\-\s]+/).filter(Boolean).join(' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
