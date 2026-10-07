import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { sampleValue, validSample } from '../../src/importer/samples.js';
import { canonical } from '../../src/importer/source.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { diffDraft, handle as importObject } from '../../src/tools/object.import.js';
import { recordNameField } from '../../src/compose/record-label.js';
import { screenShell } from '../../src/codegen/screen-shell.js';
import { formatReadOnlyValue } from '../../../component-contracts/src/date-time.js';

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 's236-'));
  for (const key of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT']) process.env[key] = path.join(folder, key);
  fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions();
});
afterEach(() => { for (const key of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT']) delete process.env[key]; reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true }); });
const from = (value: unknown) => draftSource({ content: JSON.stringify(value), name: 'source.json' });
const register = (result: ReturnType<typeof from>) => { for (const draft of result.drafts) fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, `${draft.name}.object.yaml`), draft.yaml); reloadDefinitions(); };

it.each(['https://offline.example/schema', 'file:///outside.json', '/outside.json', 'missing.json', '#named'])('reports unreachable %s without losing the usable object', $ref => {
  const result = from({ title: 'Usable', properties: { id: { type: 'integer' }, absent: { $ref } } });
  expect(result.drafts[0].name).toBe('Usable');
  expect(result.report).toContainEqual(expect.objectContaining({ file: 'source.json', pointer: '/properties/absent/$ref', kind: 'link', outcome: 'unmapped' }));
});
it('names Invoice rows by their identifier, varies valid samples, and never guesses field help', async () => {
  const source = { title: 'ImportedInvoice', properties: { id: { type: 'integer' }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, total: { type: 'number', minimum: 0.25, maximum: 1, multipleOf: 0.25 }, due: { type: 'string', format: 'date' } }, required: ['currency', 'id'] };
  const result = from(source); register(result);
  const draft = result.drafts[0];
  expect(new Set(draft.definition.samples!.map(row => row.id)).size).toBe(5);
  for (const row of draft.definition.samples!) for (const [field, schema] of Object.entries(source.properties)) expect(validSample(schema, row[field]), `${field}: ${row[field]}`).toBe(true);
  expect(draft.definition.schema.currency.description).toBe('');
  const output = await compose({ object: draft.name, context: 'list', options: { transient: true } });
  expect(output.status).toBe('ok');
  expect(recordNameField(draft.name, output.schema!.objectSchema!)).toBe('id');
  expect(canonical(from(source))).toBe(canonical(result));
  expect(formatReadOnlyValue('2026-01-02', 'date')).toBe('Jan 2, 2026');
  expect(formatReadOnlyValue('2026-01-02T12:00:00Z', 'datetime')).toContain('12:00');
});
it('checks supplied examples and tricky constraints before using any sample', () => {
  for (const schema of [
    { type: 'string', pattern: '^INV-[0-9]{4}$', examples: ['wrong'] },
    { type: 'integer', minimum: -8, maximum: -3 },
    { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1, multipleOf: 0.1 },
    { type: 'array', minItems: 2, maxItems: 4, uniqueItems: true, items: { type: 'string', pattern: '^[a-z]{4}$' } },
    { type: 'string', format: 'email' }, { type: 'string', enum: ['one', 'two'] },
  ]) for (let i = 0; i < 3; i++) expect(validSample(schema, sampleValue(schema, 'value', i)), JSON.stringify([schema, i, sampleValue(schema, 'value', i)])).toBe(true);
  expect(sampleValue({ type: 'string', pattern: '^x$', minLength: 3 }, 'bad', 0)).toBeUndefined();
});
it('suggests capabilities from shape with valid parameters, never increasing evidence from names', () => {
  const result = from({ title: 'Capabilities', properties: {
    value: { type: 'number', minimum: 0 }, code: { type: 'string', enum: ['USD', 'EUR'] },
    y: { type: 'number', minimum: -90, maximum: 90 }, x: { type: 'number', minimum: -180, maximum: 180 },
    labels: { type: 'array', uniqueItems: true, items: { type: 'string', enum: ['sale', 'new'] } },
    palette: { type: 'string', enum: ['info', 'critical'] },
    location: { type: 'object', properties: { country: { type: 'string', pattern: '^[A-Z]{2}$' }, street: { type: 'string' }, city: { type: 'string' } } },
    contact: { type: 'string', format: 'email' }, colour: { type: 'string', pattern: '^#[a-f0-9]{6}$' },
  } });
  const proposals = result.drafts[0].proposals;
  for (const name of ['Priceable', 'Geocodable', 'Taggable', 'Colorized', 'Addressable']) expect(proposals).toContainEqual(expect.objectContaining({ trait: expect.objectContaining({ name }), valid: true }));
  expect(proposals.some(p => p.trait.name === 'Communicable')).toBe(false);
  expect(result.report.some(e => e.reason.includes('contact alone'))).toBe(true);
  expect(result.drafts[0].definition.traits).toEqual([]);
});
it('a read-only history source applies with timeline and without a form', async () => {
  const source = { title: 'Snapshot', readOnly: true, properties: { id: { type: 'integer' }, recorded_at: { type: 'string', format: 'date-time' } }, 'x-oods': { history: { timestampField: 'recorded_at' } } };
  const staged = await importObject({ action: 'draft', source: { content: JSON.stringify(source) } });
  const applied = await importObject({ action: 'apply', importId: (staged as any).importId, objects: [{ name: 'Snapshot' }] });
  expect((applied as any).applied[0].contexts).toEqual(['list', 'detail', 'timeline']);
});
it('related records populate a real form picker and trait fields do not masquerade as source removals', async () => {
  const result = from({ $defs: { Customer: { properties: { id: { type: 'string' }, name: { type: 'string' } } }, InvoiceRecord: { properties: { id: { type: 'integer' }, customer: { $ref: '#/$defs/Customer' }, status: { type: 'string', enum: ['new', 'paid'] } } } } });
  register(result);
  const output = await compose({ object: 'InvoiceRecord', context: 'form', options: { transient: true } });
  expect(output.status).toBe('ok');
  const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];
  const picker = output.schema!.screens.flatMap(nodes).find(node => node.component === 'Select' && node.props?.field === 'customer');
  expect(picker.props.options).toHaveLength(5);
  const draft = result.drafts.find(d => d.name === 'InvoiceRecord')!;
  fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'InvoiceRecord.object.yaml'), draft.yaml.replace('traits: []', 'traits:\n  - name: Timestampable'));
  reloadDefinitions();
  const diff = diffDraft(draft);
  expect(diff.traitFields).toContain('created_at');
  expect(diff.fields.removed).not.toContain('created_at');
});

