/**
 * s247-m01: a task is an ask, not a ticket. core/Assignment is the record of one ask to one person or agent to do one piece
 * of work, and what became of it. These checks encode why each part matters:
 * - its fields live on the trait, because the importer can only propose traits and a proposal binds only the fields a
 *   trait declares; an accepted import binds what the source has and leaves the rest null, so the record composes with
 *   any of them missing, an id kept without its name included;
 * - on the screen where the work's state is changed, what was asked, who asked and for whom, and who is doing it are read
 *   as facts and never edited, while the three things a person doing the work writes (the result, the due date, what it
 *   waits on) each get a control whatever the form's ten field slots take;
 * - most of a task's places are empty in most of its states (what it waits on is empty for six samples in eight), so a
 *   place that opts in is not drawn where the record holds no value: no "Not recorded", no "Waiting on unavailable";
 * - the line in any record's history can name the task it was made under, on every history path, its id kept in the
 *   data and never printed, and a history written before 0.14.0 prints exactly what 0.13.1 printed;
 * - a declared order may name only its own states, and every state a task can be in has a tone that reads for any object.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, historyAttribution } from '@oods/component-contracts';
import { clearObjectCache, getObjectFilePath, listObjects, loadObject } from '../../src/objects/object-loader.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { clearTraitCache, listTraits, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { parameterProblems } from '../../src/objects/parameter-validation.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as validate } from '../../src/tools/object.validate.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
/** The words a person sees: no stylesheet, no script. */
const text = (html: string) => (JSDOM.fragment(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).textContent ?? '').replace(/\s+/g, ' ');
/** The labels of a page's controls (inputs, selects, text areas), as a person reads them beside each control. */
const controlLabels = (html: string): string[] => {
  const page = JSDOM.fragment(html);
  return [...page.querySelectorAll('input, select, textarea')].filter(control => control.getAttribute('type') !== 'hidden').map(control => {
    const id = control.getAttribute('id');
    const label = (id ? page.querySelector(`label[for="${id}"]`) : null) ?? control.closest('label');
    return (label?.textContent ?? control.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
  });
};
/** The page before the closed Reference details block, which lists every reference set or not, by design. */
const shown = (html: string) => { const body = text(html); const at = body.indexOf('Reference details'); return at >= 0 ? body.slice(0, at) : body; };
const FIELDS = [
  'instruction', 'requested_by_id', 'requested_by_name', 'requested_by_kind', 'requested_for_id', 'requested_for_name', 'asked_of_id', 'asked_of_name',
  'asked_of_kind', 'subject_type', 'subject_id', 'subject_name', 'due_at', 'waiting_on_type', 'waiting_on_id', 'waiting_on_name', 'parent_id',
  'parent_name', 'origin_id', 'origin_name', 'result', 'tries', 'last_try',
];
const STATES = ['not_started', 'working', 'needs_input', 'waiting', 'paused', 'outcome_unknown', 'finished', 'failed', 'declined', 'cancelled', 'handed_over'];
const NEW_TONES = ['not_started', 'working', 'needs_input', 'outcome_unknown', 'finished', 'handed_over'];
const RENDERERS = ['html', 'react', 'vue'] as const;
const taskPhrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · task: Get INV-2026-0155 paid';

describe('core/Assignment is a shipped trait', () => {
  it('holds the record\'s fields, every id a plain string so an imported reference can bind, the ask the one field required', () => {
    expect(listTraits()).toContain('Assignment');
    const trait = loadTrait('core/Assignment');
    expect(trait.trait).toMatchObject({ name: 'Assignment', version: '1.0.0', category: 'core' });
    expect(Object.keys(trait.schema)).toEqual(FIELDS);
    for (const field of FIELDS.filter(name => name.endsWith('_id'))) expect(trait.schema[field]!.type, field).toBe('string');
    expect(Object.entries(trait.schema).filter(([, field]) => field.required).map(([name]) => name)).toEqual(['instruction']);
    // The state of the work is the record's own lifecycle, through Stateful; no field says what the doer may do.
    expect(Object.keys(trait.schema).some(field => /status|state|grant|scope|budget|permission/.test(field))).toBe(false);
    expect(trait.dependencies).toEqual(['Stateful']);
    expect(trait.parameters).toEqual([]);
  });

  it('lets the form write only what the one doing the work writes: the result line, the due date and what it waits on', () => {
    const trait = loadTrait('core/Assignment');
    expect(Object.entries(trait.schema).filter(([, field]) => !field.readOnly).map(([name]) => name)).toEqual(['due_at', 'waiting_on_name', 'result']);
  });

  it('ships a parameter schema file, validates with none, and uses exactly the regions of its views', () => {
    const file = path.resolve(import.meta.dirname, '../../../../schemas/traits/assignment.parameters.schema.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    expect(parameterProblems('Assignment', {})).toEqual([]);
    expect(parameterProblems('Assignment', { states: ['a'] })[0]?.message).toMatch(/^Assignment: must NOT have additional properties/);
    const trait = loadTrait('core/Assignment');
    expect(trait.metadata.regionsUsed).toEqual(Object.keys(trait.view_extensions));
  });

  it('tags itself with compound words only, so the components it places match no intent\'s words', () => {
    const trait = loadTrait('core/Assignment');
    expect(trait.trait.tags?.length).toBeGreaterThan(0);
    for (const tag of trait.trait.tags ?? []) expect(tag, tag).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
  });
});

describe('a declared order may name only the states its lifecycle declares (next step 1860)', () => {
  const states = ['draft', 'active', 'done'];
  it('refuses a target and a key the states lack, naming each state and where it is named', () => {
    expect(parameterProblems('lifecycle/Stateful', { states, initialState: 'draft', transitionRules: { draft: ['active', 'actve'], archived: ['draft'], active: ['done'], done: [] } })).toEqual([
      { path: '/transitionRules/draft/1', message: 'Stateful/transitionRules/draft/1: "actve" is not one of the lifecycle\'s states (draft, active, done).' },
      { path: '/transitionRules/archived', message: 'Stateful/transitionRules/archived: "archived" is not one of the lifecycle\'s states (draft, active, done).' },
    ]);
    expect(parameterProblems('lifecycle/Stateful', { states, initialState: 'draft', transitionRules: { draft: ['active'], active: ['done'], done: [] } })).toEqual([]);
  });

  it('object_validate refuses a team object whose order has a typo, at the trait\'s parameter, naming the state', async () => {
    const yaml = [
      'object: { name: Shipment, version: 1.0.0, domain: test, description: A shipment that moves through a declared order. }',
      'traits:',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [packed, shipped, delivered], initialState: packed, transitionRules: { packed: [shiped], shipped: [delivered], delivered: [] } }',
      'schema:',
      '  name: { type: string, required: true, description: What is shipped. }',
    ].join('\n');
    const result = await validate({ yaml });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ kind: 'invalid-parameter', path: 'traits[0].parameters/transitionRules/packed/0', message: expect.stringContaining('"shiped"') }));
  });

  it('every checkout object still validates, Approval\'s declared order among them', async () => {
    const objects = listObjects();
    // m02: Task is the 31st checkout object, and its own declared order validates too.
    expect(objects).toHaveLength(31);
    for (const name of objects) {
      const result = await validate({ yaml: fs.readFileSync(getObjectFilePath(name)!, 'utf8') });
      expect(result.errors, name).toEqual([]);
      expect(result.valid, name).toBe(true);
    }
    const approval = loadObject('Approval').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as { transitionRules?: unknown };
    expect(approval.transitionRules).toBeTruthy();
  });
});

