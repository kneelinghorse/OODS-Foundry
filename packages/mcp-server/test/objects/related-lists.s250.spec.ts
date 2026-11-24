/**
 * s250-m01: what a closure's page needs from the lists declared on the page that shows them (Interface 2). A closure is
 * the record of what became of the work after a grant ended, so its page lists records by its grant's id, not its own,
 * and reads the grant's end, not its own. These specs pin why each piece matters:
 * - `endedAt` names the end a list reads, from a date-time field of the subject: the rows read at that instant ("When the
 *   grant ended: needs input. Now: needs input."), and "after it ended" keeps only what was written after it, whatever
 *   the subject's own state. A subject that holds no instant there has not ended, so it is drawn as one that has not;
 * - `lines` lets a row matched by a top-level field carry its record's whole history: a closure's lines are its history,
 *   and the first is written at the instant its grant ended, so an after-the-end list never filters them by time;
 * - `when: { field: { present: true } }` keeps only records that hold a value, so a request that was never given (no
 *   giver) is kept out of a list that says a grant was given; it is a map, because the bare word "present" is a value a
 *   team's own `when` compares with today, and that must keep its meaning;
 * - a list that reads another field of the subject through `key` matches by that field's id, so its words never say the
 *   records here name the subject: the page's closing sentence and the default empty sentence say "matched by id";
 * - none of this moves a list shipped in 0.16.0 (artifacts/product-reality/sprint-250/m01/related-compare-lists.json).
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as validate } from '../../src/tools/object.validate.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { relatedAppData, resolveRelatedLists } from '../../src/compose/related-records.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
type Sample = Record<string, any>;
const RENDERERS = ['html', 'react', 'vue'] as const;
const NORTHWIND_REPLIES = '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c05';
const NORTHWIND_TRADERS = '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a01';
const KEYED = 'These lists show only records here, matched by id; records named only in words, or that another product keeps, are not listed.';
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const textOf = (node: Node): string => {
  const pieces: string[] = [];
  const visit = (current: Node) => { if (current.nodeType === 3) { if (current.textContent?.trim()) pieces.push(current.textContent); return; } current.childNodes.forEach(visit); };
  visit(node);
  return words(pieces.join(' '));
};
/** What a page's related region says, read the same way from each renderer's markup. */
function region(html: string) {
  const document = new JSDOM(html).window.document;
  const area = document.querySelector('[data-oods-collection="related"]');
  if (!area) return undefined;
  return {
    text: textOf(area),
    lists: [...area.querySelectorAll('section.oods-related')].map(section => ({
      id: section.getAttribute('data-oods-list'), heading: textOf(section.querySelector('h2')!),
      rows: section.querySelectorAll(':scope li.oods-related-row').length,
      lines: [...section.querySelectorAll('details.oods-related-lines li')].map(line => textOf(line)),
    })),
    notes: [...area.querySelectorAll(':scope > .oods-related-note')].map(note => textOf(note)),
  };
}