it('normalizes numeric string bounds found in vendor OpenAPI while retaining report provenance', () => {
  const result = draftSource({ content: JSON.stringify({ type: 'object', properties: { id: { type: 'integer', minimum: '1', maximum: '999999999999999' } } }) });
  expect(result.drafts[0].definition.schema.id.validation).toMatchObject({ minimum: 1, maximum: 999999999999999 });
  expect(result.drafts[0].definition.samples).toHaveLength(5);
});

it('uses the record primary key before foreign keys and avoids a duplicated title editor', async () => {
  const result = draftSource({ format: 'sql', content: 'CREATE TABLE payment (customer_id int, payment_id int PRIMARY KEY, title text NOT NULL);' });
  register(result);
  const form = await compose({ object: 'Payment', context: 'form', options: { transient: true } });
  const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];
  expect(form.schema.screens.flatMap(nodes).filter(node => ['Input', 'Textarea'].includes(node.component) && node.props?.field === 'title')).toHaveLength(1);
  const nameless = draftSource({ format: 'sql', content: 'CREATE TABLE payment (customer_id int, payment_id int PRIMARY KEY);' });
  expect(nameless.drafts[0].definition.semantics.payment_id.semantic_type).toBe('text.label');
  register(nameless);
  const namelessForm = await compose({ object: 'Payment', context: 'form', options: { transient: true } });
  expect(screenShell(namelessForm.schema, {} as any)?.heading).toBe('Payment form');
  const named = from({ title: 'Customers', properties: { customer_id: { type: 'string' }, customer_name: { type: 'string' } } });
  expect(named.drafts[0].definition.semantics.customer_name.semantic_type).toBe('text.label');
});
it('hashes the separated large-payload staging files and rejects either sidecar being changed', async () => {
  const staged = await importObject({ action: 'draft', source: { content: JSON.stringify({ title: 'LargeRecord', type: 'object', properties: { id: { type: 'integer' } } }) } });
  const manifest = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8'));
  expect(manifest.storageVersion).toBe(2);
  expect(manifest).not.toHaveProperty('hub');
  fs.appendFileSync(path.join(staged.directory, 'hub.json'), ' ');
  await expect(importObject({ action: 'apply', importId: staged.importId, objects: [{ name: 'LargeRecord' }] })).rejects.toThrow(/hub content hash mismatch/);
  expect(fs.readdirSync(process.env.OODS_OBJECTS_DIR!)).toEqual([]);
});
it('writes bounded canonical chunks with byte-identical numeric-key and Unicode ordering', async () => {
  const { writeCanonical, hashStagedFile } = await import('../../src/importer/staging-json.js');
  const source = { z: 'é😀'.repeat(40000), map: { '10': 'ten', '2': 'two', x: undefined }, a: [null, 'line\nbreak'] };
  const file = path.join(folder, 'canonical.json');
  const digest = writeCanonical(file, source);
  expect(fs.readFileSync(file, 'utf8')).toBe(canonical(source));
  expect(hashStagedFile(file)).toBe(digest);
});