describe('every state a task can be in has a tone, in words that read for any object', () => {
  it('the six new states read their own tone and description, never the fallback, and say nothing of agents or tasks', () => {
    for (const state of NEW_TONES) {
      const presentation = getStatusPresentation('lifecycle', state);
      expect(presentation.description, state).not.toMatch(/not found in registry/);
      expect(presentation.description, state).not.toMatch(/\bagents?\b|\btasks?\b/i);
    }
    // The doer's word is not a success, and not knowing whether it took is not a failure.
    expect(getStatusPresentation('lifecycle', 'finished').tone).not.toBe('success');
    expect(getStatusPresentation('lifecycle', 'outcome_unknown').tone).not.toBe('critical');
    // A wait for a person and a wait for anything else do not look alike.
    expect(getStatusPresentation('lifecycle', 'needs_input').tone).not.toBe(getStatusPresentation('lifecycle', 'waiting').tone);
  });

  it('no badge for any of the eleven states reads the fallback description, in HTML, React or Vue', async () => {
    const schema = { version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: STATES.map((status, index) => ({ id: `badge-${index}`, component: 'StatusBadge', props: { status, tone: 'lifecycle' } })) }] } as UiSchema;
    const pages = [renderTree(schema)];
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      pages.push(renderGenerated(framework, result.code!, {}, []));
    }
    for (const page of pages) {
      expect(page).not.toMatch(/not found in registry/);
      for (const state of STATES) expect(text(page)).toContain(getStatusPresentation('lifecycle', state).label);
    }
  });
});

