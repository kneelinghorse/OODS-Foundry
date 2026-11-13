/**
 * s247-m02: Task, the fourteenth public object. A task is an ask, not a ticket: one ask to one person or agent to do one
 * piece of work, and what became of it. These specs pin why each part matters:
 * - its samples tell true stories about the other samples: every person, agent, organization and approval a task names
 *   is a shipped sample by its id and its name, the one who answers follows the rule for who answers, a chain of tasks
 *   keeps its party and its first ask, and every agent and person acts only while its own record says it is active;
 * - each rule can fail: removing any one rule's fact from a sample is caught, so the samples are held, not described;
 * - on the screen where its state is changed, what was asked, who asked and for whom, and who is doing it are read and
 *   never edited, in every renderer and in the generated app;
 * - Cancel is offered exactly where the declared order lets the task move to cancelled, in the generated React and Vue
 *   apps, the first object whose Cancel follows an order;
 * - the payment's resend names the task it was made under, and no other shipped sample is added or reworded.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, historyAttribution } from '@oods/component-contracts';
import { listObjects, loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { FORM_FACT } from '../../src/compose/form-detail.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).textContent ?? '').replace(/\s+/g, ' ');
/** The page before the closed Reference details block, which lists every reference set or not, by design. */
const shown = (html: string) => { const body = text(html); const at = body.indexOf('Reference details'); return at >= 0 ? body.slice(0, at) : body; };
type Sample = Record<string, any>;
const STATES = ['not_started', 'working', 'needs_input', 'waiting', 'paused', 'outcome_unknown', 'finished', 'failed', 'declined', 'cancelled', 'handed_over'];
const ENDINGS = ['finished', 'failed', 'declined', 'cancelled', 'handed_over'];
const FACT_FIELDS = ['instruction', 'requested_by_id', 'requested_by_name', 'requested_for_id', 'requested_for_name', 'asked_of_id', 'asked_of_name'];
const CONTROLS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector']);
const bound = (node: UiElement) => Object.entries(node.props ?? {}).flatMap(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string' ? [value] : []);

const tasks = (loadObject('Task').samples ?? []) as Sample[];
const users = (loadObject('User').samples ?? []) as Sample[];
const agents = (loadObject('Agent').samples ?? []) as Sample[];
const organizations = (loadObject('Organization').samples ?? []) as Sample[];
const approvals = (loadObject('Approval').samples ?? []) as Sample[];
const order = loadObject('Task').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters!.transitionRules as Record<string, string[]>;
const user = (id: unknown, name: unknown) => users.find(sample => sample.user_id === id && sample.name === name);
const agent = (id: unknown, name: unknown) => agents.find(sample => sample.agent_id === id && sample.name === name);
const organization = (id: unknown, name: unknown) => organizations.find(sample => sample.organization_id === id && sample.label === name);

/** When a shipped User or Agent sample's own history says it was active: [from, to) pairs, to open-ended when it still is. */
function activeSpans(record: Sample): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let since: number | undefined;
  for (const entry of record.state_history ?? []) {
    const at = Date.parse(entry.at);
    if (entry.to === 'active' && since === undefined) since = at;
    else if (entry.to !== 'active' && since !== undefined) { spans.push([since, at]); since = undefined; }
  }
  if (since !== undefined) spans.push([since, Infinity]);
  return spans;
}

/**
 * The rules a Task sample keeps (s247 handoff, Interfaces 2), as one checker so each can be shown to fail. It returns a
 * sentence per broken rule, naming the sample.
 */
