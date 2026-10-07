import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump } from 'js-yaml';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import { loadObject, normalizeObjectDocument } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { validateDefinition } from '../../src/tools/object.validate.js';
import { diffDraft, handle as importObject } from '../../src/tools/object.import.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { bindRecordSchema } from '../../src/render/record-renderer.js';
import { deriveConsumerModel } from '../../src/codegen/preview-model.js';
import { workflowDataFiles } from '../../src/codegen/workflow-data-emitter.js';
import { reconcileFormDetail } from '../../src/compose/form-detail.js';
import { referenceFieldExpression } from '../../src/codegen/binding-utils.js';

let folder: string;
const variables = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
const prior = Object.fromEntries(variables.map(key => [key, process.env[key]]));
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 's237-'));
  for (const key of variables) process.env[key] = path.join(folder, key);
  fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions();
});
afterEach(() => { for (const key of variables) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; } reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true }); });
const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];
const source = { title: 'BoundOrder', properties: { id: { type: 'integer' }, title: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed'], default: 'open' }, placedAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time', readOnly: true } }, required: ['id', 'state', 'placedAt', 'title'] };
const accept = async (value: unknown = source) => {
  const staged = await importObject({ action: 'draft', source: { content: JSON.stringify(value) } });
  const shown = await importObject({ action: 'show', importId: staged.importId, object: 'BoundOrder' });
  await importObject({ action: 'apply', importId: staged.importId, objects: [{ name: 'BoundOrder', proposals: shown.proposals.filter((p: any) => p.valid && p.grade !== 'weak').map((p: any) => p.id) }] });
  return shown;
};

it('accepts one evidenced proposal per trait and binds every screen and generator to the original fields', async () => {
  const shown = await accept();
  expect(shown.proposals.map((p: any) => p.trait.name).sort()).toEqual(['Stateful', 'Timestampable']);
  const timestamps = shown.proposals.find((p: any) => p.trait.name === 'Timestampable');
  expect(timestamps.evidence).toHaveLength(2);
  expect(timestamps.trait.fieldBindings).toEqual({ created_at: 'placedAt', updated_at: 'updatedAt', last_event: null, last_event_at: null });
  const object = loadObject('BoundOrder');
  expect(object.samples!.every(row => row.state && row.placedAt)).toBe(true);
  for (const context of ['list', 'detail', 'form', 'timeline'] as const) {
    const result = await compose({ object: 'BoundOrder', context, options: { transient: true } });
    expect(result.status).toBe('ok');
    expect(Object.keys(result.schema.objectSchema!)).not.toEqual(expect.arrayContaining(['status', 'created_at']));
    expect(result.schema.objectSchema!.last_event).toBeUndefined();
    const all = result.schema.screens.flatMap(nodes);
    if (context === 'form') expect(all.filter(node => ['Select', 'StatusSelector'].includes(node.component) && node.props?.field === 'state')).toHaveLength(1);
    if (context === 'list') expect(all.find(node => node.component === 'RelativeTimestamp').props.field).toBe('updatedAt');
    if (context === 'timeline') {
      const model = deriveConsumerModel(result.schema);
      expect(model.events).toEqual(expect.arrayContaining([expect.objectContaining({ at: object.samples![0].placedAt })]));
    }
    for (const framework of ['react', 'vue'] as const) {
      const code = await generate({ schema: result.schema, framework });
      expect(code.errors ?? [], context + JSON.stringify(all.filter(node => node.component === 'StatusTimeline'))).toEqual([]);
      expect(code.code).not.toMatch(/createdAt[?:]|lastEvent[?:]/);
    }
  }
  const workflow = await compose({ object: 'BoundOrder', context: 'workflow', options: { transient: true } });
  expect(workflow.status).toBe('ok');
  const store = workflowDataFiles(workflow.schema).find(file => file.path === 'src/store.ts')!.contents;
  expect(store).toContain('target["state"]');
  expect(store).toContain('target["updatedAt"] = at');
  expect(diffDraft(draftSource({ content: JSON.stringify(source) }).drafts[0]).fields.changed).toEqual([]);
});

