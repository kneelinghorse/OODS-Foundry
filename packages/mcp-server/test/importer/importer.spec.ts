import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { canonical, MAX_SOURCE_BYTES, Sources } from '../../src/importer/source.js';
import { listObjects, loadObject } from '../../src/objects/object-loader.js';
import { validateDefinition } from '../../src/tools/object.validate.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'import-'));
  process.env.OODS_OBJECTS_DIR = path.join(folder, 'objects');
  process.env.OODS_TRAITS_DIR = path.join(folder, 'traits');
  process.env.MCP_SCHEMA_STORE_ROOT = folder;
  reloadDefinitions();
});
afterEach(() => {
  for (const key of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'MCP_SCHEMA_STORE_ROOT']) delete process.env[key];
  reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true });
});
const schema = { type: 'object', properties: { title: { type: 'string', examples: ['Example record'] } }, required: ['title'] };
const from = (value: unknown) => draftSource({ content: JSON.stringify(value), name: 'Source.json' });
const write = (file: string, value: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };

it.each(['2.0', '3.0.3', '3.1.0', '3.2.0'])('imports OpenAPI %s and emits valid deterministic object YAML', version => {
  const value = version === '2.0' ? { swagger: version, definitions: { 'work-item': schema } } : { openapi: version, components: { schemas: { 'work-item': schema } } };
  const result = from(value);
  expect(result.drafts.map(draft => draft.name)).toEqual(['WorkItem']);
  expect(result.hub.$schema).toContain('2020-12');
  expect(result.drafts[0].sourceName).toBe('work-item');
  expect(validateDefinition(result.drafts[0].yaml).valid).toBe(true);
  expect(canonical(from(value))).toBe(canonical(result));
  expect(result.counts.total).toBe(result.counts.mapped + result.counts.proposed + result.counts.unmapped);
});
it.each(['https://json-schema.org/draft/2020-12/schema', 'http://json-schema.org/draft-07/schema#'])('imports %s', $schema => {
  expect(from({ $schema, title: 'Widget', ...schema }).drafts[0].name).toBe('Widget');
});
it('reads YAML without executing tags and refuses cyclic YAML aliases', () => {
  expect(draftSource({ content: dump({ title: 'Widget', ...schema }) }).drafts).toHaveLength(1);
  expect(() => draftSource({ content: 'type: !!js/function function() { return 1; }' })).toThrow(/Invalid JSON\/YAML/);
  expect(() => draftSource({ content: 'properties: &loop\n  field: *loop' })).toThrow(/Cyclic YAML/);
});
it.each(['https://example.com/spec.json', 'file:///etc/passwd', '//host/schema'])('refuses URL input %s', value => {
  expect(() => draftSource({ path: value })).toThrow(/local/);
});
it.each(['https://example.com/schema', 'file:///etc/passwd', '../outside.json', '%2e%2e/outside.json', '/etc/passwd', '%2fetc/passwd'])('refuses escaping ref %s at its exact pointer', ref => {
  write(path.join(folder, 'source.json'), { title: 'Widget', type: 'object', properties: { parent: { $ref: ref } } });
  expect(() => draftSource({ path: path.join(folder, 'source.json') })).toThrow(/source.json#\/properties\/parent\/\$ref/);
});
it('refuses outside symlink targets before reading them', () => {
  write(path.join(folder, 'outside.json'), schema);
  fs.mkdirSync(path.join(folder, 'source'));
  fs.symlinkSync(path.join(folder, 'outside.json'), path.join(folder, 'source', 'link.json'));
  write(path.join(folder, 'source', 'main.json'), { $ref: 'link.json' });
  expect(() => draftSource({ path: path.join(folder, 'source', 'main.json') })).toThrow(/symbolic link outside/);
});
it('checks the file byte cap before reading and admits a 96.5 MB file by size', () => {
  const file = path.join(folder, 'large.json');
  const fd = fs.openSync(file, 'w'); fs.ftruncateSync(fd, MAX_SOURCE_BYTES + 1); fs.closeSync(fd);
  expect(MAX_SOURCE_BYTES).toBeGreaterThan(96_500_000);
  expect(() => new Sources({ path: file })).toThrow(/before reading/);
});
it('resolves same-folder files and escaped JSON pointers, orders targets before dependents', () => {
  write(path.join(folder, 'types.json'), { $defs: { 'a/b~c': schema } });
  write(path.join(folder, 'main.json'), { title: 'ZContainer', type: 'object', properties: { items: { type: 'array', items: { $ref: 'types.json#/$defs/a~1b~0c' } } } });
  const result = draftSource({ path: path.join(folder, 'main.json') });
  expect(result.drafts.map(draft => draft.name)).toEqual(['ABC', 'ZContainer']);
  expect(result.drafts[1].definition.relationships).toEqual([{ target: 'ABC', via: 'items', cardinality: 'one-to-many', label: 'items' }]);
  expect(result.drafts.every(draft => validateDefinition(draft.yaml, result.drafts.map(d => d.name)).valid)).toBe(true);
});
it('keeps cycles finite and reports the cycle while retaining all relationships', () => {
  const result = from({ $defs: { A: { type: 'object', properties: { b: { $ref: '#/$defs/B' } } }, B: { type: 'object', properties: { a: { $ref: '#/$defs/A' } } } } });
  expect(result.drafts).toHaveLength(2);
  expect(result.cycles).toEqual([['A', 'B', 'A']]);
  expect(result.drafts.every(draft => draft.dependencies.length === 1)).toBe(true);
});
it('merges compatible allOf including inherited required fields without overwriting constraints', () => {
  const result = from({ title: 'Combined', allOf: [{ ...schema }, { type: 'object', properties: { title: { type: 'string', maxLength: 10 }, count: { type: 'integer' } }, required: ['count'] }] });
  const fields = result.drafts[0].definition.schema;
  expect(fields.title).toMatchObject({ type: 'string', required: true, validation: { maxLength: 10 } });
  expect(fields.count.required).toBe(true);
  const conflict = from({ title: 'Conflict', allOf: [{ ...schema }, { properties: { title: { type: 'integer' } } }] });
  expect(conflict.drafts).toEqual([]);
  expect(conflict.report.some(entry => /incompatible types/.test(entry.reason))).toBe(true);
});
it.each(['oneOf', 'anyOf'])('preserves %s variants, with and without a discriminator, without inventing merged fields', union => {
  for (const discriminator of [undefined, { propertyName: 'kind' }]) {
    const result = from({ title: 'Variant', ...schema, properties: { ...schema.properties, choice: { [union]: [{ type: 'string' }, { type: 'integer' }], discriminator } } });
    expect(result.drafts[0].definition.schema).not.toHaveProperty('choice');
    expect(result.report.filter(entry => entry.kind === 'variant')).toHaveLength(2);
    expect(result.hub.$defs.Variant.properties.choice[union]).toHaveLength(2);
  }
});
it('preserves nullable types, maps, formats and every enum member, and upgrades boolean exclusive bounds', () => {
  const result = from({ swagger: '2.0', definitions: { Measurements: { type: 'object', properties: {
    old: { type: 'number', minimum: 2, exclusiveMinimum: true, 'x-nullable': true },
    modern: { type: ['string', 'null'], format: 'email' },
    bag: { type: 'object', additionalProperties: { type: 'string' } },
    state: { type: 'string', enum: ['pending', 'active'] },
  } } } });
  expect(result.drafts[0].definition.schema.old.type).toBe('number?');
  expect(result.drafts[0].definition.schema.modern.type).toBe('email?');
  expect(result.hub.$defs.Measurements.properties.old.exclusiveMinimum).toBe(2);
  expect(result.report.filter(entry => entry.kind === 'enum')).toHaveLength(2);
  expect(result.report.find(entry => entry.pointer.endsWith('/bag') && entry.kind === 'property')?.outcome).toBe('unmapped');
});
it('grades structural evidence independently of names, never applies proposals, and reports invalid proposal parameters', () => {
  const result = from({ title: 'Record', type: 'object', properties: { status: { type: 'string' }, category: { type: 'string', enum: ['red', 'blue'] }, happened: { type: 'string', format: 'date-time', readOnly: true }, strange: { type: 'string', enum: ['A space', 'TOO-UPPER'] } } });
  expect(result.drafts[0].definition.traits).toEqual([]);
  const proposals = result.drafts[0].proposals;
  expect(proposals.filter(p => p.grade === 'weak')[0].evidence[0].kind).toBe('name');
  expect(proposals.filter(p => p.grade === 'strong')[0].evidence[0].kind).toBe('structure');
  expect(proposals.some(p => p.grade === 'medium' && !p.valid && p.errors.length)).toBe(true);
});
it('gives every retained hub value a source file and pointer', () => {
  const result = from({ title: 'Widget', ...schema });
  expect(result.hub['x-oods'].provenance['/$defs/Widget/properties/title/type']).toEqual({ file: 'Source.json', pointer: '/properties/title/type' });
  expect(result.hub['x-oods'].provenance['/$defs/Widget/properties/title/examples/0']).toEqual({ file: 'Source.json', pointer: '/properties/title/examples/0' });
});
it('validates every shipped object with parameter schemas including defaults, rejecting wrong values and enum membership', () => {
  for (const name of listObjects()) {
    const result = validateDefinition(dump(loadObject(name)));
    expect(result.errors, name).toEqual([]);
  }
  const definition = from({ title: 'Widget', ...schema }).drafts[0].definition;
  definition.traits = [{ name: 'Stateful', parameters: { states: ['on', 'off'], initialState: 'other' } }];
  expect(validateDefinition(dump(definition)).errors).toContainEqual(expect.objectContaining({ kind: 'invalid-parameter' }));
  definition.traits = [{ name: 'Labelled', parameters: { maxLabelLength: 'wrong' } }];
  expect(validateDefinition(dump(definition)).errors).toContainEqual(expect.objectContaining({ kind: 'invalid-parameter' }));
});
it('composes list, detail and form, withholding secret samples from read screens and generated controls from read-only fields', async () => {
  const result = from({ title: 'AccountImport', type: 'object', properties: { title: schema.properties.title, serial: { type: 'integer', readOnly: true }, password: { type: 'string', writeOnly: true, example: 'must-never-display' } } });
  const draft = result.drafts[0];
  fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true });
  fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'AccountImport.object.yaml'), draft.yaml);
  reloadDefinitions();
  for (const context of ['list', 'detail', 'form'] as const) {
    const output = await compose({ object: draft.name, context, options: { transient: true } });
    expect(output.status, JSON.stringify(output.errors)).toBe('ok');
    expect(JSON.stringify(output)).not.toContain('must-never-display');
    expect(output.schema?.objectSchema).not.toHaveProperty(context === 'form' ? 'serial' : 'password');
  }
});
it('retains the full x-oods vocabulary and rejects invalid declared money units', () => {
  const vocabulary = { enumLabels: { USD: 'US dollar' }, localeLabels: { fr: { USD: 'Dollar américain' } }, unit: { symbol: 'kg' }, lifecycle: { field: 'title', states: ['new'], initialState: 'new' }, history: { field: 'events', timestampField: 'at' } };
  const result = from({ title: 'Annotated', ...schema, 'x-oods': vocabulary });
  expect(result.hub.$defs.Annotated['x-oods']).toMatchObject(vocabulary);
  expect(from({ title: 'Money', type: 'object', properties: { amount: { type: 'integer', 'x-oods': { currency: { field: 'currency', minorUnits: 100 } } }, currency: { type: 'string', pattern: '^[A-Z]{3}$' } } }).drafts[0].definition.semantics.amount.ui_hints).toMatchObject({ minorUnits: 100 });
  expect(() => from({ title: 'Money', ...schema, 'x-oods': { currency: { field: 'currency', minorUnits: 0 } } })).toThrow(/Invalid x-oods/);
});
it('never promotes supplied name-only proposal evidence and records proposals in the hub', () => {
  const result = from({ title: 'Declared', ...schema, 'x-oods': { traitProposals: [{ name: 'Stateful', grade: 'strong', evidence: [{ file: 'Source.json', pointer: '/properties/title', kind: 'name', reason: 'Only a name' }] }] } });
  expect(result.drafts[0].proposals[0].grade).toBe('weak');
  expect(result.hub.$defs.Declared['x-oods'].traitProposals[0].grade).toBe('weak');
});
it('drafts a hub document through the same projection and preserves declared field semantics', () => {
  const initial = from({ title: 'RoundTrip', ...schema });
  const repeated = from(initial.hub);
  expect(repeated.drafts[0].definition.schema).toEqual(initial.drafts[0].definition.schema);
});
it('accepts nullable reference unions without choosing between two non-null variants', () => {
  const result = from({ title: 'Nullable', type: 'object', properties: { optional: { anyOf: [{ type: 'string' }, { type: 'null' }] } } });
  expect(result.drafts[0].definition.schema.optional.type).toBe('string?');
});
it('names broken local pointers without inventing a target or blocking unrelated usable schemas', () => {
  const result = from({ title: 'Broken', ...schema, oneOf: [{ $ref: '#/$defs/missing' }] });
  expect(result.report).toContainEqual(expect.objectContaining({ pointer: '/oneOf/0/$ref', outcome: 'unmapped', reason: expect.stringContaining('Unresolved reference') }));
  expect(result.hub.$defs.Broken.oneOf[0]['x-oods-unresolved-ref']).toBe('#/$defs/missing');
});
it('reads folders in stable order and disambiguates colliding normalized names', () => {
  write(path.join(folder, 'second.json'), { title: 'a-b', ...schema });
  write(path.join(folder, 'first.json'), { title: 'a_b', ...schema });
  const first = draftSource({ path: folder });
  expect(new Set(first.drafts.map(d => d.name)).size).toBe(2);
  expect(canonical(draftSource({ path: folder }))).toBe(canonical(first));
});
it('retains unknown formats and constraints with explicit outcomes, and enumerates API links', () => {
  const result = from({ openapi: '3.1.0', paths: { '/widgets': { get: { responses: { '200': { links: { next: { operationId: 'nextWidget' } }, content: { 'application/json': { schema } } } } } } }, components: { schemas: { Widget: { ...schema, properties: { odd: { type: 'string', format: 'vendor-code', deprecated: true } } } } } });
  expect(result.report.find(e => e.pointer.endsWith('/deprecated'))).toMatchObject({ outcome: 'unmapped' });
  expect(result.report.find(e => e.pointer.endsWith('/links/next'))).toMatchObject({ kind: 'link', outcome: 'unmapped' });
  expect(result.drafts.some(d => d.definition.schema.odd?.validation?.format === 'vendor-code')).toBe(true);
});
it('does not let dangerous identifier fields change object prototypes', () => {
  const properties = JSON.parse('{"__proto__":{"type":"string"},"constructor":{"type":"string"},"safe":{"type":"string"}}');
  const result = from({ title: 'Safe', type: 'object', properties });
  expect(Object.keys(result.drafts[0].definition.schema)).toEqual(['safe']);
  expect(result.report.filter(e => e.kind === 'property' && e.outcome === 'unmapped')).toHaveLength(2);
});