describe('the record trait composed onto test objects, in every context where it declares a view, in HTML, React and Vue', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  const write = (name: string, lines: string[]) => fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), lines.join('\n') + '\n');
  // The full sample fills every place; the sparse one leaves the optional places empty.
  const full: Record<string, unknown> = {
    errand_id: 'tsk_1', name: 'Get INV-2026-0155 paid', status: 'waiting', instruction: 'Get INV-2026-0155 paid',
    requested_by_id: 'agt_billing', requested_by_name: 'Billing Agent', requested_by_kind: 'agent', requested_for_id: 'org_tidewater', requested_for_name: 'Tidewater Co-op',
    asked_of_id: 'agt_billing', asked_of_name: 'Billing Agent', asked_of_kind: 'agent', subject_type: 'Transaction', subject_id: 'PAY-2026-0429', subject_name: 'PAY-2026-0429 for INV-2026-0155',
    due_at: '2026-10-02T17:00:00Z', waiting_on_type: 'Transaction', waiting_on_id: 'PAY-2026-0429', waiting_on_name: 'PAY-2026-0429 at the bank',
    parent_id: 'tsk_0', parent_name: 'Collect September invoices', origin_id: 'tsk_0', origin_name: 'Collect September invoices',
    result: 'Sent again; waiting for the bank', tries: 1, last_try: '29 Sep, 09:15: sent again; no answer yet',
    owner_id: 'usr_ruth', owner_type: 'user', owner_name: 'Ruth Adeyemi', ownership_role: 'Answers for it',
  };
  const sparse: Record<string, unknown> = {
    errand_id: 'tsk_2', name: 'Call the supplier', status: 'working', instruction: 'Call the supplier about the late crate',
    requested_by_id: 'usr_ruth', requested_by_name: 'Ruth Adeyemi', requested_by_kind: 'person', asked_of_id: 'usr_ruth', asked_of_name: 'Ruth Adeyemi', asked_of_kind: 'person',
    owner_id: 'usr_ruth', owner_type: 'user', owner_name: 'Ruth Adeyemi', ownership_role: 'Answers for it',
  };
  // The places that are empty on the sparse sample, by their labels.
  const EMPTY_LABELS = ['Asked for', 'About', 'Kind of thing', 'Due', 'Waiting on', 'Kind of thing waited on', 'Came from', 'First ask', 'Result', 'Tries', 'Last try'];
  const yamlSample = (sample: Record<string, unknown>) => ['  -', ...Object.entries(sample).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)].join('\n').replace('  -\n    ', '  - ');

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s247-m01-'));
    fs.mkdirSync(path.join(home, 'objects'));
    // A team's record of work: the record trait beside its own lifecycle, and Ownerable for the one who answers for it,
    // named by its own owner_name as Agent names its sponsor.
    write('Errand', [
      'object: { name: Errand, version: 1.0.0, domain: test, description: A test record of work. }',
      'traits:',
      '  - name: core/Assignment',
      '  - name: lifecycle/Stateful',
      `    parameters: { states: [${STATES.join(', ')}], initialState: not_started }`,
      '  - name: structural/Ownerable',
      '    parameters: { ownerTypes: [user, team], primaryOwnerType: user }',
      'schema:',
      '  errand_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What the work is called. }',
      '  owner_name: { type: string, required: false, description: Display name of the person or team that answers for the work. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      '  owner_id: { semantic_type: ownership.owner.id, token_mapping: tokenMap(ownership.owner.id), ui_hints: { component: OwnerReference, ownerTypeField: owner_type, displayLabelField: owner_name } }',
      'samples:',
      yamlSample(full),
      yamlSample(sparse),
    ]);
    // A record of work as an accepted import binds it: every trait field named, the source's bound, the rest null; the
    // doer is bound as an id and the source keeps no name for it.
    const bindings = Object.fromEntries(FIELDS.map(field => [field, ({ instruction: 'summary', asked_of_id: 'assignee', requested_by_id: 'creator', due_at: 'dueDate' } as Record<string, string>)[field] ?? null]));
    write('ImportedRun', [
      'object: { name: ImportedRun, version: 1.0.0, domain: imported, description: Imported agent run schema. }',
      'schema:',
      '  summary: { type: string, required: true, description: What the run was asked to do. }',
      '  assignee: { type: string, required: false, description: The agent doing the run. }',
      '  creator: { type: string, required: false, description: Who started the run. }',
      '  dueDate: { type: datetime, required: false, description: When the run is due. }',
      '  state: { type: string, required: true, description: The run\'s state., validation: { enum: [queued, in_progress, awaiting_input, completed] } }',
      'traits:',
      '  - name: Stateful',
      '    parameters: { states: [queued, in_progress, awaiting_input, completed], initialState: queued }',
      '    fieldBindings: { status: state, state_history: null, allowed_transitions: null }',
      '  - name: Assignment',
      '    parameters: {}',
      `    fieldBindings: ${JSON.stringify(bindings)}`,
      'samples:',
      '  - { summary: Fix the flaky login test, assignee: "agent:9f2c1e", creator: "user:41b7aa", state: in_progress }',
      '  - { summary: Update the changelog, assignee: "agent:9f2c1e", state: awaiting_input }',
      '  - { summary: Bump the parser, assignee: "agent:5d0a3b", creator: "user:41b7aa", dueDate: "2026-10-04T09:00:00Z", state: queued }',
      '  - { summary: Rename the build step, assignee: "agent:5d0a3b", state: completed }',
      '  - { summary: Triage new issues, assignee: "agent:9f2c1e", state: queued }',
      'metadata: { supportedContexts: [list, detail, form] }',
    ]);
    // A team's thing whose history names the task a change was made under.
    write('Host', [
      'object: { name: Host, version: 1.0.0, domain: test, description: A test payment whose resend was part of a task. }',
      'traits:',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [pending, returned, settled], initialState: pending }',
      'schema:',
      '  host_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What it is. }',
      'samples:',
      '  - host_id: h_1',
      '    name: PAY-2026-0429',
      '    status: pending',
      '    state_history:',
      '      - { from: null, to: pending, at: "2026-09-24T09:00:00Z", reason: Created }',
      '      - { from: pending, to: returned, at: "2026-09-25T02:00:00Z", reason: Returned by the bank }',
      '      - { from: returned, to: pending, at: "2026-09-29T09:15:00Z", reason: Sent again by bank transfer, actor_id: agt_billing, actor_name: Billing Agent, actor_kind: agent, on_behalf_of_name: Tidewater Co-op, approved_by_name: Ruth Adeyemi, approval_id: apr_resend_0429, approval_level: approval, task_id: tsk_tidewater_0155, task_name: Get INV-2026-0155 paid }',
    ]);
    process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
    process.env.MCP_SCHEMA_STORE_ROOT = home;
    clearTraitCache(); clearObjectCache();
  });
  afterAll(() => {
    for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  const composed = async (object: string, context: string): Promise<UiSchema> => {
    const result = await compose({ object, context, options: { transient: true } } as never);
    expect(result.status, `${object}/${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
    return result.schema as UiSchema;
  };
  /** A record as the screens read it: every field of the schema, camel-cased, null where the record holds nothing. */
  const model = (schema: UiSchema, record: Record<string, unknown>) => Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), record[field] ?? null]));
  /** The page each renderer shows for one context and the records given, so a chosen record is the one on the screen. */
  async function pages(object: string, context: string, records: Array<Record<string, unknown>>): Promise<Record<(typeof RENDERERS)[number], string>> {
    const schema = await composed(object, context);
    const rows = records.map(record => model(schema, record));
    const established = context === 'list' ? { rows } : model(schema, records[0]!);
    // A list's preview keeps one derived row unless it is given its rows, so the chosen records are set as the rows.
    const sample = { ...seedPreviewModel({ schema, context, object, established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
    const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      expect(result.status, `${object}/${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      out[framework] = renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    return out;
  }

  it('places its facts on the detail page as labelled rows, in the order it declares them, in all three renderers', async () => {
    const order = ['What was asked', 'Get INV-2026-0155 paid', 'About', 'PAY-2026-0429 for INV-2026-0155', 'Kind of thing', 'Transaction', 'Asked by', 'Billing Agent', 'Kind of asker', 'Agent',
      'Asked for', 'Tidewater Co-op', 'Doing it', 'Billing Agent', 'Kind of doer', 'Agent', 'Due', 'Waiting on', 'PAY-2026-0429 at the bank', 'Kind of thing waited on', 'Transaction',
      'Result', 'Sent again; waiting for the bank', 'Tries', '1', 'Last try', '29 Sep, 09:15: sent again; no answer yet', 'Came from', 'Collect September invoices', 'First ask', 'Collect September invoices'];
    const page = await pages('Errand', 'detail', [full]);
    for (const renderer of RENDERERS) {
      const body = shown(page[renderer]);
      const details = body.slice(body.indexOf('What was asked'));
      let at = 0;
      for (const words of order) {
        const found = details.indexOf(words, at);
        expect(found, `${renderer}: "${words}" after position ${at}`).toBeGreaterThanOrEqual(0);
        at = found + words.length;
      }
      // A reference shows its kept name, never the id the product knows the party by.
      expect(details, renderer).not.toMatch(/usr_ruth|agt_billing|org_tidewater|tsk_0\b/);
    }
  });

  it('places who is doing it and what it waits on on a list row and on a card', async () => {
    for (const context of ['list', 'card'] as const) {
      const page = await pages('Errand', context, [full]);
      for (const renderer of RENDERERS) for (const words of ['Get INV-2026-0155 paid', 'Billing Agent', 'PAY-2026-0429 at the bank']) expect(shown(page[renderer]), `${renderer} ${context}`).toContain(words);
    }
  });

  it('draws nothing where the record holds no value: on a list row, a card, a detail page and a form, in all three renderers', async () => {
    for (const context of ['list', 'card', 'detail', 'form'] as const) {
      const empty = await pages('Errand', context, [sparse]);
      const filled = await pages('Errand', context, [full]);
      for (const renderer of RENDERERS) {
        const body = shown(empty[renderer]);
        const where = `${renderer} ${context}, a record that waits on nothing`;
        expect(body, where).toContain(context === 'list' || context === 'card' ? 'Call the supplier' : 'Call the supplier about the late crate');
        expect(body, where).not.toMatch(/Not recorded|unavailable|not resolved/);
        // The form reads the ask's facts only; the detail page reads every place the trait gives a fact.
        const labels = context === 'form' ? ['Asked for'] : context === 'detail' ? EMPTY_LABELS : ['Waiting on'];
        for (const label of labels) expect(body, `${where}: "${label}"`).not.toMatch(new RegExp(`${label}(?! id)`));
        // The same places are drawn on a record that holds a value for them, so the absence above is the opt-in's.
        const filledBody = shown(filled[renderer]);
        expect(filledBody, `${renderer} ${context}, a full record`).toContain(context === 'form' ? 'Tidewater Co-op' : 'PAY-2026-0429 at the bank');
      }
    }
  });

  it('draws nothing where the record holds no value on the generated app\'s own detail and list screens, in React and Vue', async () => {
    const workflow = await composed('Errand', 'workflow');
    const props = (files: GeneratedArtifact['files']) => runGeneratedStore(files, `
const records = store.createStore({ latency: 0 }).list({ pageSize: 1000 }).records;
process.stdout.write(JSON.stringify(records.map(record => ({ ...store.screenProps(record), events: store.collectionEvents(record), uiState: 'success' }))));
`) as Array<Record<string, unknown>>;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      const files = result.artifact!.files;
      const records = props(files);
      const waits = records.filter(record => record.waitingOnName);
      const idle = records.filter(record => !record.waitingOnName);
      expect(waits.length, framework).toBeGreaterThan(0);
      expect(idle.length, framework).toBeGreaterThan(0);
      const actions = result.artifact!.actions.map(({ name }: { name: string }) => name);
      const screen = (name: string) => ({ entry: `src/screens/${name}.${framework === 'react' ? 'tsx' : 'vue'}`, files });
      const detailCode = files.find(file => file.path === screen('Detail').entry)!.contents;
      const [waiting, working] = renderGeneratedModels(framework, detailCode, [waits[0]!, idle[0]!], actions, screen('Detail'));
      expect(shown(waiting!), `${framework} app detail, waiting`).toContain('Waiting on');
      expect(shown(working!), `${framework} app detail, working`).not.toMatch(/Waiting on(?! id)|Asked for(?! id)|Not recorded|unavailable/);
      const listCode = files.find(file => file.path === screen('List').entry)!.contents;
      const [list] = renderGeneratedModels(framework, listCode, [{ rows: [idle[0]], collectionQuery: { page: 1, pageSize: 10, total: 1 }, uiState: 'success' }], actions, screen('List'));
      expect(shown(list!), `${framework} app list`).toContain('Call the supplier');
      expect(shown(list!), `${framework} app list`).not.toMatch(/unavailable|PAY-2026-0429/);
      // The mark that asks for this is a condition in the code, never an attribute on the page.
      for (const file of files) expect(file.contents, file.path).not.toContain('data-oods-omit-empty');
    }
  });

  it('reads the ask\'s facts on the form with no control, and gives the result, the due date and what it waits on a control each', async () => {
    const schema = await composed('Errand', 'form');
    const nodes = schemaNodes(schema);
    const controls = (field: string) => nodes.filter(node => node.props?.field === field && !['Text', 'Stack'].includes(node.component));
    for (const field of ['instruction', 'requested_by_id', 'requested_by_name', 'requested_for_id', 'requested_for_name', 'asked_of_id', 'asked_of_name']) {
      expect(controls(field), `${field} is a fact`).toEqual([]);
    }
    expect(nodes.filter(node => node.meta?.intent === 'form-fact').map(node => node.children?.find(child => child.meta?.intent === 'read-only-field')?.props?.field))
      .toEqual(['instruction', 'requested_by_name', 'requested_for_name', 'asked_of_name']);
    for (const field of ['result', 'due_at', 'waiting_on_name']) {
      expect(controls(field).map(node => node.component), field).toEqual(['Input']);
      expect(controls(field)[0]!.bindings?.onChange, field).toBe(`handleChange_${field}`);
    }
    const page = await pages('Errand', 'form', [full]);
    for (const renderer of RENDERERS) {
      const html = page[renderer];
      const labels = controlLabels(html);
      for (const label of ['Result', 'Due', 'Waiting on']) expect(labels.filter(text => text.startsWith(label)), `${renderer}: a control labelled ${label} (${labels.join(' | ')})`).toHaveLength(1);
      for (const label of ['What was asked', 'Asked by', 'Asked for', 'Doing it']) expect(labels.filter(text => text.startsWith(label)), `${renderer}: no control labelled ${label}`).toEqual([]);
      const body = shown(html);
      const facts = ['What was asked', 'Get INV-2026-0155 paid', 'Asked by', 'Billing Agent', 'Asked for', 'Tidewater Co-op', 'Doing it', 'Billing Agent', 'Status'];
      let at = 0;
      for (const words of facts) { const found = body.indexOf(words, at); expect(found, `${renderer}: "${words}"`).toBeGreaterThanOrEqual(0); at = found + words.length; }
    }
  });

  it('an import that binds the trait with most fields null and the doer\'s id without its kept name composes list, detail and form; the id shows as the id', async () => {
    const record = composeObject(loadObject('ImportedRun'));
    expect(Object.keys(record.schema).sort()).toEqual(['assignee', 'creator', 'dueDate', 'state', 'summary']);
    // The kept name was bound to null, so the id's hint to it is gone with it, and nothing throws.
    expect(record.semantics.assignee?.ui_hints).toEqual({ component: 'Text', label: 'Doing it' });
    for (const context of ['list', 'detail', 'form'] as const) {
      const schema = await composed('ImportedRun', context);
      const samples = loadObject('ImportedRun').samples as Array<Record<string, unknown>>;
      const rows = samples.map(sample => model(schema, sample));
      const established = context === 'list' ? { rows } : model(schema, samples[0]!);
      const sample = { ...seedPreviewModel({ schema, context, object: 'ImportedRun', established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
      const out = [renderRecordBody(schema, { objectName: 'ImportedRun', sampleModel: sample } as never)];
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
        expect(result.status, `${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
        out.push(renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name)));
      }
      for (const [index, page] of out.entries()) {
        const where = `${RENDERERS[index]} ${context}`;
        if (context === 'form') expect(shown(page), where).toContain('Doing it');
        else expect(shown(page), where).toMatch(/Doing it\s*agent:9f2c1e|agent:9f2c1e/);
        expect(shown(page), where).not.toMatch(/reference not resolved|Doing it unavailable/);
      }
    }
  });

  it('the history line names its task on the generated rail and the detail page, in HTML, React and Vue, and its task id stays in the record\'s data', async () => {
    for (const context of ['timeline', 'detail'] as const) {
      const schema = await composed('Host', context);
      const flow = await composed('Host', 'workflow');
      const sample = seedPreviewModel({ schema, context, object: 'Host', workflowSchema: flow, established: {} });
      const out = [renderRecordBody(schema, { objectName: 'Host', sampleModel: sample } as never)];
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
        expect(result.status).toBe('ok');
        out.push(renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name)));
      }
      for (const [index, page] of out.entries()) {
        expect(text(page), `${RENDERERS[index]} ${context}`).toContain(taskPhrase);
        expect(page, `${RENDERERS[index]} ${context}`).not.toContain('tsk_tidewater_0155');
      }
    }
    const workflow = await composed('Host', 'workflow');
    expect(JSON.stringify(workflowSampleData(workflow).records)).toContain('"task_id":"tsk_tidewater_0155"');
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build' } as never);
      expect(result.artifact!.files.filter(file => file.contents.includes('tsk_tidewater_0155')).map(file => file.path), framework).toEqual(['src/sample-data.ts']);
    }
  });
});

describe('the HTML history components name the task, and an entry without the fields prints as in 0.13.1', () => {
  const entry = { title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer', actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi', approval_id: 'apr_resend_0429', approval_level: 'approval' };
  const tasked = { ...entry, task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };
  const audit = (row: Record<string, unknown>) => ({ ...row, from_state: row.from, to_state: row.to, transitioned_at: row.at });
  const html = (history: Record<string, unknown>[]) => renderTree({ version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: [
    { id: 'status', component: 'StatusTimeline', props: { status: 'pending', history } },
    { id: 'audit', component: 'AuditTimeline', props: { auditLog: history.map(audit) } },
    { id: 'summary', component: 'AuditSummaryCard', props: { auditLog: history.map(audit) } },
    { id: 'rows', component: 'StateTransitionEvent', props: { history } },
  ] }] } as UiSchema);

  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the task and not its id', () => {
    const page = html([tasked]);
    expect(page.match(/Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi \(level: Approval\) · task: Get INV-2026-0155 paid/g)).toHaveLength(4);
    expect(page).not.toContain('tsk_tidewater_0155');
  });

  it('an entry with a task id and no task name renders byte for byte as the 0.13.1 entry', () => {
    expect(html([{ ...entry, task_id: 'tsk_tidewater_0155' }])).toBe(html([entry]));
    expect(historyAttribution({ ...entry, task_id: 'tsk_tidewater_0155' })).toStrictEqual(historyAttribution(entry));
  });
});
