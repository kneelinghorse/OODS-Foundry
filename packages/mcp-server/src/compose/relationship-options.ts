import { loadObject } from '../objects/object-loader.js';
import { recordKeyField } from '../objects/record-identity.js';
import type { ObjectRelationship, SemanticMapping } from '../objects/types.js';

/** The same sample lookup names a related record in a picker and on a read screen. */
export function relationshipOptions(relationship: ObjectRelationship, semantic?: SemanticMapping): Array<{ value: string; label: string }> {
  const target = loadObject(relationship.target);
  const id = recordKeyField(target)!;
  const declared = semantic?.ui_hints?.referenceLabelField;
  const title = typeof declared === 'string' && Object.hasOwn(target.schema, declared) ? declared
    : Object.keys(target.schema).find(key => target.semantics[key]?.semantic_type === 'text.label')
      ?? Object.keys(target.schema).find(key => /^(name|title|label)$/i.test(key)) ?? id;
  return (target.samples ?? []).filter(row => row[id] !== undefined).map(row => ({ value: String(row[id]), label: String(row[title] ?? row[id]) }));
}
