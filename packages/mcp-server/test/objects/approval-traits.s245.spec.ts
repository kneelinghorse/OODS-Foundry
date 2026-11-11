/**
 * s245-m01: an approval is a decision, not a status. Two traits carry the model:
 * - core/Decision is the record of one ask to one actor and the answer it became. Its fields live on the trait, because
 *   the importer can only propose traits and a proposal can bind only the fields a trait declares; an accepted import
 *   binds what the source has and leaves the rest null, so the record must compose with any of them missing, an id kept
 *   without its name included (Jira Service Management's approver).
 * - core/Approvable is the rule and the outcome on the thing approved. Its rule may name only the levels it declares, and
 *   its outcome is written by the product, so it is read-only: shown on the detail page, kept off the form.
 * And the line in a record's history is the trace: it names its level of yes on every history path, its approval's id
 * stays in the record's data, and an entry without the two fields prints what 0.12.0 printed.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, historyAttribution } from '@oods/component-contracts';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { clearTraitCache, listTraits, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { parameterProblems } from '../../src/objects/parameter-validation.js';
import { enumOptionLabel } from '../../src/compose/internal-fields.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as validate } from '../../src/tools/object.validate.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html).textContent ?? '').replace(/\s+/g, ' ');
const LEVELS = ['acknowledgement', 'review', 'approval', 'sign_off'];
const OUTCOMES = ['not_required', 'waiting', 'approved', 'declined', 'out_of_date'];
const DECISION_FIELDS = [
  'requested_by_id', 'requested_by_name', 'requested_by_kind', 'requested_for_id', 'requested_for_name', 'asked_of_id', 'asked_of_name',
  'answered_by_id', 'answered_by_name', 'answered_by_kind', 'answered_for_id', 'answered_for_name', 'subject_type', 'subject_id', 'subject_name',
  'shown', 'level', 'meaning', 'asked_at', 'due_at', 'answered_at', 'comment',
];
const levelPhrase = 'Approved by Ruth Adeyemi (level: Review)';

describe('core/Decision and core/Approvable are shipped traits', () => {
  it('Decision holds the record\'s fields, every id a plain string so an imported reference can bind', () => {
    expect(listTraits()).toEqual(expect.arrayContaining(['Decision', 'Approvable']));
    const decision = loadTrait('core/Decision');
    expect(decision.trait).toMatchObject({ name: 'Decision', version: '1.0.0', category: 'core' });
    expect(Object.keys(decision.schema)).toEqual(DECISION_FIELDS);
    for (const field of DECISION_FIELDS.filter(name => name.endsWith('_id'))) expect(decision.schema[field]!.type, field).toBe('string');
    expect(Object.entries(decision.schema).filter(([, field]) => field.required).map(([name]) => name)).toEqual(['subject_name', 'shown', 'level', 'meaning']);
    expect(decision.schema.level!.validation).toEqual({ enumFromParameter: 'levels' });
    // The answer is the record's own lifecycle, through Stateful; the trait keeps no verdict of its own.
    expect(Object.keys(decision.schema).some(field => /status|state|decision|verdict|answer$/.test(field))).toBe(false);
    expect(decision.dependencies).toEqual(['Stateful']);
    expect(decision.parameters.map(parameter => [parameter.name, parameter.default])).toEqual([['levels', LEVELS]]);
  });

  it('Approvable holds the rule as parameters and the outcome as two read-only fields', () => {
    const approvable = loadTrait('core/Approvable');
    expect(approvable.trait).toMatchObject({ name: 'Approvable', version: '1.0.0', category: 'core' });
    expect(approvable.parameters.map(parameter => parameter.name)).toEqual(['levels', 'levelDefinitions', 'requiredLevels', 'approvalsNeeded', 'askerMayAnswer', 'agentLevels', 'lapsesOnChange', 'outcomes']);
    expect(Object.keys(approvable.schema)).toEqual(['approval_state', 'approval_summary']);
    for (const field of Object.values(approvable.schema)) expect(field).toMatchObject({ required: false, readOnly: true });
    expect(approvable.schema.approval_state!.validation).toEqual({ enumFromParameter: 'outcomes' });
    // A product declares what its own levels are; the four example levels' definitions are illustrative, and each passes the
    // parameter's own shape (six short texts) against the default levels.
    expect(approvable.parameters.find(parameter => parameter.name === 'levelDefinitions')!.default).toEqual({});
    const examples = approvable.metadata.levelExamples as Record<string, Record<string, string>>;
    expect(Object.keys(examples)).toEqual(LEVELS);
    for (const definition of Object.values(examples)) expect(Object.keys(definition)).toEqual(['who', 'permits', 'shown', 'cost', 'act', 'lapses']);
    expect(parameterProblems('Approvable', { levelDefinitions: examples })).toEqual([]);
  });

  it('both validate with their defaults and with a product\'s own levels', () => {
    expect(parameterProblems('Decision', {})).toEqual([]);
    expect(parameterProblems('Approvable', {})).toEqual([]);
    expect(parameterProblems('Decision', { levels: ['review', 'sign_off'] })).toEqual([]);
    expect(parameterProblems('Approvable', {
      levels: ['review', 'sign_off'], requiredLevels: { published: 'review', release: 'sign_off' }, approvalsNeeded: { sign_off: 2 }, agentLevels: ['review'],
      levelDefinitions: { review: { who: 'An editor', permits: 'Publishing', shown: 'The article', cost: 'A wrong article', act: 'A read', lapses: 'When it is edited' } },
    })).toEqual([]);
  });
});

describe('a rule that names a level its list lacks is refused, with a message that names the level', () => {
  const levels = ['review', 'approval'];
  it.each([
    ['a change that requires an undeclared level', { requiredLevels: { resend: 'manager' } }, '/requiredLevels/resend', 'requires the level "manager"'],
    ['a definition keyed by an undeclared level', { levelDefinitions: { manager: { who: 'a', permits: 'b', shown: 'c', cost: 'd', act: 'e', lapses: 'f' } } }, '/levelDefinitions/manager', 'defines the level "manager"'],
    ['a count for an undeclared level', { approvalsNeeded: { manager: 2 } }, '/approvalsNeeded/manager', 'counts the level "manager"'],
    ['an agent level the list lacks', { agentLevels: ['review', 'manager'] }, '/agentLevels/1', 'lets an agent give the level "manager"'],
  ])('%s', (_name, rule, at, says) => {
    const problems = parameterProblems('Approvable', { levels, ...rule });
    expect(problems).toEqual([{ path: at, message: `Approvable${at}: ${says}, which levels does not declare (review, approval).` }]);
  });

  it('object_validate refuses an object whose rule names an undeclared level, at the trait\'s parameter', async () => {
    const yaml = [
      'object: { name: Payout, version: 1.0.0, domain: test, description: A payout that needs an approval. }',
      'traits:',
      '  - name: core/Approvable',
      '    parameters: { levels: [review, approval], requiredLevels: { send: sign_off } }',
      'schema:',
      '  name: { type: string, required: true, description: What is paid out. }',
    ].join('\n');
    const result = await validate({ yaml });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ kind: 'invalid-parameter', path: 'traits[0].parameters/requiredLevels/send', message: expect.stringContaining('"sign_off"') }));
  });

  it('a level list that repeats or misspells a name is refused by the parameter schema', () => {
    expect(parameterProblems('Decision', { levels: ['review', 'review'] })[0]?.message).toMatch(/^Decision\/levels: must NOT have duplicate items/);
    expect(parameterProblems('Decision', { levels: ['sign off'] })[0]?.message).toMatch(/^Decision\/levels\/0: must match pattern/);
    expect(parameterProblems('Approvable', { outcomes: [] })[0]?.message).toMatch(/^Approvable\/outcomes: must NOT have fewer than 1 items/);
  });
});

describe('every state the two traits declare has a tone', () => {
  it('each of Approvable\'s outcomes reads its own tone and description, never the fallback', () => {
    for (const state of OUTCOMES) {
      const presentation = getStatusPresentation('lifecycle', state);
      expect(presentation.description, state).not.toMatch(/not found in registry/);
    }
    // A decline is an answer, not a failure, and a wait is not an error.
    expect(['declined', 'waiting'].map(state => getStatusPresentation('lifecycle', state).tone)).toEqual(['warning', 'info']);
    // Decision declares no state of its own: its answer is the record's lifecycle, declared by the object through Stateful.
    expect(loadTrait('core/Decision').parameters.some(parameter => /state/i.test(parameter.name))).toBe(false);
  });
});

describe('the two traits composed onto test objects, in every context where each declares a view, in HTML, React and Vue', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  const write = (name: string, lines: string[]) => fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), lines.join('\n') + '\n');

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s245-m01-'));
    fs.mkdirSync(path.join(home, 'objects'));
    // A team's approval record, composing Decision beside its own lifecycle, with one sample that fills every fact.
    write('Probe', [
      'object: { name: Probe, version: 1.0.0, domain: test, description: A test approval record. }',
      'traits:',
      '  - name: core/Decision',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [not_yet_asked, waiting, approved, declined], initialState: not_yet_asked }',
      'schema:',
      '  probe_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What is asked. }',
      'samples:',
      '  - probe_id: apr_1',
      '    name: Resend PAY-2026-0429',
      '    status: approved',
      '    subject_type: Transaction',
      '    subject_id: PAY-2026-0429',
      '    subject_name: PAY-2026-0429 for INV-2026-0155',
      '    shown: Resend $12,000.00 by bank transfer for INV-2026-0155',
      '    level: approval',
      '    meaning: "Approval: go ahead with this one resend"',
      '    requested_by_id: agt_billing',
      '    requested_by_name: Billing Agent',
      '    requested_by_kind: agent',
      '    requested_for_id: org_tidewater',
      '    requested_for_name: Tidewater Co-op',
      '    asked_of_id: usr_ruth',
      '    asked_of_name: Ruth Adeyemi',
      '    answered_by_id: usr_ruth',
      '    answered_by_name: Ruth Adeyemi',
      '    answered_by_kind: person',
      '    asked_at: "2026-09-28T09:00:00Z"',
      '    answered_at: "2026-09-28T09:20:00Z"',
      '    comment: Go ahead.',
      '    state_history:',
      '      - { from: null, to: not_yet_asked, at: "2026-09-28T08:59:00Z", reason: Created }',
      '      - { from: not_yet_asked, to: waiting, at: "2026-09-28T09:00:00Z", reason: Asked }',
      '      - { from: waiting, to: approved, at: "2026-09-28T09:20:00Z", reason: Approved }',
    ]);
    // A team's thing that can be approved, with its outcome written and one history entry pointing at its approval.
    write('Host', [
      'object: { name: Host, version: 1.0.0, domain: test, description: A test thing that can be approved. }',
      'traits:',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [draft, published], initialState: draft }',
      '  - name: core/Approvable',
      '    parameters: { requiredLevels: { published: review } }',
      'schema:',
      '  host_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What it is. }',
      'samples:',
      '  - host_id: h_1',
      '    name: How prorations work',
      '    status: published',
      '    approval_state: approved',
      '    approval_summary: Approved by Ruth Adeyemi · version 3 · 2 Nov',
      '    state_history:',
      '      - { from: null, to: draft, at: "2026-11-01T09:00:00Z", reason: Created }',
      '      - { from: draft, to: published, at: "2026-11-02T09:00:00Z", reason: Published, approved_by_name: Ruth Adeyemi, approval_id: apr_7, approval_level: review }',
    ]);
    // An approval table as an accepted import binds it: every trait field named, the source's bound, the rest null; the
    // approver is bound as the id and the source keeps no name for it (Jira Service Management's ApproverDTO).
    const bindings = Object.fromEntries(DECISION_FIELDS.map(field => [field, ({ asked_of_id: 'approver', answered_at: 'decidedAt', comment: 'note' } as Record<string, string>)[field] ?? null]));
    write('ApproverRecord', [
      'object: { name: ApproverRecord, version: 1.0.0, domain: imported, description: Imported ApproverDTO schema. }',
      'schema:',
      '  approver: { type: string, required: false, description: The approver. }',
      '  approverDecision: { type: string, required: true, description: Decision made by the approver., validation: { enum: [pending, approved, declined] } }',
      '  decidedAt: { type: datetime, required: false, description: When the approver decided. }',
      '  note: { type: string, required: false, description: What the approver said. }',
      'traits:',
      '  - name: Stateful',
      '    parameters: { states: [pending, approved, declined], initialState: pending }',
      '    fieldBindings: { status: approverDecision, state_history: null, allowed_transitions: null }',
      '  - name: Decision',
      '    parameters: {}',
      `    fieldBindings: ${JSON.stringify(bindings)}`,
      'samples:',
      '  - { approver: "557058:f58131cb-b67d-43c7-b30d-6b58d40bd077", approverDecision: approved, decidedAt: "2026-10-02T09:00:00Z", note: Looks right }',
      '  - { approver: "557058:0e4b7a2c-1d3f-4a5b-9c6d-7e8f9a0b1c2d", approverDecision: pending }',
      // s245-m03: five rows, as an accepted import carries; the approver is now the record's key (a decision is never one),
      // and a preview keeps authored keys only when it has one for each of its five records (#2502).
      '  - { approver: "557058:2b6c8d0e-3f5a-4b7c-9d1e-2f3a4b5c6d7e", approverDecision: declined, decidedAt: "2026-10-03T14:30:00Z", note: Needs the tax line }',
      '  - { approver: "557058:7a9b1c3d-5e7f-4a2b-8c4d-6e8f0a2b4c6d", approverDecision: approved, decidedAt: "2026-10-04T08:15:00Z" }',
      '  - { approver: "557058:4d6e8f0a-2b4c-4d6e-8f0a-1b3c5d7e9f1a", approverDecision: pending }',
      'metadata: { supportedContexts: [list, detail, form] }',
    ]);
    // The same table where the source keeps the approver's name under a name of its own.
    const renamed = Object.fromEntries(DECISION_FIELDS.map(field => [field, ({ asked_of_id: 'approver_ref', asked_of_name: 'approver_display' } as Record<string, string>)[field] ?? null]));
    write('SignoffRecord', [
      'object: { name: SignoffRecord, version: 1.0.0, domain: imported, description: Imported sign-off table. }',
      'schema:',
      '  title: { type: string, required: true, description: What is signed off. }',
      '  approver_ref: { type: string, required: true, description: The approver. }',
      '  approver_display: { type: string, required: false, description: The approver\'s name. }',
      '  state: { type: string, required: true, description: The answer., validation: { enum: [pending, approved] } }',
      'traits:',
      '  - name: Stateful',
      '    parameters: { states: [pending, approved], initialState: pending }',
      '    fieldBindings: { status: state, state_history: null, allowed_transitions: null }',
      '  - name: Decision',
      `    fieldBindings: ${JSON.stringify(renamed)}`,
      'samples:',
      '  - { title: Release 4.2, approver_ref: usr_ruth, approver_display: Ruth Adeyemi, state: approved }',
      '  - { title: Release 4.3, approver_ref: usr_ruth, approver_display: Ruth Adeyemi, state: pending }',
      'metadata: { supportedContexts: [list, detail, form] }',
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

  /** The page each renderer shows for one context: HTML through the pipeline, React and Vue generated and server-rendered. */
  async function pages(object: string, context: string): Promise<{ schema: UiSchema; html: string; react: string; vue: string }> {
    const composed = await compose({ object, context, options: { transient: true } } as never);
    expect(composed.status, `${object}/${context}: ${JSON.stringify(composed.errors)}`).toBe('ok');
    const schema = composed.schema as UiSchema;
    // An accepted import composes list, detail and form only, so its React and Vue screens are seeded from its own samples.
    const flow = await compose({ object, context: 'workflow', options: { transient: true } } as never);
    const workflow = flow.status === 'ok' ? flow.schema as UiSchema : undefined;
    const camel = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [snakeToCamel(key), value]));
    const samples = (loadObject(object).samples ?? []) as Array<Record<string, unknown>>;
    const established = workflow ? {} : context === 'list' ? { rows: samples.map(camel) } : camel(samples[0] ?? {});
    const rendered = await pipeline({ object, context, framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } };
    const out = { schema, html: String(rendered.render?.html ?? '') } as { schema: UiSchema; html: string; react: string; vue: string };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      expect(result.status, `${object}/${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      out[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context, object, workflowSchema: workflow, established }), result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    return out;
  }

  it('Decision places its facts on the detail page as labelled rows, in the order it declares them, in all three renderers', async () => {
    const { html, react, vue } = await pages('Probe', 'detail');
    const order = ['Approving', 'PAY-2026-0429 for INV-2026-0155', 'Kind of thing', 'What was shown', 'Resend $12,000.00 by bank transfer for INV-2026-0155',
      'Level', 'Approval', 'What this yes means', 'Approval: go ahead with this one resend', 'Asked by', 'Billing Agent', 'Kind of asker', 'Agent',
      'Asked for', 'Tidewater Co-op', 'Asked of', 'Ruth Adeyemi', 'Answered by', 'Kind of answerer', 'Person', 'Asked', 'Answered', 'Comment', 'Go ahead.'];
    for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
      const body = text(page);
      const details = body.slice(body.indexOf('Approving'));
      let at = 0;
      for (const words of order) {
        const found = details.indexOf(words, at);
        expect(found, `${renderer}: "${words}" after position ${at}`).toBeGreaterThanOrEqual(0);
        at = found + words.length;
      }
      // A reference shows its kept name, never the id the product knows the person by.
      expect(details.slice(0, details.indexOf('Reference details') >= 0 ? details.indexOf('Reference details') : undefined), renderer).not.toMatch(/usr_ruth|agt_billing|org_tidewater/);
    }
  });

  // s245-m02: the card names the thing in the record's own name already, so it adds the level and who was asked.
  it('Decision places the level and who was asked on a list row and on a card', async () => {
    for (const [context, words] of [['list', ['Resend PAY-2026-0429', 'Approval', 'Ruth Adeyemi']], ['card', ['Resend PAY-2026-0429', 'Approval', 'Ruth Adeyemi']]] as const) {
      const { html, react, vue } = await pages('Probe', context);
      for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
        for (const word of words) expect(text(page), `${renderer} ${context}`).toContain(word);
      }
    }
  });

  it('Approvable shows the outcome and its summary on the detail page, and no badge reads the fallback description', async () => {
    const { html, react, vue } = await pages('Host', 'detail');
    for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
      const body = text(page);
      expect(body, renderer).toMatch(/Approval state\s*Approved/);
      expect(body, renderer).toMatch(/Approvals\s*Approved by Ruth Adeyemi · version 3 · 2 Nov/);
      expect(page, renderer).not.toContain('Status not found in registry');
    }
    // The tab of read rows keeps its name: a core trait's rows are the record's details.
    const labels = schemaNodes((await compose({ object: 'Host', context: 'detail', options: { transient: true } } as never)).schema as UiSchema)
      .filter(node => node.component === 'Tabs').flatMap(node => (node.children ?? []).map(panel => panel.props?.label));
    expect(labels).toEqual(['Details']);
  });

  it('Approvable\'s outcome fields are read-only: kept off the form in all three renderers, its samples included', async () => {
    const { schema, html, react, vue } = await pages('Host', 'form');
    expect(Object.keys(schema.objectSchema ?? {}).filter(field => field.startsWith('approval_'))).toEqual([]);
    expect(schemaNodes(schema).filter(node => JSON.stringify(node.props ?? {}).includes('approval_'))).toEqual([]);
    for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
      expect(page, renderer).not.toMatch(/approval_state|approval_summary|approvalState|approvalSummary/);
      expect(text(page), renderer).not.toContain('version 3 · 2 Nov');
      expect(text(page), renderer).toContain('Name');
    }
  });

  it('an import that binds the record trait with facts null and an id without its kept name composes list, detail and form; the id shows as the id', async () => {
    const composed = composeObject(loadObject('ApproverRecord'));
    expect(Object.keys(composed.schema).sort()).toEqual(['approver', 'approverDecision', 'decidedAt', 'note']);
    // The kept name was bound to null, so the id's hint to it is gone with it, and nothing throws.
    expect(composed.semantics.approver?.ui_hints).toEqual({ component: 'Text', label: 'Asked of' });
    for (const context of ['list', 'detail', 'form'] as const) {
      const { html, react, vue } = await pages('ApproverRecord', context);
      for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
        const body = text(page);
        if (context === 'form') expect(page, `${renderer} ${context}`).toMatch(/Asked of/);
        // The id itself, whichever sample the screen shows (a detail page shows one, chosen by the preview's seed).
        else expect(body, `${renderer} ${context}`).toMatch(/Asked of\s*557058:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|557058:f58131cb-b67d-43c7-b30d-6b58d40bd077/);
        expect(body, `${renderer} ${context}`).not.toMatch(/reference not resolved|Asked of unavailable/);
      }
    }
  });

  it('a kept name bound under another field name follows the binding and shows wherever the id is placed', async () => {
    const composed = composeObject(loadObject('SignoffRecord'));
    expect(composed.semantics.approver_ref?.ui_hints).toMatchObject({ displayLabelField: 'approver_display', label: 'Asked of' });
    for (const context of ['list', 'detail'] as const) {
      const { html, react, vue } = await pages('SignoffRecord', context);
      for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
        const body = text(page);
        expect(body, `${renderer} ${context}`).toContain('Ruth Adeyemi');
        const shown = body.indexOf('Reference details') >= 0 ? body.slice(0, body.indexOf('Reference details')) : body;
        expect(shown, `${renderer} ${context}`).not.toContain('usr_ruth');
      }
    }
  });

  it('the history line names its level on the generated rail, in HTML, React and Vue, and its approval id stays in the record\'s data', async () => {
    const { html, react, vue } = await pages('Host', 'timeline');
    for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) {
      expect(text(page), renderer).toContain(levelPhrase);
      expect(page, renderer).not.toContain('apr_7');
    }
    const workflow = (await compose({ object: 'Host', context: 'workflow', options: { transient: true } } as never)).schema as UiSchema;
    const records = workflowSampleData(workflow).records as Array<Record<string, unknown>>;
    expect(JSON.stringify(records)).toContain('"approval_id":"apr_7"');
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build' } as never);
      expect(result.artifact!.files.filter(file => file.contents.includes('apr_7')).map(file => file.path), framework).toEqual(['src/sample-data.ts']);
    }
    const list = await pipeline({ object: 'Host', context: 'list', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } };
    expect(String(list.render?.html ?? '')).toContain('apr_7');
  });

  it('the detail page\'s StatusTimeline names the level in all three renderers', async () => {
    const { html, react, vue } = await pages('Host', 'detail');
    for (const [renderer, page] of [['html', html], ['react', react], ['vue', vue]] as const) expect(text(page), renderer).toContain(levelPhrase);
  });
});

describe('the HTML history components name the level, and an entry without the fields prints as in 0.12.0', () => {
  const entry = { title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge', actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi' };
  const pointed = { ...entry, approval_id: 'apr_resend_0429', approval_level: 'approval' };
  const audit = (row: Record<string, unknown>) => ({ ...row, from_state: row.from, to_state: row.to, transitioned_at: row.at });
  const html = (history: Record<string, unknown>[]) => renderTree({ version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: [
    { id: 'status', component: 'StatusTimeline', props: { status: 'refunded', history } },
    { id: 'audit', component: 'AuditTimeline', props: { auditLog: history.map(audit) } },
    { id: 'summary', component: 'AuditSummaryCard', props: { auditLog: history.map(audit) } },
    { id: 'rows', component: 'StateTransitionEvent', props: { history } },
  ] }] } as UiSchema);

  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the level and not the id', () => {
    const page = html([pointed]);
    expect(page.match(/Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi \(level: Approval\)/g)).toHaveLength(4);
    expect(page).not.toContain('apr_resend_0429');
  });

  it('an entry with an approval id and no level renders byte for byte as the 0.12.0 entry', () => {
    expect(html([{ ...entry, approval_id: 'apr_resend_0429' }])).toBe(html([entry]));
  });

  it('the level is printed in the words every screen shows a level in (the composer\'s enum label)', () => {
    for (const level of [...LEVELS, 'Sign-off', 'managerReview', 'L2']) {
      expect(historyAttribution({ approval_level: level })?.text, level).toBe(`Approved (level: ${enumOptionLabel(level)})`);
    }
  });
});
