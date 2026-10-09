import { loadObject } from '../objects/object-loader.js';
import { fieldLabel } from './label-generator.js';
import { recordKeyField } from '../objects/record-identity.js';
import type { ObjectRelationship, SemanticMapping } from '../objects/types.js';

/** The same sample lookup names a related record in a picker and on a read screen. */
export function relationshipOptions(relationship: ObjectRelationship, semantic?: SemanticMapping): Array<{ value: string; label: string }> {
  const target = loadObject(relationship.target);
  const id = recordKeyField(target)!;
  const declared = semantic?.ui_hints?.referenceLabelField;
  const title = typeof declared === 'string' && Object.hasOwn(target.schema, declared) ? declared
    : Object.keys(target.schema).find(key => target.semantics[key]?.semantic_type === 'text.label' || /\.number$/.test(target.semantics[key]?.semantic_type ?? ''))
      ?? Object.keys(target.schema).find(key => /^(name|title|label)$/i.test(key)) ?? id;
  return (target.samples ?? []).filter(row => row[id] !== undefined).map(row => {
    const label = String(row[title] ?? row[id]);
    const numbered = /\.number$/.test(target.semantics[title]?.semantic_type ?? '') && /^(?:[A-Z]{1,4}-)?\d+$/.test(label);
    return { value: String(row[id]), label: numbered ? `${fieldLabel(relationship.target)} ${Number(label.replace(/^[A-Z]{1,4}-/, ''))}` : label };
  });
}
