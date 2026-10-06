/** Create one mapping or validate and atomically save a complete list. */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadMappings, saveMappings, computeMappingsEtag, generateMappingId, loadKnownTraits,
  type ComponentMapping, type MappingsDoc, type PropMapping,
} from './map.shared.js';
import type {
  MapCreateInput, MapCreateOutput, MapCreateBatchInput, MapCreateBatchOutput,
  MapCreateBatchError, MapCreateEntryOutcome,
} from './types.js';
import { validateSubstitution } from './component-substitution.js';
import { inspectShadcn } from './map.shadcn.js';
import { validateLocalImplementation } from './map.local-package.js';
import { formatValidationErrors } from '../security/errors.js';
import { ToolError } from '../errors/tool-error.js';
import { getAjv } from '../lib/ajv.js';
import inputSchema from '../schemas/map.create.input.json' with { type: 'json' };

const validateEntry = getAjv().compile({ $defs: inputSchema.$defs, $ref: '#/$defs/MappingEntry' });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function mappingRecord(input: MapCreateInput): ComponentMapping {
  // Preserve Stage1 coercion and review data; substitutions run in the opposite direction.
  const propMappings: PropMapping[] | undefined = input.propMappings?.map(pm => ({
    externalProp: pm.externalProp, oodsProp: pm.oodsProp, coercion: pm.coercion === undefined ? null : pm.coercion,
  }));
  return {
    id: generateMappingId(input.externalSystem, input.externalComponent),
    externalSystem: input.externalSystem, externalComponent: input.externalComponent, oodsTraits: input.oodsTraits,
    ...(input.substitution ? { substitution: input.substitution } : {}),
    ...(propMappings?.length ? { propMappings } : {}),
    confidence: input.confidence ?? 'manual',
    metadata: {
      createdAt: new Date().toISOString(),
      ...(input.metadata?.author ? { author: input.metadata.author } : {}),
      ...(input.metadata?.notes ? { notes: input.metadata.notes } : {}),
    },
    ...(input.projection_variants?.length ? { projection_variants: input.projection_variants } : {}),
  };
}

function append(doc: MappingsDoc, input: MapCreateInput, mapping: ComponentMapping): void {
  doc.mappings.push(mapping);
  for (const field of ['disambiguation_decisions', 'preferred_terms', 'capabilities'] as const) {
    // These registry-level arrays are pass-through data, as in the single create contract.
    const incoming = input[field];
    if (incoming?.length) (doc as Record<string, unknown>)[field] = [...(doc[field] ?? []), ...incoming];
  }
}

function traitWarnings(input: MapCreateInput): string[] {
  const known = loadKnownTraits();
  return input.oodsTraits.filter(trait => !known.has(trait.split('/').pop()!))
    .map(trait => `Unknown trait '${trait}' — not found in current OODS trait registry.`);
}

export function checkSubstitution(input: MapCreateInput, mappings: ComponentMapping[]): void {
  if (!input.substitution) return;
  const component = input.substitution.component;
  const previous = mappings.find(mapping => mapping.substitution?.component === component);
  if (previous) throw new Error(`shipped component '${component}' is already substituted by mapping '${previous.id}'`);
  for (const framework of ['react', 'vue'] as const) {
    const source = input.substitution[framework];
    if (!source) continue;
    try { if (source.shadcn) inspectShadcn(source.shadcn, source.export); else validateLocalImplementation(source); }
    catch (error) { throw new Error(`substitution.${framework}: ${error instanceof Error ? error.message : String(error)}`); }
  }
}

function entryError(index: number, id: string, message: string, field?: string): MapCreateBatchError {
  return { code: 'OODS-V219', message: `Entry ${index} ('${id}'): ${message}`, ...(field ? { field } : {}) };
}

