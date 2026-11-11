/**
 * s245-m02: Approval, the thirteenth public object. An approval is a decision, not a status: one ask to one actor that
 * becomes their answer, about one version of one thing. These specs pin why each part matters:
 * - its samples tell true stories about the other samples: each names a real payment or article by its reference or slug
 *   and its name, and the thing's outcome follows from its approvals by one stated mapping;
 * - on the screen where an answer is given, the thing, exactly what was shown, the level and the meaning are read and
 *   never edited, in every renderer and in the generated app;
 * - the composer holds that screen to those four facts: a fact the record keeps and the screen leaves out is refused;
 *   a fact the record does not keep is a warning, and the screen still composes;
 * - a form view is a fact only when it says so, so every 0.12.0 form composes as it did, a team's Statusable one included.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, historyAttribution } from '@oods/component-contracts';
import { clearObjectCache, listObjects, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache, listTraits, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { enforceApprovalFacts } from '../../src/compose/approval-facts.js';
import { FORM_FACT } from '../../src/compose/form-detail.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import { getDefinition } from '../../src/errors/registry.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html).textContent ?? '').replace(/\s+/g, ' ');
type Sample = Record<string, unknown>;
const FACT_FIELDS = ['subject_id', 'subject_name', 'shown', 'level', 'meaning'];
const CONTROLS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector']);
const bound = (node: UiElement) => Object.entries(node.props ?? {}).flatMap(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string' ? [value] : []);

/**
 * The mapping from a thing's approvals to its outcome (s245-m02), applied to the samples only: OODS Foundry does not work
 * the outcome out, a product's code does. An approval that still stands decides: a decline first, then a wait, then a yes
 * (approved or used); an out-of-date yes makes the outcome out of date; not yet asked, not needed, taken back, expired and
 * withdrawn count for nothing; a thing no approval names needs none.
 */
export function outcomeOf(statuses: string[]): string {
  if (!statuses.length) return 'not_required';
  if (statuses.includes('declined')) return 'declined';
  if (statuses.includes('waiting')) return 'waiting';
  if (statuses.some(status => ['approved', 'used'].includes(status))) return 'approved';
  if (statuses.includes('out_of_date')) return 'out_of_date';
  return 'not_required';
}

const approvals = (loadObject('Approval').samples ?? []) as Sample[];
const hosts = { Transaction: (loadObject('Transaction').samples ?? []) as Sample[], Article: (loadObject('Article').samples ?? []) as Sample[] };
const keyOf = (type: string, sample: Sample) => String(type === 'Transaction' ? sample.payment_reference : sample.slug);
const nameOf = (type: string, sample: Sample) => String(type === 'Transaction' ? sample.payment_reference : sample.label);

