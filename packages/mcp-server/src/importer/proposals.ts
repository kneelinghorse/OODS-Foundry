import type { Proposal } from './draft.js';
import type { TraitReference } from '../objects/types.js';
import { isMap, type MapValue, type Origin } from './source.js';

type Propose = (trait: TraitReference, grade: Proposal['grade'], evidence: Proposal['evidence']) => void;

/** The named schema a field points at, one level through a nullable union or an array's items. */
function referenceOf(schema: MapValue): { target: string; many: boolean } | undefined {
  if (!isMap(schema)) return undefined;
  const union = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined;
  if (union?.length === 2 && union.some((branch: MapValue) => branch?.type === 'null')) return referenceOf(union.find((branch: MapValue) => branch?.type !== 'null'));
  const name = (value: MapValue) => isMap(value) && typeof value.$ref === 'string' && value.$ref.startsWith('#/$defs/') ? value.$ref.slice(8).replace(/~1/g, '/').replace(/~0/g, '~') : undefined;
  if (schema.type === 'array' || Array.isArray(schema.type) && schema.type.includes('array')) { const target = name(schema.items); return target ? { target, many: true } : undefined; }
  const target = name(schema);
  return target ? { target, many: false } : undefined;
}
/** s244-m03 (#2837): a record that people or groups are named by: a user, an account, an organization, a team, a group or a directory object. */
const PRINCIPAL = /^(user|account|organi[sz]ation|team|group|directoryobject|person|member|principal)$/i;
const principal = (target: string) => PRINCIPAL.test(target.split('.').pop() ?? target);
/** A boolean field, nullable or not (OData and JSON Schema write a nullable one as type [boolean, null]). */
const boolean = (schema: MapValue) => schema.type === 'boolean' || Array.isArray(schema.type) && schema.type.includes('boolean') && schema.type.every((type: string) => type === 'boolean' || type === 'null');
/** An app or installation record beside a bot flag says the flagged records are an app's (an agent's). */
const APP = /^(app|application|installation|integration|oauthapp|oauthapplication|bot|botprofile|serviceprincipal)$/i;
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

  if (annotation.lifecycle?.states?.length) propose({ name: 'Stateful', ...(fields[annotation.lifecycle.field] ? { fieldBindings: { status: annotation.lifecycle.field } } : {}), parameters: { states: annotation.lifecycle.states, initialState: annotation.lifecycle.initialState ?? annotation.lifecycle.states[0] } }, 'strong', evidence(annotation.lifecycle.field ?? '', 'Explicit lifecycle state declaration.', 'declaration'));
  if (annotation.history) propose({ name: 'Supersedable', parameters: {} }, 'strong', evidence(annotation.history.field ?? '', 'Declared record history; review whether revisions replace one another before accepting Supersedable.', 'declaration'));
  for (const relationship of annotation.relationships ?? []) {
    const field = relationship.via;
    if (relationship.target === shape.title && !annotation.history) propose({ name: 'Classifiable', parameters: { classification_mode: 'taxonomy', hierarchy_storage_model: 'adjacency_list' } }, 'medium', evidence(field, 'A declared self-referencing key can represent an adjacency hierarchy; confirm taxonomy meaning.'));
    // s244-m03 (#2837): group and directory-object targets name principals too (Microsoft Graph's owners and sponsors).
    if (principal(relationship.target)) propose({ name: 'Ownerable', parameters: {} }, 'medium', evidence(field, 'Declared foreign key to a principal record; confirm ownership rather than another association.'));
  }
  if (annotation.archive) propose({ name: 'Archivable', parameters: {} }, 'strong', evidence(annotation.archive.field, 'Explicit archive marker.', 'declaration'));

  // s244-m03 (#2837): agent records (an agent is an actor, not a user). A field's name is name evidence and grades weak; a
  // reference to a principal or an app record is the structure that backs it (medium). Nothing applies without acceptance.
  const named = (field: string, reason: string) => [{ ...originOf(field), kind: 'name' as const, reason }];
  // Sponsors before owners: an agent's sponsor is a person or a team, and the first configuration of a grade is kept.
  for (const [field, schema] of [...entries].sort(([a], [b]) => Number(/^sponsors?$/i.test(b)) - Number(/^sponsors?$/i.test(a)))) {
    const reference = referenceOf(schema);
    const toPrincipal = reference && principal(reference.target) ? reference.target : undefined;
    // A boolean named owner is a role flag (Linear's User.owner), never a reference to who owns the record.
    if (/^(owners?|sponsors?)$/i.test(field) && !boolean(schema)) {
      const sponsor = /^sponsors?$/i.test(field);
      const trait = { name: 'Ownerable', parameters: sponsor ? { ownerTypes: ['user', 'team'], primaryOwnerType: 'user' } : {}, ...(toPrincipal && !reference!.many ? { fieldBindings: { owner_id: field } } : {}) };
      if (toPrincipal) propose(trait, 'medium', evidence(field, `${sponsor ? 'Sponsors' : 'Owners'} reference ${toPrincipal} records: the people or groups ${sponsor ? 'who answer for this record' : 'who own this record'}; confirm ownership before accepting.`));
      else propose(trait, 'weak', named(field, `Name alone suggests ${sponsor ? 'sponsors' : 'owners'}; the field references no person, group or directory record.`));
    }
    if (/^(run_?as(_?user)?|runs_?as|on_?behalf_?of(_?(user|id))?|acting_?(as|for)|identity_?parent(_?id)?)$/i.test(field)) {
      if (toPrincipal) propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', evidence(field, `This record acts as or for a ${toPrincipal} record: an agent acting under a delegation. Model the grant as a Relationship of type delegation from that ${toPrincipal} to this record.`));
      else propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'weak', named(field, 'Name alone suggests this record acts as or for someone else (a delegation); the field references no person or principal record.'));
    }
    if (boolean(schema) && /^(is_?bot|bot|is_?app(_?user)?|app|is_?agent|agent)$/i.test(field)) {
      const app = entries.find(([other, value]) => other !== field && APP.test((referenceOf(value)?.target ?? '').split('.').pop() ?? ''));
      const flagged = `Records with ${field} true are agents (an app or a bot); OODS keeps an agent in an object of its own, so separate people from agents before accepting Actor as an agent.`;
      if (app) propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', [...evidence(field, flagged), ...evidence(app[0], `The ${field} flag sits beside a reference to ${referenceOf(app[1])!.target}, the app the flagged records belong to.`)]);
      else propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'weak', named(field, `${flagged} Only the flag's name says so: no app or installation reference sits beside it.`));
    }
    const constant = schema.const ?? (Array.isArray(schema.enum) && schema.enum.length === 1 ? schema.enum[0] : undefined);
    if (/^(resource_?type|type|kind|object)$/i.test(field) && constant === 'agent') {
      propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', evidence(field, `Every record declares ${field} "agent": the records are agents.`));
    }
    if (boolean(schema) && /^(active|is_?active|enabled|is_?enabled|account_?enabled)$/i.test(field)) {
      const states = /enabled/i.test(field) ? ['enabled', 'disabled'] : ['active', 'inactive'];
      propose({ name: 'Stateful', parameters: { states, initialState: states[0] } }, 'weak', named(field, `A boolean named ${field} is a two-state lifecycle (${states.join(', ')}). The source records a flag, not a state, so acceptance binds no status field until the flag is mapped to one.`));
    }
  }
  if (annotation.sortFields?.length) propose({ name: 'Sortable', parameters: { sortableFields: annotation.sortFields, defaultSortField: annotation.sortFields[0] } }, 'strong', evidence(annotation.sortFields[0], 'Declared sortable fields.', 'declaration'));
}
