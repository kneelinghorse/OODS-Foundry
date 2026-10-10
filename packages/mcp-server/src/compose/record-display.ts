import type { FieldSchemaEntry, UiSchema } from '../schemas/generated.js';
import type { ComposedObject } from '../objects/trait-composer.js';
import { loadObject } from '../objects/object-loader.js';
import { recordKeyField } from '../objects/record-identity.js';
import { recordNameField } from './record-label.js';
import { relationshipOptions } from './relationship-options.js';
import { fieldLabel } from './label-generator.js';
import { enumOptionLabel } from './internal-fields.js';

/** Data counterpart of codegen's display expression, used by HTML and preview sorting. */
export function recordDisplayValue(field: string, fields: Record<string, FieldSchemaEntry>, read: (name: string) => unknown): unknown {
  const entry = fields[field];
  const value = read(field);
  const labels = entry?.titleReferences?.flatMap(name => {
    const reference = fields[name];
    const key = read(name);
    if (!reference || key == null || key === '') return [];
    const label = (reference.displayLabelField ? read(reference.displayLabelField) : undefined) ?? reference.referenceLabels?.[String(key)];
    return typeof label === 'string' && label.trim() ? [label] : [];
  });
  if (labels?.length) return labels.join(' · ');
  if (entry?.enum?.includes(String(value))) return enumOptionLabel(String(value), entry.enumLabels);
  const shown = String(value ?? '').trim() || !entry?.displayFallbackField ? value : read(entry.displayFallbackField);
  const numberedObject = entry?.semanticType?.match(/^object\.([^.]+)\.number$/)?.[1];
  return numberedObject && /^(?:[A-Z]{1,4}-)?\d+$/.test(String(shown ?? ''))
    ? `${fieldLabel(numberedObject)} ${Number(String(shown).replace(/^[A-Z]{1,4}-/, ''))}` : shown;
}

/** One display contract for references, shared by every context and importer. */
export function populateRecordDisplay(schema: UiSchema, composed: ComposedObject): void {
  const fields = schema.objectSchema ?? {};
  let definition;
  try { definition = loadObject(composed.object.name); } catch { return; }
  const relationships = definition.relationships ?? [];
  for (const relationship of relationships) {
    const field = fields[relationship.via];
    if (!field) continue;
    const declared = composed.semantics[relationship.via]?.ui_hints?.label;
    const normalized = (value: string) => value.replace(/[_\s-]/g, '').toLowerCase();
    field.displayLabel = typeof declared === 'string' ? declared
      : fieldLabel(relationship.label && normalized(relationship.label) !== normalized(relationship.via) ? relationship.label
        : relationship.via.replace(/(?:_ids?|Ids?)$/, ''));
    if (!field.displayLabelField) {
      const options = relationshipOptions(relationship, composed.semantics[relationship.via]);
      if (options.length) field.referenceLabels = Object.fromEntries(options.map(option => [option.value, option.label]));
    }
  }
  const key = recordKeyField(definition);
  const name = recordNameField(composed.object.name, fields);
  // A real authored name/number wins. Only the identifier fallback receives a join title.
  if (!key || !fields[key] || name && (name !== key || !/\.number$/.test(fields[name]?.semanticType ?? ''))) return;
  const references = relationships.filter(edge => fields[edge.via]?.required && !fields[edge.via]!.type.includes('[]')
    && !['one-to-many', 'many-to-many'].includes(edge.cardinality)).map(edge => edge.via);
  if (references.length) fields[key].titleReferences = [...new Set(references)];
}