describe('Approval is the thirteenth public object', () => {
  it('composes Decision, Stateful and Timestampable, with a lifecycle that starts before anyone is asked', () => {
    const approval = loadObject('Approval');
    expect(approval.object).toMatchObject({ name: 'Approval', version: '1.0.0' });
    expect(approval.object).not.toHaveProperty('visibility');
    expect(approval.traits.map(trait => trait.name)).toEqual(['core/Decision', 'lifecycle/Stateful', 'lifecycle/Timestampable']);
    const lifecycle = approval.traits[1]!.parameters!;
    expect(lifecycle.states).toEqual(['not_yet_asked', 'waiting', 'approved', 'declined', 'out_of_date', 'taken_back', 'expired', 'withdrawn', 'not_needed', 'used']);
    expect(lifecycle.initialState).toBe('not_yet_asked');
    // Every state reads its own tone and description, never the fallback.
    for (const state of lifecycle.states as string[]) expect(getStatusPresentation('lifecycle', state).description, state).not.toMatch(/not found in registry/);
    expect(listObjects()).toContain('Approval');
    expect(listTraits()).toEqual(expect.arrayContaining(['Decision', 'Approvable']));
  });

  it('health_check counts 18 runtime objects and 52 traits, as the registry does, where the runtime ships without the repository folder', async () => {
    const { handle: health } = await import('../../src/tools/health.js');
    const folders = await import('../../src/objects/definition-folders.js');
    const repository = path.resolve(import.meta.dirname, '../../../../repository-objects');
    const scan = folders.scanDefinitions;
    const spy = vi.spyOn(folders, 'scanDefinitions').mockImplementation((directory, ...args) => directory === repository ? [] : scan(directory, ...args));
    try {
      clearObjectCache();
      const result = await health({}) as { registry: { objects: number; traits: number } };
      expect(result.registry).toMatchObject({ objects: 18, traits: 52 });
      expect(listObjects()).toHaveLength(result.registry.objects);
      expect(listTraits()).toHaveLength(result.registry.traits);
    } finally { spy.mockRestore(); clearObjectCache(); }
  });

  it('marks a form view a fact only where Decision says so: no other shipped form view carries the mark', () => {
    const marked = listTraits().flatMap(name => (loadTrait(name).view_extensions.form ?? []).filter(view => view.fact !== undefined).map(view => `${name}:${String(view.props?.field)}`));
    expect(marked).toEqual(['Decision:subject_id', 'Decision:subject_name', 'Decision:shown', 'Decision:level', 'Decision:meaning']);
    for (const name of listObjects()) expect(JSON.stringify(loadObject(name)), name).not.toContain('"fact":');
  });

  it('names itself, so a row reads as an approval and not as a person', () => {
    const composed = composeObject(loadObject('Approval'));
    expect(composed.semantics.name?.semantic_type).toBe('text.label');
    expect(composed.semantics.shown?.semantic_type).toBe('text.summary');
  });

  it('composes and renders in list, detail, form, timeline, card, inline and workflow, in HTML, React and Vue', async () => {
    for (const context of ['list', 'detail', 'form', 'timeline', 'card', 'inline', 'workflow'] as const) {
      const composed = await compose({ object: 'Approval', context, options: { transient: true } } as never) as { status: string; schema: UiSchema };
      expect(composed.status, context).toBe('ok');
      const html = await pipeline({ object: 'Approval', context, framework: 'html', options: { skipValidation: true } } as never) as { status?: string; render?: { html?: string } };
      expect(String(html.render?.html ?? ''), `${context} html`).toContain('Approve');
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: composed.schema, framework, profile: 'build' } as never) as { status: string; errors?: unknown };
        expect(result.status, `${context} ${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      }
    }
  });

  it('its list filters by status and finds an approval by an approver\'s or a thing\'s name, in the generated app', async () => {
    const workflow = (await compose({ object: 'Approval', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const app = await generate({ schema: workflow, framework: 'react', profile: 'build' } as never) as { artifact: { files: Array<{ path: string; contents: string }> } };
    const found = runGeneratedStore(app.artifact.files, [
      'const s = store.createStore();',
      'const names = query => s.list({ pageSize: 100, ...query }).records.map(record => record.name).sort();',
      "process.stdout.write(JSON.stringify({ waiting: names({ status: 'waiting' }), ruth: names({ search: 'ruth adeyemi' }), prorations: names({ search: 'prorations' }), finance: names({ search: 'Finance team' }) }));",
    ].join('\n')) as Record<string, string[]>;
    expect(found.waiting).toEqual(['Approve publishing Refund a duplicate charge']);
    expect(found.ruth).toEqual(['Approve the resend of PAY-2026-0429']);
    expect(found.prorations).toEqual(['Approve publishing How prorations work when plans change']);
    expect(found.finance).toEqual(['Review Invoice numbers, tax IDs and legal names']);
  });
});

describe('the eight Approval samples tell true stories about the Transaction and Article samples', () => {
  it('cover waiting, approved, declined, not needed, out of date and used, at two or more levels, one asked by an agent and one answered by a delegate', () => {
    expect(approvals).toHaveLength(8);
    for (const status of ['waiting', 'approved', 'declined', 'not_needed', 'out_of_date', 'used']) expect(approvals.map(sample => sample.status), status).toContain(status);
    expect(new Set(approvals.map(sample => sample.level)).size).toBeGreaterThanOrEqual(2);
    expect(approvals.filter(sample => sample.requested_by_kind === 'agent')).toHaveLength(1);
    // A delegate answered for the person asked: the support lead's delegate on the retries article.
    expect(approvals.filter(sample => sample.answered_for_id && sample.answered_for_id === sample.asked_of_id && sample.answered_by_id !== sample.asked_of_id).map(sample => sample.subject_id)).toContain('set-up-automatic-payment-retries');
    // Every history starts at not yet asked: the record exists before it is this person's turn.
    for (const sample of approvals) expect((sample.state_history as Array<{ from: string | null; to: string }>)[0], String(sample.name)).toMatchObject({ from: null, to: 'not_yet_asked' });
    // Each authors its own id, so a history entry can point at it.
    expect(new Set(approvals.map(sample => sample.approval_id)).size).toBe(8);
  });

  it('name a real payment or article by its reference or slug, and its name', () => {
    for (const sample of approvals) {
      const type = String(sample.subject_type) as keyof typeof hosts;
      expect(['Transaction', 'Article'], String(sample.name)).toContain(type);
      const host = hosts[type].find(record => keyOf(type, record) === sample.subject_id);
      expect(host, `${sample.name} names ${sample.subject_id}`).toBeDefined();
      expect(sample.subject_name).toBe(nameOf(type, host!));
    }
  });

  it('agree with each host by the stated mapping, and every host no approval names reads not required', () => {
    for (const [type, records] of Object.entries(hosts)) for (const host of records) {
      const statuses = approvals.filter(sample => sample.subject_type === type && sample.subject_id === keyOf(type, host)).map(sample => String(sample.status));
      expect(host.approval_state, `${type} ${keyOf(type, host)}`).toBe(outcomeOf(statuses));
      expect(typeof host.approval_summary === 'string' && host.approval_summary.trim().length > 0, `${keyOf(type, host)} says its outcome in words`).toBe(true);
    }
    expect(hosts.Transaction.filter(host => host.approval_state === 'not_required')).toHaveLength(7);
    expect(hosts.Article.filter(host => host.approval_state === 'not_required').map(host => host.slug)).toEqual(['september-2026-release-notes', 'moving-from-the-pro-plan']);
  });

  it('use only levels Approval declares, as each host\'s rule does', () => {
    const declared = loadObject('Approval').traits[0]!.parameters!.levels as string[];
    for (const sample of approvals) expect(declared).toContain(sample.level);
    for (const type of ['Transaction', 'Article']) {
      const rule = loadObject(type).traits.find(trait => trait.name === 'core/Approvable')!.parameters!;
      for (const level of rule.levels as string[]) expect(declared, `${type} declares ${level}`).toContain(level);
      for (const level of Object.values(rule.requiredLevels as Record<string, string>)) expect(rule.levels as string[]).toContain(level);
    }
  });

  it("points the Billing Agent's resend at its approval, and its printed line names the level", () => {
    const payment = hosts.Transaction.find(host => host.payment_reference === 'PAY-2026-0429')!;
    const resend = (payment.state_history as Sample[]).find(entry => entry.title === 'Sent again')!;
    const approval = approvals.find(sample => sample.subject_id === 'PAY-2026-0429')!;
    expect(resend).toMatchObject({ approval_id: approval.approval_id, approval_level: 'approval', approved_by_name: 'Ruth Adeyemi' });
    expect(approval.status).toBe('used');
    expect(historyAttribution(resend)?.text).toBe('Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)');
  });

  it('keeps the out-of-date approval true: the article changed after the yes', () => {
    const approval = approvals.find(sample => sample.status === 'out_of_date')!;
    const article = hosts.Article.find(host => host.slug === approval.subject_id)!;
    const approvedAt = Date.parse(String((approval.state_history as Sample[]).find(entry => entry.to === 'approved')!.at));
    expect(Date.parse(String(article.updated_at))).toBeGreaterThan(approvedAt);
    expect(article.last_event).toBe('updated');
  });
});

describe('on Approval\'s form the four facts are read beside the answer and never edited', () => {
  it('places each fact as a labelled row with no control, and keeps one required input for the answer form', async () => {
    const { schema } = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const nodes = schemaNodes(schema);
    const facts = nodes.filter(node => node.meta?.intent === FORM_FACT);
    expect(facts.map(row => row.children?.[0]?.props?.content)).toEqual(['Approving', 'What was shown', 'Level', 'What this yes means']);
    for (const field of FACT_FIELDS) expect(nodes.filter(node => CONTROLS.has(node.component) && bound(node).includes(field)), field).toEqual([]);
    // The answer is the lifecycle's own control; the approval's name is the required input a form keeps.
    expect(nodes.filter(node => node.component === 'StatusSelector').map(node => node.props?.field)).toEqual(['status']);
    expect(nodes.find(node => node.component === 'Input' && node.props?.field === 'name')).toBeDefined();
    expect(schema.objectSchema?.name).toMatchObject({ required: true });
    // One field, one editor.
    const edited = nodes.filter(node => CONTROLS.has(node.component)).flatMap(bound);
    expect(new Set(edited).size).toBe(edited.length);
  });

  it('reads the facts as text in HTML, React and Vue, and the generated app gives none an input of its own', async () => {
    const { schema } = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const workflow = (await compose({ object: 'Approval', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const html = String((await pipeline({ object: 'Approval', context: 'form', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
    const pages: Record<string, string> = { html };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      pages[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context: 'form', object: 'Approval', workflowSchema: workflow }), result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    for (const [renderer, page] of Object.entries(pages)) {
      const fragment = JSDOM.fragment(page);
      for (const label of ['Approving', 'What was shown', 'Level', 'What this yes means']) expect(text(page), `${renderer}: ${label}`).toContain(label);
      for (const field of FACT_FIELDS) expect(fragment.querySelectorAll(`input[name="${field}"], select[name="${field}"], textarea[name="${field}"]`).length, `${renderer}: ${field}`).toBe(0);
    }
    for (const framework of ['react', 'vue'] as const) {
      const app = await generate({ schema: workflow, framework, profile: 'build' } as never);
      const application = app.artifact!.files.find(file => file.path === 'src/application.ts')!.contents;
      const supplemental = JSON.parse(application.match(/export const supplementalFields[^=]*= (\[.*?\]);/)![1]!) as Array<{ name: string }>;
      expect(supplemental.map(field => field.name).filter(name => FACT_FIELDS.includes(name)), framework).toEqual([]);
    }
  });
});

describe('the composer holds the screen where an answer is given to the four facts', () => {
  it('passes Approval\'s own form, and refuses each fact left out, naming it', async () => {
    const result = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { status: string; schema: UiSchema; warnings?: Array<{ code: string }> };
    expect(result.status).toBe('ok');
    expect((result.warnings ?? []).map(warning => warning.code)).not.toContain('OODS-V222');
    const composed = composeObject(loadObject('Approval'));
    for (const [fact, fields] of [['the thing', ['subject_id', 'subject_name']], ['exactly what was shown', ['shown']], ['the level', ['level']], ['the meaning', ['meaning']]] as const) {
      const schema = structuredClone(result.schema);
      const drop = (node: UiElement): void => { node.children = node.children?.filter(child => !bound(child).some(field => (fields as readonly string[]).includes(field))); node.children?.forEach(drop); };
      schema.screens.forEach(drop);
      expect(() => enforceApprovalFacts(schema, composed), fact).toThrowError(expect.objectContaining({ opiCode: 'OODS-V221', message: expect.stringContaining(`without showing ${fact}`) }));
    }
    expect(enforceApprovalFacts(result.schema, composed)).toEqual([]);
  });

  it('the refusal and the warning are two registered codes with their own severity', () => {
    expect(getDefinition('OODS-V221')).toMatchObject({ severity: 'error', category: 'validation' });
    expect(getDefinition('OODS-V222')).toMatchObject({ severity: 'warning', category: 'validation' });
    expect(getDefinition('OODS-V221')!.cause).not.toBe(getDefinition('OODS-V222')!.cause);
  });

  describe('records that keep only some facts', () => {
    let home: string;
    const previous = { objects: process.env.OODS_OBJECTS_DIR, traits: process.env.OODS_TRAITS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
    const DECISION_FIELDS = Object.keys(loadTrait('core/Decision').schema);
    const write = (kind: 'objects' | 'traits', name: string, lines: string[]) => fs.writeFileSync(path.join(home, kind, name), lines.join('\n') + '\n');
    // An approval table as an import accepts it: the answer is the source's own status field, and only the named facts
    // are bound to fields the source keeps.
    const table = (name: string, keep: Record<string, string>, extra: string[] = [], readOnlyKeep = false) => {
      const bindings = Object.fromEntries(DECISION_FIELDS.map(field => [field, keep[field] ?? (field === 'asked_of_id' ? 'approver' : null)]));
      write('objects', `${name}.object.yaml`, [
        `object: { name: ${name}, version: 1.0.0, domain: imported, description: Imported approval table. }`,
        'schema:',
        '  approver: { type: string, required: false, description: The approver. }',
        '  approverDecision: { type: string, required: true, description: Decision made by the approver., validation: { enum: [pending, approved, declined] } }',
        ...Object.values(keep).map(field => `  ${field}: { type: string, required: false, ${readOnlyKeep ? 'readOnly: true, ' : ''}description: A kept fact. }`),
        ...extra,
        'traits:',
        '  - name: Stateful',
        '    parameters: { states: [pending, approved, declined], initialState: pending }',
        '    fieldBindings: { status: approverDecision, state_history: null, allowed_transitions: null }',
        '  - name: Decision',
        `    fieldBindings: ${JSON.stringify(bindings)}`,
        'samples:',
        `  - { approver: usr_1, approverDecision: approved${Object.values(keep).map(field => `, ${field}: kept ${field}`).join('')} }`,
        `  - { approver: usr_2, approverDecision: pending${Object.values(keep).map(field => `, ${field}: kept ${field}`).join('')} }`,
        'metadata: { supportedContexts: [list, detail, form] }',
      ]);
    };
    beforeAll(() => {
      home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s245-m02-'));
      for (const kind of ['objects', 'traits']) fs.mkdirSync(path.join(home, kind));
      table('NoFacts', {});
      table('OnlyLevel', { level: 'approval_level_name' });
      table('ReadOnlyFact', { meaning: 'meaning_text', shown: 'shown_text', level: 'level_text', subject_name: 'thing_name' }, [], true);
      // A list whose status is bound under another name, with one fact bound: its filter carries that field, which is a
      // collection control, so the list is no screen where an answer is given.
      table('RenamedStatus', { meaning: 'meaning_text' });
      // A team's own answer control, placed away from the facts.
      write('traits', 'Answering.trait.yaml', [
        'trait: { name: Answering, version: 1.0.0, description: An answer control of a team\'s own., category: workflow }',
        'schema: {}',
        'view_extensions:',
        '  form:',
        '    - { component: StatusSelector, position: main, priority: 10, props: { field: status } }',
      ]);
      write('objects', 'TeamApproval.object.yaml', [
        'object: { name: TeamApproval, version: 1.0.0, domain: test, description: A team approval with its own answer control. }',
        'traits:',
        '  - name: core/Decision',
        '  - name: lifecycle/Stateful',
        '    parameters: { states: [not_yet_asked, waiting, approved], initialState: not_yet_asked }',
        '  - name: Answering',
        'schema:',
        '  name: { type: string, required: true, description: What is asked. }',
      ]);
      write('objects', 'StatusProbe.object.yaml', [
        'object: { name: StatusProbe, version: 1.0.0, domain: test, description: A team object composing Statusable. }',
        'traits:',
        '  - name: visual/Statusable',
        'schema:',
        '  name: { type: string, required: true, description: Its name. }',
      ]);
      Object.assign(process.env, { OODS_OBJECTS_DIR: path.join(home, 'objects'), OODS_TRAITS_DIR: path.join(home, 'traits'), MCP_SCHEMA_STORE_ROOT: home });
      clearTraitCache(); clearObjectCache();
    });
    afterAll(() => {
      for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['OODS_TRAITS_DIR', previous.traits], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      clearTraitCache(); clearObjectCache();
      fs.rmSync(home, { recursive: true, force: true });
    });
    const composeIn = (object: string, context: string) => compose({ object, context, options: { transient: true } } as never) as Promise<{ status: string; schema: UiSchema; warnings?: Array<{ code: string; message: string }>; errors?: Array<{ code: string; message: string }> }>;

    it('warns in design_compose\'s reply naming every fact a record does not keep, and the form composes (Jira\'s ApproverDTO)', async () => {
      const none = await composeIn('NoFacts', 'form');
      expect(none.status).toBe('ok');
      expect(none.warnings?.filter(warning => warning.code === 'OODS-V222').map(warning => warning.message)).toEqual([expect.stringContaining('do not keep the thing, exactly what was shown, the level or the meaning')]);
      const one = await composeIn('OnlyLevel', 'form');
      expect(one.status).toBe('ok');
      const message = one.warnings?.find(warning => warning.code === 'OODS-V222')?.message ?? '';
      expect(message).toContain('the thing, exactly what was shown or the meaning');
      expect(message).not.toContain('the level');
      // The fact the record keeps is read on the form, with no control.
      expect(schemaNodes(one.schema).filter(node => node.meta?.intent === FORM_FACT).map(row => row.children?.[1]?.props?.field)).toEqual(['approval_level_name']);
    });

    it('keeps a fact bound to a read-only source field on the form, so the rule never counts an empty fact as shown', async () => {
      const result = await composeIn('ReadOnlyFact', 'form');
      expect(result.status).toBe('ok');
      expect(composeObject(loadObject('ReadOnlyFact')).schema.meaning_text).toMatchObject({ readOnly: true });
      expect(result.schema.objectSchema?.meaning_text).toBeDefined();
      expect(schemaNodes(result.schema).filter(node => node.meta?.intent === FORM_FACT).map(row => row.children?.[1]?.props?.field)).toEqual(['thing_name', 'shown_text', 'level_text', 'meaning_text']);
      const html = String((await pipeline({ object: 'ReadOnlyFact', context: 'form', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
      expect(text(html)).toContain('kept meaning_text');
    });

    it('composes a list with its status bound under another name and one fact bound, with no warning and no refusal', async () => {
      const list = await composeIn('RenamedStatus', 'list');
      expect(list.status).toBe('ok');
      const filter = schemaNodes(list.schema).find(node => node.collectionControl === 'filter');
      expect(filter?.props?.field).toBe('approverDecision');
      expect((list.warnings ?? []).map(warning => warning.code)).not.toContain('OODS-V222');
      // The bound fact is one the row does not show, so were a filter an answer control the rule would refuse this list.
      expect(schemaNodes(list.schema).some(node => bound(node).includes('meaning_text') && !node.collectionControl)).toBe(false);
    });

    it('refuses, through design_compose, a form whose facts an override removed while a team\'s own answer control stays', async () => {
      // Composed as authored, the facts sit beside the lifecycle's answer and the team's: it passes.
      expect((await composeIn('TeamApproval', 'form')).status).toBe('ok');
      // Replacing the slot that holds the facts leaves the team's answer control on a screen that shows none of them.
      await expect(compose({ object: 'TeamApproval', context: 'form', preferences: { componentOverrides: { title: 'Text' } }, options: { transient: true } } as never))
        .rejects.toMatchObject({ opiCode: 'OODS-V221', message: expect.stringContaining('without showing the thing, exactly what was shown') });
    });

    it('gives a team object composing Statusable the form it got in 0.12.0, its status editor included', async () => {
      const form = await composeIn('StatusProbe', 'form');
      expect(form.status).toBe('ok');
      const nodes = schemaNodes(form.schema);
      expect(nodes.some(node => node.component === 'StatusBadge' && bound(node).includes('status'))).toBe(true);
      expect(nodes.some(node => ['Input', 'Select'].includes(node.component) && node.props?.field === 'status')).toBe(true);
      expect(nodes.some(node => node.meta?.intent === FORM_FACT)).toBe(false);
    });
  });
});
