import type { ObjectDefinition } from './types.js';

export const identifierField = (field: string): boolean => /(^|_)id$/i.test(field) || /[a-z](?:Id|ID)$/.test(field);

/** Samples and relationship editors must use the same target key, independent of field order. */
export function recordKeyField(definition: Pick<ObjectDefinition, 'schema' | 'semantics'>): string | undefined {
  const keys = Object.keys(definition.schema);
  // Composite keys may include a boolean draft flag. It cannot identify a record by itself.
  return keys.find(key => definition.semantics[key]?.ui_hints?.primaryKey === true && definition.schema[key].type.replace(/\?$/, '') !== 'boolean')
    ?? keys.find(key => key.toLowerCase() === 'id')
    ?? keys.find(identifierField)
    ?? keys.find(key => definition.semantics[key]?.semantic_type === 'text.label')
    ?? keys[0];
}
