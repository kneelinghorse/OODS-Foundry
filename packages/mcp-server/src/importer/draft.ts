import { dump } from 'js-yaml';
import { validateDefinition } from '../tools/object.validate.js';
import { normalizeObjectDocument } from '../objects/object-loader.js';
import { parameterProblems } from '../objects/parameter-validation.js';
import { hasTrait } from '../objects/trait-loader.js';
import { composeObject } from '../objects/trait-composer.js';
import { populateObjectSchema } from '../compose/object-slot-filler.js';
import type { ObjectDefinition, FieldDefinition, SemanticMapping, TraitReference } from '../objects/types.js';
import type { UiSchema } from '../schemas/generated.js';
import { normalizeSource, type Hub, type Normalized, type ReportEntry } from './hub.js';
import { canonical, escapePointer, hash, isMap, walk, type MapValue, type Origin, type SourceInput } from './source.js';

export type Proposal = { id: string; trait: TraitReference; grade: 'strong' | 'medium' | 'weak'; evidence: Array<Origin & { kind: 'declaration' | 'structure' | 'name'; reason: string }>; effects: string; valid: boolean; errors: string[] };
export type Draft = { name: string; sourceName: string; origin: Origin; yaml: string; definition: ObjectDefinition; proposals: Proposal[]; dependencies: string[] };
export type ImportResult = Normalized & { drafts: Draft[]; cycles: string[][]; counts: { total: number; mapped: number; proposed: number; unmapped: number; fields: number; mappedFields: number } };
const formats: Record<string, string> = { uuid: 'uuid', 'date-time': 'datetime', date: 'date', email: 'email', uri: 'url', url: 'url' };
const fieldConstraints = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'uniqueItems', 'pattern', 'format', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']);
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value : fallback;
const targetName = (schema: MapValue) => typeof schema.$ref === 'string' && schema.$ref.startsWith('#/$defs/') ? schema.$ref.slice(8) : undefined;

/** Intersections preserve constraints; contradictory field shapes are reported rather than overwritten. */
function intersect(left: MapValue, right: MapValue): MapValue {
  const result = { ...left };
  for (const key of Object.keys(right)) {
    const a = result[key], b = right[key];
    if (a === undefined || canonical(a) === canonical(b)) { result[key] = b; continue; }
    if (key === 'properties') {
      result.properties = { ...a };
      for (const field of Object.keys(b)) Object.defineProperty(result.properties, field, { value: Object.hasOwn(a, field) ? { allOf: [a[field], b[field]] } : b[field], enumerable: true, configurable: true, writable: true });
    } else if (key === 'required') result[key] = [...new Set([...a, ...b])].sort();
    else if (key === 'enum') result[key] = a.filter((v: unknown) => b.some((other: unknown) => canonical(v) === canonical(other)));
    else if (key === 'type') {
      const shared = (Array.isArray(a) ? a : [a]).filter(v => (Array.isArray(b) ? b : [b]).includes(v));
      if (!shared.length) result['x-oods-conflict'] = 'allOf has incompatible types';
      else result.type = shared.length === 1 ? shared[0] : shared;
    } else if (['minimum', 'exclusiveMinimum', 'minLength', 'minItems'].includes(key)) result[key] = Math.max(a, b);
    else if (['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems'].includes(key)) result[key] = Math.min(a, b);
    else if (key === 'readOnly' || key === 'writeOnly') result[key] = a || b;
    else if (['title', 'description', 'example', 'examples', 'default', 'discriminator'].includes(key)) { /* keep first annotation, provenance retains both */ }
    else result['x-oods-conflict'] = `allOf has incompatible ${key} constraints`;
  }
  if (Array.isArray(result.enum) && !result.enum.length) result['x-oods-conflict'] = 'allOf has no common enum values';
  for (const [min, max] of [['minimum', 'maximum'], ['minLength', 'maxLength'], ['minItems', 'maxItems']]) if (result[min] > result[max]) result['x-oods-conflict'] = `allOf has contradictory ${min}/${max}`;
  return result;
}