async function createSingle(input: MapCreateInput): Promise<MapCreateOutput> {
  // Keep the published single-call validation and duplicate response intact.
  if (input.substitution !== undefined) validateSubstitution(input.substitution);
  const doc = loadMappings();
  const id = generateMappingId(input.externalSystem, input.externalComponent);
  const existing = doc.mappings.find(mapping => mapping.externalSystem.toLowerCase() === input.externalSystem.toLowerCase()
    && mapping.externalComponent.toLowerCase() === input.externalComponent.toLowerCase());
  if (existing) {
    const errors = formatValidationErrors(['externalSystem', 'externalComponent'].map(field => ({
      keyword: 'duplicate', instancePath: `/${field}`, params: {},
      message: `mapping for '${input.externalSystem}/${input.externalComponent}' already exists (id: '${existing.id}').`,
    })), { prefix: 'Mapping validation failed' });
    return { status: 'error', mapping: existing, etag: computeMappingsEtag(doc), applied: false, errors };
  }
  try {
    if (doc.mappings.some(mapping => mapping.id === id)) throw new Error(`mapping id '${id}' already exists`);
    checkSubstitution(input, doc.mappings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolError('OODS-V219', entryError(0, id, message).message, { index: 0, id, reason: message });
  }
  const mapping = mappingRecord(input);
  const warnings = traitWarnings(input);
  const applied = input.apply === true;
  if (applied) { append(doc, input, mapping); saveMappings(doc); }
  else warnings.push('Dry run: mapping not persisted. Set apply=true to write to your mappings store.');
  return { status: 'ok', mapping, etag: computeMappingsEtag(doc), applied, ...(warnings.length ? { warnings } : {}) };
}

function createBatch(input: MapCreateBatchInput): MapCreateBatchOutput {
  const doc = loadMappings();
  const etag = computeMappingsEtag(doc);
  let source: unknown = input.mappings;
  try {
    if (input.mappingsPath !== undefined) {
      if (source !== undefined) throw new Error('provide mappings or mappingsPath, not both');
      if (!path.isAbsolute(input.mappingsPath)) throw new Error('mappingsPath must be absolute');
      const file = JSON.parse(fs.readFileSync(input.mappingsPath, 'utf8')) as unknown;
      if (!object(file) || Object.keys(file).some(key => key !== 'mappings')) throw new Error('expected a JSON document containing only mappings');
      source = file.mappings;
    }
    if (!Array.isArray(source) || source.length === 0) throw new Error('mappings must be a non-empty array of create entries, each without apply');
  } catch (error) {
    return { status: 'error', entries: [], etag, applied: false, errors: [{ code: 'OODS-V219', message: error instanceof Error ? error.message : String(error), field: input.mappingsPath === undefined ? 'mappings' : 'mappingsPath' }] };
  }

  const entries: MapCreateEntryOutcome[] = [];
  const valid: Array<{ input: MapCreateInput; mapping: ComponentMapping }> = [];
  // Reserve ids/components even when another entry fails; report every collision in the submitted list.
  const ids = new Set(doc.mappings.map(mapping => mapping.id));
  const pairKey = (mapping: MapCreateInput | ComponentMapping) => JSON.stringify([mapping.externalSystem.toLowerCase(), mapping.externalComponent.toLowerCase()]);
  const pairs = new Map(doc.mappings.map(mapping => [pairKey(mapping), `${mapping.externalSystem}/${mapping.externalComponent} (stored id '${mapping.id}')`]));
  const substitutions = [...doc.mappings];
  for (const [index, raw] of (source as unknown[]).entries()) {
    const entry = structuredClone(raw);
    const id = object(entry) && typeof entry.externalSystem === 'string' && typeof entry.externalComponent === 'string'
      ? generateMappingId(entry.externalSystem, entry.externalComponent) : '(invalid mapping)';
    const outcome: MapCreateEntryOutcome = { index, id, status: 'invalid', applied: false };
    if (!validateEntry(entry)) {
      outcome.errors = (validateEntry.errors ?? []).map((error: { instancePath: string; message?: string }) => entryError(index, id, `${error.instancePath || '/'} ${error.message ?? 'invalid mapping'}`, `mappings/${index}${error.instancePath}`));
    } else {
      const candidate = entry as MapCreateInput;
      const pair = pairKey(candidate);
      try {
        const previous = pairs.get(pair);
        if (previous) throw new Error(`mapping '${candidate.externalSystem}/${candidate.externalComponent}' duplicates '${previous}' (case-insensitive pair)`);
        if (ids.has(id)) throw new Error(`mapping id '${id}' occurs more than once or already exists in the store`);
        if (candidate.substitution !== undefined) validateSubstitution(candidate.substitution);
        checkSubstitution(candidate, substitutions);
        const mapping = mappingRecord(candidate);
        outcome.status = 'valid'; outcome.mapping = mapping;
        const warnings = traitWarnings(candidate);
        if (warnings.length) outcome.warnings = warnings;
        valid.push({ input: candidate, mapping });
      } catch (error) {
        outcome.errors = [entryError(index, id, error instanceof Error ? error.message : String(error))];
      }
      ids.add(id);
      if (!pairs.has(pair)) pairs.set(pair, `${candidate.externalSystem}/${candidate.externalComponent} (entry ${index}, id '${id}')`);
      if (candidate.substitution) substitutions.push({ id, substitution: candidate.substitution } as ComponentMapping);
    }
    entries.push(outcome);
  }
  const failed = entries.some(entry => entry.status === 'invalid');
  const applied = !failed && input.apply === true;
  if (applied) {
    for (const item of valid) append(doc, item.input, item.mapping);
    saveMappings(doc);
    for (const entry of entries) entry.applied = true;
  }
  return { status: failed ? 'error' : 'ok', entries, etag: applied ? computeMappingsEtag(doc) : etag, applied };
}

export function handle(input: MapCreateInput): Promise<MapCreateOutput>;
export function handle(input: MapCreateBatchInput): Promise<MapCreateBatchOutput>;
export function handle(input: MapCreateInput | MapCreateBatchInput): Promise<MapCreateOutput | MapCreateBatchOutput>;
export async function handle(input: MapCreateInput | MapCreateBatchInput): Promise<MapCreateOutput | MapCreateBatchOutput> {
  return 'mappings' in input || 'mappingsPath' in input ? createBatch(input as MapCreateBatchInput) : createSingle(input as MapCreateInput);
}
