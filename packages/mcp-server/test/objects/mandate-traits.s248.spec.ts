/**
 * s248-m01: a grant is a standing yes, not a setting. core/Mandate is the record of a grant: who asked for it, who gave it
 * and in what capacity, who holds it and who it is for, its terms, its end, its use, its place among other grants, and
 * how it ended. These checks encode why each part matters:
 * - its fields live on the trait, because the importer can only propose traits and a proposal binds only the fields a
 *   trait declares; an accepted import binds what the source has and leaves the rest null, so the record composes with
 *   any of them missing, an id kept without its name included;
 * - its terms are never edited in place (a change of terms is a new grant), so on the screen where a grant's state is
 *   changed the terms and seats are read as facts with no control, and the one thing written there is why it ended:
 *   taking a grant back is a change of its status on that form, with the reason beside it;
 * - a money limit is money: it reads "$12,000.00" on the form as on the detail page, never the stored 1200000, and a
 *   grant with no limit shows no limit, never "$0.00";
 * - most of a grant's places are empty for most grants, so a place is not drawn where the record holds no value;
 * - the line in any record's history can name the grant it was made under, and a change a standing yes allowed is
 *   approved by no one, so its line never reads "approved by";
 * - every state a grant can be in has a tone that reads for any object, and no ending reads as a success;
 * - a thing's rule may open a change to a yes given in advance only where it names the change, never at its most
 *   deliberate level.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation } from '@oods/component-contracts';
import { clearObjectCache, getObjectFilePath, loadObject } from '../../src/objects/object-loader.js';
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
// s249-m03 (Mandate 1.1.0): who a requested grant waits on (asked_of_*) and the capacity it was ended in (ended_as).
const FIELDS = [
  'requested_by_id', 'requested_by_name', 'requested_by_kind', 'asked_of_id', 'asked_of_name', 'asked_of_kind', 'granted_by_id', 'granted_by_name', 'granted_by_kind', 'granted_as',
  'granted_to_id', 'granted_to_name', 'granted_to_kind', 'granted_for_id', 'granted_for_name', 'scope', 'allowed_actions', 'asks_first_for',
  'never_allowed', 'amount_limit_minor', 'period_limit_minor', 'limit_currency', 'limit_period', 'uses_per_period', 'conditions', 'ends_at',
  'timezone', 'ends_note', 'uses', 'last_used_at', 'last_use', 'spent_minor', 'within_id', 'within_name', 'replaces_id', 'replaces_name',
  'first_grant_id', 'first_grant_name', 'ended_by_id', 'ended_by_name', 'ended_by_kind', 'ended_as', 'ended_reason',
];
const STATES = ['requested', 'active', 'paused', 'revoked', 'expired', 'replaced', 'declined', 'withdrawn'];
const ENDINGS = ['revoked', 'expired', 'replaced', 'declined', 'withdrawn'];
const RENDERERS = ['html', 'react', 'vue'] as const;

describe('core/Mandate is a shipped trait', () => {
  it('holds the record\'s fields, every id a plain string so an imported reference can bind, none required', () => {
    expect(listTraits()).toContain('Mandate');
    const trait = loadTrait('core/Mandate');
    expect(trait.trait).toMatchObject({ name: 'Mandate', version: '1.1.0', category: 'core' });
    expect(Object.keys(trait.schema)).toEqual(FIELDS);
    for (const field of FIELDS.filter(name => name.endsWith('_id'))) expect(trait.schema[field]!.type, field).toBe('string');
    expect(Object.entries(trait.schema).filter(([, field]) => field.required)).toEqual([]);
    // The state of the grant is the record's own lifecycle, through Stateful, never a field of the trait.
    expect(Object.keys(trait.schema).some(field => /status|state/.test(field))).toBe(false);
    expect(trait.dependencies).toEqual(['Stateful']);
    expect(trait.parameters).toEqual([]);
  });

  it('never uses a name today\'s importer reads as an actor or a doer, so a grant record is not proposed as the agent', () => {
    for (const field of FIELDS) expect(field, field).not.toMatch(/^(?:on_behalf_of|acting_for|run_as|delegate)/);
  });

  it('lets the form write only why the grant ended: every term and seat is the product\'s, written when it is given', () => {
    const trait = loadTrait('core/Mandate');
    expect(Object.entries(trait.schema).filter(([, field]) => !field.readOnly).map(([name]) => name)).toEqual(['ended_reason']);
  });

  it('declares its money limits as money, in minor units with their currency, so nothing reads them from a name', () => {
    const trait = loadTrait('core/Mandate');
    for (const field of ['amount_limit_minor', 'period_limit_minor', 'spent_minor']) {
      expect(trait.semantics?.[field]?.ui_hints, field).toMatchObject({ component: 'CurrencyAmount', currencyField: 'limit_currency', minorUnits: 100 });
    }
    expect(trait.schema.limit_period?.validation?.enum).toEqual(['day', 'week', 'month', 'year']);
  });

  it('ships a parameter schema file, validates with none, and uses exactly the regions of its views', () => {
    const file = path.resolve(import.meta.dirname, '../../../../schemas/traits/mandate.parameters.schema.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    expect(parameterProblems('Mandate', {})).toEqual([]);
    expect(parameterProblems('Mandate', { states: ['a'] })[0]?.message).toMatch(/^Mandate: must NOT have additional properties/);
    const trait = loadTrait('core/Mandate');
    expect(trait.metadata.regionsUsed).toEqual(Object.keys(trait.view_extensions));
  });

  it('tags itself with at most four compound words, and keeps its first sentence short for the registry snapshot', () => {
    const trait = loadTrait('core/Mandate');
    expect(trait.trait.tags?.length).toBeGreaterThan(0);
    expect(trait.trait.tags!.length).toBeLessThanOrEqual(4);
    for (const tag of trait.trait.tags ?? []) expect(tag, tag).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
    const first = String(trait.trait.description).replace(/\s+/g, ' ').trim().split(/(?<=\.)\s/)[0]!;
    expect(first.length).toBeLessThanOrEqual(180);
  });
});

describe('every state a grant can be in has a tone, in words that read for any object, and no ending reads as success', () => {
  it('requested, revoked and replaced are new, expired is reworded, and none says anything of grants or agents', () => {
    expect(getStatusPresentation('lifecycle', 'requested').description).toBe('Requested and not yet answered.');
    // s248-m04 (the fresh read): revoked says only that someone ended it, true of a grant with no end too and asserting
    // no authority nothing checks; active reads only "Active.", true of a person, a product and a grant alike. s249-m03
    // (Interface 11): "took it back" became "ended it", true too of a holder giving a grant up; and withdrawn names no one,
    // true of an asker dropping an ask and of a product calling one off because its grant ended.
    expect(getStatusPresentation('lifecycle', 'revoked').description).toBe('Revoked: someone ended it.');
    expect(getStatusPresentation('lifecycle', 'withdrawn').description).toBe('Withdrawn: the ask was called off.');
    expect(getStatusPresentation('lifecycle', 'active').description).toBe('Active.');
    expect(getStatusPresentation('lifecycle', 'replaced').description).toBe('Replaced: a newer one took its place.');
    // An approval that was never answered and a grant that reached its end both ran out of time.
    expect(getStatusPresentation('lifecycle', 'expired').description).toBe('Expired: its time ran out.');
    for (const state of [...STATES, 'allowed_in_advance']) {
      const description = getStatusPresentation('lifecycle', state).description;
      expect(description, state).not.toMatch(/not found in registry/);
      expect(description, state).not.toMatch(/\bagents?\b|\bgrants?\b|\btasks?\b/i);
    }
  });

  it('no ending is a success, and taking a grant back is the rule working, not a failure', () => {
    for (const state of ENDINGS) expect(getStatusPresentation('lifecycle', state).tone, state).not.toBe('success');
    expect(['critical', 'warning']).not.toContain(getStatusPresentation('lifecycle', 'revoked').tone);
    // A change a standing yes allowed was approved by no one: it does not wear the approved tone or say approved.
    expect(getStatusPresentation('lifecycle', 'allowed_in_advance').tone).not.toBe(getStatusPresentation('lifecycle', 'approved').tone);
    expect(getStatusPresentation('lifecycle', 'allowed_in_advance').description).not.toMatch(/approved/i);
  });

  it('no badge for any of the eight states or the new outcome reads the fallback description, in HTML, React or Vue', async () => {
    const states = [...STATES, 'allowed_in_advance'];
    const schema = { version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: states.map((status, index) => ({ id: `badge-${index}`, component: 'StatusBadge', props: { status, tone: 'lifecycle' } })) }] } as UiSchema;
    const pages = [renderTree(schema)];
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      pages.push(renderGenerated(framework, result.code!, {}, []));
    }
    for (const page of pages) {
      expect(page).not.toMatch(/not found in registry/);
      for (const state of states) expect(text(page)).toContain(getStatusPresentation('lifecycle', state).label);
    }
  });
});

describe('a thing\'s rule may open a change to a yes given in advance, and nothing else changes for a rule that does not', () => {
  const rule = { levels: ['approval', 'sign_off'], requiredLevels: { resend: 'approval', refund_above_limit: 'sign_off' } };
  it('accepts a change the rule names at a level below its last', () => {
    expect(parameterProblems('core/Approvable', { ...rule, inAdvance: ['resend'] })).toEqual([]);
    expect(parameterProblems('core/Approvable', rule)).toEqual([]);
    expect(loadTrait('core/Approvable').parameters.find(parameter => parameter.name === 'inAdvance')).toMatchObject({ default: [], required: false });
  });

  it('refuses a change the rule does not name, which needs no yes to give in advance, naming the change', () => {
    expect(parameterProblems('core/Approvable', { ...rule, inAdvance: ['dispute'] })).toEqual([{ path: '/inAdvance/0',
      message: 'Approvable/inAdvance/0: opens "dispute" to a yes given in advance, but requiredLevels does not name it, so it needs no yes; requiredLevels names resend, refund_above_limit.' }]);
    // A change is named by the rule's own keys: an inherited one (constructor) names nothing.
    expect(parameterProblems('core/Approvable', { ...rule, inAdvance: ['constructor'] })).toEqual([{ path: '/inAdvance/0',
      message: 'Approvable/inAdvance/0: opens "constructor" to a yes given in advance, but requiredLevels does not name it, so it needs no yes; requiredLevels names resend, refund_above_limit.' }]);
  });

  it('lets a rule with one level open its change: there is no more deliberate level to keep', () => {
    expect(parameterProblems('core/Approvable', { levels: ['approval'], requiredLevels: { resend: 'approval' }, inAdvance: ['resend'] })).toEqual([]);
  });

  it('refuses a change that needs the rule\'s last, most deliberate level: sign-off is always asked', () => {
    expect(parameterProblems('core/Approvable', { ...rule, inAdvance: ['resend', 'refund_above_limit'] })).toEqual([{ path: '/inAdvance/1',
      message: 'Approvable/inAdvance/1: opens "refund_above_limit" to a yes given in advance, but it needs "sign_off", the rule\'s last and most deliberate level, which is always asked.' }]);
  });

  it('every shipped rule lists its levels least deliberate first, and every object that composes Approvable validates unchanged', async () => {
    for (const name of ['Transaction', 'Article']) {
      const levels = (loadObject(name).traits.find(trait => trait.name === 'core/Approvable')!.parameters as { levels: string[] }).levels;
      expect(levels.at(-1), name).toBe('sign_off');
    }
    for (const name of ['Transaction', 'Article', 'Approval']) {
      const result = await validate({ yaml: fs.readFileSync(getObjectFilePath(name)!, 'utf8') });
      expect(result.errors, name).toEqual([]);
    }
  });
});

describe('the record trait composed onto test objects, in every context where it declares a view, in HTML, React and Vue', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  const write = (name: string, lines: string[]) => fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), lines.join('\n') + '\n');
  // A standing yes inside another, with every term and a money limit; a revoked grant with no terms beyond its seats; and
  // a grant that keeps a currency and a limit per period only.
  const full: Record<string, unknown> = {
    consent_id: 'grt_2', name: 'Resend returned transfers', status: 'active', scope: 'Resend returned transfers',
    requested_by_id: 'agt_billing', requested_by_name: 'Billing Agent', requested_by_kind: 'agent',
    granted_by_id: 'usr_ruth', granted_by_name: 'Ruth Adeyemi', granted_by_kind: 'person', granted_as: 'Finance manager, Tidewater Co-op',
    granted_to_id: 'agt_billing', granted_to_name: 'Billing Agent', granted_to_kind: 'agent', granted_for_id: 'org_tidewater', granted_for_name: 'Tidewater Co-op',
    allowed_actions: 'Resend a payment', asks_first_for: 'None', never_allowed: 'None',
    amount_limit_minor: 1200000, period_limit_minor: 3000000, limit_currency: 'USD', limit_period: 'month', uses_per_period: 3,
    conditions: 'Only a payment the bank returned, to the same payee for the same amount', ends_at: '2026-12-31T10:59:59Z', timezone: 'Pacific/Auckland',
    ends_note: 'At the end of 31 Dec 2026, Tauranga time', uses: 1, last_used_at: '2026-10-20T09:15:00Z', last_use: '20 Oct: PAY-2026-0512 sent again', spent_minor: 410000,
    within_id: 'grt_1', within_name: 'Tidewater Co-op invoices and payments', replaces_id: 'grt_0', replaces_name: 'Resend transfers once',
    first_grant_id: 'grt_0', first_grant_name: 'Resend transfers once',
    owner_id: 'usr_ruth', owner_type: 'user', owner_name: 'Ruth Adeyemi', ownership_role: 'Answers for it',
  };
  const sparse: Record<string, unknown> = {
    consent_id: 'grt_3', name: 'Marlow Yoga class bookings', status: 'revoked', scope: 'Class bookings',
    granted_by_id: 'usr_jonah', granted_by_name: 'Jonah Marlow', granted_to_id: 'agt_sched', granted_to_name: 'Scheduling Agent',
    granted_for_id: 'org_marlow', granted_for_name: 'Marlow Yoga', ended_by_id: 'usr_jonah', ended_by_name: 'Jonah Marlow', ended_by_kind: 'person', ended_reason: 'The studio closed',
    owner_id: 'usr_jonah', owner_type: 'user', owner_name: 'Jonah Marlow', ownership_role: 'Answers for it',
  };
  const monthly: Record<string, unknown> = {
    consent_id: 'grt_4', name: 'Summit monthly reorders', status: 'active', scope: 'Monthly reorders', granted_to_id: 'agt_order', granted_to_name: 'Order Agent',
    granted_for_id: 'org_summit', granted_for_name: 'Summit Outfitters', period_limit_minor: 500000, limit_currency: 'USD', limit_period: 'month',
    ends_note: 'No end: it stands until someone ends it', owner_id: 'usr_arjun', owner_type: 'user', owner_name: 'Arjun Mehta', ownership_role: 'Answers for it',
  };
  // The places that are empty on the sparse sample, by their labels.
  const EMPTY_LABELS = ['Kind of holder', 'Kind of giver', 'Given as', 'Asked for by', 'Allowed actions', 'Asks first for', 'Never allowed', 'Most per use', 'Most per period',
    'Period', 'Uses per period', 'Conditions', 'Ends', 'Time zone', 'Uses', 'Last used', 'Last used for', 'Spent this period', 'Inside', 'Replaces', 'First grant'];
  const yamlSample = (sample: Record<string, unknown>) => ['  -', ...Object.entries(sample).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)].join('\n').replace('  -\n    ', '  - ');

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s248-m01-'));
    fs.mkdirSync(path.join(home, 'objects'));
    // A team's own record of a grant: the record trait beside its own lifecycle in Grant's eight states and declared order,
    // and Ownerable for the one who answers for it, named by its own owner_name as Agent names its sponsor.
    write('Consent', [
      'object: { name: Consent, version: 1.0.0, domain: test, description: A test record of a standing yes. }',
      'traits:',
      '  - name: core/Mandate',
      '  - name: lifecycle/Stateful',
      `    parameters: { states: [${STATES.join(', ')}], initialState: requested, transitionRules: { requested: [active, declined, withdrawn], active: [paused, revoked, expired, replaced], paused: [active, revoked, expired, replaced], revoked: [], expired: [], replaced: [], declined: [], withdrawn: [] } }`,
      '  - name: structural/Ownerable',
      '    parameters: { ownerTypes: [user, team], primaryOwnerType: user }',
      'schema:',
      '  consent_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What the grant is called. }',
      '  owner_name: { type: string, required: false, description: Display name of the person or team that answers for the grant. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      '  scope: { semantic_type: text.summary, token_mapping: tokenMap(text.body.*), ui_hints: { component: Text, label: Covers } }',
      '  owner_id: { semantic_type: ownership.owner.id, token_mapping: tokenMap(ownership.owner.id), ui_hints: { component: OwnerReference, ownerTypeField: owner_type, displayLabelField: owner_name } }',
      // The sparse grant is the first sample, so a place it leaves out has no first example for a preview to fall back on.
      'samples:',
      yamlSample(sparse),
      yamlSample(full),
      yamlSample(monthly),
    ]);
    // A grant record as an accepted import binds it: every trait field named, the source's bound, the rest null; the holder
    // is bound as an id and the source keeps no name for it.
    const bindings = Object.fromEntries(FIELDS.map(field => [field, ({ granted_to_id: 'client_id', granted_for_id: 'principal_id', ends_at: 'expiry_time', scope: 'scope' } as Record<string, string>)[field] ?? null]));
    write('ImportedConsent', [
      'object: { name: ImportedConsent, version: 1.0.0, domain: imported, description: Imported permission grant schema. }',
      'schema:',
      '  scope: { type: string, required: true, description: What the grant lets the client do. }',
      '  client_id: { type: string, required: true, description: The app the grant is to. }',
      '  principal_id: { type: string, required: false, description: The user the grant is for. }',
      '  expiry_time: { type: datetime, required: false, description: When the grant runs out. }',
      '  state: { type: string, required: true, description: The grant\'s state., validation: { enum: [active, revoked, expired] } }',
      'traits:',
      '  - name: Stateful',
      '    parameters: { states: [active, revoked, expired], initialState: active }',
      '    fieldBindings: { status: state, state_history: null, allowed_transitions: null }',
      '  - name: Mandate',
      '    parameters: {}',
      `    fieldBindings: ${JSON.stringify(bindings)}`,
      'samples:',
      '  - { scope: Mail.Read, client_id: "app:7c41d2", principal_id: "user:41b7aa", expiry_time: "2027-01-01T00:00:00Z", state: active }',
      '  - { scope: Calendars.Read, client_id: "app:7c41d2", state: revoked }',
      '  - { scope: Files.Read, client_id: "app:90ee1f", principal_id: "user:41b7aa", state: expired }',
      '  - { scope: User.Read, client_id: "app:90ee1f", state: active }',
      '  - { scope: Mail.Send, client_id: "app:7c41d2", principal_id: "user:5d0a3b", state: active }',
      'metadata: { supportedContexts: [list, detail, form] }',
    ]);
    // A team's thing whose history names the grant a change was made under: once beside an approval and a task, once alone.
    write('Host', [
      'object: { name: Host, version: 1.0.0, domain: test, description: A test payment whose resends were made under grants. }',
      'traits:',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [pending, returned, settled], initialState: pending }',
      'schema:',
      '  host_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What it is. }',
      'samples:',
      '  - host_id: h_1',
      '    name: PAY-2026-0512',
      '    status: pending',
      '    state_history:',
      '      - { from: null, to: pending, at: "2026-09-24T09:00:00Z", reason: Created }',
      '      - { from: pending, to: returned, at: "2026-09-25T02:00:00Z", reason: Returned by the bank }',
      '      - { from: returned, to: pending, at: "2026-09-29T09:15:00Z", reason: Sent again by bank transfer, actor_id: agt_billing, actor_name: Billing Agent, actor_kind: agent, on_behalf_of_name: Tidewater Co-op, approved_by_name: Ruth Adeyemi, approval_id: apr_resend_0429, approval_level: approval, grant_id: grt_tidewater_billing, grant_name: Tidewater Co-op invoices and payments, task_id: tsk_tidewater_0155, task_name: Get INV-2026-0155 paid }',
      '      - { from: pending, to: returned, at: "2026-10-19T02:00:00Z", reason: Returned by the bank }',
      '      - { from: returned, to: pending, at: "2026-10-20T09:15:00Z", reason: Sent again by bank transfer, actor_id: agt_billing, actor_name: Billing Agent, actor_kind: agent, on_behalf_of_name: Tidewater Co-op, grant_id: grt_tidewater_resends, grant_name: Resend returned transfers }',
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
    const sample = { ...seedPreviewModel({ schema, context, object, established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
    const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      expect(result.status, `${object}/${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      out[framework] = renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    return out;
  }
  /** Each words, in order, after the first. */
  const inOrder = (body: string, words: string[], where: string) => {
    let at = 0;
    for (const word of words) { const found = body.indexOf(word, at); expect(found, `${where}: "${word}" after position ${at}`).toBeGreaterThanOrEqual(0); at = found + word.length; }
  };

  it('places its facts on the detail page as labelled rows in the order it declares them, the money as money and the end in the party\'s words then UTC', async () => {
    const order = ['Covers', 'Resend returned transfers', 'For', 'Tidewater Co-op', 'Held by', 'Billing Agent', 'Kind of holder', 'Agent', 'Given by', 'Ruth Adeyemi', 'Kind of giver', 'Person',
      'Given as', 'Finance manager, Tidewater Co-op', 'Asked for by', 'Billing Agent', 'Kind of asker', 'Agent', 'Allowed actions', 'Resend a payment', 'Asks first for', 'None',
      'Never allowed', 'None', 'Most per use', '$12,000.00', 'Most per period', '$30,000.00', 'Period', 'Month', 'Uses per period', '3', 'Conditions', 'Only a payment the bank returned',
      // s249-m04 (Interface 13): an instant names its zone, so its label no longer does; s249-m05's fresh read names the
      // instants apart from the party's words and the last use's line ("End time", "Last used", "Last used for").
      'Ends', 'At the end of 31 Dec 2026, Tauranga time', 'End time', 'Dec 31, 2026, 10:59 AM UTC', 'Time zone', 'Pacific/Auckland', 'Uses', '1', 'Last used', 'Oct 20, 2026',
      'Last used for', '20 Oct: PAY-2026-0512 sent again', 'Spent this period', '$4,100.00', 'Inside', 'Tidewater Co-op invoices and payments', 'Replaces', 'Resend transfers once',
      'First grant', 'Resend transfers once'];
    const page = await pages('Consent', 'detail', [full]);
    for (const renderer of RENDERERS) {
      const body = shown(page[renderer]);
      inOrder(body.slice(body.indexOf('Covers')), order, renderer);
      // s249-m04: the values say UTC, so no label does ("Last used (UTC)" would still hold "Last used" in order).
      expect(body, renderer).not.toContain('(UTC)');
      // A reference shows its kept name, never the id the product knows the party by; no amount is the stored number.
      expect(body, renderer).not.toMatch(/usr_ruth|agt_billing|org_tidewater|grt_[0-9]\b|1200000|3000000/);
    }
  });

  it('places the holder, the party and the end on a list row and a card, under the grant\'s name and what it covers', async () => {
    for (const context of ['list', 'card'] as const) {
      const page = await pages('Consent', context, [full]);
      for (const renderer of RENDERERS) inOrder(shown(page[renderer]), ['Resend returned transfers', 'Billing Agent', 'Held by', 'Tidewater Co-op', 'For', 'At the end of 31 Dec 2026, Tauranga time', 'Ends'], `${renderer} ${context}`);
    }
    // The list's summary line is what the grant covers.
    const list = await pages('Consent', 'list', [sparse]);
    for (const renderer of RENDERERS) expect(shown(list[renderer]), renderer).toContain('Class bookings');
  });

  it('draws nothing where the record holds no value: on a list row, a card, a detail page and a form, in all three renderers', async () => {
    for (const context of ['list', 'card', 'detail', 'form'] as const) {
      const empty = await pages('Consent', context, [sparse]);
      for (const renderer of RENDERERS) {
        const body = shown(empty[renderer]);
        const where = `${renderer} ${context}, a revoked grant with no terms recorded`;
        expect(body, where).toContain('Marlow Yoga');
        expect(body, where).not.toMatch(/Not recorded|unavailable|not resolved|\$0\.00/);
        const labels = context === 'form' ? ['Most per use', 'Most per period', 'Uses per period', 'Allowed actions', 'Inside', 'Ends'] : context === 'detail' ? EMPTY_LABELS : ['Ends'];
        for (const label of labels) expect(body, `${where}: "${label}"`).not.toMatch(new RegExp(`${label.replace(/[()]/g, '\\$&')}(?! id)`));
      }
    }
  });

  it('a currency kept without a limit per use draws no limit per use, and a grant with no end says so in its end line', async () => {
    for (const context of ['detail', 'form'] as const) {
      const page = await pages('Consent', context, [monthly]);
      for (const renderer of RENDERERS) {
        const body = shown(page[renderer]);
        expect(body, `${renderer} ${context}`).toContain('$5,000.00');
        expect(body, `${renderer} ${context}`).not.toMatch(/Most per use|\$0\.00/);
        expect(body, `${renderer} ${context}`).toContain('No end: it stands until someone ends it');
        expect(body, `${renderer} ${context}`).not.toContain('End time');
      }
    }
  });

  it('reads the terms and seats on the form with no control, the limits as money, and gives why it ended a control', async () => {
    const schema = await composed('Consent', 'form');
    const nodes = schemaNodes(schema);
    const controls = (field: string) => nodes.filter(node => [node.props?.field, node.props?.amountField].includes(field) && !['Text', 'Stack', 'BillingSummaryBadge'].includes(node.component));
    for (const field of FIELDS.filter(name => name !== 'ended_reason')) expect(controls(field), `${field} is no control`).toEqual([]);
    expect(nodes.filter(node => node.meta?.intent === 'form-fact').map(node => node.children?.find(child => child.meta?.intent === 'read-only-field')).map(node => node?.props?.field ?? node?.props?.amountField))
      // s249-m03: who a requested grant waits on is a fact too, read by its kept name.
      .toEqual(['scope', 'granted_for_name', 'granted_to_name', 'granted_by_name', 'granted_as', 'requested_by_name', 'asked_of_name', 'allowed_actions', 'asks_first_for', 'never_allowed',
        'amount_limit_minor', 'period_limit_minor', 'limit_period', 'uses_per_period', 'conditions', 'ends_note', 'ends_at', 'within_name']);
    expect(controls('ended_reason').map(node => node.component)).toEqual(['Input']);
    expect(controls('ended_reason')[0]!.bindings?.onChange).toBe('handleChange_ended_reason');
    // The record's own name stays the one required, editable input.
    expect(nodes.filter(node => node.props?.field === 'name' && node.component === 'Input')).toHaveLength(1);
    expect(schema.objectSchema?.name?.required).toBe(true);
    const page = await pages('Consent', 'form', [full]);
    for (const renderer of RENDERERS) {
      const html = page[renderer];
      const labels = controlLabels(html);
      expect(labels.filter(label => label.startsWith('Why it ended')), `${renderer}: one control for why it ended (${labels.join(' | ')})`).toHaveLength(1);
      expect(labels.filter(label => label.startsWith('Status')), `${renderer}: the status select`).toHaveLength(1);
      for (const label of ['Covers', 'For', 'Held by', 'Given by', 'Allowed actions', 'Most per use', 'Currency', 'Ends']) expect(labels.filter(text => text === label || text.startsWith(`${label} `)), `${renderer}: no control labelled ${label}`).toEqual([]);
      inOrder(shown(html), ['Covers', 'Resend returned transfers', 'For', 'Tidewater Co-op', 'Held by', 'Billing Agent', 'Given by', 'Ruth Adeyemi', 'Most per use', '$12,000.00', 'Most per period', '$30,000.00', 'Status'], renderer);
      expect(shown(html), renderer).not.toMatch(/1200000|3000000/);
    }
  });

  it('reads the limits as money on the generated app\'s own form, and a grant with no limit reads none, in React and Vue', async () => {
    const workflow = await composed('Consent', 'workflow');
    const props = (files: GeneratedArtifact['files']) => runGeneratedStore(files, `
const records = store.createStore({ latency: 0 }).list({ pageSize: 1000 }).records;
process.stdout.write(JSON.stringify(records.map(record => ({ ...store.screenProps(record), uiState: 'success' }))));
`) as Array<Record<string, unknown>>;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      const files = result.artifact!.files;
      const records = props(files);
      const limited = records.find(record => record.amountLimitMinor === 1200000);
      const unlimited = records.find(record => record.name === 'Marlow Yoga class bookings');
      expect(limited, framework).toBeTruthy();
      expect(unlimited, framework).toBeTruthy();
      const actions = result.artifact!.actions.map(({ name }: { name: string }) => name);
      const screen = { entry: `src/screens/Form.${framework === 'react' ? 'tsx' : 'vue'}`, files };
      const formCode = files.find(file => file.path === screen.entry)!.contents;
      const [withLimit, without] = renderGeneratedModels(framework, formCode, [limited!, unlimited!], actions, screen);
      inOrder(shown(withLimit!), ['Most per use', '$12,000.00', 'Most per period', '$30,000.00'], `${framework} app form`);
      expect(shown(without!), `${framework} app form, no limits`).not.toMatch(/Most per use|Most per period|Period\s*(?:Day|Week|Month|Year)|Uses per period|\$0\.00/);
      // The mark that asks for this is a condition in the code, never an attribute on the page.
      for (const file of files) expect(file.contents, file.path).not.toContain('data-oods-omit-empty');
    }
  });

  it('an import that binds the trait with most fields null and the holder\'s id without its kept name composes list, detail and form; the id shows as the id', async () => {
    const record = composeObject(loadObject('ImportedConsent'));
    expect(Object.keys(record.schema).sort()).toEqual(['client_id', 'expiry_time', 'principal_id', 'scope', 'state']);
    // The kept name was bound to null, so the id's hint to it is gone with it, and nothing throws.
    expect(record.semantics.client_id?.ui_hints).toEqual({ component: 'Text', label: 'Held by' });
    for (const context of ['list', 'detail', 'form'] as const) {
      const schema = await composed('ImportedConsent', context);
      const samples = loadObject('ImportedConsent').samples as Array<Record<string, unknown>>;
      const rows = samples.map(sample => model(schema, sample));
      const established = context === 'list' ? { rows } : model(schema, samples[0]!);
      const sample = { ...seedPreviewModel({ schema, context, object: 'ImportedConsent', established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
      const out = [renderRecordBody(schema, { objectName: 'ImportedConsent', sampleModel: sample } as never)];
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
        expect(result.status, `${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
        out.push(renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name)));
      }
      for (const [index, page] of out.entries()) {
        const where = `${RENDERERS[index]} ${context}`;
        expect(shown(page), where).toMatch(/app:7c41d2/);
        expect(shown(page), where).not.toMatch(/reference not resolved|Held by unavailable/);
      }
    }
  });

  it('the history line names its grant on the generated rail and the detail page, in HTML, React and Vue, and never "approved by" where no one approved', async () => {
    const both = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater Co-op invoices and payments · task: Get INV-2026-0155 paid';
    const alone = 'Billing Agent for Tidewater Co-op · grant: Resend returned transfers';
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
        const where = `${RENDERERS[index]} ${context}`;
        expect(text(page), where).toContain(both);
        expect(text(page), where).toContain(alone);
        expect(text(page), where).not.toMatch(/Tidewater Co-op · approved by Ruth Adeyemi \(level: Approval\) · grant: Resend returned transfers/);
        expect(page, where).not.toMatch(/grt_tidewater_(?:billing|resends)/);
      }
    }
    const workflow = await composed('Host', 'workflow');
    expect(JSON.stringify(workflowSampleData(workflow).records)).toContain('"grant_id":"grt_tidewater_resends"');
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build' } as never);
      expect(result.artifact!.files.filter(file => file.contents.includes('grt_tidewater_resends')).map(file => file.path), framework).toEqual(['src/sample-data.ts']);
    }
  });
});

describe('the HTML history components name the grant, and an entry without the fields prints as in 0.14.0', () => {
  const entry = { title: 'Sent again', from: 'returned', to: 'pending', at: '2026-09-29T09:15:00Z', reason: 'Sent again by bank transfer', actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi', approval_id: 'apr_resend_0429', approval_level: 'approval', task_id: 'tsk_tidewater_0155', task_name: 'Get INV-2026-0155 paid' };
  const granted = { ...entry, grant_id: 'grt_tidewater_billing', grant_name: 'Tidewater Co-op invoices and payments' };
  const audit = (row: Record<string, unknown>) => ({ ...row, from_state: row.from, to_state: row.to, transitioned_at: row.at });
  const html = (history: Record<string, unknown>[]) => renderTree({ version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: [
    { id: 'status', component: 'StatusTimeline', props: { status: 'pending', history } },
    { id: 'audit', component: 'AuditTimeline', props: { auditLog: history.map(audit) } },
    { id: 'summary', component: 'AuditSummaryCard', props: { auditLog: history.map(audit) } },
    { id: 'rows', component: 'StateTransitionEvent', props: { history } },
  ] }] } as UiSchema);

  it('StatusTimeline, AuditTimeline, AuditSummaryCard and the recipe rows print the grant and not its id', () => {
    const page = html([granted]);
    expect(page.match(/Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi \(level: Approval\) · grant: Tidewater Co-op invoices and payments · task: Get INV-2026-0155 paid/g)).toHaveLength(4);
    expect(page).not.toContain('grt_tidewater_billing');
  });

  it('an entry with a grant id and no grant name renders byte for byte as the 0.14.0 entry', () => {
    expect(html([{ ...entry, grant_id: 'grt_tidewater_billing' }])).toBe(html([entry]));
  });
});