it('uses a single creation time as the list primary value, without inventing event metadata', async () => {
  const { updatedAt, ...properties } = source.properties;
  await accept({ ...source, properties });
  const list = await compose({ object: 'BoundOrder', context: 'list', options: { transient: true } });
  expect(list.schema.screens.flatMap(nodes).find(node => node.component === 'RelativeTimestamp').props.field).toBe('placedAt');
  const detail = await compose({ object: 'BoundOrder', context: 'detail', options: { transient: true } });
  expect(detail.schema.objectSchema!.last_event).toBeUndefined();
});

it('makes bindings available to hand-written objects, validates targets, and leaves unbound traits unchanged', () => {
  const definition = normalizeObjectDocument({ object: { name: 'HandWritten', version: '1.0.0', domain: 'test', description: 'Bound lifecycle' }, traits: [{ name: 'Stateful', parameters: { states: ['open', 'closed'], initialState: 'open' }, fieldBindings: { status: 'state' } }], schema: { state: { type: 'string', required: true, description: '' } } });
  expect(validateDefinition(dump(definition)).valid).toBe(true);
  const bound = composeObject(definition);
  expect(bound.schema.status).toBeUndefined();
  expect(bound.viewExtensions.form.some(extension => extension.props?.field === 'state')).toBe(true);
  for (const fieldBindings of [{ wrong: 'state' }, { status: 'missing' }, { status: 42 }, { status: 'state', state_history: 'state' }]) {
    expect(validateDefinition(dump({ ...definition, traits: [{ ...definition.traits[0], fieldBindings }] })).valid).toBe(false);
  }
  const unbound = { ...definition, traits: [{ name: 'Timestampable' }] };
  expect(composeObject(unbound).schema).toHaveProperty('created_at');
});

it('retains referenced enums, defaults and array item constraints in samples and recognizes the extension-less scalar URL', () => {
  const result = draftSource({ content: JSON.stringify({ title: 'EnumRecord', properties: { state: { $ref: '#/$defs/State' }, values: { type: 'array', items: { $ref: '#/$defs/State' }, minItems: 1 } }, required: ['state', 'values'], $defs: { State: { type: 'string', enum: ['open', 'closed'], default: 'open' } } }) });
  const object = result.drafts[0].definition;
  expect(object.schema.state.default).toBe('open');
  expect(object.schema.values.validation!.items).toMatchObject({ enum: ['open', 'closed'] });
  expect(object.samples!.every(row => ['open', 'closed'].includes(String(row.state)) && Array.isArray(row.values) && row.values.length)).toBe(true);
  const gql = draftSource({ format: 'graphql', content: 'scalar Instant @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time")\nenum State { OPEN CLOSED }\ntype Ticket { id: ID! state: State! at: Instant! }' });
  expect(gql.drafts[0].definition.schema.at.type).toBe('datetime');
  expect(gql.drafts[0].definition.samples!.every(row => row.state)).toBe(true);
});

it('includes unreachable reference reports in object show', async () => {
  const staged = await importObject({ action: 'draft', source: { content: JSON.stringify({ title: 'Reachable', properties: { id: { type: 'integer' }, absent: { $ref: 'https://offline.invalid/schema' } } }) } });
  const shown = await importObject({ action: 'show', importId: staged.importId, object: 'Reachable' });
  expect(shown.unmapped).toContainEqual(expect.objectContaining({ kind: 'link', pointer: '/properties/absent/$ref' }));
});

it('uses OData navigation labels for detail and picker and declared labels on list columns', async () => {
  const file = path.resolve('test/fixtures/importer/odata-bindings.xml');
  const staged = await importObject({ action: 'draft', source: { path: file, format: 'odata' } });
  await importObject({ action: 'apply', importId: staged.importId, objects: [{ name: 'Agency' }, { name: 'Trip' }] });
  const target = loadObject('Agency');
  const detail = await compose({ object: 'Trip', context: 'detail', options: { transient: true } });
  const fields = detail.schema.objectSchema!;
  expect(fields.AgencyID.referenceLabels?.[String(target.samples![2].AgencyID)]).toBe(target.samples![2].Name);
  const bound = bindRecordSchema(detail.schema, loadObject('Trip').samples![2]);
  expect(bound.screens.flatMap(nodes).some(node => node.props?.text === target.samples![2].Name)).toBe(true);
  for (const framework of ['react', 'vue'] as const) {
    const code = await generate({ schema: detail.schema, framework });
    expect(code.errors ?? []).toEqual([]);
    expect(code.code).toContain(referenceFieldExpression('AgencyID', fields));
  }
  const list = await compose({ object: 'Trip', context: 'list', options: { transient: true } });
  expect(list.schema.screens.flatMap(nodes).some(node => node.props?.text === 'Starts on')).toBe(true);
});

