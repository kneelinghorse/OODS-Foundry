import type { Proposal } from './draft.js';
import type { TraitReference } from '../objects/types.js';
import { isMap, type MapValue, type Origin } from './source.js';

type Propose = (trait: TraitReference, grade: Proposal['grade'], evidence: Proposal['evidence']) => void;
/** A structural match suggests a capability for review, not an assertion of domain meaning. */
export function suggestTraits(shape: MapValue, fields: Record<string, MapValue>, originOf: (field: string) => Origin, propose: Propose, note: (field: string, reason: string) => void): void {
  const entries = Object.entries(fields);
  const evidence = (field: string, reason: string, kind: 'structure' | 'declaration' = 'structure') => [{ ...originOf(field), kind, reason }];
  const number = (schema: MapValue) => ['integer', 'number'].includes(schema.type);
  const currencies = entries.filter(([, s]) => s.format === 'iso-4217' || s.pattern === '^[A-Z]{3}$' || (s.enum?.length && s.enum.every((v: unknown) => typeof v === 'string' && /^[A-Z]{3}$/.test(v))));
  const amount = entries.find(([, s]) => number(s) && (s['x-oods']?.currency || s.minimum >= 0));
  if (amount && currencies.length) {
    const [field, s] = amount, [currency, code] = currencies[0];
    const declared = s['x-oods']?.currency?.field === currency;
    const codes = code.enum ?? ['USD', 'EUR', 'GBP'];
    propose({ name: 'Priceable', parameters: { supportedCurrencies: codes, defaultCurrency: codes.includes(code.default) ? code.default : codes[0] } }, declared ? 'strong' : 'medium', [
      ...evidence(field, 'Numeric amount paired with a constrained three-letter currency field; review price meaning and minor-unit alignment.', declared ? 'declaration' : 'structure'),
      ...evidence(currency, 'Currency format, enumeration or ISO-shaped pattern constrains the code.'),
    ]);
  }
  const latitude = entries.find(([, s]) => number(s) && s.minimum === -90 && s.maximum === 90);
  const longitude = entries.find(([, s]) => number(s) && s.minimum === -180 && s.maximum === 180);
  if (latitude && longitude) propose({ name: 'Geocodable', parameters: { autoDetect: false, explicitFields: [latitude[0], longitude[0]] } }, 'strong', [...evidence(latitude[0], 'Numeric coordinate bounded at ±90.'), ...evidence(longitude[0], 'Numeric coordinate bounded at ±180.')]);
  for (const [field, schema] of entries) {
    if (schema.type === 'array' && schema.items?.type === 'string' && (schema.uniqueItems || schema.items.enum)) {
      const allowed = schema.items.enum;
      propose({ name: 'Taggable', parameters: { ...(schema.maxItems > 0 && schema.maxItems <= 64 ? { maxTags: schema.maxItems } : {}), ...(allowed?.length ? { allowedTags: allowed, allowCustomTags: false } : {}) } }, 'medium', evidence(field, 'Unique string collection or controlled string vocabulary fits tags; classification meaning requires acceptance.'));
    }
    if (['email', 'phone'].includes(schema.format)) note(field, 'Contact format retained; Communicable models channels, templates and conversations, so a contact alone does not justify that trait.');
    if (typeof schema.pattern === 'string' && /[0-9a-f]/i.test(schema.pattern) && schema.pattern.includes('#')) note(field, 'Colour pattern retained; Colorized models semantic status tones, not arbitrary colour values.');
    if (schema.enum?.length && schema.enum.every((value: string) => ['neutral', 'info', 'accent', 'success', 'warning', 'critical'].includes(value))) {
      propose({ name: 'Colorized', parameters: { colorStates: schema.enum, fallbackTone: schema.enum[0] } }, 'medium', evidence(field, 'Enumeration is entirely within the shipped semantic status tone vocabulary.'));
    }
    if (isMap(schema.properties)) {
      const nested = Object.values(schema.properties) as MapValue[];
      if (nested.some(s => s.format === 'iso-3166-1-alpha-2' || s.pattern === '^[A-Z]{2}$') && nested.filter(s => s.type === 'string').length >= 3) {
        propose({ name: 'Addressable', parameters: {} }, 'medium', evidence(field, 'Structured postal-shaped record includes a constrained country code and multiple text address parts; review role alignment.'));
      }
    }
  }
  const annotation = shape['x-oods'] ?? {};
  const validity = entries.filter(([, schema]) => schema.format === 'date-time');
  const current = entries.find(([, schema]) => schema.type === 'boolean' && schema.default === true);
  if (!annotation.history && validity.length >= 2 && current && validity.some(([, schema]) => Array.isArray(schema.type) && schema.type.includes('null'))) {
    propose({ name: 'Supersedable', parameters: { states: ['active', 'superseded'], initialState: 'active' } }, 'medium', [...validity.map(([field]) => evidence(field, 'Timestamp pair with an open-ended nullable boundary.')[0]), ...evidence(current[0], 'Current-row flag beside validity boundaries suggests type-2 history; confirm replacement meaning.')]);
  }

  if (annotation.lifecycle?.states?.length) propose({ name: 'Stateful', parameters: { states: annotation.lifecycle.states, initialState: annotation.lifecycle.initialState ?? annotation.lifecycle.states[0] } }, 'strong', evidence(annotation.lifecycle.field ?? '', 'Explicit lifecycle state declaration.', 'declaration'));
  if (annotation.history) propose({ name: 'Supersedable', parameters: {} }, 'strong', evidence(annotation.history.field ?? '', 'Declared record history; review whether revisions replace one another before accepting Supersedable.', 'declaration'));
  for (const relationship of annotation.relationships ?? []) {
    const field = relationship.via;
    if (relationship.target === shape.title && !annotation.history) propose({ name: 'Classifiable', parameters: { classification_mode: 'taxonomy', hierarchy_storage_model: 'adjacency_list' } }, 'medium', evidence(field, 'A declared self-referencing key can represent an adjacency hierarchy; confirm taxonomy meaning.'));
    if (/^(User|Account|Organization|Team)$/i.test(relationship.target)) propose({ name: 'Ownerable', parameters: {} }, 'medium', evidence(field, 'Declared foreign key to a principal record; confirm ownership rather than another association.'));
  }
  if (annotation.archive) propose({ name: 'Archivable', parameters: {} }, 'strong', evidence(annotation.archive.field, 'Explicit archive marker.', 'declaration'));
  if (annotation.sortFields?.length) propose({ name: 'Sortable', parameters: { sortableFields: annotation.sortFields, defaultSortField: annotation.sortFields[0] } }, 'strong', evidence(annotation.sortFields[0], 'Declared sortable fields.', 'declaration'));
}