// The lists a closure's page declares (Interface 3), on a team's own test record that stands in for one (not named Notice:
// "notice" is a word the component selector reads as a banner): it names its grant and its party by id and kept name, and
// keeps the instant the grant ended. It declares no order of its own, so it never
// ends by its own reading: every end these lists read is the grant's.
const UNDER_WAY = { from: ['Task', 'Approval', 'Transaction', 'Grant'], via: 'state_history[].grant_id', key: 'about_id' };
const LISTS = [
  { id: 'ended', label: 'The grant and its party now', empty: 'Neither the grant nor its party is a record here.', sources: [
    { from: 'Grant', key: 'about_id', seat: 'Grant', kept: { name: 'about_name' }, lines: true },
    { from: ['Organization', 'User'], key: 'party_id', seat: 'For', kept: { name: 'party_name' } },
  ] },
  { id: 'under-way', label: 'Still under way when the grant ended', empty: 'No record here that names the grant was under way when it ended.',
    endedAt: { field: 'ended_at', noun: 'grant' }, finality: ['not_final', 'not_known'], sources: [UNDER_WAY] },
  { id: 'after-end', label: 'Recorded under the grant after it ended', empty: 'Nothing here was recorded under the grant after it ended.',
    endedAt: { field: 'ended_at', noun: 'grant' }, afterEnd: true, sources: [UNDER_WAY] },
  // The grant itself, after its end: its row carries every line it holds, the ones before the end too.
  { id: 'grant-after', label: 'The grant, read after it ended', endedAt: { field: 'ended_at', noun: 'grant' }, afterEnd: true, sources: [{ from: 'Grant', key: 'about_id', lines: true }] },
  // The party's grants that were used: a grant holding no last use is left out.
  { id: 'used', label: 'Grants for the party that were used', sources: [{ from: 'Grant', via: 'granted_for_id', key: 'party_id', when: { last_used_at: { present: true } } }] },
];
const wrapup = (lists: unknown = LISTS, schema: Record<string, unknown> = {}) => ({
  object: { name: 'Wrapup', version: '1.0.0', domain: 'team.test', description: 'A test record of what was reported after a grant ended.' },
  traits: [{ name: 'lifecycle/Stateful', parameters: { states: ['open', 'closed'], initialState: 'open' } }],
  schema: {
    wrapup_id: { type: 'uuid', required: true, description: 'Primary identifier.' },
    name: { type: 'string', required: true, description: 'What it is called.' },
    about_id: { type: 'string', required: false, description: 'The grant it is about, by id.' },
    about_name: { type: 'string', required: false, description: 'The grant it is about, as named.' },
    party_id: { type: 'string', required: false, description: 'Who the grant was for, by id.' },
    party_name: { type: 'string', required: false, description: 'Who the grant was for, as named.' },
    ended_at: { type: 'datetime', required: false, description: 'When the grant ended.' },
    noted_on: { type: 'date', required: false, description: 'The day it was noted.' },
    ...schema,
  },
  samples: [
    // Read at the grant's end: the task was waiting on Dana Whitfield then, and is now.
    { wrapup_id: '7a1b2c3d-0000-4000-8000-000000000001', name: 'Wrap-up of Northwind customer replies', status: 'open', about_id: NORTHWIND_REPLIES, about_name: 'Northwind customer replies',
      party_id: NORTHWIND_TRADERS, party_name: 'Northwind Traders', ended_at: '2026-10-08T16:00:00Z', noted_on: '2026-10-08' },
    // Read at an earlier instant, between the task's first line and its question: it was being worked on then.
    { wrapup_id: '7a1b2c3d-0000-4000-8000-000000000002', name: 'Wrap-up read before the question', status: 'open', about_id: NORTHWIND_REPLIES, about_name: 'Northwind customer replies',
      party_id: NORTHWIND_TRADERS, party_name: 'Northwind Traders', ended_at: '2026-10-06T14:05:00Z' },
    // No instant: nothing here says the grant ended.
    { wrapup_id: '7a1b2c3d-0000-4000-8000-000000000003', name: 'Wrap-up with no end', status: 'open', about_id: NORTHWIND_REPLIES, about_name: 'Northwind customer replies', party_id: NORTHWIND_TRADERS, party_name: 'Northwind Traders' },
    // A grant and a party no record here names: the kept names stand in.
    { wrapup_id: '7a1b2c3d-0000-4000-8000-000000000004', name: 'Wrap-up of an outside grant', status: 'open', about_id: 'grt_elsewhere', about_name: 'A grant another product keeps',
      party_id: 'org_elsewhere', party_name: 'Elsewhere Ltd', ended_at: '2026-10-08T16:00:00Z' },
  ],
  metadata: { relatedLists: lists },
});
// A team's own visits, whose attendance is the word "present" or "absent": a `when` that compares the word still compares.
const visits = {
  object: { name: 'Visit', version: '1.0.0', domain: 'team.test', description: 'A test visit to a branch.' },
  traits: [{ name: 'lifecycle/Stateful', parameters: { states: ['booked', 'done'], initialState: 'booked' } }],
  schema: {
    visit_id: { type: 'uuid', required: true, description: 'Primary identifier.' },
    name: { type: 'string', required: true, description: 'What the visit is called.' },
    branch_id: { type: 'string', required: false, description: 'The branch visited, by id.' },
    attendance: { type: 'string', required: false, description: 'Whether the visitor came: present or absent.' },
  },
  samples: [
    { visit_id: '7a1b2c3d-0000-4000-8000-0000000000a1', name: 'Morning visit', status: 'done', branch_id: 'br_1', attendance: 'present' },
    { visit_id: '7a1b2c3d-0000-4000-8000-0000000000a2', name: 'Noon visit', status: 'done', branch_id: 'br_1', attendance: 'absent' },
    { visit_id: '7a1b2c3d-0000-4000-8000-0000000000a3', name: 'Evening visit', status: 'booked', branch_id: 'br_1' },
  ],
};
const branchOf = (when: Record<string, unknown>) => ({
  object: { name: 'Branch', version: '1.0.0', domain: 'team.test', description: 'A test branch.' },
  schema: { branch_id: { type: 'string', required: true, description: 'Primary identifier.' }, name: { type: 'string', required: true, description: 'Branch name.' } },
  samples: [{ branch_id: 'br_1', name: 'Harbour Street' }],
  metadata: { relatedLists: [{ id: 'visits', label: 'Visits to {name}', empty: 'No visit names {name} by id.', sources: [{ from: 'Visit', via: 'branch_id', when }] }] },
});

