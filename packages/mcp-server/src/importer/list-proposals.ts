import { fieldLabel } from '../compose/label-generator.js';
import { pluralLabel } from '../codegen/screen-shell.js';
import { recordKeyField } from '../objects/record-identity.js';
import type { ObjectDefinition, ObjectRelationship, RelatedList } from '../objects/types.js';
import { relatedListProblems } from '../objects/related-lists.js';
import { shapeOfDefinition } from '../compose/related-records.js';
import type { Draft } from './draft.js';
import type { Hub, ReportEntry } from './hub.js';
import { canonical, escapePointer, hash, isMap, type MapValue, type Origin } from './source.js';

export interface ListProposal {
  id: string;
  list: RelatedList;
  grade: 'strong';
  evidence: Array<Origin & { kind: 'declaration'; reason: string }>;
  effects: string;
  valid: boolean;
  errors: string[];
  /** The read-only inverse array superseded when the team accepts this list. */
  backSide?: string;
}

const auditSeat = /^(?:created|updated|modified|deleted|reviewed|approved|archived|changed|edited)_?by(?:_?id)?$|^(?:creator|updater|editor|modifier)(?:_?id)?$/i;
const slug = (word: string) => word.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
// These common plurals and mass nouns already name a collection.
const collectionName = (name: string) => /\b(?:staff|people|children|men|women|mice|geese|sheep|fish|deer|equipment|information)$/i.test(name) ? name : pluralLabel(name);
const timeField = (definition: ObjectDefinition) => {
  const dates = Object.keys(definition.schema).filter(key => /^(date|datetime)\??$/.test(definition.schema[key].type));
  return dates.find(key => /^created_?at$/i.test(key)) ?? dates.find(key => /^created/i.test(key))
    ?? dates.find(key => !/^(updated|modified|deleted|last_?update)|expir|end|until/i.test(key));
};

interface Key {
  target: Draft;
  via: string;
  role: string;
  origin: Origin;
  referenced?: string;
  useInverse: boolean;
}

export function proposeLists(drafts: Draft[], hub: Hub, report: ReportEntry[]) {
  const byName = new Map(drafts.map(draft => [draft.name, draft]));
  const shapes = new Map(drafts.map(draft => [draft.name, shapeOfDefinition(draft.definition, { schema: draft.definition.schema })]));
  for (const source of drafts) {
    const schema = hub.$defs[source.name];
    const keys: Key[] = [];
    const base = `/$defs/${escapePointer(source.name)}`;
    const declared: ObjectRelationship[] = Array.isArray(schema['x-oods']?.relationships) ? schema['x-oods'].relationships : [];
    for (const [index, edge] of declared.entries()) {
      const target = byName.get(edge.target);
      if (!target || edge.cardinality !== 'many-to-one' || !Object.hasOwn(source.definition.schema, edge.via)) continue;
      const property = schema.properties?.[edge.via];
      const origin = hub['x-oods'].provenance[base + '/x-oods/relationships/' + index] ?? source.origin;
      const hints: MapValue[] = Array.isArray(schema['x-import-foreign-keys']) ? schema['x-import-foreign-keys'] : [];
      const foreign = hints.find(key => isMap(key) && key.via === edge.via && (key.target === target.sourceName || key.target === target.name)
        && isMap(key.origin) && typeof key.origin.file === 'string' && typeof key.origin.pointer === 'string');
      if (!foreign && isMap(property?.['x-odata']) && Object.keys(property['x-odata']).some(key => /(?:^@|\.)Common(?:\.v1)?\.ValueList(?:#|$)/.test(key))) {
        report.push({ ...origin, object: source.name, kind: 'link', outcome: 'unmapped', reason: `No related list for ${source.name}.${edge.via}: the OData value help declares choices without a navigation key to ${target.name}.` });
        continue;
      }
      if (keys.some(key => key.target === target && key.via === edge.via)) continue;
      keys.push({ target, via: edge.via, role: fieldLabel(edge.via.replace(/(?:_id|Id|ID)$/, '') || edge.via).toLowerCase(),
        origin: foreign?.origin ?? origin, referenced: foreign?.referenced, useInverse: foreign?.reader === 'prisma' || foreign?.reader === 'odata' });
    }
    const primary = Object.keys(source.definition.schema).filter(field => source.definition.semantics[field]?.ui_hints?.primaryKey === true);
    const link = primary.length > 1 && primary.every(field => keys.some(key => key.via === field));
    for (const key of keys) {
      const target = key.target;
      const targetKey = recordKeyField(target.definition);
      const skip = link ? 'the primary key is made of foreign keys on this link record'
        : primary.length === 1 && primary[0] === key.via ? 'the foreign key is also the source record’s primary key'
        : key.referenced && key.referenced !== targetKey ? `the key references ${key.referenced} instead of the record key ${targetKey ?? '(none)'}` : undefined;
      if (skip) {
        report.push({ ...key.origin, object: source.name, kind: 'link', outcome: 'unmapped', reason: `No related list for ${source.name}.${key.via}: ${skip}.` });
        continue;
      }
      const otherKeys = keys.filter(other => other.target === target).length;
      const inverses = (target.definition.relationships ?? []).filter(edge => edge.target === source.name && edge.cardinality === 'one-to-many');
      const backSide = key.useInverse && otherKeys === 1 && inverses.length === 1 ? inverses[0].via : undefined;
      const seat = otherKeys > 1 || target === source;
      const name = fieldLabel(source.name);
      const plural = collectionName(name);
      const inverse = backSide ? fieldLabel(backSide) : undefined;
      const noun = !seat && inverse && inverse.toLowerCase() !== plural.toLowerCase() ? `${name} records in ${inverse}` : plural;
      const field = key.role.charAt(0).toUpperCase() + key.role.slice(1);
      const id = slug(source.name) + (seat ? '-' + slug(key.role) : '');
      const time = timeField(source.definition);
      const list: RelatedList = { id, label: seat ? `${noun} with “${field}” set to {name}` : `${noun} for {name}`,
        empty: seat ? `No records from ${source.name} have “${field}” set to {name}.` : `No records from ${source.name} match {name}.`,
        ...(auditSeat.test(key.via) ? { collapsed: true } : {}),
        sources: [{ from: source.name, via: key.via, ...(time ? { row: { time } } : {}) }] };
      const proposals = target.lists ??= [];
      let suffix = 2;
      while (proposals.some(proposal => proposal.list.id === list.id)) list.id = id + '-' + suffix++;
      const evidence: ListProposal['evidence'] = [{ ...key.origin, kind: 'declaration', reason: `${source.name}.${key.via} declares a key to ${target.name}.${key.referenced ?? targetKey}.` }];
      const errors = relatedListProblems([list], shapes.get(target.name)!, name => shapes.get(name)).map(problem => problem.message);
      const effects = `Shows records from ${source.name} whose ${key.via} matches this record’s ${targetKey}.` + (backSide ? ` Replaces the generated ${backSide} array with the matching records.` : '') + ' Replacing a shipped object also replaces its list declarations.';
      proposals.push({ id: hash(canonical({ target: target.name, list, evidence })).slice(0, 16), list, grade: 'strong', evidence, effects, valid: errors.length === 0, errors, ...(backSide ? { backSide } : {}) });
      report.push({ ...key.origin, object: target.name, kind: 'link', outcome: 'proposed', reason: `Related list ${list.id} from ${source.name}.${key.via} requires acceptance.` });
    }
  }
}
