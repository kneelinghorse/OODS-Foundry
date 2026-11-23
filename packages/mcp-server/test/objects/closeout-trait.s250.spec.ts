/**
 * s250-m01: core/Closeout, the record trait of what became of the work after something ended (Interface 1). Closure, the
 * third part of the Grant story, composes it for a grant that was given and then ended; a team's own revocation or
 * offboarding record can compose it too. These checks encode why each part matters:
 * - every field is written by the product when it reports, so the record composes with any of them missing, and on a
 *   form each is read as a fact with no control: a person never edits what a report says;
 * - who was told and what became of each piece of work are lines of the record's history, not fields, because flat
 *   fields cannot hold several parties each with an instant;
 * - an instant is shown in UTC, labelled so, and no list row or card prints an instant as stored;
 * - a place is not drawn where the record holds no value, since most closures leave most places empty;
 * - it says what it does not do, and a team trait of the same name is refused, as every shipped trait's name is.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearObjectCache, registryIssues } from '../../src/objects/object-loader.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { clearTraitCache, getTraitFilePath, listTraits, loadTrait } from '../../src/objects/trait-loader.js';
import { parameterProblems } from '../../src/objects/parameter-validation.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as objectTool } from '../../src/tools/object.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
/** The words a person sees: no stylesheet, no script. */
const text = (html: string) => (JSDOM.fragment(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).textContent ?? '').replace(/\s+/g, ' ');
/** The labels of a page's controls, as a person reads them beside each control. */
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
const FIELDS = ['closes_id', 'closes_name', 'ended_how', 'ended_at', 'for_id', 'for_name', 'scope', 'summary', 'deadline_at', 'still_works_until', 'still_works_note', 'receipt_sent_at', 'receipt_sent_to_name', 'receipt_channel'];
const INSTANTS = ['ended_at', 'deadline_at', 'still_works_until', 'receipt_sent_at'];
const STATES = ['closing', 'reported_closed', 'still_running', 'not_known', 'failed'];
const RENDERERS = ['html', 'react', 'vue'] as const;
const RAW_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

