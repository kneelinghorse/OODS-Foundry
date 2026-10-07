import { identifierField, recordKeyField } from '../objects/record-identity.js';
import { sampleValue } from './samples.js';
import { suggestTraits } from './proposals.js';
import { dump } from 'js-yaml';
import { validateDefinition } from '../tools/object.validate.js';
import { normalizeObjectDocument } from '../objects/object-loader.js';
import { parameterProblems } from '../objects/parameter-validation.js';
import { hasTrait, loadTrait } from '../objects/trait-loader.js';
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
    } else if (key.startsWith('x-') && key !== 'x-oods-conflict') result[key] = isMap(a) && isMap(b) ? { ...a, ...b } : b;
    else if (key === 'required') result[key] = [...new Set([...a, ...b])].sort();
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
    const sampleSchemas: Record<string, MapValue> = {};
    const samples: Array<Record<string, unknown>> = [{}, {}, {}, {}, {}];
    const propose = (trait: TraitReference, grade: Proposal['grade'], evidence: Proposal['evidence']) => {
      const errors = hasTrait(trait.name) ? parameterProblems(trait.name, trait.parameters ?? {}).map(p => p.message) : [`Unknown trait ${trait.name}`];
      for (const item of evidence) {
        const entries = byOrigin.get(`${item.file}#${item.pointer}`) ?? [];
        for (const entry of entries) if (entry.kind === 'keyword') { entry.outcome = 'proposed'; entry.reason = `Evidence for ${trait.name}; acceptance required.`; }
      }
      const previous = proposals.find(proposal => proposal.trait.name === trait.name);
      if (previous) {
        if (canonical(previous.trait) !== canonical(trait)) report.push({ ...evidence[0], object: name, kind: 'keyword', outcome: 'unmapped', reason: `Alternative ${trait.name} configuration retained as evidence; one configuration is proposed by evidence grade, then source field order. ${errors.length ? errors.join('; ') : 'Review the selected field binding before acceptance.'}` });
        const rank = { strong: 3, medium: 2, weak: 1 };
        if (rank[grade] > rank[previous.grade] || grade === previous.grade && previous.errors.length > 0 && !errors.length) { previous.trait = trait; previous.grade = grade; previous.errors = errors; previous.valid = !errors.length; }
        previous.evidence.push(...evidence.filter(item => !previous.evidence.some(old => canonical(old) === canonical(item))));
        previous.id = hash(canonical({ name, trait: previous.trait, evidence: previous.evidence })).slice(0, 16);
        return;
      }
      proposals.push({ id: hash(canonical({ name, trait, evidence })).slice(0, 16), trait, grade, evidence, valid: !errors.length, errors,
        effects: trait.fieldBindings ? `Acceptance adds ${trait.name}'s views with the declared fieldBindings; null bindings omit unsupported fields. No trait is applied to this draft.` : `Acceptance adds ${trait.name}'s canonical fields and views. Review field alignment; no trait is applied to this draft.` });
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
      const objectTarget = target && objectNames.has(target);
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
      if (schema.type === 'array' && isMap(schema.items) && !objectTarget) validation.items = effective(schema.items, hub);
      if (Array.isArray(schema.enum) && schema.enum.filter((v: unknown) => v !== null).every((v: unknown) => typeof v === 'string')) validation.enum = schema.enum.filter((v: unknown) => v !== null);
      const definition: FieldDefinition = { type: type + (nullable ? '?' : ''), required: (shape.required ?? []).includes(field), description: text(schema.description, '') };
      if (Object.keys(validation).length) definition.validation = validation;
      if (schema.default !== undefined && !objectTarget) definition.default = schema.default;
      if (schema.readOnly === true) definition.readOnly = true;
      if (schema.writeOnly === true) definition.writeOnly = true;
      if (schema.type === 'array' && isMap(schema.items) && !objectTarget) schema = { ...schema, items: effective(schema.items, hub) };
      sampleSchemas[field] = schema;
      if (!schema.writeOnly && !objectTarget) {
        const sampleSchema = { ...schema, ...(nullable ? { type: [schema.type, 'null'] } : {}) };
        for (let i = 0; i < samples.length; i++) {
          const value = sampleValue(sampleSchema, /^(name|title|label|display_name)$/i.test(field) ? name : field, i);
          if (value !== undefined) Object.defineProperty(samples[i], field, { value, enumerable: true, writable: true });
        }
        if (!samples.some(sample => Object.hasOwn(sample, field))) report.push({ ...fieldOrigin, object: name, kind: 'keyword', outcome: 'unmapped', reason: 'No valid illustrative sample could be generated within the source constraints; sample omitted.' });
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
      if (schema.title || annotation?.label || annotation?.detailGroup || annotation?.semanticType || annotation?.displayLabelField || annotation?.referenceLabelField || annotation?.unit || annotation?.primaryKey) semantics[field] = {
        semantic_type: annotation?.semanticType ?? (annotation?.primaryKey ? 'identifier.primary' : 'text.value'), token_mapping: 'tokenMap(text.primary)',
        ui_hints: { ...(annotation?.primaryKey ? { primaryKey: true } : {}), ...(schema.title || annotation?.label ? { label: annotation?.label ?? schema.title } : {}), ...(annotation?.detailGroup ? { detail_group: annotation.detailGroup } : {}), ...(annotation?.referenceLabelField ? { referenceLabelField: annotation.referenceLabelField } : {}), ...(annotation?.displayLabelField ? { displayLabelField: annotation.displayLabelField } : {}), ...(annotation?.unit ? { unit: annotation.unit } : {}) },
      };
      if (isMap(annotation?.currency) && typeof annotation.currency.field === 'string') {
        semantics[field] = { semantic_type: 'money.amount', token_mapping: 'tokenMap(text.primary)', ui_hints: { ...semantics[field]?.ui_hints, component: 'CurrencyAmount', currencyField: annotation.currency.field, ...(annotation.currency.minorUnits ? { minorUnits: annotation.currency.minorUnits } : {}) } };
        mark(provenance[`${fieldPath}/x-oods`], 'mapped', 'Explicit currency and unit declaration becomes money semantics.');
      }
      if (Array.isArray(validation.enum) && validation.enum.length > 1) propose({ name: 'Stateful', fieldBindings: { status: field }, parameters: { states: validation.enum, initialState: validation.enum.includes(schema.default) ? schema.default : validation.enum[0] } }, 'medium', [{ ...fieldOrigin, pointer: `${fieldOrigin.pointer}/enum`, kind: 'structure', reason: 'String enum supplies possible states; lifecycle meaning and initial state require acceptance.' }]);
      else if (/^(status|state)$/i.test(field)) propose({ name: 'Stateful', fieldBindings: { status: field }, parameters: {} }, 'weak', [{ ...fieldOrigin, kind: 'name', reason: 'Name alone suggests status; no state values or lifecycle structure were declared.' }]);
    }
    const timestamps = Object.entries(sampleSchemas).filter(([, schema]) => schema.format === 'date-time');
    if (timestamps.length) {
      const created = timestamps.find(([field]) => /^created_?at$/i.test(field)) ?? timestamps.find(([field]) => !/^updated_?at$/i.test(field));
      const updated = timestamps.find(([field]) => /^updated_?at$/i.test(field));
      const fieldBindings = Object.fromEntries(Object.keys(loadTrait('Timestampable').schema).map(field => [field, fields[field] ? field : null]));
      fieldBindings.created_at = created?.[0] ?? null;
      fieldBindings.updated_at = updated?.[0] ?? null;
      propose({ name: 'Timestampable', parameters: {}, fieldBindings }, timestamps.some(([, schema]) => schema.readOnly || schema['x-oods']?.generatedTimestamp) ? 'strong' : 'medium', timestamps.map(([field, schema]) => ({
        ...(fieldOrigins(field)[0]?.origin ?? origin), kind: 'structure' as const,
        reason: `date-time format${schema.readOnly ? ' and readOnly' : ''} provides timestamp evidence for ${field}; review the proposed audit role before acceptance.`,
      })));
    }
    const annotations = shape['x-oods'];
    for (const declared of Array.isArray(annotations?.traitProposals) ? annotations.traitProposals : []) {
      if (isMap(declared) && typeof declared.name === 'string') propose({ name: declared.name, parameters: declared.parameters ?? {}, ...(declared.fieldBindings ? { fieldBindings: declared.fieldBindings } : {}) }, declared.evidence.every((e: MapValue) => e.kind === 'name') ? 'weak' : declared.grade, declared.evidence);
    }
    suggestTraits({ ...shape, title: name }, shape.properties, field => fieldOrigins(field)[0]?.origin ?? origin, propose, (field, reason) => report.push({ ...(fieldOrigins(field)[0]?.origin ?? origin), object: name, kind: 'keyword', outcome: 'unmapped', reason }));
    for (const edge of annotations?.relationships ?? []) if (fields[edge.via] && objectNames.has(edge.target) && !relationships.some(item => item.via === edge.via)) relationships.push(edge);
    // Acceptance cannot invent facts the source does not supply. View-state traits are deliberately not record data.
    for (const proposal of proposals) if (hasTrait(proposal.trait.name)) {
      const trait = loadTrait(proposal.trait.name);
      if (trait.trait.tags?.includes('list-behavior')) continue;
      proposal.trait.fieldBindings = { ...Object.fromEntries(Object.keys(trait.schema).map(field => [field, fields[field] ? field : null])), ...proposal.trait.fieldBindings };
      proposal.id = hash(canonical({ name, trait: proposal.trait, evidence: proposal.evidence })).slice(0, 16);
      proposal.effects = `Acceptance binds ${proposal.trait.name} to the declared source fields and omits canonical fields with null bindings. ${Object.values(proposal.trait.fieldBindings).some(Boolean) ? 'Review the bindings and audit roles.' : 'No source fields implement this trait yet; acceptance contributes no record views.'} No trait is applied to this draft.`;
    }
    const title = annotations?.titleField ?? Object.keys(fields).find(field => /^(name|title|label|display_name)$/i.test(field))
      ?? Object.keys(fields).find(field => [name.toLowerCase(), name.toLowerCase().replace(/s$/, '')].some(prefix => ['name', 'title', 'label'].some(suffix => field.replace(/_/g, '').toLowerCase() === prefix + suffix)))
      ?? Object.keys(fields).find(field => sampleSchemas[field]?.['x-oods']?.unique && !sampleSchemas[field]?.format && !sampleSchemas[field]?.enum)
      ?? Object.keys(fields).find(field => sampleSchemas[field]?.['x-oods']?.primaryKey && identifierField(field))
      ?? Object.keys(fields).find(field => sampleSchemas[field]?.['x-oods']?.primaryKey && !['date', 'date-time'].includes(sampleSchemas[field]?.format))
      ?? Object.keys(fields).find(field => identifierField(field));
    if (title && fields[title]) semantics[title] = { ...semantics[title], semantic_type: 'text.label', token_mapping: 'tokenMap(text.primary)' };
    if (annotations?.summaryField && fields[annotations.summaryField]) semantics[annotations.summaryField] = { semantic_type: 'text.summary', token_mapping: 'tokenMap(text.secondary)' };
    const supportedContexts = ['list', 'detail', ...(shape.readOnly || annotations?.readOnly || Object.values(fields).every(field => field.readOnly) ? [] : ['form']), ...(annotations?.lifecycle || annotations?.history ? ['timeline'] : [])];
    if (!Object.keys(fields).length) { objectNames.delete(name); mark(origin, 'unmapped', 'No fields can be projected without choosing a variant or inventing a scalar conversion.', 'schema'); continue; }
    const definition = normalizeObjectDocument({ object: { name, version: '1.0.0', domain: 'imported', description: text(shape.description, `Imported ${hub['x-oods'].sourceNames[name]} schema. Samples without source examples are illustrative.`) }, schema: fields, traits: [], semantics, relationships, samples,
      metadata: { supportedContexts, ...(annotations?.listColumns ? { listColumns: annotations.listColumns.filter((column: MapValue) => fields[column.field]) } : {}), references: [`${origin.file}#${origin.pointer}`] } });
    for (const proposal of proposals) if (proposal.valid) {
      try { composeObject({ ...definition, traits: [proposal.trait] }); }
      catch (error) { proposal.valid = false; proposal.errors.push((error as Error).message); }
    }
    // Exercise the same composition and field-contract materialization as object.validate before issuing a draft.
    const composed = composeObject(definition);
    populateObjectSchema({ version: '2026.02', screens: [{ id: 'import-shape', component: 'Stack' }] } as UiSchema, composed.schema, composed.semantics, composed.traits, composed.samples);
    mark(origin, 'mapped', `Drafted an object with ${supportedContexts.join(', ')} contexts; no traits applied.`, 'schema');
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
    for (const edge of draft.definition.relationships) {
      const target = drafts.find(item => item.name === edge.target)!;
      const id = recordKeyField(target.definition)!;
      for (const [i, row] of (draft.definition.samples ?? []).entries()) {
        const value = target.definition.samples?.[i]?.[id];
        if (value !== undefined) row[edge.via] = draft.definition.schema[edge.via].type.replace(/\?$/, '').endsWith('[]') ? [String(value)] : /^integer|^number/.test(draft.definition.schema[edge.via].type) ? Number(value) : String(value);
      }
    }
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
  for (const entry of report) if (!entry.object) {
    const owner = drafts.filter(draft => entry.file === draft.origin.file && (entry.pointer === draft.origin.pointer || entry.pointer.startsWith(draft.origin.pointer + '/'))).sort((a, b) => b.origin.pointer.length - a.origin.pointer.length)[0];
    if (owner) entry.object = owner.name;
  }
  const ordered = dependencyOrder(drafts);
  const counts = { total: report.length, mapped: 0, proposed: 0, unmapped: 0, fields: 0, mappedFields: 0 };
  for (const entry of report) { counts[entry.outcome]++; if (entry.kind === 'property') { counts.fields++; if (entry.outcome === 'mapped') counts.mappedFields++; } }
  return { ...normalized, ...ordered, counts };
}