it('does not mistake extension patches for API schemas or discriminator annotations for allOf constraints', () => {
  const result = from({ openapi: '3.0.4', components: { schemas: { Base: { ...schema, discriminator: { propertyName: 'kind', mapping: { base: '#/components/schemas/Base' } } }, Child: { allOf: [{ $ref: '#/components/schemas/Base' }, { properties: { id: { type: 'string' } }, discriminator: { propertyName: 'kind', mapping: { child: '#/components/schemas/Child' } } }] } } }, paths: { '/items': { get: { 'x-patches': [{ schema: { properties: { title: null } } }] } } } });
  expect(result.drafts.find(d => d.name === 'Child')?.definition.schema).toHaveProperty('title');
  expect(Object.keys(result.hub.$defs)).toEqual(['Base', 'Child']);
});

it('keeps nullable boolean controls typed so imported forms do not edit booleans as strings', async () => {
  const draft = from({ title: 'NullableFlag', type: 'object', properties: { active: { type: ['boolean', 'null'] } } }).drafts[0];
  fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true });
  fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'NullableFlag.object.yaml'), draft.yaml);
  reloadDefinitions();
  const result = await compose({ object: 'NullableFlag', context: 'form', options: { transient: true } });
  expect(result.status).toBe('ok');
  expect(JSON.stringify(result.schema.screens)).toContain('Checkbox');
  expect(result.schema.objectSchema?.active.type).toBe('boolean?');
});

it.each(['react', 'vue'] as const)('strictly compiles an imported %s form application with nullable scalar editors', async framework => {
  const draft = from({ title: 'NullableRecord', type: 'object', properties: {
    name: { type: 'string' }, active: { type: ['boolean', 'null'], examples: [null] },
    email: { type: ['string', 'null'], format: 'email', examples: [null] },
    recorded_at: { type: ['string', 'null'], format: 'date-time', examples: [null] },
    amount: { type: ['number', 'null'], examples: [null] },
  } }).drafts[0];
  fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true });
  fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'NullableRecord.object.yaml'), draft.yaml);
  reloadDefinitions();
  const composed = await compose({ object: 'NullableRecord', context: 'form', options: { transient: true } });
  expect(composed.status, JSON.stringify(composed.errors)).toBe('ok');
  const result = await generate({ schema: composed.schema, framework, profile: 'build', options: { output: 'application' } });
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  const app = result.artifact!.files.find(file => /^src\/App\./.test(file.path))!.contents;
  expect(app).toContain('"active": null');
  const checked = typecheckWorkflow(result.artifact!);
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
}, 90_000);