function taskProblems(samples: Sample[]): string[] {
  const problems: string[] = [];
  for (const task of samples) {
    const at = String(task.name);
    // 1. Every person or agent a task names is a shipped User or Agent sample, by id and name, its kind agreeing.
    for (const seat of ['requested_by', 'asked_of']) {
      const kind = task[`${seat}_kind`];
      const found = kind === 'person' ? user(task[`${seat}_id`], task[`${seat}_name`]) : kind === 'agent' ? agent(task[`${seat}_id`], task[`${seat}_name`]) : undefined;
      if (!found) problems.push(`${at}: ${seat} is not a shipped ${String(kind)} by id and name`);
    }
    // 2. The one it is for is a shipped Organization or User, never an Agent.
    if (!organization(task.requested_for_id, task.requested_for_name) && !user(task.requested_for_id, task.requested_for_name)) problems.push(`${at}: it is for no shipped organization or person`);
    // 3. The one who answers is a person or a team, never an agent, by the three clauses.
    if (!['user', 'team'].includes(task.owner_type)) problems.push(`${at}: answered for by a ${String(task.owner_type)}`);
    const doer = agent(task.asked_of_id, task.asked_of_name);
    const expected = task.asked_of_kind === 'person' ? { id: task.asked_of_id, name: task.asked_of_name, type: 'user' }
      : task.requested_by_kind === 'person' ? { id: task.requested_by_id, name: task.requested_by_name, type: 'user' }
        : doer ? { id: doer.owner_id, name: doer.owner_name, type: doer.owner_type } : undefined;
    if (!expected || task.owner_id !== expected.id || task.owner_name !== expected.name || task.owner_type !== expected.type) problems.push(`${at}: the one who answers breaks the rule`);
    // 4. A task with a parent is for the same party, and names the parent's first ask or the parent as its first ask.
    if (task.parent_id !== undefined) {
      const parent = samples.find(sample => sample.task_id === task.parent_id && sample.name === task.parent_name);
      if (!parent) problems.push(`${at}: its parent is no sample`);
      else {
        if (parent.requested_for_id !== task.requested_for_id) problems.push(`${at}: it is for another party than its parent`);
        const first = parent.origin_id !== undefined ? { id: parent.origin_id, name: parent.origin_name } : { id: parent.task_id, name: parent.name };
        if (task.origin_id !== first.id || task.origin_name !== first.name) problems.push(`${at}: it names another first ask`);
      }
    }
    // 5. A handed-over task is named as the parent of another sample.
    if (task.status === 'handed_over' && !samples.some(sample => sample.parent_id === task.task_id)) problems.push(`${at}: handed over to no task`);
    // 6. A task that needs input or waits sets what it waits on, and a task in any other state does not.
    const waits = ['needs_input', 'waiting'].includes(task.status);
    const pointed = ['waiting_on_type', 'waiting_on_id', 'waiting_on_name'].filter(field => task[field] !== undefined);
    if (waits && pointed.length !== 3) problems.push(`${at}: it waits on nothing named`);
    if (!waits && pointed.length) problems.push(`${at}: it is ${String(task.status)} and still names what it waits on`);
    // 7. An Approval a task names is a shipped Approval sample.
    const named = [task.waiting_on_type === 'Approval' ? task.waiting_on_id : undefined, task.subject_type === 'Approval' ? task.subject_id : undefined,
      ...(task.state_history ?? []).map((entry: Sample) => entry.approval_id)].filter(id => id !== undefined);
    for (const id of named) if (!approvals.some(sample => sample.approval_id === id)) problems.push(`${at}: it names an approval no sample holds`);
    // 8. Every history follows the declared order.
    for (const entry of task.state_history ?? []) if (entry.from !== null && !(order[entry.from] ?? []).includes(entry.to)) problems.push(`${at}: ${String(entry.from)} to ${String(entry.to)} is not in the declared order`);
    // 9. Every agent and person acts only while its own record says it is active, and so does the asker when it asks.
    const acts = [...(task.state_history ?? []).map((entry: Sample) => ({ kind: entry.actor_kind, id: entry.actor_id, name: entry.actor_name, at: entry.at })),
      { kind: task.requested_by_kind, id: task.requested_by_id, name: task.requested_by_name, at: task.created_at }];
    for (const act of acts) {
      const actor = act.kind === 'agent' ? agent(act.id, act.name) : act.kind === 'person' ? user(act.id, act.name) : undefined;
      if (!actor) { problems.push(`${at}: ${String(act.name)} acts and is no shipped sample`); continue; }
      const when = Date.parse(act.at);
      if (!activeSpans(actor).some(([from, to]) => when >= from && when < to)) problems.push(`${at}: ${String(act.name)} acts at ${String(act.at)}, when its record says it is not active`);
    }
    // 10. An agent's line names a party it acts for only where the agent's own grants name that party.
    for (const entry of task.state_history ?? []) {
      if (entry.actor_kind !== 'agent' || entry.on_behalf_of_name === undefined) continue;
      const grants = String(agent(entry.actor_id, entry.actor_name)?.acts_for ?? 'None').split('; ').map(grant => grant.split(' · ')[0]);
      if (!grants.includes(entry.on_behalf_of_name)) problems.push(`${at}: ${String(entry.actor_name)} acts for ${String(entry.on_behalf_of_name)}, which none of its grants names`);
    }
  }
  return problems;
}