let home: string;
const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
const reload = () => { clearTraitCache(); clearObjectCache(); };
const put = (name: string, definition: unknown) => { fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), dump(definition)); reload(); };
beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s250-lists-'));
  fs.mkdirSync(path.join(home, 'objects'));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  put('Wrapup', wrapup());
  put('Visit', visits);
});
afterAll(() => {
  for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  reload();
  fs.rmSync(home, { recursive: true, force: true });
});

const samples = () => loadObject('Wrapup').samples as Sample[];
const listOf = (record: Sample, id: string) => resolveRelatedLists('Wrapup', record).find(list => list.id === id)!;

describe('the declaration\'s checks', () => {
  it('accepts every new key as a closure\'s page declares it, and afterEnd with endedAt needs no order of the subject\'s own', async () => {
    const result = await validate({ yaml: dump(wrapup()) });
    expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
    // Without endedAt, a subject with no declared order still cannot say when it ended.
    const without = await validate({ yaml: dump(wrapup([{ ...LISTS[2], endedAt: undefined }])) });
    expect(without.errors.find(error => error.path === 'metadata.relatedLists[0].afterEnd')?.message).toMatch(/needs Wrapup to declare its lifecycle's order, which says when it has ended, or the list to read its end from a date-time field \(endedAt\)/);
  });

  it.each([
    ['endedAt that is not a map', 'ended_at', 'metadata.relatedLists[0].endedAt', /must be a map with field \(a date-time field of Wrapup .*\) and noun/],
    ['a field the subject lacks', { field: 'closed_at', noun: 'grant' }, 'metadata.relatedLists[0].endedAt.field', /"closed_at" is not a field of Wrapup/],
    ['a field that is not a date-time', { field: 'noted_on', noun: 'grant' }, 'metadata.relatedLists[0].endedAt.field', /"noted_on" is a date field, and an end is an instant/],
    ['a text field', { field: 'about_name', noun: 'grant' }, 'metadata.relatedLists[0].endedAt.field', /"about_name" is a string field, and an end is an instant/],
    ['a missing noun', { field: 'ended_at' }, 'metadata.relatedLists[0].endedAt.noun', /must be the words naming what ended/],
    ['a key endedAt does not take', { field: 'ended_at', noun: 'grant', zone: 'UTC' }, 'metadata.relatedLists[0].endedAt.zone', /endedAt takes field and noun/],
  ])('refuses %s, naming its path', async (_name, endedAt, where, says) => {
    const result = await validate({ yaml: dump(wrapup([{ ...LISTS[1], endedAt }])) });
    expect(result.valid).toBe(false);
    const problem = result.errors.find(error => error.path === where);
    expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
    expect(problem!.message).toMatch(says);
  });

  it.each([
    ['lines on a source that reads a history', [{ ...UNDER_WAY, lines: true }], 'metadata.relatedLists[0].sources[0].lines', /reads a history \(state_history\[\]\.grant_id\), so each row already carries the lines that name the subject/],
    ['lines on a source that keeps no history', [{ from: 'Plan', key: 'about_id', lines: true }], 'metadata.relatedLists[0].sources[0].lines', /reads a history, and Plan keeps none/],
    ['lines that is not true or false', [{ from: 'Grant', key: 'about_id', lines: 'all' }], 'metadata.relatedLists[0].sources[0].lines', /must be true or false/],
    ['a when that asks for presence another way', [{ from: 'Grant', via: 'granted_for_id', key: 'party_id', when: { last_used_at: { present: false } } }], 'metadata.relatedLists[0].sources[0].when.last_used_at', /must be one value: text, a number, true or false, null for none, or \{ present: true \} for any value/],
    ['a when map with more than present', [{ from: 'Grant', via: 'granted_for_id', key: 'party_id', when: { last_used_at: { present: true, after: '2026-01-01' } } }], 'metadata.relatedLists[0].sources[0].when.last_used_at', /\{ present: true \} for any value/],
    ['a when map with a word for true', [{ from: 'Grant', via: 'granted_for_id', key: 'party_id', when: { last_used_at: { present: 'yes' } } }], 'metadata.relatedLists[0].sources[0].when.last_used_at', /\{ present: true \} for any value/],
  ])('refuses %s, naming its path', async (_name, sources, where, says) => {
    const result = await validate({ yaml: dump(wrapup([{ id: 'one', label: 'One', sources }])) });
    expect(result.valid).toBe(false);
    const problem = result.errors.find(error => error.path === where);
    expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
    expect(problem!.message).toMatch(says);
  });

  it('accepts lines on a forward lookup and on a source matched by a top-level field', async () => {
    const result = await validate({ yaml: dump(wrapup([{ id: 'one', label: 'One', sources: [{ from: 'Grant', key: 'about_id', lines: true }, { from: 'Grant', via: 'granted_for_id', key: 'party_id', lines: true }] }])) });
    expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
  });
});

describe('a list reads the end it names, whatever the subject\'s own state', () => {
  it('reads each row at the grant\'s end and names the grant in the row\'s sentence', () => {
    const [atEnd] = samples();
    const list = listOf(atEnd!, 'under-way');
    expect(list.endedAt).toBe('2026-10-08T16:00:00Z');
    expect(list.rows.map(row => [row.title, row.stateAtEnd, row.state, row.atEndText])).toEqual([
      ['Reply about order NW-2207', 'needs_input', 'needs_input', 'When the grant ended: needs input. Now: needs input.'],
    ]);
    // Nothing was written under the grant after its end.
    expect(listOf(atEnd!, 'after-end')).toMatchObject({ applies: true, rows: [], heading: 'Recorded under the grant after it ended (0)' });
  });

  it('reads another instant as the end: the row\'s state then, and what was written after it', () => {
    const before = samples()[1]!;
    const under = listOf(before, 'under-way');
    expect(under.rows.map(row => row.atEndText)).toEqual(['When the grant ended: working. Now: needs input.']);
    const after = listOf(before, 'after-end');
    expect(after.applies).toBe(true);
    // Only the task's question, at 14:12, follows the instant; its first line, at 14:00, does not.
    expect(after.rows.map(row => [row.title, row.lines?.map(line => line.title)])).toEqual([['Reply about order NW-2207', ['Asked a question']]]);
  });

  it('draws a subject holding no instant as one that has not ended', () => {
    const none = samples()[2]!;
    const under = listOf(none, 'under-way');
    expect(under.endedAt).toBeUndefined();
    // Read now, with no sentence about an end.
    expect(under.rows.map(row => [row.title, row.state, row.atEndText])).toEqual([['Reply about order NW-2207', 'needs_input', undefined]]);
    expect(listOf(none, 'after-end').applies).toBe(false);
    expect(listOf(none, 'grant-after').applies).toBe(false);
  });

  it('a list without endedAt reads the subject\'s own end, as in 0.16.0', () => {
    const grant = loadObject('Grant').samples!.find(sample => sample.grant_id === NORTHWIND_REPLIES)!;
    const [under] = resolveRelatedLists('Grant', grant).filter(list => list.id === 'under-way');
    expect(under!.rows.map(row => row.atEndText)).toEqual(['When the grant ended: needs input. Now: needs input.']);
  });
});

describe('a row matched by a top-level field carries its record\'s whole history', () => {
  it('carries the grant\'s every line in the row\'s disclosure, and the party\'s row none', () => {
    const list = listOf(samples()[0]!, 'ended');
    const [grant, party] = list.rows;
    expect([grant!.seat, grant!.title, party!.seat, party!.title]).toEqual(['Grant', 'Northwind customer replies', 'For', 'Northwind Traders']);
    const history = loadObject('Grant').samples!.find(sample => sample.grant_id === NORTHWIND_REPLIES)!.state_history as Sample[];
    expect(grant!.lines?.map(line => line.at)).toEqual(history.map(line => line.at));
    expect(grant!.linesText).toBe(`${history.length} lines`);
    expect(party!.lines).toBeUndefined();
    expect(list.lineCount).toBe(history.length);
  });

  it('never filters those lines by time after an end: every line, the ones before it too', () => {
    const [grant] = listOf(samples()[0]!, 'grant-after').rows;
    const history = loadObject('Grant').samples!.find(sample => sample.grant_id === NORTHWIND_REPLIES)!.state_history as Sample[];
    expect(history.every(line => Date.parse(line.at) <= Date.parse('2026-10-08T16:00:00Z'))).toBe(true);
    expect(grant!.lines).toHaveLength(history.length);
  });

  it('shows a seat\'s kept name where no record here matches, with no lines', () => {
    const list = listOf(samples()[3]!, 'ended');
    expect(list.rows.map(row => [row.seat, row.title, row.lines])).toEqual([['Grant', 'A grant another product keeps', undefined], ['For', 'Elsewhere Ltd', undefined]]);
  });

  it('copies the history into a generated app, which type-checks and lists the same rows', async () => {
    const app = relatedAppData('Wrapup')!;
    expect(app.objects.Grant!.records!.every(record => Array.isArray(record.state_history) && record.state_history.length > 0)).toBe(true);
    const workflow = (await compose({ object: 'Wrapup', context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema });
    expect(workflow.status).toBe('ok');
    const result = await generate({ schema: workflow.schema, framework: 'react', profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact; errors?: unknown };
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const data = result.artifact.files.find(file => file.path === 'src/related-data.ts')!.contents;
    expect(data).toContain('"lines": true');
    expect(data).toContain('"endedAt"');
    expect(data).toContain('"present": true');
    // The copied grant keeps its history.
    expect(data).toMatch(/"grant_id": "4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c05",[\s\S]*?"state_history": \[/);
    const checked = typecheckWorkflow(result.artifact);
    expect(checked.status, `${checked.stdout}\n${checked.stderr}`).toBe(0);
  });
});

describe('when can require that a field holds a value, and the word "present" still compares', () => {
  it('keeps only the party\'s grants that hold a last use', () => {
    expect(listOf(samples()[0]!, 'used').rows.map(row => row.title)).toEqual(['Northwind customer replies']);
    // Without the filter, the party's other grant, never used, is listed too.
    put('Wrapup', wrapup([{ ...LISTS[4], sources: [{ from: 'Grant', via: 'granted_for_id', key: 'party_id' }] }]));
    expect(resolveRelatedLists('Wrapup', samples()[0]!)[0]!.rows.map(row => row.title)).toEqual(['Northwind spring order replies', 'Northwind customer replies']);
    put('Wrapup', wrapup());
  });

  it('a when that compares a field with the word "present" keeps only that word', async () => {
    put('Branch', branchOf({ attendance: 'present' }));
    expect((await validate({ yaml: dump(branchOf({ attendance: 'present' })) })).errors).toEqual([]);
    const branch = loadObject('Branch').samples![0]!;
    expect(resolveRelatedLists('Branch', branch)[0]!.rows.map(row => row.title)).toEqual(['Morning visit']);
    put('Branch', branchOf({ attendance: { present: true } }));
    expect(resolveRelatedLists('Branch', branch)[0]!.rows.map(row => row.title)).toEqual(['Morning visit', 'Noon visit']);
    put('Branch', branchOf({ attendance: null }));
    expect(resolveRelatedLists('Branch', branch)[0]!.rows.map(row => row.title)).toEqual(['Evening visit']);
    fs.rmSync(path.join(home, 'objects', 'Branch.object.yaml'));
    reload();
  });
});

describe('a page says what its lists read', () => {
  it('a list that reads another field through key says "matched by id", and its default empty sentence names no one', () => {
    const lists = resolveRelatedLists('Wrapup', samples()[0]!);
    for (const list of lists) expect(list.cannotSee, list.id).toBe(KEYED);
    put('Wrapup', wrapup([{ id: 'plain', label: 'Grants for the party', sources: [{ from: 'Grant', via: 'granted_for_id', key: 'party_id', when: { granted_by_id: 'nobody' } }] }]));
    expect(resolveRelatedLists('Wrapup', samples()[0]!)[0]!.empty).toBe('No record here matches by id.');
    put('Wrapup', wrapup());
  });

  it('draws the page alike in React, Vue and HTML, ending with that sentence, and the grant\'s lines in its row', async () => {
    const schema = (await compose({ object: 'Wrapup', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const code: Record<string, { code: string; actions: string[] }> = {};
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      code[framework] = { code: result.code, actions: result.artifact.actions.map(action => action.name) };
    }
    for (const record of samples()) {
      const established = Object.fromEntries(Object.entries(record).map(([field, value]) => [snakeToCamel(field), value]));
      const model = { ...seedPreviewModel({ schema, context: 'detail', object: 'Wrapup', established }), related: resolveRelatedLists('Wrapup', record) };
      const drawn = {
        html: region(renderRecordBody(schema, { objectName: 'Wrapup', sampleModel: model } as never)),
        react: region(renderGenerated('react', code.react!.code, model, code.react!.actions)),
        vue: region(renderGenerated('vue', code.vue!.code, model, code.vue!.actions)),
      };
      for (const renderer of RENDERERS) {
        expect(drawn[renderer]?.notes, `${record.name} ${renderer}`).toEqual([KEYED]);
        expect(drawn[renderer]!.text, `${record.name} ${renderer}`).not.toMatch(/Not recorded|unavailable|not resolved|name Wrapup/);
      }
      expect(drawn.react, `${record.name}: React and HTML`).toEqual(drawn.html);
      expect(drawn.vue, `${record.name}: Vue and HTML`).toEqual(drawn.html);
      if (record.wrapup_id.endsWith('01')) {
        const ended = drawn.html!.lists.find(list => list.id === 'ended')!;
        expect(ended.heading).toBe('The grant and its party now (2)');
        expect(ended.lines.length).toBe((loadObject('Grant').samples!.find(sample => sample.grant_id === NORTHWIND_REPLIES)!.state_history as Sample[]).length);
        expect(drawn.html!.text).toContain('When the grant ended: needs input. Now: needs input.');
        // No date-time is printed raw in a row.
        expect(drawn.html!.text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      }
      // A wrap-up with no end draws no list that applies only after one.
      if (record.wrapup_id.endsWith('03')) expect(drawn.html!.lists.map(list => list.id)).toEqual(['ended', 'under-way', 'used']);
    }
  });

  it.each([['User', 'name'], ['Organization', 'label'], ['Agent', 'name'], ['Grant', 'name']])('every %s page still ends with the sentence that names its record', (object, field) => {
    for (const record of loadObject(object).samples as Sample[]) {
      const [first] = resolveRelatedLists(object, record).filter(list => list.applies);
      const name = String(record[field]);
      expect(first!.cannotSee, `${object} ${name}`).toBe(`These lists show only records here that name ${name} by id; records that hold the name only in words, or that another product keeps, are not listed.`);
    }
  });
});