describe('core/Closeout is a shipped trait', () => {
  it('holds the record\'s fields, every id a plain string, none required, none editable, and no state of its own', () => {
    expect(listTraits()).toContain('Closeout');
    const trait = loadTrait('core/Closeout');
    expect(trait.trait).toMatchObject({ name: 'Closeout', version: '1.0.1', category: 'core' });
    expect(Object.keys(trait.schema)).toEqual(FIELDS);
    for (const field of FIELDS.filter(name => name.endsWith('_id'))) expect(trait.schema[field]!.type, field).toBe('string');
    for (const field of INSTANTS) expect(trait.schema[field]!.type, field).toBe('datetime');
    expect(Object.entries(trait.schema).filter(([, field]) => field.required)).toEqual([]);
    expect(Object.entries(trait.schema).filter(([, field]) => !field.readOnly)).toEqual([]);
    // The record's state is its own lifecycle, through Stateful; who was told is its history, never a field.
    expect(FIELDS.some(field => /status|state|told|notified|parties/.test(field))).toBe(false);
    expect(trait.dependencies).toEqual(['Stateful']);
    expect(trait.parameters).toEqual([]);
  });

  it('ships a parameter schema file, validates with none, and declares a view only where Mandate does', () => {
    const file = path.resolve(import.meta.dirname, '../../../../schemas/traits/closeout.parameters.schema.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    expect(parameterProblems('Closeout', {})).toEqual([]);
    expect(parameterProblems('Closeout', { states: ['a'] })[0]?.message).toMatch(/^Closeout: must NOT have additional properties/);
    const trait = loadTrait('core/Closeout');
    // No timeline or inline view: a timeline view with no position is never drawn and warns (OODS-V120).
    expect(Object.keys(trait.view_extensions)).toEqual(['list', 'card', 'detail', 'form']);
    expect(trait.metadata.regionsUsed).toEqual(Object.keys(trait.view_extensions));
    // A list row and a card place words only, never an instant as stored.
    for (const region of ['list', 'card'] as const) {
      for (const place of trait.view_extensions[region] as Array<{ props: { field: string } }>) expect(INSTANTS, `${region} ${place.props.field}`).not.toContain(place.props.field);
    }
  });

  it('tags itself with compound words, keeps its first sentence short, and says what it does not do', () => {
    const trait = loadTrait('core/Closeout');
    expect(trait.trait.tags!.length).toBeLessThanOrEqual(4);
    for (const tag of trait.trait.tags ?? []) expect(tag, tag).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
    const description = String(trait.trait.description).replace(/\s+/g, ' ').trim();
    const first = description.split(/(?<=\.)\s/)[0]!;
    expect(first).toBe('The record of what became of the work after something ended: what ended, how and when, who it was for, what the record covers and where it stands now.');
    expect(first.length).toBeLessThanOrEqual(180);
    expect(description).toContain('It does not close anything, tell anyone, stop a token, send a receipt or work out whether everything stopped.');
    // "Only a report moves it" is the product's rule to keep: nothing here says OODS Foundry holds it.
    expect(description).toContain('Only a report should move the record, and that rule is your product\'s to keep');
    expect(description).not.toMatch(/OODS Foundry (?:checks|enforces|holds|keeps the rule)/);
  });
});

describe('the record trait composed onto a team\'s own revocation record, in every context where it declares a view', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, traits: process.env.OODS_TRAITS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  const full: Record<string, unknown> = {
    takeback_id: '9c1d2e3f-0000-4000-8000-000000000001', name: 'Take-back of Northwind customer replies', status: 'still_running',
    closes_id: 'grt_northwind_replies', closes_name: 'Northwind customer replies', ended_how: 'Revoked', ended_at: '2026-10-08T16:00:00Z',
    for_id: 'org_northwind', for_name: 'Northwind Traders', scope: 'What the support desk controls', summary: 'One reply still waits on an answer.',
    deadline_at: '2026-10-15T16:00:00Z', still_works_until: '2026-10-09T16:00:00Z', still_works_note: 'Reply drafts already sent may still be opened until 9 Oct.',
    receipt_sent_at: '2026-10-08T16:20:00Z', receipt_sent_to_name: 'Dana Whitfield', receipt_channel: 'Email',
    owner_id: 'usr_dana', owner_type: 'user', owner_name: 'Dana Whitfield', ownership_role: 'Answers for it',
    state_history: [
      { title: 'Opened', from: null, to: 'closing', at: '2026-10-08T16:00:00Z', reason: 'The grant was revoked', actor_name: 'Support desk', actor_kind: 'system' },
      { title: 'Receipt sent', from: null, to: 'closing', at: '2026-10-08T16:20:00Z', reason: 'Sent to Dana Whitfield by email', actor_name: 'Support desk', actor_kind: 'system' },
      { title: 'A reply is still waiting', from: 'closing', to: 'still_running', at: '2026-10-08T16:30:00Z', reason: 'Reply about order NW-2207 waits on an answer', actor_name: 'Support desk', actor_kind: 'system' },
    ],
  };
  const sparse: Record<string, unknown> = {
    takeback_id: '9c1d2e3f-0000-4000-8000-000000000002', name: 'Take-back of Marlow Yoga class bookings', status: 'closing',
    closes_id: 'grt_marlow', closes_name: 'Marlow Yoga class bookings', ended_how: 'Revoked', ended_at: '2026-07-10T08:55:00Z',
    owner_id: 'usr_jonah', owner_type: 'user', owner_name: 'Jonah Marlow', ownership_role: 'Answers for it',
  };
  const EMPTY_LABELS = ['For', 'This record covers', 'Where it stands', 'Waits for answers until', 'May still work until', 'What may still work', 'Receipt sent'];
  const yamlSample = (sample: Record<string, unknown>) => dump([sample]).trimEnd().split('\n').map(line => `  ${line}`).join('\n');

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s250-closeout-'));
    fs.mkdirSync(path.join(home, 'objects'));
    fs.mkdirSync(path.join(home, 'traits'));
    // A team's own record of a take-back: the record trait beside its own lifecycle in Closure's five states and declared
    // order, and Ownerable for the one who answers for it. It has a form, so its status can be changed there, which is
    // why "only a report moves it" is said of the shipped Closure and left to a team's product here.
    fs.writeFileSync(path.join(home, 'objects', 'Takeback.object.yaml'), [
      'object: { name: Takeback, version: 1.0.0, domain: test, description: A test record of what became of the work after a grant was taken back. }',
      'traits:',
      '  - name: core/Closeout',
      '  - name: lifecycle/Stateful',
      `    parameters: { states: [${STATES.join(', ')}], initialState: closing, transitionRules: { closing: [reported_closed, still_running, not_known, failed], still_running: [reported_closed, not_known, failed], not_known: [reported_closed, still_running, failed], reported_closed: [failed], failed: [] } }`,
      '  - name: structural/Ownerable',
      '    parameters: { ownerTypes: [user, team], primaryOwnerType: user }',
      'schema:',
      '  takeback_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What the record is called. }',
      '  owner_name: { type: string, required: false, description: Display name of the person or team that answers for it. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      '  summary: { semantic_type: text.summary, token_mapping: tokenMap(text.body.*), ui_hints: { component: Text, label: Where it stands } }',
      '  owner_id: { semantic_type: ownership.owner.id, token_mapping: tokenMap(ownership.owner.id), ui_hints: { component: OwnerReference, ownerTypeField: owner_type, displayLabelField: owner_name } }',
      // The sparse record is the first sample, so a place it leaves out has no first example for a preview to fall back on.
      'samples:',
      yamlSample(sparse),
      yamlSample(full),
    ].join('\n') + '\n');
    process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
    process.env.OODS_TRAITS_DIR = path.join(home, 'traits');
    process.env.MCP_SCHEMA_STORE_ROOT = home;
    clearTraitCache(); clearObjectCache();
  });
  afterAll(() => {
    for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['OODS_TRAITS_DIR', previous.traits], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  const composed = async (object: string, context: string): Promise<UiSchema> => {
    const result = await compose({ object, context, options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
    expect(result.status, `${object}/${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
    return result.schema;
  };
  const model = (schema: UiSchema, record: Record<string, unknown>) => Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), record[field] ?? null]));
  /** The page each renderer shows for one context and the records given, so a chosen record is the one on the screen. */
  async function pages(context: string, records: Array<Record<string, unknown>>): Promise<Record<(typeof RENDERERS)[number], string>> {
    const schema = await composed('Takeback', context);
    const rows = records.map(record => model(schema, record));
    const established = context === 'list' ? { rows } : model(schema, records[0]!);
    const sample = { ...seedPreviewModel({ schema, context, object: 'Takeback', established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
    const out = { html: renderRecordBody(schema, { objectName: 'Takeback', sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: { actions: Array<{ name: string }> }; errors?: unknown };
      expect(result.status, `${context}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      out[framework] = renderGenerated(framework, result.code, sample, result.artifact.actions.map(({ name }) => name));
    }
    return out;
  }
  const inOrder = (body: string, words: string[], where: string) => {
    let at = 0;
    for (const word of words) { const found = body.indexOf(word, at); expect(found, `${where}: "${word}" after position ${at}`).toBeGreaterThanOrEqual(0); at = found + word.length; }
  };

  it('places its facts on the detail page as labelled rows in the order it declares them, each instant in UTC', async () => {
    const order = ['What ended', 'Northwind customer replies', 'How it ended', 'Revoked', 'When it ended', 'Oct 8, 2026, 4:00 PM UTC', 'For', 'Northwind Traders',
      'This record covers', 'What the support desk controls', 'Where it stands', 'One reply still waits on an answer.', 'Waits for answers until', 'Oct 15, 2026, 4:00 PM UTC',
      'May still work until', 'Oct 9, 2026, 4:00 PM UTC', 'What may still work', 'Reply drafts already sent may still be opened until 9 Oct.',
      'Receipt sent', 'Oct 8, 2026, 4:20 PM UTC', 'Receipt sent to', 'Dana Whitfield', 'Receipt sent by', 'Email'];
    const page = await pages('detail', [full]);
    for (const renderer of RENDERERS) {
      const body = shown(page[renderer]);
      inOrder(body.slice(body.indexOf('What ended')), order, renderer);
      // A reference shows its kept name, never the id the product knows it by; no instant is printed as stored.
      expect(body, renderer).not.toMatch(/grt_northwind_replies|org_northwind/);
      expect(body, renderer).not.toMatch(RAW_INSTANT);
      expect(body, renderer).not.toContain('(UTC)');
      // The shared table's words read on a team's own record in the same state, as its badge's title.
      expect(page[renderer], renderer).toContain('title="Still running: it, or some of the work it covers, is still going."');
    }
  });

  it('places what ended and who it was for on a list row and a card, with no instant printed as stored', async () => {
    for (const context of ['list', 'card'] as const) {
      const page = await pages(context, [full]);
      for (const renderer of RENDERERS) {
        const body = shown(page[renderer]);
        const facts = context === 'list'
          ? ['What ended', 'Northwind customer replies', 'For', 'Northwind Traders']
          : ['Northwind customer replies', 'What ended', 'Northwind Traders', 'For'];
        inOrder(body, ['Take-back of Northwind customer replies', ...facts], `${renderer} ${context}`);
        expect(body, `${renderer} ${context}`).not.toMatch(RAW_INSTANT);
      }
    }
    // The list's summary line is where it stands.
    const list = await pages('list', [full]);
    for (const renderer of RENDERERS) expect(shown(list[renderer]), renderer).toContain('One reply still waits on an answer.');
  });

  it('draws nothing where the record holds no value: on a list row, a card, a detail page and a form, in all three renderers', async () => {
    for (const context of ['list', 'card', 'detail', 'form'] as const) {
      const empty = await pages(context, [sparse]);
      for (const renderer of RENDERERS) {
        const body = shown(empty[renderer]);
        const where = `${renderer} ${context}, a take-back with only what ended recorded`;
        expect(body, where).toContain('Marlow Yoga class bookings');
        expect(body, where).not.toMatch(/Not recorded|unavailable|not resolved/);
        const labels = context === 'list' || context === 'card' ? ['For'] : EMPTY_LABELS;
        for (const label of labels) expect(body, `${where}: "${label}"`).not.toMatch(new RegExp(`\\b${label}\\b(?! id)`));
      }
    }
  });

  it('reads every fact on the form with no control, and the record\'s own name stays the required, editable input', async () => {
    const schema = await composed('Takeback', 'form');
    const nodes = schemaNodes(schema);
    const controls = (field: string) => nodes.filter(node => node.props?.field === field && !['Text', 'Stack'].includes(node.component));
    for (const field of FIELDS) expect(controls(field), `${field} is no control`).toEqual([]);
    expect(nodes.filter(node => node.meta?.intent === 'form-fact').map(node => node.children?.find(child => child.meta?.intent === 'read-only-field')?.props?.field))
      .toEqual(['closes_name', 'ended_how', 'ended_at', 'for_name', 'scope', 'summary', 'deadline_at', 'still_works_until', 'still_works_note', 'receipt_sent_at', 'receipt_sent_to_name', 'receipt_channel']);
    expect(nodes.filter(node => node.props?.field === 'name' && node.component === 'Input')).toHaveLength(1);
    expect(schema.objectSchema?.name?.required).toBe(true);
    const page = await pages('form', [full]);
    for (const renderer of RENDERERS) {
      const labels = controlLabels(page[renderer]);
      // The record's name, and the status a team's own form offers (Stateful places it); no control for any fact.
      expect(labels.filter(label => label.startsWith('Status')), `${renderer}: the status select (${labels.join(' | ')})`).toHaveLength(1);
      for (const label of ['What ended', 'How it ended', 'When it ended', 'For', 'This record covers', 'Where it stands', 'Receipt sent']) {
        expect(labels.filter(text => text === label || text.startsWith(`${label} `)), `${renderer}: no control labelled ${label}`).toEqual([]);
      }
      inOrder(shown(page[renderer]), ['What ended', 'Northwind customer replies', 'How it ended', 'Revoked', 'When it ended', 'Oct 8, 2026, 4:00 PM UTC', 'Status'], renderer);
    }
  });

  it('refuses a team trait named Closeout, so a shipped object keeps composing the shipped one', async () => {
    const before = await composed('Takeback', 'detail');
    fs.writeFileSync(path.join(home, 'traits', 'Closeout.trait.yaml'), [
      '# A team trait reusing the shipped record trait\'s name.',
      'trait: { name: Closeout, version: 1.0.0, description: A team\'s own idea of a closeout., category: core }',
      'schema:',
      '  outcome: { type: string, required: true, description: The outcome. }',
    ].join('\n') + '\n');
    clearTraitCache(); clearObjectCache();
    expect(registryIssues()).toContainEqual(expect.objectContaining({ kind: 'shipped-name', severity: 'error', name: 'Closeout' }));
    expect(getTraitFilePath('Closeout')).toMatch(/traits\/core\/Closeout\.trait\.yaml$/);
    const after = await composed('Takeback', 'detail');
    expect(after).toEqual(before);
    const checked = await objectTool({ action: 'validate', yaml: fs.readFileSync(path.join(home, 'traits', 'Closeout.trait.yaml'), 'utf8') } as never) as { valid: boolean; errors: Array<{ kind: string }> };
    expect(checked.valid).toBe(false);
    expect(checked.errors.map(error => error.kind)).toContain('shipped-name');
    fs.rmSync(path.join(home, 'traits', 'Closeout.trait.yaml'));
    clearTraitCache(); clearObjectCache();
  });
});