const copy = () => structuredClone(tasks);
const sampleIn = (samples: Sample[], status: string) => samples.find(sample => sample.status === status)!;

describe('Task is the fourteenth public object', () => {
  it('composes the record trait, its lifecycle, its times, the one who answers and Cancel', () => {
    const task = loadObject('Task');
    expect(task.object).toMatchObject({ name: 'Task', version: '1.0.0' });
    expect(task.object).not.toHaveProperty('visibility');
    expect(task.traits.map(trait => trait.name)).toEqual(['core/Assignment', 'lifecycle/Stateful', 'lifecycle/Timestampable', 'structural/Ownerable', 'lifecycle/Cancellable']);
    const lifecycle = task.traits[1]!.parameters!;
    expect(lifecycle.states).toEqual(STATES);
    expect(lifecycle.initialState).toBe('not_started');
    // The five endings are final, and every other state can be stopped.
    for (const ending of ENDINGS) expect(order[ending], ending).toEqual([]);
    for (const state of STATES.filter(name => !ENDINGS.includes(name))) expect(order[state], state).toContain('cancelled');
    // The one who answers is a person or a team; the owner types offer no agent.
    expect(task.traits[3]!.parameters!.ownerTypes).toEqual(['user', 'team']);
    for (const state of STATES) expect(getStatusPresentation('lifecycle', state).description, state).not.toMatch(/not found in registry/);
    expect(listObjects()).toContain('Task');
  });

  it('names itself, so a row reads as a task and not as a person', () => {
    const composed = composeObject(loadObject('Task'));
    expect(composed.semantics.name?.semantic_type).toBe('text.label');
    expect(composed.semantics.instruction?.semantic_type).toBe('text.summary');
    expect(composed.semantics.owner_id?.ui_hints).toMatchObject({ displayLabelField: 'owner_name' });
  });

  it('composes and renders in list, detail, form, timeline, card, inline and workflow, in HTML, React and Vue', async () => {
    for (const context of ['list', 'detail', 'form', 'timeline', 'card', 'inline', 'workflow'] as const) {
      const composed = await compose({ object: 'Task', context, options: { transient: true } } as never) as { status: string; schema: UiSchema };
      expect(composed.status, context).toBe('ok');
      const html = await pipeline({ object: 'Task', context, framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } };
      expect(String(html.render?.html ?? ''), `${context} html`).toMatch(/Get INV-2026-0155 paid|Reply about order NW-2207|Hold 40 trail tents|Send Sunday|Add a late fee|Count flour and butter|Send September/);
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: composed.schema, framework, profile: 'build' } as never) as { status: string; errors?: unknown };
        expect(result.status, `${context} ${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      }
    }
  });

  it('an intent that names the Task composes it', async () => {
    const composed = await compose({ intent: 'Show the Task list', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(composed.status).toBe('ok');
    expect(JSON.stringify(composed.schema)).toContain('Get INV-2026-0155 paid');
  });
});

describe('the eight Task samples tell true stories about the shipped samples they name', () => {
  it('rest in waiting, needs input, paused, outcome unknown, declined, handed over, finished and cancelled', () => {
    expect(tasks.map(sample => sample.status)).toEqual(['waiting', 'needs_input', 'paused', 'outcome_unknown', 'declined', 'handed_over', 'finished', 'cancelled']);
    // One is done by a person, one names another as the task it came from, one has a team answering for it.
    expect(tasks.filter(sample => sample.asked_of_kind === 'person').map(sample => sample.name)).toEqual(['Count flour and butter by hand']);
    expect(tasks.filter(sample => sample.parent_id !== undefined).map(sample => sample.name)).toEqual(['Count flour and butter by hand']);
    expect(tasks.filter(sample => sample.owner_type === 'team').map(sample => sample.owner_name)).toEqual(['Accounts team']);
    // One person asks an agent whose sponsor is someone else, so the rule's second clause decides a case its third would not.
    const decided = tasks.filter(sample => sample.asked_of_kind === 'agent' && sample.requested_by_kind === 'person' && agent(sample.asked_of_id, sample.asked_of_name)!.owner_id !== sample.requested_by_id);
    expect(decided.map(sample => sample.name)).toEqual(['Add a late fee to overdue invoices']);
    // A sample's own id is authored, so another record can point at it.
    expect(new Set(tasks.map(sample => sample.task_id)).size).toBe(8);
  });

  it('keep every rule: the parties, who answers, the chain, the wait, the approvals, the order and the actors\' dates', () => {
    expect(taskProblems(tasks)).toEqual([]);
  });

  it.each([
    ['a doer that is no shipped agent', (s: Sample[]) => { s[0]!.asked_of_name = 'Billing Bot'; }, /asked_of is not a shipped agent/],
    ['an asker whose kind disagrees', (s: Sample[]) => { s[1]!.requested_by_kind = 'agent'; }, /requested_by is not a shipped agent/],
    ['a task for an agent', (s: Sample[]) => { s[0]!.requested_for_id = agents[0]!.agent_id; s[0]!.requested_for_name = agents[0]!.name; }, /for no shipped organization or person/],
    ['an agent answering for the work', (s: Sample[]) => { Object.assign(s[0]!, { owner_id: agents[0]!.agent_id, owner_name: agents[0]!.name, owner_type: 'agent' }); }, /answered for by a agent/],
    // Grace Okafor asked the Collections Agent, whose sponsor is the Accounts team: the one who asked answers, not the sponsor.
    ['the sponsor answering where a person asked', (s: Sample[]) => { Object.assign(s[4]!, { owner_id: 'team_kestrel_accounts', owner_name: 'Accounts team', owner_type: 'team' }); }, /the one who answers breaks the rule/],
    ['the asker answering where a person does the work', (s: Sample[]) => { Object.assign(s[6]!, { owner_id: agents[4]!.agent_id, owner_name: agents[4]!.name, owner_type: 'user' }); }, /the one who answers breaks the rule/],
    ['a follow-up for another party', (s: Sample[]) => { s[6]!.requested_for_id = s[0]!.requested_for_id; s[6]!.requested_for_name = s[0]!.requested_for_name; }, /for another party than its parent/],
    ['a follow-up naming another first ask', (s: Sample[]) => { s[6]!.origin_name = 'Count stock'; }, /names another first ask/],
    ['a hand-over with no task after it', (s: Sample[]) => { s.splice(6, 1); }, /handed over to no task/],
    ['a wait that names nothing', (s: Sample[]) => { delete s[0]!.waiting_on_id; }, /waits on nothing named/],
    ['a paused task that still names a wait', (s: Sample[]) => { Object.assign(s[2]!, { waiting_on_type: 'User', waiting_on_id: users[0]!.user_id, waiting_on_name: users[0]!.name }); }, /paused and still names what it waits on/],
    ['an approval no sample holds', (s: Sample[]) => { Object.assign(s[1]!, { waiting_on_type: 'Approval', waiting_on_id: '7b3d5f9a-1c2e-4a6b-8d0f-2e4a6c8e0aff', waiting_on_name: 'A yes' }); }, /names an approval no sample holds/],
    ['a move the order does not declare', (s: Sample[]) => { s[6]!.state_history[1].from = 'not_started'; s[6]!.state_history[0].to = 'not_started'; }, /not_started to finished is not in the declared order/],
    ['an agent acting before its record says it is active', (s: Sample[]) => { s[3]!.state_history[0].at = '2026-09-19T11:00:00Z'; }, /Booking Agent acts at 2026-09-19T11:00:00Z/],
    ['a person acting after their account was locked', (s: Sample[]) => { s[7]!.state_history[1].at = '2026-09-24T09:00:00Z'; }, /Grace Okafor acts at 2026-09-24T09:00:00Z/],
    // The agent that hands the count over is taken back to draft at that moment, so it cannot be the one asking.
    ['an agent asking as its record leaves active', (s: Sample[]) => { Object.assign(s[6]!, { requested_by_id: agents[4]!.agent_id, requested_by_name: agents[4]!.name, requested_by_kind: 'agent' }); }, /Inventory Agent acts at 2026-10-19T07:00:00Z/],
    ['an agent acting for a party none of its grants names', (s: Sample[]) => { Object.assign(s[5]!.state_history[0], { on_behalf_of_id: s[5]!.requested_for_id, on_behalf_of_name: 'Lindqvist Bakery' }); }, /Inventory Agent acts for Lindqvist Bakery, which none of its grants names/],
  ])('catches %s', (_name, mutate, says) => {
    const samples = copy();
    mutate(samples);
    expect(taskProblems(samples).join('\n')).toMatch(says);
  });

  it('starts the Tidewater task on 28 Sep (UTC), not when the bank returned the transfer, and tells it in four lines', () => {
    const first = tasks[0]!;
    expect(first).toMatchObject({ name: 'Get INV-2026-0155 paid', status: 'waiting', tries: 1, waiting_on_id: 'PAY-2026-0429', subject_id: 'PAY-2026-0429', owner_name: 'Ruth Adeyemi' });
    const history = first.state_history as Sample[];
    expect(history.map(entry => `${entry.from} > ${entry.to}`)).toEqual(['not_started > working', 'working > needs_input', 'needs_input > working', 'working > waiting']);
    // 28 Sep, 20:30 UTC (a Monday in UTC, Tuesday morning in Tauranga), before the approval was created at 20:40; the
    // bank returned the transfer on 25 Sep. The first line names no day part, which differs by time zone.
    expect(new Date(history[0]!.at).getUTCDay()).toBe(1);
    expect(history[0]!.at).toBe('2026-09-28T20:30:00Z');
    expect(String(history[0]!.reason)).not.toMatch(/return|bank|morning|evening/i);
    // The yes is used once, by the resend: the payment's line names the approval and the task; the task's resume names
    // neither an approval nor a level, only that she said yes.
    const resend = ((loadObject('Transaction').samples as Sample[]).find(sample => sample.payment_reference === 'PAY-2026-0429')!.state_history as Sample[])[2]!;
    const approval = approvals.find(sample => sample.approval_id === resend.approval_id)!;
    expect(approval.subject_id).toBe('PAY-2026-0429');
    expect(Date.parse(history[0]!.at)).toBeLessThan(Date.parse(approval.state_history[0].at));
    expect(history.some(entry => entry.approval_id !== undefined || entry.approved_by_name !== undefined)).toBe(false);
    expect(historyAttribution(history[2])?.text).toBe('Billing Agent for Tidewater Co-op');
  });

  it("names the task on the payment's resend line, and prints the payment's other lines as 0.13.1 did", () => {
    const payment = (loadObject('Transaction').samples as Sample[]).find(sample => sample.payment_reference === 'PAY-2026-0429')!;
    const lines = (payment.state_history as Sample[]).map(entry => historyAttribution(entry)?.text);
    expect(lines).toEqual([undefined, undefined, 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · task: Get INV-2026-0155 paid']);
    const resend = (payment.state_history as Sample[])[2]!;
    expect(resend).toMatchObject({ task_id: tasks[0]!.task_id, task_name: tasks[0]!.name });
  });

  it('adds and rewords no shipped sample of another object, the resend\'s task aside', () => {
    const strip = (name: string, samples: Sample[]) => name !== 'Transaction' ? samples : samples.map(sample => ({ ...sample,
      state_history: (sample.state_history ?? []).map((entry: Sample) => { const { task_id: _id, task_name: _name, ...rest } = entry; return rest; }) }));
    // The digests of each object's samples as 0.13.1 shipped them (planning head 80b903a6d6).
    const SHIPPED: Record<string, string> = {
      User: 'c46b7b8b2503dff1', Organization: '9f9ee86cf12d29fc', Product: 'b9743dd806f97cf8', Subscription: '3ea11bcf91188e07', Transaction: '8613e5416546e7e0',
      Relationship: 'ebfe1de18c636fee', Article: '9194b50293de1fae', Media: 'b659b30bae5d5093', Invoice: '5b755a0663efb6f5', Plan: '421f7fd719870b01',
      Usage: 'c54a4d96226e4e98', Agent: 'f54bc01fdd86743e', Approval: '0eaf67ca99658d7f',
    };
    for (const [name, digest] of Object.entries(SHIPPED)) {
      expect(crypto.createHash('sha256').update(JSON.stringify(strip(name, loadObject(name).samples as Sample[] ?? []))).digest('hex').slice(0, 16), name).toBe(digest);
    }
  });
});

describe('on Task\'s form the ask\'s facts are read beside the status and never edited', () => {
  it('places each fact as a labelled row with no control, and keeps the task\'s name as its one required input', async () => {
    const { schema } = await compose({ object: 'Task', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const nodes = schemaNodes(schema);
    expect(nodes.filter(node => node.meta?.intent === FORM_FACT).map(row => row.children?.[0]?.props?.content)).toEqual(['What was asked', 'Asked by', 'Asked for', 'Doing it']);
    for (const field of FACT_FIELDS) expect(nodes.filter(node => CONTROLS.has(node.component) && bound(node).includes(field)), field).toEqual([]);
    expect(nodes.filter(node => node.component === 'StatusSelector').map(node => node.props?.field)).toEqual(['status']);
    for (const field of ['result', 'due_at', 'waiting_on_name', 'name']) expect(nodes.filter(node => node.component === 'Input' && node.props?.field === field), field).toHaveLength(1);
    expect(schema.objectSchema?.name).toMatchObject({ required: true });
    const edited = nodes.filter(node => CONTROLS.has(node.component)).flatMap(bound);
    expect(new Set(edited).size).toBe(edited.length);
  });

  it('reads the facts as text in HTML, React and Vue, and the generated app gives none an input of its own', async () => {
    const { schema } = await compose({ object: 'Task', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const workflow = (await compose({ object: 'Task', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const html = String((await pipeline({ object: 'Task', context: 'form', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
    const pages: Record<string, string> = { html };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      pages[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context: 'form', object: 'Task', workflowSchema: workflow }), result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    for (const [renderer, page] of Object.entries(pages)) {
      for (const label of ['What was asked', 'Asked by', 'Doing it', 'Status']) expect(text(page), `${renderer}: ${label}`).toContain(label);
      const fragment = JSDOM.fragment(page);
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

describe('the generated app: Cancel follows the declared order, the list finds a task by any party, and no empty place is drawn', () => {
  const apps = {} as Record<'react' | 'vue', GeneratedArtifact>;
  let records: Array<{ status: string; name: string; props: Record<string, unknown>; cancel: string }> = [];
  beforeAll(async () => {
    const workflow = (await compose({ object: 'Task', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      apps[framework] = result.artifact!;
    }
    records = runGeneratedStore(apps.react.files, `
const { createStore, screenProps, collectionEvents, idField } = store;
const attempt = (run) => { try { run(); return 'ok'; } catch (error) { return String(error.message); } };
const out = [];
for (const record of createStore({ latency: 0 }).list({ pageSize: 1000 }).records) {
  const id = String(record[idField]);
  const cancel = attempt(() => createStore({ latency: 0, now: () => '2026-10-20T12:00:00.000Z' }).cancel(id, 'No longer needed', 'no_longer_needed', false));
  out.push({ status: String(record.status), name: String(record.name), props: { ...screenProps(record), events: collectionEvents(record), uiState: 'success' }, cancel });
}
process.stdout.write(JSON.stringify(out));
`) as typeof records;
  }, 600_000);

  it('offers Cancel, and the store accepts it, exactly from the states the order lets move to cancelled', () => {
    const cancellable = STATES.filter(state => (order[state] ?? []).includes('cancelled'));
    expect(cancellable).toEqual(['not_started', 'working', 'needs_input', 'waiting', 'paused', 'outcome_unknown']);
    const statuses = new Set(records.map(record => record.status));
    // The samples reach states on both sides, so the check below could fail either way.
    expect([...statuses].some(status => cancellable.includes(status)) && [...statuses].some(status => !cancellable.includes(status))).toBe(true);
    for (const framework of ['react', 'vue'] as const) {
      const detail = apps[framework].files.find(file => file.path === `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`)!;
      const pages = renderGeneratedModels(framework, detail.contents, records.map(record => record.props), apps[framework].actions.map(action => action.name), { entry: detail.path, files: apps[framework].files });
      records.forEach((record, index) => {
        const where = `${framework} ${record.name} (${record.status})`;
        const offered = /data-oods-action="handleCancel"/.test(pages[index]!);
        expect(offered, where).toBe(cancellable.includes(record.status));
        expect(record.cancel === 'ok', `${where}: the store (${record.cancel})`).toBe(cancellable.includes(record.status));
      });
    }
  });

  it('filters by status and finds a task by any actor\'s name, the thing\'s name or the first ask\'s name', () => {
    const found = runGeneratedStore(apps.react.files, [
      'const s = store.createStore();',
      'const names = query => [...new Set(s.list({ pageSize: 100, ...query }).records.map(record => record.name))].sort();',
      "process.stdout.write(JSON.stringify({ waiting: names({ status: 'waiting' }), ruth: names({ search: 'Ruth Adeyemi' }), billing: names({ search: 'Billing Agent' }), dana: names({ search: 'Dana Whitfield' }), payment: names({ search: 'PAY-2026-0429' }), first: names({ search: 'Count flour and butter for Monday' }), team: names({ search: 'Accounts team' }) }));",
    ].join('\n')) as Record<string, string[]>;
    expect(found.waiting).toEqual(['Get INV-2026-0155 paid']);
    expect(found.ruth).toEqual(['Get INV-2026-0155 paid']);
    expect(found.billing).toEqual(['Get INV-2026-0155 paid']);
    expect(found.dana).toEqual(['Reply about order NW-2207']);
    expect(found.payment).toEqual(['Get INV-2026-0155 paid']);
    // The first ask's name is kept on every task in the chain, so a search by it gathers the chain.
    expect(found.first).toEqual(['Count flour and butter by hand', 'Count flour and butter for Monday\'s order']);
    expect(found.team).toEqual(['Send September\'s payment reminders']);
  });

  it('draws no empty place the record trait gives a fact on the app\'s detail page and list, for any sample', () => {
    for (const framework of ['react', 'vue'] as const) {
      const detail = apps[framework].files.find(file => file.path === `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`)!;
      const pages = renderGeneratedModels(framework, detail.contents, records.map(record => record.props), apps[framework].actions.map(action => action.name), { entry: detail.path, files: apps[framework].files });
      records.forEach((record, index) => expect(shown(pages[index]!), `${framework} ${record.name}`).not.toMatch(/Not recorded|unavailable|not resolved/));
      const list = apps[framework].files.find(file => file.path === `src/screens/List.${framework === 'react' ? 'tsx' : 'vue'}`)!;
      const [page] = renderGeneratedModels(framework, list.contents, [{ rows: records.map(record => record.props), collectionQuery: { page: 1, pageSize: 20, total: records.length }, uiState: 'success' }], apps[framework].actions.map(action => action.name), { entry: list.path, files: apps[framework].files });
      expect(shown(page!), `${framework} list`).not.toMatch(/Not recorded|unavailable|not resolved/);
      // Who does the work is named as doing it on every row, apart from the one who answers for it.
      expect((shown(page!).match(/Doing it/g) ?? []).length, `${framework} list`).toBe(records.length);
    }
  });
});
