import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 300_000 });

/**
 * s249-m04 (Interface 12): one search rule in React, Vue and HTML. A list's search finds a record when any string or
 * number value at any depth contains it (its fields, its lists and its history entries), never by a key name. The
 * generated app's store (React and Vue share it) and HTML's own list script must find exactly the records
 * @oods/component-contracts recordMatchesSearch finds, for every object with a list, for searches that name a value, a
 * history line's words and two key names ("name", "actor").
 */
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { recordMatchesSearch } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { OBJECTS, supportsWorkflow } from '../../src/lib/runtime-ledger.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options?: Record<string, unknown>) => { window: Window & typeof globalThis } };
type Row = Record<string, unknown>;
// The objects the runtime ships whose list has a search: every one with a workflow app.
const LISTED = OBJECTS.filter(object => supportsWorkflow(object));

/** The searches for one object: two key names, a word of its first record's title, and a word only its history holds. */
function searchesFor(records: Row[], titleField: string): string[] {
  const title = String(records[0]?.[titleField] ?? '').split(/\s+/).find(word => word.length > 3) ?? '';
  const history = records.flatMap(record => Array.isArray(record.state_history) ? record.state_history as Row[] : [])
    .map(entry => String(entry.reason ?? '')).flatMap(reason => reason.split(/\s+/)).find(word => word.length > 6 && !records.some(record => Object.values(record).some(value => typeof value === 'string' && value.includes(word))));
  return ['name', 'actor', ...(title ? [title.toLowerCase()] : []), ...(history ? [history] : [])];
}

/** The ids HTML's list script shows for a search, page by page, after typing it into the list's search box. */
function htmlFinds(html: string, idField: string, search: string): string[] {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const document = dom.window.document;
  const input = document.querySelector<HTMLInputElement>('[data-oods-control="search"] input');
  if (!input) throw new Error('no search box');
  input.value = search;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const found = new Set<string>();
  for (let page = 0; page < 20; page++) {
    for (const row of document.querySelectorAll<HTMLElement>('[data-oods-collection="rows"] [data-oods-row]')) {
      if (!row.hidden) found.add(String((JSON.parse(row.dataset.oodsRow!) as Row)[snakeToCamel(idField)]));
    }
    const next = [...document.querySelectorAll<HTMLButtonElement>('[data-oods-control="page"] button')].find(button => button.textContent === 'Next page');
    if (!next || next.disabled) break;
    next.click();
  }
  dom.window.close();
  return [...found].sort();
}

const results: Record<string, { idField: string; records: Row[]; searches: string[]; store: Record<string, string[]>; html: Record<string, string[]>; htmlRows: Row[] }> = {};

beforeAll(async () => {
  for (const object of LISTED) {
    const composed = await compose({ object, context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(composed.status, object).toBe('ok');
    const schema = composed.schema;
    const idField = schema.workflow!.data.idField;
    const records = workflowSampleRecords(schema).filter(record => !record.is_archived);
    const titleField = Object.keys(schema.objectSchema ?? {}).find(name => schema.objectSchema![name]!.semanticType === 'text.label') ?? 'name';
    const searches = searchesFor(records, titleField);
    const app = await generate({ schema, framework: 'react', profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact };
    expect(app.status, object).toBe('ok');
    const store = runGeneratedStore(app.artifact.files, `
const s = store.createStore({ latency: 0 });
const out = {};
for (const search of ${JSON.stringify(searches)}) out[search] = s.list({ search, pageSize: 1000 }).records.map((record) => String(record[store.idField])).sort();
process.stdout.write(JSON.stringify(out));`) as Record<string, string[]>;
    const html = String(((await pipeline({ object, context: 'list', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
    const htmlRows = [...new JSDOM(html).window.document.querySelectorAll<HTMLElement>('[data-oods-collection="rows"] [data-oods-row]')].map(row => JSON.parse(row.dataset.oodsRow!) as Row);
    results[object] = { idField, records, searches, store, html: Object.fromEntries(searches.map(search => [search, htmlFinds(html, idField, search)])), htmlRows };
  }
}, 1_800_000);

describe('one search rule finds the same records in React, Vue and HTML (Interface 12)', () => {
  it('covers every object with a list, Grant, Approval and Task among them', () => {
    expect(LISTED).toEqual(expect.arrayContaining(['Grant', 'Approval', 'Task', 'Transaction', 'User']));
    expect(LISTED.length).toBeGreaterThanOrEqual(14);
  });

  it('the store finds exactly the records the rule finds, for every object and search', () => {
    for (const [object, result] of Object.entries(results)) {
      for (const search of result.searches) {
        const expected = result.records.filter(record => recordMatchesSearch(record, search)).map(record => String(record[result.idField])).sort();
        expect(result.store[search], `${object} "${search}"`).toEqual(expected);
      }
    }
  });

  it('HTML\'s list finds what the store finds, on the same records, for every object and search', () => {
    for (const [object, result] of Object.entries(results)) {
      // The rows HTML lists are the store's records, so the two can be compared record for record.
      expect(result.htmlRows.map(row => String(row[snakeToCamel(result.idField)])).sort(), object).toEqual(result.records.map(record => String(record[result.idField])).sort());
      for (const search of result.searches) {
        expect(result.html[search], `${object} "${search}"`).toEqual(result.store[search]);
        const byRule = result.htmlRows.filter(row => recordMatchesSearch(row, search)).map(row => String(row[snakeToCamel(result.idField)])).sort();
        expect(result.html[search], `${object} "${search}" by the rule on HTML's own rows`).toEqual(byRule);
      }
    }
  });

  it('never matches a key name: "name" and "actor" find only records whose words hold them', () => {
    let keyOnly = 0;
    for (const [object, result] of Object.entries(results)) {
      for (const search of ['name', 'actor']) {
        const byKey = result.records.filter(record => JSON.stringify(record).toLowerCase().includes(search)).length;
        keyOnly += byKey - result.store[search]!.length;
        for (const id of result.store[search]!) {
          const record = result.records.find(entry => String(entry[result.idField]) === id)!;
          expect(recordMatchesSearch(record, search), `${object} "${search}" ${id}`).toBe(true);
        }
      }
    }
    // A rule that read keys would have found these records too; the check can tell the two apart.
    expect(keyOnly).toBeGreaterThan(0);
  });

  it('finds a record by its history\'s words, which only the history holds', () => {
    const history = Object.entries(results).filter(([, result]) => result.searches.length > 3);
    expect(history.length).toBeGreaterThan(5);
    for (const [object, result] of history) expect(result.store[result.searches[3]!]!.length, `${object} "${result.searches[3]}"`).toBeGreaterThan(0);
  });
});