it.each(['react', 'vue'] as const)('strictly compiles a %s workflow with accepted source-field bindings and numeric sort keys', async framework => {
  const { title, ...properties } = source.properties;
  // Real Prisma models may allow both audit values to be null; package timestamp props accept undefined.
  await accept({ ...source, properties: { ...properties, placedAt: { type: ['string', 'null'], format: 'date-time' }, updatedAt: { type: ['string', 'null'], format: 'date-time' } }, required: ['id', 'state'] });
  const result = await compose({ object: 'BoundOrder', context: 'workflow', options: { transient: true } });
  expect(result.status).toBe('ok');
  const generated = await generate({ schema: result.schema, framework, profile: 'build', options: { output: 'application' } });
  expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
  const checked = typecheckWorkflow(generated.artifact!);
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
}, 90_000);

it('omits unsupported canonical facts from every accepted imported trait, including history suggestions', async () => {
  const staged = await importObject({ action: 'draft', source: { content: JSON.stringify({ title: 'HistoryRecord', properties: { id: { type: 'integer' }, at: { type: 'string', format: 'date-time' } }, 'x-oods': { history: { timestampField: 'at' } } }) } });
  const shown = await importObject({ action: 'show', importId: staged.importId, object: 'HistoryRecord' });
  const history = shown.proposals.find((p: any) => p.trait.name === 'Supersedable');
  expect(Object.values(history.trait.fieldBindings).every(value => value === null)).toBe(true);
  expect(history.effects).toContain('no record views');
  await importObject({ action: 'apply', importId: staged.importId, objects: [{ name: 'HistoryRecord', proposals: shown.proposals.filter((p: any) => p.valid).map((p: any) => p.id) }] });
  const composed = await compose({ object: 'HistoryRecord', context: 'detail', options: { transient: true } });
  expect(Object.keys(composed.schema.objectSchema!).sort()).toEqual(['at', 'id']);
});


it('removes unbound suggested detail panels while preserving authored content and real record rows', async () => {
  await accept();
  const result = await compose({ object: 'BoundOrder', context: 'detail', options: { transient: true } });
  result.schema.screens[0].children!.push(
    { id: 'empty-membership', component: 'MembershipPanel', meta: { intent: 'slot:metadata' } },
    { id: 'authored-membership', component: 'MembershipPanel', props: { summary: 'Team-provided membership summary' } },
  );
  reconcileFormDetail(result.schema, 'detail', composeObject(loadObject('BoundOrder')));
  const all = result.schema.screens.flatMap(nodes);
  expect(all.some(node => node.id === 'empty-membership')).toBe(false);
  expect(all.find(node => node.id === 'authored-membership')?.props.summary).toBe('Team-provided membership summary');
  expect(all.some(node => node.props?.field === 'placedAt')).toBe(true);
});

it('keeps authored string identities raw when the declared relationship has no lookup rows', async () => {
  const result = await compose({ object: 'Comparison', context: 'detail', options: { transient: true } });
  expect(result.schema.objectSchema!.source_capture_id.referenceLabels).toBeUndefined();
  const named = await compose({ object: 'Article', context: 'detail', options: { transient: true } });
  expect(named.schema.objectSchema!.author_id.displayLabelField).toBe('author_name');
  expect(named.schema.objectSchema!.author_id.referenceLabels).toBeUndefined();
  const record = { sourceCaptureId: '09d5af73-f8ae-4778-ad47-7b30fa53dbb4' };
  const bound = bindRecordSchema(result.schema, record);
  expect(bound.screens.flatMap(nodes).some(node => node.props?.text === record.sourceCaptureId)).toBe(true);
});