function effective(schema: MapValue, hub: Hub, active = new Set<string>()): MapValue {
  let result: MapValue = {};
  const target = targetName(schema);
  if (target) {
    if (active.has(target)) return { ...schema, 'x-oods-conflict': 'Recursive inheritance cannot be flattened; reference retained in hub.' };
    result = effective(hub.$defs[target] ?? {}, hub, new Set([...active, target]));
  }
  for (const branch of Array.isArray(schema.allOf) ? schema.allOf : []) {
    if (!isMap(branch)) { if (branch === false) result['x-oods-conflict'] = 'allOf contains false'; continue; }
    result = intersect(result, effective(branch, hub, active));
  }
  const own = Object.fromEntries(Object.entries(schema).filter(([key]) => !['$ref', 'allOf'].includes(key)));
  return intersect(result, own);
}

export function dependencyOrder(drafts: Draft[]): { drafts: Draft[]; cycles: string[][] } {
  const byName = new Map(drafts.map(draft => [draft.name, draft]));
  const ordered: Draft[] = [], done = new Set<string>(), active: string[] = [], cycles: string[][] = [];
  const visit = (name: string) => {
    if (done.has(name)) return;
    const loop = active.indexOf(name);
    if (loop >= 0) { cycles.push([...active.slice(loop), name]); return; }
    const draft = byName.get(name);
    if (!draft) return;
    active.push(name);
    for (const target of draft.dependencies) if (target !== name) visit(target);
    active.pop(); done.add(name); ordered.push(draft);
  };
  [...byName.keys()].sort().forEach(visit);
  return { drafts: ordered, cycles };
}