it('renders numeric record identifiers as visible headings and generates string title props', async () => {
  const { bindRecordSchema } = await import('../../src/render/record-renderer.js');
  const { handle: generate } = await import('../../src/tools/code.generate.js');
  const schema = { version: '2026.02', objectSchema: { id: { type: 'integer', required: true, semanticType: 'text.label', examples: [1, 2, 3] } }, screens: [{ id: 'detail', component: 'DetailHeader', props: { titleField: 'id' } }] } as any;
  expect(bindRecordSchema(schema, { id: 3 }).screens[0].props.title).toBe('3');
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema, framework });
    expect(generated.errors ?? []).toEqual([]);
    expect(generated.code).toContain("String(id ?? '')");
  }
});

it('preserves uppercase lifecycle values from schema standards in an acceptable Stateful proposal', async () => {
  const staged = await importObject({ action: 'draft', source: { format: 'prisma', content: 'enum Stage {\n OPEN\n CLOSED\n}\nmodel CaseRecord {\n id Int @id\n title String\n status Stage @default(OPEN)\n}' } });
  const shown = await importObject({ action: 'show', importId: staged.importId, object: 'CaseRecord' });
  const proposal = shown.proposals.find((p: any) => p.trait.name === 'Stateful');
  expect(proposal.valid).toBe(true);
  expect(proposal.trait.parameters.states).toEqual(['OPEN', 'CLOSED']);
  const applied = await importObject({ action: 'apply', importId: staged.importId, objects: [{ name: 'CaseRecord', proposals: [proposal.id] }] });
  expect(applied.applied[0].contexts).toContain('timeline');
});
it('formats optional dates with the same date-only/date-time policy as required dates', () => {
  expect(formatReadOnlyValue('2026-01-02', 'date?')).toBe('Jan 2, 2026');
  expect(formatReadOnlyValue('2026-01-02T12:00:00Z', 'datetime?')).toContain('12:00');
});

it('uses the record component of a composite key instead of the shared boolean draft flag', async () => {
  const { recordKeyField } = await import('../../src/objects/record-identity.js');
  expect(recordKeyField({ schema: { IsActiveEntity: { type: 'boolean', required: true }, TravelUUID: { type: 'uuid', required: true } }, semantics: {
    IsActiveEntity: { semantic_type: 'identifier.primary', token_mapping: 'tokenMap(text.primary)', ui_hints: { primaryKey: true } },
    TravelUUID: { semantic_type: 'identifier.primary', token_mapping: 'tokenMap(text.primary)', ui_hints: { primaryKey: true } },
  } })).toBe('TravelUUID');
});

it('uses ordinary numeric samples inside broad machine bounds', () => {
  const schema = { type: 'integer', minimum: -2147483648, maximum: 2147483647 };
  expect([0, 1, 2].map(index => sampleValue(schema, 'number', index))).toEqual([1, 2, 3]);
  expect(validSample({ type: 'number', minimum: -5, maximum: -1, multipleOf: 0.5 }, sampleValue({ type: 'number', minimum: -5, maximum: -1, multipleOf: 0.5 }, 'negative', 0))).toBe(true);
});

it('keeps short illustrative keys distinct while respecting maximum length', () => {
  const schema = { type: 'string', maxLength: 3 };
  const values = [0, 1, 2, 3, 4].map(index => sampleValue(schema, 'code', index));
  expect(new Set(values).size).toBe(5);
  expect(values.every(value => validSample(schema, value))).toBe(true);
});
it('keeps read-only reference labels out of forms without invalidating the editable identifier', async () => {
  const result = from({ title: 'ReadOnlyLabel', properties: { id: { type: 'integer' }, agency: { type: 'string', 'x-oods': { displayLabelField: 'agency_name' } }, agency_name: { type: 'string', readOnly: true } } });
  register(result);
  const form = await compose({ object: 'ReadOnlyLabel', context: 'form', options: { transient: true } });
  expect(form.status).toBe('ok');
  expect(form.schema.objectSchema?.agency_name).toBeUndefined();
  expect(form.schema.objectSchema?.agency.displayLabelField).toBeUndefined();
  const detail = await compose({ object: 'ReadOnlyLabel', context: 'detail', options: { transient: true } });
  expect(detail.schema.objectSchema?.agency.displayLabelField).toBe('agency_name');
});

