/**
 * s255-m02: core/Remembered, the record trait of what an assistant or an agent keeps about a person (Interface 1). Memory
 * composes it in m03; a team's own memory table can compose it too. These checks encode why each part matters:
 * - a memory is a claim, not a fact, so how it was made is always on the page, and where the product does not say, it
 *   reads "Not known": never as something the person said, on a list row, a card or the detail page, in any renderer,
 *   and a preview of a given memory never fills a fact in from another memory or an enum (settled 7 and 8);
 * - what removing it would leave, and what remains once it is removed, are the product's report, so each reads "Not
 *   reported" where the product says nothing, and each only in the state it belongs to;
 * - a removed memory holds no words, no note on its source and no statement from the person, and shows none of them even
 *   if a product still sends them; its page says who removed it and when (settled 6);
 * - the words never become the name another record keeps for a memory: a reference reads the kept name, and an object
 *   whose records would be named by the words is refused (settled 6);
 * - every fact is written by the product, so a form reads them and edits none; and a team trait named Remembered is
 *   refused, as every shipped trait's name is (settled 1).
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation } from '@oods/component-contracts';
import { clearObjectCache, listObjects, loadObject, registryIssues } from '../../src/objects/object-loader.js';
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
const root = path.resolve(import.meta.dirname, '../../../..');
const FIELDS = ['words', 'kind', 'about_id', 'about_name', 'origin', 'made_by_id', 'made_by_name', 'made_by_kind', 'kept_by_id', 'kept_by_name', 'kept_in', 'kept_for_id', 'kept_for_name', 'kept_for_kind', 'grant_id', 'grant_name', 'source_kind', 'source_id', 'source_note', 'if_source_goes', 'removing_leaves', 'replaced_by_id', 'replaced_by_name', 'expires_at', 'expires_how', 'persons_statement', 'removed_at', 'removed_by_id', 'removed_by_name', 'removed_by_kind', 'remains'];
const INSTANTS = ['expires_at', 'removed_at'];
const STATES = ['active', 'paused', 'replaced', 'removed'];
const RENDERERS = ['html', 'react', 'vue'] as const;
const CONTEXTS = ['list', 'detail', 'timeline', 'card', 'inline'] as const;
const RAW_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ORIGINS = { told: 'Said by the person it is about', inferred: 'Concluded, not said by the person', combined: 'Made from other memories', imported: 'Copied in from another store', added_by_someone_else: 'Added by someone else' };

describe('core/Remembered is a shipped trait', () => {
  it('holds a memory\'s facts, every id a plain string, only who it is about required, none editable, and no state of its own', () => {
    expect(listTraits()).toContain('Remembered');
    expect(listTraits()).toHaveLength(56);
    const trait = loadTrait('core/Remembered');
    expect(trait.trait).toMatchObject({ name: 'Remembered', version: '1.0.0', category: 'core' });
    expect(Object.keys(trait.schema)).toEqual(FIELDS);
    for (const field of FIELDS.filter(name => name.endsWith('_id'))) expect(trait.schema[field]!.type, field).toBe('string');
    for (const field of INSTANTS) expect(trait.schema[field]!.type, field).toBe('datetime');
    // Only the core every record store fills is required (R2): who it is about. When it was made is Timestampable's.
    expect(Object.entries(trait.schema).filter(([, field]) => field.required).map(([name]) => name)).toEqual(['about_id', 'about_name']);
    expect(Object.entries(trait.schema).filter(([, field]) => !field.readOnly)).toEqual([]);
    // The record's state is its own lifecycle, through Stateful; who changed it is its history, never a field.
    expect(FIELDS.some(field => /^(status|state)$|history/.test(field))).toBe(false);
    expect(trait.dependencies).toEqual(['Stateful']);
    expect(trait.parameters).toEqual([]);
    expect(trait.schema.origin!.validation?.enum).toEqual(Object.keys(ORIGINS));
  });

  it('ships a parameter schema file, validates with none, and declares views where Closeout and Mandate do', () => {
    const file = path.join(root, 'schemas/traits/remembered.parameters.schema.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
    expect(fs.readFileSync(path.join(root, 'generated/types/traits/remembered.parameters.ts'), 'utf8')).toContain('export interface RememberedTraitParameters {}');
    expect(parameterProblems('Remembered', {})).toEqual([]);
    expect(parameterProblems('Remembered', { states: ['a'] })[0]?.message).toMatch(/^Remembered: must NOT have additional properties/);
    const trait = loadTrait('core/Remembered');
    // No timeline or inline view: a timeline view with no position is never drawn and warns (OODS-V120).
    expect(Object.keys(trait.view_extensions)).toEqual(['list', 'card', 'detail', 'form']);
    expect(trait.metadata.regionsUsed).toEqual(Object.keys(trait.view_extensions));
    for (const region of ['list', 'card'] as const) {
      for (const place of trait.view_extensions[region] as Array<{ props: { field: string } }>) expect(INSTANTS, `${region} ${place.props.field}`).not.toContain(place.props.field);
    }
  });

  it('declares the origin\'s labels and the words for what a product does not report, with the trait', () => {
    const { semantics } = loadTrait('core/Remembered');
    expect(semantics.origin!.ui_hints).toMatchObject({ label: 'How it was made', enumLabels: ORIGINS, valueLabels: { '': 'Not known' } });
    expect(semantics.removing_leaves!.ui_hints).toMatchObject({ label: 'Removing it would leave', valueLabels: { '': 'Not reported' } });
    expect(semantics.remains!.ui_hints).toMatchObject({ label: 'What remains', valueLabels: { '': 'Not reported' } });
    // Only these three always show; every other place is left undrawn where the record holds no value.
    const always = Object.entries(semantics).filter(([, mapping]) => Object.hasOwn((mapping.ui_hints?.valueLabels ?? {}) as object, '')).map(([field]) => field);
    expect(always).toEqual(['words', 'origin', 'removing_leaves', 'remains']);
    // The words are prose: a heading never takes them (compose/record-label.ts isProseSemantic).
    expect(semantics.words!.semantic_type).toMatch(/\.text$/);
  });

  it('tags itself with compound words, keeps its first sentence short, and says what it does not do', () => {
    const trait = loadTrait('core/Remembered');
    expect(trait.trait.tags!.length).toBeLessThanOrEqual(4);
    for (const tag of trait.trait.tags ?? []) expect(tag, tag).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
    const description = String(trait.trait.description).replace(/\s+/g, ' ').trim();
    const first = description.split(/(?<=\.)\s/)[0]!;
    expect(first).toBe('What an assistant or an agent keeps about a person, as the product that holds it shows it: what it says, who made it and how, the grant it is kept under, and what removing it would leave.');
    expect(first.length).toBeLessThanOrEqual(200);
    expect(description).toContain('A memory is a claim, not a fact');
    expect(description).toContain('OODS Foundry does not store, remove, share or check a memory');
    expect(description).toContain('Removing a memory removes the entry, not what it shaped.');
    // Foundry never says deleted, erased or forgotten in its own voice (settled 6).
    expect(description).not.toMatch(/\b(?:deleted|erased|forgotten)\b/i);
  });
});

describe('the record trait composed onto a team\'s own memory record, in every context Memory uses', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, traits: process.env.OODS_TRAITS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  // The full record comes first, so a preview that fell back on the first sample would show its facts on the others.
  const full: Record<string, unknown> = {
    note_id: 'mem_ruth_pdf', name: 'Memory about Ruth Adeyemi, 14 Oct 2026, 09:12 UTC', status: 'active',
    words: 'Prefers one PDF of all invoices at the end of the month.', kind: 'entry', about_id: 'usr_ruth', about_name: 'Ruth Adeyemi', origin: 'told',
    made_by_id: 'usr_ruth', made_by_name: 'Ruth Adeyemi', made_by_kind: 'person', kept_by_id: 'agt_billing', kept_by_name: 'Billing Agent', kept_in: 'Tidewater support desk',
    kept_for_id: 'org_tidewater', kept_for_name: 'Tidewater Co-op', kept_for_kind: 'organization', grant_id: 'grt_tidewater', grant_name: 'Tidewater billing replies',
    source_kind: 'chat', source_id: 'chat_ruth_1014', source_note: 'A chat on 14 Oct', if_source_goes: 'stays', persons_statement: 'Only for Tidewater invoices, not my own.',
    expires_at: '2027-10-14T09:12:00Z', expires_how: 'hides', removing_leaves: 'Replies it shaped are unchanged. A log of the removal is kept for 30 days.',
    created_at: '2026-10-14T09:12:00Z', updated_at: '2026-10-14T09:12:00Z',
  };
  const unknown: Record<string, unknown> = {
    note_id: 'mem_ruth_late', name: 'Memory about Ruth Adeyemi, 2 Nov 2026, 10:04 UTC', status: 'paused', words: 'Usually pays in the last week of the month.',
    about_id: 'usr_ruth', about_name: 'Ruth Adeyemi', kept_by_id: 'agt_billing', kept_by_name: 'Billing Agent', created_at: '2026-11-02T10:04:00Z', updated_at: '2026-11-02T10:04:00Z',
  };
  const removed: Record<string, unknown> = {
    note_id: 'mem_ruth_old', name: 'Memory about Ruth Adeyemi, 1 Sep 2026, 16:40 UTC', status: 'removed', about_id: 'usr_ruth', about_name: 'Ruth Adeyemi', origin: 'inferred',
    kept_by_id: 'agt_billing', kept_by_name: 'Billing Agent', removed_at: '2026-11-12T08:00:00Z', removed_by_id: 'usr_ruth', removed_by_name: 'Ruth Adeyemi', removed_by_kind: 'person',
    remains: 'A log of the removal is kept until 12 Dec.', created_at: '2026-09-01T16:40:00Z', updated_at: '2026-11-12T08:00:00Z',
  };
  // A product that still sends a removed memory's words: they are shown nowhere.
  const leaky: Record<string, unknown> = { ...removed, note_id: 'mem_ruth_leak', name: 'Memory about Ruth Adeyemi, 3 Sep 2026, 11:00 UTC', remains: undefined,
    words: 'Has two overdue invoices from August.', source_note: 'A chat on 3 Sep', persons_statement: 'They were paid on 4 Sep.', removing_leaves: 'Replies it shaped are unchanged.' };
  const yamlSample = (sample: Record<string, unknown>) => dump([JSON.parse(JSON.stringify(sample))]).trimEnd().split('\n').map(line => `  ${line}`).join('\n');

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s255-remembered-'));
    fs.mkdirSync(path.join(home, 'objects'));
    fs.mkdirSync(path.join(home, 'traits'));
    // A team's own record of what its assistant keeps: the record trait beside a lifecycle in Memory's four states and
    // order, and when it was made through Timestampable. Its name field is a kept name that never takes the words.
    fs.writeFileSync(path.join(home, 'objects', 'Note.object.yaml'), [
      'object: { name: Note, version: 1.0.0, domain: test, description: A test record of what an assistant keeps about a person. }',
      'traits:',
      '  - name: core/Remembered',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [active, paused, replaced, removed], initialState: active, transitionRules: { active: [paused, replaced, removed], paused: [active, replaced, removed], replaced: [removed], removed: [] } }',
      '  - name: lifecycle/Timestampable',
      'schema:',
      '  note_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: The name other records keep for it. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      'metadata: { supportedContexts: [list, detail, timeline, card, inline, form] }',
      'samples:',
      yamlSample(full), yamlSample(unknown), yamlSample(removed), yamlSample(leaky),
    ].join('\n') + '\n');
    // A record that points at a memory: it keeps the memory's name, never its words.
    fs.writeFileSync(path.join(home, 'objects', 'Reply.object.yaml'), [
      'object: { name: Reply, version: 1.0.0, domain: test, description: A test reply that names the memory it was shaped by. }',
      'schema:',
      '  reply_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What the reply is called. }',
      '  memory_id: { type: string, required: false, description: The memory it was shaped by. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      'relationships:',
      '  - { target: Note, via: memory_id, cardinality: many-to-one, label: Shaped by }',
      'samples:',
      '  - { reply_id: rpl_1, name: Reply about the October invoice, memory_id: mem_ruth_pdf }',
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
  async function pages(context: string, records: Array<Record<string, unknown>>, object = 'Note'): Promise<Record<(typeof RENDERERS)[number], string>> {
    const schema = await composed(object, context);
    const rows = records.map(record => model(schema, record));
    const established = context === 'list' ? { rows } : model(schema, records[0]!);
    const sample = { ...seedPreviewModel({ schema, context, object, established }), ...(context === 'list' ? { rows, collectionQuery: { page: 1, pageSize: 10, total: rows.length } } : {}) };
    const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
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

  it('composes in list, detail, timeline, card and inline, alike in React, Vue and HTML', async () => {
    for (const context of CONTEXTS) {
      const page = await pages(context, context === 'list' ? [full, unknown, removed] : [full]);
      const bodies = RENDERERS.map(renderer => shown(page[renderer]).replace(/^Sample data · Connect actions to your application\./, '').replace(/\s+/g, ' ').trim());
      expect(bodies[0]!.length, context).toBeGreaterThan(0);
      for (const name of [full.name as string]) for (const [i, renderer] of RENDERERS.entries()) expect(bodies[i], `${renderer} ${context}`).toContain(name);
    }
  });

  it('places a memory\'s facts on the detail page as labelled rows in the order it declares them, each instant in UTC', async () => {
    const order = ['What it says', 'Prefers one PDF of all invoices at the end of the month.', 'How it was made', 'Said by the person it is about', 'Kept as', 'One entry',
      'About', 'Ruth Adeyemi', 'Made by', 'Ruth Adeyemi', 'Kept by', 'Billing Agent', 'Kept in', 'Tidewater support desk', 'Kept for', 'Tidewater Co-op',
      'Kept under', 'Tidewater billing replies', 'Where it came from', 'A chat on 14 Oct', 'If its source goes', 'This memory stays',
      'The person\'s own statement', 'Only for Tidewater invoices, not my own.', 'Expires', 'Oct 14, 2027, 9:12 AM UTC', 'When it expires', 'It is paused and kept',
      'Removing it would leave', 'Replies it shaped are unchanged. A log of the removal is kept for 30 days.'];
    const page = await pages('detail', [full]);
    for (const renderer of RENDERERS) {
      const body = shown(page[renderer]);
      inOrder(body.slice(body.indexOf('What it says')), order, renderer);
      // A reference shows its kept name, never the id the product knows it by, and the record a memory was made from is
      // named by the note on its source, never its id; no instant is printed as stored.
      expect(body, renderer).not.toMatch(/usr_ruth|agt_billing|org_tidewater|grt_tidewater|chat_ruth_1014/);
      expect(body, renderer).not.toMatch(RAW_INSTANT);
      // What remains belongs to a removed memory only.
      expect(body, renderer).not.toContain('What remains');
    }
  });

  it('reads "Not known" where the product does not say how a memory was made, on a list row, a card and the detail page, never another memory\'s origin', async () => {
    for (const context of ['list', 'card', 'detail'] as const) {
      const page = await pages(context, context === 'list' ? [full, unknown] : [unknown]);
      for (const renderer of RENDERERS) {
        const body = shown(page[renderer]);
        const where = `${renderer} ${context}`;
        expect(body, where).toContain('Usually pays in the last week of the month.');
        expect(body, where).toMatch(/How it was made ?Not known|Not known ?How it was made/);
        // The first sample's facts never stand in for the ones this memory's product did not report.
        if (context !== 'list') {
          expect(body, where).not.toMatch(new RegExp(Object.values(ORIGINS).join('|')));
          expect(body, where).not.toMatch(/Kept as|If its source goes|When it expires|Kept under|Where it came from/);
        } else expect(body.match(/Said by the person it is about/g), where).toHaveLength(1);
        // An origin code is never printed: rows, cards and pages print its label.
        expect(body, where).not.toMatch(/\b(?:told|inferred|added_by_someone_else)\b/);
      }
    }
  });

  it('reads "Not reported" only for what removing it would leave, before it is removed, and what remains, once it is', async () => {
    const open = await pages('detail', [unknown]), gone = await pages('detail', [{ ...removed, remains: undefined }]);
    for (const renderer of RENDERERS) {
      expect(shown(open[renderer]), renderer).toMatch(/Removing it would leave ?Not reported/);
      expect(shown(open[renderer]), renderer).not.toContain('What remains');
      expect(shown(gone[renderer]), renderer).toMatch(/What remains ?Not reported/);
      expect(shown(gone[renderer]), renderer).not.toContain('Removing it would leave');
      // "Not known" is for how it was made only, and the record here says that.
      for (const body of [shown(open[renderer]), shown(gone[renderer])]) {
        expect((body.match(/Not known/g) ?? []).length, renderer).toBeLessThanOrEqual(1);
        expect((body.match(/Not reported/g) ?? []).length, renderer).toBe(1);
      }
    }
    // A list row and a card never say "Not reported": neither places what removing it leaves or what remains.
    for (const context of ['list', 'card'] as const) {
      const page = await pages(context, [unknown]);
      for (const renderer of RENDERERS) expect(shown(page[renderer]), `${renderer} ${context}`).not.toContain('Not reported');
    }
  });

  it('shows a removed memory with no words, no note on its source and no statement, even when a product still sends them', async () => {
    for (const record of [removed, leaky]) {
      for (const context of ['detail', 'card', 'list'] as const) {
        const page = await pages(context, [record]);
        for (const renderer of RENDERERS) {
          const body = shown(page[renderer]);
          const where = `${renderer} ${context} ${record.note_id}`;
          expect(body, where).toContain(record.name as string);
          if (record === leaky && context !== 'detail') continue; // a row or a card shows only what the product sends; see below
          expect(body, where).not.toMatch(/Has two overdue invoices|A chat on 3 Sep|They were paid on 4 Sep|What it says|Where it came from|The person's own statement|Removing it would leave/);
        }
      }
      const detail = await pages('detail', [record]);
      for (const renderer of RENDERERS) {
        inOrder(shown(detail[renderer]), ['How it was made', 'Concluded, not said by the person', 'Removed', 'Nov 12, 2026, 8:00 AM UTC', 'Removed by', 'Ruth Adeyemi', 'What remains'], `${renderer} ${record.note_id}`);
        expect(detail[renderer], renderer).toContain('title="Removed: the product that holds it reports it removed."');
      }
    }
  });

  it('keeps the memory\'s name, never its words, on a record that points at it', async () => {
    for (const context of ['detail', 'list'] as const) {
      const schema = await composed('Reply', context);
      expect(schema.objectSchema?.memory_id?.referenceLabels).toEqual(expect.objectContaining({ mem_ruth_pdf: 'Memory about Ruth Adeyemi, 14 Oct 2026, 09:12 UTC' }));
      expect(JSON.stringify(schema)).not.toMatch(/Prefers one PDF|Usually pays|Has two overdue invoices/);
    }
    const page = await pages('detail', [{ reply_id: 'rpl_1', name: 'Reply about the October invoice', memory_id: 'mem_ruth_pdf' }], 'Reply');
    for (const renderer of RENDERERS) {
      expect(shown(page[renderer]), renderer).toContain('Memory about Ruth Adeyemi, 14 Oct 2026, 09:12 UTC');
      expect(page[renderer], renderer).not.toContain('Prefers one PDF');
    }
  });

  it('refuses an object whose records would be named by a memory\'s words, its note on the source or the person\'s statement', async () => {
    const definition = (semantics: string, schema = '') => [
      'object: { name: Diary, version: 1.0.0, domain: test, description: A test memory record named by its words. }',
      'traits:', '  - name: core/Remembered', '  - name: lifecycle/Stateful', '    parameters: { states: [active, removed], initialState: active }',
      'schema:', '  diary_id: { type: string, required: true, description: Its id. }', schema,
      'semantics:', semantics,
    ].filter(Boolean).join('\n') + '\n';
    for (const [field, words] of [['words', 'words'], ['source_note', 'note on its source'], ['persons_statement', 'statement from the person']] as const) {
      const checked = await objectTool({ action: 'validate', yaml: definition(`  ${field}: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }`) } as never) as { valid: boolean; errors: Array<{ kind: string; path: string; message: string }> };
      expect(checked.valid, field).toBe(false);
      expect(checked.errors, field).toContainEqual(expect.objectContaining({ kind: 'invalid-field', path: `schema.${field}`, message: expect.stringContaining(`Diary's records would be named by ${field}, the memory's ${words}.`) }));
      // The refusal explains each of the three, whichever names the record (s255-m05, the fresh read).
      expect(checked.errors.find(error => error.path === `schema.${field}`)!.message, field).toContain('A memory\'s words, its note on its source and the person\'s statement appear only where the memory itself is shown');
    }
    // Bound to a field of the object's own, the words are followed there.
    const bound = definition('  entry: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }', '  entry: { type: string, required: false, description: What it says. }')
      .replace('  - name: core/Remembered', '  - name: core/Remembered\n    fieldBindings: { words: entry }');
    expect((await objectTool({ action: 'validate', yaml: bound } as never) as { valid: boolean }).valid).toBe(false);
    // A kept name of its own composes.
    const named = await objectTool({ action: 'validate', yaml: definition('  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }', '  name: { type: string, required: true, description: Its kept name. }') } as never) as { valid: boolean; errors: unknown };
    expect(named.valid, JSON.stringify(named.errors)).toBe(true);
  });

  it('reads every fact on a form with no control, and the record\'s own name stays the required, editable input', async () => {
    const schema = await composed('Note', 'form');
    const nodes = schemaNodes(schema);
    const controls = (field: string) => nodes.filter(node => node.props?.field === field && !['Text', 'Stack'].includes(node.component));
    for (const field of FIELDS) expect(controls(field), `${field} is no control`).toEqual([]);
    expect(nodes.filter(node => node.props?.field === 'name' && node.component === 'Input')).toHaveLength(1);
    const page = await pages('form', [full]);
    for (const renderer of RENDERERS) {
      const labels = controlLabels(page[renderer]);
      for (const label of ['What it says', 'How it was made', 'About', 'Made by', 'Kept by', 'Where it came from', 'Removing it would leave']) {
        expect(labels.filter(text => text === label || text.startsWith(`${label} `)), `${renderer}: no control labelled ${label}`).toEqual([]);
      }
      inOrder(shown(page[renderer]), ['What it says', 'Prefers one PDF of all invoices at the end of the month.', 'How it was made', 'Said by the person it is about'], renderer);
    }
  });

  it('refuses a team trait named Remembered, so a shipped object keeps composing the shipped one', async () => {
    const before = await composed('Note', 'detail');
    fs.writeFileSync(path.join(home, 'traits', 'Remembered.trait.yaml'), [
      '# A team trait reusing the shipped record trait\'s name.',
      'trait: { name: Remembered, version: 1.0.0, description: A team\'s own idea of a memory., category: core }',
      'schema:',
      '  fact: { type: string, required: true, description: The fact. }',
    ].join('\n') + '\n');
    clearTraitCache(); clearObjectCache();
    expect(registryIssues()).toContainEqual(expect.objectContaining({ kind: 'shipped-name', severity: 'error', name: 'Remembered' }));
    expect(getTraitFilePath('Remembered')).toMatch(/traits\/core\/Remembered\.trait\.yaml$/);
    expect(await composed('Note', 'detail')).toEqual(before);
    const checked = await objectTool({ action: 'validate', yaml: fs.readFileSync(path.join(home, 'traits', 'Remembered.trait.yaml'), 'utf8') } as never) as { valid: boolean; errors: Array<{ kind: string }> };
    expect(checked.valid).toBe(false);
    expect(checked.errors.map(error => error.kind)).toContain('shipped-name');
    fs.rmSync(path.join(home, 'traits', 'Remembered.trait.yaml'));
    clearTraitCache(); clearObjectCache();
  });
});

describe('the removed state joins the shared tone table, and never reads as a success', () => {
  const table = JSON.parse(fs.readFileSync(path.join(root, 'packages/component-contracts/registry/lifecycle-status-tones.json'), 'utf8')) as { states: Record<string, { tone: string; icon: string; description: string }> };
  it('says it in words that read for any record in that state', () => {
    expect(table.states.removed).toEqual({ tone: 'neutral', icon: 'icon.status.default', description: 'Removed: the product that holds it reports it removed.' });
    const shown = getStatusPresentation('lifecycle', 'removed');
    expect(shown).toMatchObject({ tone: 'neutral', label: 'Removed', description: 'Removed: the product that holds it reports it removed.' });
    expect(shown.iconName).not.toMatch(/success|paid/);
    // The words never name a memory, a person or OODS Foundry, and never say deleted, erased or forgotten.
    expect(shown.description).not.toMatch(/memory|person|foundry|oods|deleted|erased|forgotten/i);
    // Memory's other states keep their shipped entries.
    expect(['active', 'paused', 'replaced'].map(state => table.states[state]!.tone)).toEqual(['info', 'neutral', 'neutral']);
  });

  it('is a state no shipped object rests in but Memory, so no other shipped badge changes', () => {
    // s255-m03: Memory, the seventeenth public object, is the one shipped object with a removed state.
    for (const name of listObjects().filter(object => object !== 'Memory')) {
      const definition = loadObject(name);
      const states = definition.traits.flatMap(trait => Array.isArray(trait.parameters?.states) ? trait.parameters.states as string[] : []);
      expect(states, name).not.toContain('removed');
      for (const sample of definition.samples ?? []) expect(sample.status, `${name} sample`).not.toBe('removed');
    }
    expect(STATES.filter(state => !table.states[state])).toEqual([]);
  });
});