export function draftSource(input: SourceInput): ImportResult {
  const normalized = normalizeSource(input);
  const { hub, report } = normalized;
  const provenance = hub['x-oods'].provenance;
  const byOrigin = new Map<string, ReportEntry[]>();
  for (const entry of report) {
    const key = `${entry.file}#${entry.pointer}`;
    const entries = byOrigin.get(key) ?? []; entries.push(entry); byOrigin.set(key, entries);
  }
  const mark = (origin: Origin | undefined, outcome: ReportEntry['outcome'], reason: string, kind?: ReportEntry['kind']) => {
    if (!origin) return;
    for (const entry of byOrigin.get(`${origin.file}#${origin.pointer}`) ?? []) if (!kind || entry.kind === kind) { entry.outcome = outcome; entry.reason = reason; }
  };
  const shapes = new Map(Object.keys(hub.$defs).sort().map(name => [name, effective(hub.$defs[name], hub)]));
  const objectNames = new Set([...shapes.entries()].filter(([, shape]) => isMap(shape.properties) && Object.keys(shape.properties).length && !shape['x-oods-conflict']).map(([name]) => name));
  const drafts: Draft[] = [];
  for (const [name, shape] of shapes) {
    const base = `/$defs/${name}`, origin = provenance[base];
    if (!objectNames.has(name)) {
      mark(origin, 'unmapped', shape['x-oods-conflict'] ?? (shape.oneOf || shape.anyOf ? 'Variant container retained; choose a concrete variant schema.' : 'No object properties to project.'), 'schema'); continue;
    }
    const fields: Record<string, FieldDefinition> = {}, semantics: Record<string, SemanticMapping> = {};
    const relationships: NonNullable<ObjectDefinition['relationships']> = [];
    const proposals: Proposal[] = [];
    const propose = (trait: TraitReference, grade: Proposal['grade'], evidence: Proposal['evidence']) => {
      const errors = hasTrait(trait.name) ? parameterProblems(trait.name, trait.parameters ?? {}).map(p => p.message) : [`Unknown trait ${trait.name}`];
      for (const item of evidence) {
        const entries = byOrigin.get(`${item.file}#${item.pointer}`) ?? [];
        for (const entry of entries) if (entry.kind === 'keyword') { entry.outcome = 'proposed'; entry.reason = `Evidence for ${trait.name}; acceptance required.`; }
      }
      proposals.push({ id: hash(canonical({ name, trait, evidence })).slice(0, 16), trait, grade, evidence, valid: !errors.length, errors,
        effects: `Acceptance adds ${trait.name}'s canonical fields and views. Review field alignment; no trait is applied to this draft.` });
    };
    // Inherited fields keep the original declaration's provenance, including same-folder references.
    const fieldOrigins = (field: string): Array<{ path: string; origin: Origin }> => {
      const suffix = `/properties/${escapePointer(field)}`;
      const candidates: Array<{ path: string; origin: Origin }> = [];
      const seen = new Set<string>();
      const find = (node: MapValue, at: string) => {
        if (seen.has(at)) return; seen.add(at);
        if (node.properties && Object.hasOwn(node.properties, field) && provenance[at + suffix]) candidates.push({ path: at + suffix, origin: provenance[at + suffix] });
        const target = targetName(node); if (target) find(hub.$defs[target], `/$defs/${target}`);
        (node.allOf ?? []).forEach((branch: MapValue, i: number) => { if (isMap(branch)) find(branch, `${at}/allOf/${i}`); });
      };
      find(hub.$defs[name], base);
      return candidates;
    };
    for (const field of Object.keys(shape.properties).sort()) {
      const raw = shape.properties[field];
      const places = fieldOrigins(field);
      const fieldOrigin = places[0]?.origin ?? origin;
      const fieldPath = places[0]?.path ?? `${base}/properties/${escapePointer(field)}`;
      const markField = (outcome: ReportEntry['outcome'], reason: string) => places.forEach(place => mark(place.origin, outcome, reason, 'property'));
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) || ['__proto__', 'prototype', 'constructor'].includes(field)) { markField('unmapped', 'Field name is not a valid object/code identifier; rename explicitly before applying.'); continue; }
      if (!isMap(raw)) { markField('unmapped', 'Boolean schemas have no concrete field type.'); continue; }
      let schema = effective(raw, hub);
      let nullable = false, referenceSchema = raw;
      const union = schema.oneOf ?? schema.anyOf;
      if (Array.isArray(union) && union.length === 2 && union.filter((branch: MapValue) => branch.type === 'null').length === 1) {
        nullable = true;
        const branch = union.find((branch: MapValue) => branch.type !== 'null');
        const { oneOf: _one, anyOf: _any, ...rest } = schema;
        referenceSchema = branch;
        schema = intersect(effective(branch, hub), rest);
      }
      if (Array.isArray(schema.type)) {
        nullable = nullable || schema.type.includes('null');
        const types = schema.type.filter((type: string) => type !== 'null');
        if (types.length === 1) schema = { ...schema, type: types[0] }; else { markField('unmapped', 'Multiple non-null types retained as a union in the hub.'); continue; }
      }
      let target = targetName(referenceSchema), many = false;
      if (schema.type === 'array') { many = true; if (isMap(schema.items)) target = targetName(schema.items); }
      let type: string | undefined;
      if (target && objectNames.has(target)) {
        type = many ? 'string[]' : 'string';
        relationships.push({ target, via: field, cardinality: many ? 'one-to-many' : 'many-to-one', label: text(raw.title, field.replace(/_/g, ' ')) });
        for (const place of places) mark(provenance[`${place.path}${many ? '/items' : ''}/$ref`], 'mapped', `Named schema reference becomes a relationship to ${target}.`, 'link');
      } else if (schema['x-oods-conflict'] || schema.oneOf || schema.anyOf) {
        markField('unmapped', schema['x-oods-conflict'] ?? 'oneOf/anyOf variants retained separately; no variant is selected automatically.'); continue;
      } else if (['string', 'integer', 'number', 'boolean'].includes(schema.type)) type = schema.type === 'string' ? (formats[schema.format] ?? 'string') : schema.type;
      else if (schema.type === 'array' && isMap(schema.items)) {
        const item = effective(schema.items, hub);
        if (['string', 'integer', 'number', 'boolean'].includes(item.type)) type = `${item.type === 'string' ? formats[item.format] ?? 'string' : item.type}[]`;
      }
      if (!type) { markField('unmapped', 'Nested documents, maps and unconstrained fields are retained in the hub; the scalar object editor cannot represent them.'); continue; }
      const validation: MapValue = Object.fromEntries(Object.entries(schema).filter(([key]) => fieldConstraints.has(key)));
      if (Array.isArray(schema.enum) && schema.enum.filter((v: unknown) => v !== null).every((v: unknown) => typeof v === 'string')) validation.enum = schema.enum.filter((v: unknown) => v !== null);
      const definition: FieldDefinition = { type: type + (nullable ? '?' : ''), required: (shape.required ?? []).includes(field), description: text(schema.description, text(schema.title, field.replace(/_/g, ' '))) };
      if (Object.keys(validation).length) definition.validation = validation;
      if (schema.default !== undefined && !target) definition.default = schema.default;
      if (schema.readOnly === true) definition.readOnly = true;
      if (schema.writeOnly === true) definition.writeOnly = true;
      const examples = schema.examples ?? (schema.example !== undefined ? [schema.example] : undefined);
      if (Array.isArray(examples) && examples.length && !target && !schema.writeOnly) definition.examples = examples.filter((v: unknown) => !validation.enum || validation.enum.includes(v));
      if (!definition.examples?.length && !schema.writeOnly) {
        const sample = validation.enum?.[0] ?? schema.default ?? (type === 'boolean' ? true : type === 'integer' || type === 'number' ? Math.max(schema.minimum ?? 1, 1) : type.endsWith('[]') ? [] : type === 'datetime' ? '2026-01-01T12:00:00Z' : type === 'date' ? '2026-01-01' : type === 'email' ? 'example@example.com' : type === 'url' ? 'https://example.com' : type === 'uuid' ? '00000000-0000-4000-8000-000000000001' : target ? `${target}-example` : `Example ${field.replace(/_/g, ' ')}`);
        definition.examples = [sample];
      }
      Object.defineProperty(fields, field, { value: definition, enumerable: true });
      markField('mapped', target && objectNames.has(target) ? 'Mapped to a relationship identifier field; referenced object data stays in the related object.' : 'Mapped to an object field; unsupported constraints remain explicitly listed in the report.');
      for (const place of places) {
        for (const key of ['type', 'title', 'description', 'default', 'example', 'examples', 'readOnly', 'writeOnly', ...fieldConstraints]) mark(provenance[`${place.path}/${key}`], 'mapped', 'Retained in the object field contract.');
        if (validation.enum) {
          mark(provenance[`${place.path}/enum`], 'mapped', 'String enumeration becomes field validation.');
          schema.enum.forEach((_v: unknown, i: number) => mark(provenance[`${place.path}/enum/${i}`], 'mapped', 'Enumeration member is retained (nullability is represented by the nullable type).', 'enum'));
        }
      }
      const annotation = schema['x-oods'];
      if (isMap(annotation?.currency) && typeof annotation.currency.field === 'string') {
        semantics[field] = { semantic_type: 'money.amount', token_mapping: 'tokenMap(text.primary)', ui_hints: { component: 'CurrencyAmount', currencyField: annotation.currency.field, ...(annotation.currency.minorUnits ? { minorUnits: annotation.currency.minorUnits } : {}) } };
        mark(provenance[`${fieldPath}/x-oods`], 'mapped', 'Explicit currency and unit declaration becomes money semantics.');
      }
      if (Array.isArray(validation.enum) && validation.enum.length > 1) propose({ name: 'Stateful', parameters: { states: validation.enum, initialState: validation.enum.includes(schema.default) ? schema.default : validation.enum[0] } }, 'medium', [{ ...fieldOrigin, pointer: `${fieldOrigin.pointer}/enum`, kind: 'structure', reason: 'String enum supplies possible states; lifecycle meaning and initial state require acceptance.' }]);
      else if (type === 'datetime') propose({ name: 'Timestampable', parameters: {} }, schema.readOnly ? 'strong' : 'medium', [{ ...fieldOrigin, pointer: `${fieldOrigin.pointer}/format`, kind: 'structure', reason: `date-time format${schema.readOnly ? ' and readOnly' : ''} provides timestamp evidence; audit meaning requires acceptance.` }]);
      else if (/^(status|state)$/i.test(field)) propose({ name: 'Stateful', parameters: {} }, 'weak', [{ ...fieldOrigin, kind: 'name', reason: 'Name alone suggests status; no state values or lifecycle structure were declared.' }]);
    }
    const annotations = shape['x-oods'];
    for (const declared of Array.isArray(annotations?.traitProposals) ? annotations.traitProposals : []) {
      if (isMap(declared) && typeof declared.name === 'string') propose({ name: declared.name, parameters: declared.parameters ?? {} }, declared.evidence.every((e: MapValue) => e.kind === 'name') ? 'weak' : declared.grade, declared.evidence);
    }
    if (!Object.keys(fields).length) { objectNames.delete(name); mark(origin, 'unmapped', 'No fields can be projected without choosing a variant or inventing a scalar conversion.', 'schema'); continue; }
    const definition = normalizeObjectDocument({ object: { name, version: '1.0.0', domain: 'imported', description: text(shape.description, `Imported ${hub['x-oods'].sourceNames[name]} schema. Samples without source examples are illustrative.`) }, schema: fields, traits: [], semantics, relationships,
      metadata: { supportedContexts: ['list', 'detail', 'form'], references: [`${origin.file}#${origin.pointer}`] } });
    // Exercise the same composition and field-contract materialization as object.validate before issuing a draft.
    const composed = composeObject(definition);
    populateObjectSchema({ version: '2026.02', screens: [{ id: 'import-shape', component: 'Stack' }] } as UiSchema, composed.schema, composed.semantics, composed.traits, composed.samples);
    mark(origin, 'mapped', 'Drafted an object with list, detail and form contexts; no traits applied.', 'schema');
    for (const key of ['type', 'properties', 'required', 'allOf', 'title', 'description']) mark(provenance[`${base}/${key}`], 'mapped', 'Projected into the object definition.');
    drafts.push({ name, sourceName: hub['x-oods'].sourceNames[name], origin, definition, yaml: '', proposals: proposals.sort((a, b) => a.id < b.id ? -1 : 1), dependencies: [] });
  }
  // Remove edges to schemas which turned out to have no representable fields, with an explicit report outcome.
  const drafted = new Set(drafts.map(draft => draft.name));
  for (const draft of drafts) {
    draft.definition.relationships = (draft.definition.relationships ?? []).filter(edge => {
      if (drafted.has(edge.target)) return true;
      for (const entry of report) if (entry.object === draft.name && entry.kind === 'link' && entry.reason.includes(edge.target)) { entry.outcome = 'unmapped'; entry.reason = `Target ${edge.target} has no projectable object; identifier field retained, relationship not registered.`; }
      return false;
    });
    draft.dependencies = [...new Set(draft.definition.relationships.map(edge => edge.target))].sort();
    const annotations = hub.$defs[draft.name]['x-oods'] ?? {};
    const proposalPath = `/$defs/${draft.name}/x-oods/traitProposals`;
    annotations.traitProposals = draft.proposals.map(p => ({ ...p.trait, grade: p.grade, evidence: p.evidence }));
    hub.$defs[draft.name]['x-oods'] = annotations;
    provenance[`/$defs/${draft.name}/x-oods`] ??= draft.origin;
    walk(annotations.traitProposals, (_value, pointer) => { provenance[pointer] ??= draft.proposals[Number(pointer.slice(proposalPath.length + 1).split('/')[0])]?.evidence[0] ?? draft.origin; }, proposalPath);
    draft.yaml = dump(JSON.parse(canonical(draft.definition)), { noRefs: true, sortKeys: true, lineWidth: 120 });
    const checked = validateDefinition(draft.yaml, [...drafted]);
    if (!checked.valid) throw new Error(`Draft ${draft.name} does not validate: ${checked.errors.map(error => error.message).join('; ')}`);
  }
  const ordered = dependencyOrder(drafts);
  const counts = { total: report.length, mapped: 0, proposed: 0, unmapped: 0, fields: 0, mappedFields: 0 };
  for (const entry of report) { counts[entry.outcome]++; if (entry.kind === 'property') { counts.fields++; if (entry.outcome === 'mapped') counts.mappedFields++; } }
  return { ...normalized, ...ordered, counts };
}
