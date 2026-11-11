import type { ObjectDefinition } from './types.js';

export const identifierField = (field: string): boolean => /(^|_)id$/i.test(field) || /[a-z](?:Id|ID)$/.test(field);

type KeyCandidate = { type: string; enum?: unknown; validation?: { enum?: unknown } | Record<string, unknown> };
/**
 * s245-m03: a field that can tell records apart when an object names no identifier: a text or number value with no
 * closed list of values. An enum's values repeat by design (a lifecycle's status: Jira's ApproverDTO.approverDecision,
 * Bitbucket's participant.state), and a boolean, a date, a list or a document cannot identify a record either.
 */
export function identifyingValue(field: KeyCandidate): boolean {
  const listed = (values: unknown) => Array.isArray(values) && values.length > 0;
  return ['string', 'uuid', 'integer', 'number', 'email', 'url'].includes(field.type.replace(/\?$/, '')) && !listed(field.enum) && !listed(field.validation?.enum);
}
/** The key of an object that names no identifier: its first field that can identify a record, else its first field. */
export function fallbackKeyField(fields: Record<string, KeyCandidate>): string | undefined {
  const keys = Object.keys(fields);
  return keys.find(key => identifyingValue(fields[key])) ?? keys[0];
}

/** Samples and relationship editors must use the same target key, independent of field order. */
export function recordKeyField(definition: Pick<ObjectDefinition, 'schema' | 'semantics'>): string | undefined {
  const keys = Object.keys(definition.schema);
  // Composite keys may include a boolean draft flag. It cannot identify a record by itself.
  return keys.find(key => definition.semantics[key]?.ui_hints?.primaryKey === true && definition.schema[key].type.replace(/\?$/, '') !== 'boolean')
    ?? keys.find(key => key.toLowerCase() === 'id')
    ?? keys.find(identifierField)
    ?? keys.find(key => definition.semantics[key]?.semantic_type === 'text.label')
    ?? fallbackKeyField(definition.schema);
}