it('uses camel-case identifiers and removes forms when every source field is read-only', () => {
  const result = from({ title: 'Lookup', properties: { createdBy: { type: 'string', readOnly: true }, valueId: { type: 'string', readOnly: true }, description: { type: 'string', readOnly: true } } });
  expect(result.drafts[0].definition.semantics.valueId.semantic_type).toBe('text.label');
  expect(result.drafts[0].definition.metadata.supportedContexts).toEqual(['list', 'detail']);
});

it('uses a declared non-id primary key for relationship choices instead of the target display name', async () => {
  const result = draftSource({ format: 'sql', content: 'CREATE TABLE currencies (code varchar(3) PRIMARY KEY, name text); CREATE TABLE prices (id int PRIMARY KEY, currency_code varchar(3) REFERENCES currencies(code));' });
  register(result);
  const form = await compose({ object: 'Prices', context: 'form', options: { transient: true } });
  const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];
  const picker = form.schema.screens.flatMap(nodes).find(node => node.component === 'Select' && node.props?.field === 'currency_code');
  const currency = result.drafts.find(d => d.name === 'Currencies')!;
  expect(picker.props.options[2]).toEqual({ value: currency.definition.samples![2].code, label: currency.definition.samples![2].name });
  expect(result.drafts.find(d => d.name === 'Prices')!.definition.samples![2].currency_code).toBe(picker.props.options[2].value);
});

it('keeps GraphQL relationship samples and picker keys aligned when id and databaseId both exist', async () => {
  const result = draftSource({ format: 'graphql', content: 'type Repository { databaseId: Int! id: ID! name: String! } type CheckRun { id: ID! repository: Repository! }' });
  register(result);
  const form = await compose({ object: 'CheckRun', context: 'form', options: { transient: true } });
  const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];
  const picker = form.schema.screens.flatMap(nodes).find(node => node.component === 'Select' && node.props?.field === 'repository');
  const target = result.drafts.find(d => d.name === 'Repository')!;
  expect(picker.props.options[2].value).toBe(target.definition.samples![2].id);
  expect(result.drafts.find(d => d.name === 'CheckRun')!.definition.samples![2].repository).toBe(picker.props.options[2].value);
});

it('keeps imported date-only read fields date-only in generated React and Vue with retained consumer libraries', async () => {
  const { handle: generate } = await import('../../src/tools/code.generate.js');
  const { slotDateHelperSource, SLOT_DATE_HELPER } = await import('../../src/codegen/binding-utils.js');
  const schema = { version: '2026.02', objectSchema: { day: { type: 'date?', required: false, examples: ['2026-01-02'] } }, screens: [{ id: 'day', component: 'Text', props: { field: 'day' }, meta: { intent: 'read-only-field' } }] } as any;
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema, framework });
    expect(generated.errors ?? []).toEqual([]);
    expect(generated.code).toContain(`function ${SLOT_DATE_HELPER}(`);
    expect(generated.code).toContain(`${SLOT_DATE_HELPER}(day, true)`);
    expect(generated.code).toContain('Not recorded');
    expect(generated.code).toContain('Invalid date');
    expect(generated.code).not.toContain('formatReadOnlyValue(day');
  }
  const display = new Function(`${slotDateHelperSource(false)}; return ${SLOT_DATE_HELPER};`)();
  expect(display('2026-01-02', true)).toBe('Jan 2, 2026');
});

it('shortens imported UUID titles before calling the retained one-argument consumer formatter', async () => {
  const { resolveFrameworkChildContent } = await import('../../src/codegen/binding-utils.js');
  const { handle: generate } = await import('../../src/tools/code.generate.js');
  const fields = { id: { type: 'uuid', required: true, semanticType: 'text.label' } };
  const node = { id: 'title', component: 'Text', props: { field: 'id' } };
  const expression = resolveFrameworkChildContent(node, fields)!.fieldName;
  const calls: unknown[][] = [];
  const legacyFormatter = (...args: unknown[]) => { calls.push(args); return String(args[0] ?? ''); };
  const display = new Function('id', 'formatRecordLabel', `return ${expression};`);
  expect(display('00000000-0000-4000-8000-000000000123', legacyFormatter)).toBe('Record …00000123');
  expect(display('ORDER-123', legacyFormatter)).toBe('ORDER-123');
  expect(calls.every(args => args.length === 1)).toBe(true);
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema: { version: '2026.02', objectSchema: fields, screens: [node] }, framework });
    expect(generated.errors ?? []).toEqual([]);
    expect(generated.code).toContain(expression);
  }
});
