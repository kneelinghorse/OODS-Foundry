import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 180_000 });

/**
 * s249-m03 (Interface 6, "Cancel's behaviour is unchanged"; Interface 10, "objects that declare no order are unchanged").
 * Sprint 249 gives a generated store an actor, declared actions and the declared order. For the three objects that cancel
 * (Subscription, Transaction, Task), this compares the app generated now with 0.15.0's, kept byte for byte in
 * test/fixtures/s249-cancel-before (scripts/product-reality/s249-cancel-before.ts checked each against the composition
 * probe's hash at the planning head):
 * - cancel() writes and says the same for every sample record, from the same seed and clock, ending now or at the
 *   period's end; with an actor it writes the same but for who acted on Cancel's line;
 * - the Cancel bar and its gate on the Detail screen, the CancellationForm and the app's code around it are the same;
 * - every other line of their stores that moves is named here: the actor's type and option, the history entry's actor
 *   fields, the signature each line carries, and, for Task alone, which declares an order, its order and refusals;
 * - an object that declares no order (Subscription, Transaction) saves an edit and any status move as before.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { runGeneratedStore } from '../product-reality/render-generated.js';

const OBJECTS = ['Subscription', 'Transaction', 'Task'] as const;
type Object = typeof OBJECTS[number];
const FIXTURE = fileURLToPath(new URL('../fixtures/s249-cancel-before/', import.meta.url));
const ACTOR = { id: '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d01', name: 'Dana Whitfield', kind: 'person' };
const before = (object: Object, file: string) => fs.readFileSync(path.join(FIXTURE, object, file), 'utf8');
const lines = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'detail-cancel-lines.json'), 'utf8')) as Record<Object, { react: string[]; vue: string[]; chartAssets?: string }>;
// As the fixture script reads them: a line that draws the button comes with the line before it, where React writes its gate.
const cancelLines = (text: string) => text.split('\n').flatMap((line, index, all) => !line.includes('handleCancel') ? []
  : line.includes('data-oods-action="handleCancel"') ? [all[index - 1]!.trim(), line.trim()] : [line.trim()]);
const sha = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

const apps = {} as Record<Object, Record<'react' | 'vue', GeneratedArtifact>>;
const schemas = {} as Record<Object, UiSchema>;
const file = (artifact: GeneratedArtifact, name: string) => artifact.files.find(entry => entry.path === name)?.contents;
/** 0.15.0's store beside the chart assets of today's app, which must be 0.15.0's too. */
const beforeFiles = (object: Object) => {
  const files = ['store.ts', 'sample-data.ts'].map(name => ({ path: `src/${name}`, contents: before(object, `src/${name}`) }));
  const charts = file(apps[object].react, 'src/chart-assets.ts');
  if (lines[object].chartAssets) {
    expect(sha(charts ?? ''), `${object}'s chart assets`).toBe(lines[object].chartAssets);
    files.push({ path: 'src/chart-assets.ts', contents: charts! });
  }
  return files;
};

beforeAll(async () => {
  for (const object of OBJECTS) {
    const composed = await compose({ object, context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(composed.status, object).toBe('ok');
    schemas[object] = composed.schema;
    apps[object] = {} as Record<'react' | 'vue', GeneratedArtifact>;
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: composed.schema, framework, profile: 'build', options: { styling: 'tokens', typescript: true } } as never) as { status: string; artifact: GeneratedArtifact };
      expect(generated.status, `${object} ${framework}`).toBe('ok');
      apps[object][framework] = generated.artifact;
    }
  }
}, 600_000);

/** Every sample record cancelled now and at its period's end, from a fresh store each time: what is written, or why not. */
const CANCEL_SCRIPT = (code: string, actor?: typeof ACTOR) => `
const attempt = (run) => { try { return { record: run() }; } catch (error) { return { refused: String(error.message) }; } };
const fresh = () => store.createStore({ latency: 0, now: () => '2026-11-20T09:00:00.000Z'${actor ? `, actor: ${JSON.stringify(actor)}` : ''} });
const out = [];
for (const record of fresh().list({ pageSize: 1000 }).records.concat(fresh().list({ pageSize: 1000, archived: true }).records)) {
  const id = String(record[store.idField]);
  for (const atPeriodEnd of [false, true]) out.push({ id, atPeriodEnd, result: attempt(() => fresh().cancel(id, 'Budget changed for next year', ${JSON.stringify(code)}, atPeriodEnd)) });
  out.push({ id, empty: true, result: attempt(() => fresh().cancel(id, '', '', false)) });
}
process.stdout.write(JSON.stringify(out));
`;

// Subscription now keeps the id of its named customer. Compare that id with the independent
// Organization record and preserve every historical field and every other store result.
const customers = new Map(loadObject('Organization').samples!.map(row => [row.label, row.organization_id]));
function withCustomerId(record: Record<string, unknown>) {
  const organization_id = customers.get(record.customer_name);
  expect(organization_id, String(record.customer_name)).toBeTypeOf('string');
  return { ...record, organization_id };
}

// Transaction and Task now use the related-row store extension already shipped on User in 0.18.0.
const relatedStoreParts = [
  `import { resolveRelatedListRows, type ResolvedRelatedList } from '@oods/component-contracts';
import { relatedCopied, relatedLists, relatedObjects, relatedOwn } from './related-data';`,
  `/**
 * The record's related lists (metadata.relatedLists), worked out by the same core HTML and the standalone screens use.
 * Records of other objects come from related-data.ts, copied from the samples when this app was made; the app's own
 * records are the store's, so a change made here shows on the page that lists it. Replace this with your own query.
 */
export function relatedRows(record: DomainRecord, records: readonly DomainRecord[]): ResolvedRelatedList[] {
  const objects = { ...relatedObjects, [relatedOwn.name]: { ...relatedOwn, records: records as unknown as Array<Record<string, unknown>> } };
  return relatedLists.map((list) => ({ ...resolveRelatedListRows(list, relatedOwn, record as unknown as Record<string, unknown>, objects), ...(relatedCopied[list.id] ? { copied: relatedCopied[list.id] } : {}) }));
}`,
  '    related(record: DomainRecord) { return relatedRows(record, records); },',
];
function withoutStoreAdditions(object: Object, source: string) {
  const additions = object === 'Subscription' ? [
    '  "organization_id"?: string;\n', '  organizationId: record["organization_id"],\n',
    ',"organization_id":"Organization id"', ',"organization_id":"string"',
  ] : relatedStoreParts;
  for (const addition of additions) {
    expect(source, object).toContain(addition);
    source = source.replace(addition, '');
  }
  return source;
}

// Only a new history line at the comparison clock takes the revised multiword status label.
// Every seeded line, actor, state code, reason and refusal still compares to the historical store.
function expectedHistory<T>(object: Object, results: T): T {
  return JSON.parse(JSON.stringify(results, function (key, value) {
    if (object === 'Subscription' && key === 'record' && value) return withCustomerId(value);
    if (key !== 'title' || this.at !== '2026-11-20T09:00:00.000Z') return value;
    if (this.to === 'past_due' && value === 'Past Due') return 'Past due';
    if (this.to === 'pending_cancellation' && value === 'Pending Cancellation') return 'Pending cancellation';
    return value;
  }));
}

describe("Cancel's behaviour is unchanged for the three objects that cancel (s249-m03, Interface 6)", () => {
  for (const object of OBJECTS) {
    it(`${object}: cancel() preserves the historical result for every sample with current history titles and the acting person's signature`, () => {
      const code = schemas[object].workflow!.data.cancellationReasonCodes?.[0] ?? 'customer_request';
      const old = runGeneratedStore(beforeFiles(object), CANCEL_SCRIPT(code)) as Array<{ result: { record?: Record<string, unknown>; refused?: string } }>;
      const now = runGeneratedStore(apps[object].react.files, CANCEL_SCRIPT(code)) as typeof old;
      expect(now).toEqual(expectedHistory(object, old));
      // Both kinds of result are compared, so the check cannot pass on refusals alone, or on writes alone.
      expect(old.some(entry => entry.result.record), object).toBe(true);
      expect(old.some(entry => entry.result.refused), object).toBe(true);
      const signed = runGeneratedStore(apps[object].react.files, CANCEL_SCRIPT(code, ACTOR)) as typeof old;
      signed.forEach((entry, index) => {
        const record = entry.result.record;
        if (!record) { expect(entry, `${object} ${index}`).toEqual(old[index]); return; }
        const history = record.state_history as Array<Record<string, unknown>>;
        const { actor_id, actor_name, actor_kind, ...line } = history.at(-1)!;
        expect({ actor_id, actor_name, actor_kind }, `${object} ${index}`).toEqual({ actor_id: ACTOR.id, actor_name: ACTOR.name, actor_kind: ACTOR.kind });
        expect({ ...entry, result: { record: { ...record, state_history: [...history.slice(0, -1), line] } } }, `${object} ${index}`).toEqual(expectedHistory(object, old[index]));
      });
    });

    it(`${object}: the Cancel bar and its gate, the CancellationForm and its handlers preserve the historical contract after the notice moved`, () => {
      for (const framework of ['react', 'vue'] as const) {
        const detail = file(apps[object][framework], `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`)!;
        expect(cancelLines(detail), `${object} ${framework}`).toEqual(lines[object][framework]);
      }
      // Sprint 251 places the same notice immediately below navigation in every workflow.
      for (const framework of ['react', 'vue'] as const) {
        const name = framework === 'react' ? 'src/App.tsx' : 'src/App.vue';
        const notice = framework === 'react'
          ? '<p className="workflow-notice" role="status">{state.notice}</p>'
          : '<p class="workflow-notice" role="status">{{ state.notice }}</p>';
        let previous = before(object, name);
        if (object !== 'Subscription') {
          const state = framework === 'react' ? 'state' : 'state.value';
          previous = previous.replace('collectionQuery:', `related: app.related(${state}.draft), collectionQuery:`);
        }
        const withoutNotice = framework === 'react'
          ? previous.replace('    ' + notice + '\n', '')
          : previous.replace('</section>' + notice, '</section>');
        expect(file(apps[object][framework], name)).toBe(withoutNotice.replace('</nav>', '</nav>\n    ' + notice));
      }
      for (const name of ['src/actions.ts', 'src/sample-data.ts']) {
        let expected = before(object, name);
        if (object === 'Subscription' && name === 'src/sample-data.ts') {
          const start = expected.indexOf(' = [') + ' = '.length;
          const samples = JSON.parse(expected.slice(start).trim().slice(0, -1)) as Array<Record<string, unknown>>;
          expected = expected.slice(0, start) + JSON.stringify(samples.map(withCustomerId), null, 2) + ';\n';
        }
        for (const framework of ['react', 'vue'] as const) expect(file(apps[object][framework], name), `${object} ${framework} ${name}`).toBe(expected);
      }
      // s249-m04 (next step 1864 item 1): application.ts moves in one line only, the map of the screens' field nodes, which
      // loses the form controls a form no longer offers (the record's own id, its creation and update instants, its last
      // event); every other line, Cancel's included, is 0.15.0's.
      const fieldMap = (text: string) => JSON.parse(/^const fieldByNodeId: Record<string, string> = (.*);$/m.exec(text)![1]!) as Record<string, string>;
      for (const framework of ['react', 'vue'] as const) {
        const now = file(apps[object][framework], 'src/application.ts')!;
        const old = before(object, 'src/application.ts');
        const strip = (text: string) => text.replace(/^const fieldByNodeId: .*$/m, '');
        // The loading screen clears the notice. A successful save carries it to its destination.
        let expected = old
          .replace('navigate(screen: Screen, id = state.id)', "navigate(screen: Screen, id = state.id, notice = '')")
          .replace('publish({ screen, id, cancelOpen:', "publish({ screen, id, notice: '', cancelOpen:")
          .replace('publish({ records: list.records', 'publish({ notice, records: list.records')
          .replace("publish({ notice: 'Changes saved in this session.' }); await navigate(destination)", "await navigate(destination, state.id, 'Changes saved in this session.')");
        // A refused write keeps the mounted form or Cancel panel. A failed load still offers retry.
        expected = expected.replace(`  async function change(operation: () => DomainRecord, destination: Screen) {
    publish({ uiState: 'loading', error: '' });
    try { await store.ready(); operation(); await navigate(destination, state.id, 'Changes saved in this session.'); }
    catch (error) { publish({ uiState: 'error', error: error instanceof Error ? error.message : String(error) }); }
  }`, `  let changePending = false;
  async function change(operation: () => DomainRecord, destination: Screen, notice = 'Changes saved in this session.') {
    if (changePending) return;
    changePending = true;
    const initial = state;
    let loaded = false;
    try {
      await store.ready();
      if (state !== initial) return;
      loaded = true;
      operation();
      await navigate(destination, state.id, notice);
    } catch (error) {
      if (state === initial) publish({ uiState: loaded ? 'success' : 'error', error: error instanceof Error ? error.message : String(error) });
    } finally { changePending = false; }
  }`).replace('dismissCancellation() { publish({ cancelOpen: false }); }', "dismissCancellation() { publish({ cancelOpen: false, error: '' }); }");
        if (object !== 'Subscription') {
          expected = expected.replace('collectionEvents, type DomainRecord', 'collectionEvents, relatedRows, type DomainRecord')
            .replace('history, collectionEvents };', 'history, collectionEvents, relatedRows };')
            .replace('    retry()', "    /** The shown record's related lists, from the store's live records and the copied ones. */\n    related(record: DomainRecord) { return store.related(record); },\n    retry()");
        }
        expect(strip(now), `${object} ${framework} application.ts`).toBe(strip(expected));
        const removed = Object.entries(fieldMap(old)).filter(([node]) => !Object.hasOwn(fieldMap(now), node));
        expect(Object.fromEntries(Object.entries(fieldMap(old)).filter(([node]) => Object.hasOwn(fieldMap(now), node))), `${object} ${framework}`).toEqual(fieldMap(now));
        expect(removed.length, object).toBeGreaterThan(0);
        for (const [node, field] of removed) expect(node.startsWith('form-') && /^(?:id|\w+_id|created_at|updated_at|last_event|last_event_at)$/.test(field) && (field.endsWith('_id') ? field === `${object.toLowerCase()}_id` : true), `${object} ${node} ${field}`).toBe(true);
      }
    });

    it(`${object}: every other line of its store that moves is named`, () => {
      const old = before(object, 'src/store.ts').split('\n');
      const current = file(apps[object].react, 'src/store.ts')!;
      expect(file(apps[object].vue, 'src/store.ts')).toBe(current);
      const now = withoutStoreAdditions(object, current).split('\n');
      const removed = old.filter(line => !now.includes(line));
      const added = now.filter(line => !old.includes(line));
      const ordered = object === 'Task';
      // s255-m03 (settled 15a): Task and Transaction declare labels their names do not give ("Doing it", "Approvals");
      // Subscription's fields declare none, so its map of labels does not move.
      const relabelled = object !== 'Subscription';
      // The lines that change: the import (the search rule, and Task's order helpers), the options and the history entry,
      // the list's search (s249-m04, one search rule), and the two lines a store writes, an edit's and a cancellation's,
      // which now carry the signature. s255-m03 (settled 15a): the map of field labels, which reads each field's declared
      // label, as the screens do.
      expect(removed.map(line => line.trim())).toEqual([
        expect.stringMatching(/^import \{ recordCollectionEvents, (?:restartedBillingPeriod, )?type CollectionEvent \} from/),
        ...(relabelled ? [expect.stringMatching(/^export const fieldLabels: Record<string, string> = \{/)] : []),
        expect.stringMatching(/^export interface StoreOptions \{ empty\?: boolean; .* seed\?: DomainRecord\[\] \}$/),
        expect.stringMatching(/^export interface HistoryEntry \{ title\?: string; .* atPeriodEnd\?: boolean \}$/),
        expect.stringMatching(/^const entry: HistoryEntry = \{ title: moved/),
        "const search = (query.search ?? '').trim().toLowerCase();",
        expect.stringMatching(/^&& \(!search \|\| Object\.values\(record\)\.some\(\(value\) => String\(value\)\.toLowerCase\(\)\.includes\(search\)\)\);$/),
        expect.stringMatching(/^const entry: HistoryEntry = \{ title: target ===/),
      ]);
      const named: RegExp[] = [
        ordered ? /^import \{ enumOptionLabel, recordCollectionEvents, recordMatchesSearch, declaredMoveRefusal, isFinalState, type CollectionEvent, type DeclaredStateOrder \} from '@oods\/component-contracts';$/
          : /^import \{ enumOptionLabel, recordCollectionEvents, recordMatchesSearch, (?:restartedBillingPeriod, )?type CollectionEvent \} from '@oods\/component-contracts';$/,
        ...(relabelled ? [/^export const fieldLabels: Record<string, string> = \{/] : []),
        /^\/\*\* Who is acting, when the app is told: the store signs each line it writes with them\. Not a viewer: nothing is shown or hidden by it\. \*\/$/,
        /^export interface StoreActor \{ id: string; name: string; kind: 'person' \| 'agent' \| 'system' \}$/,
        /^export interface StoreOptions \{ empty\?: boolean; fail\?: boolean; latency\?: number; now\?: \(\) => string; seed\?: DomainRecord\[\]; actor\?: StoreActor \}$/,
        /^export interface HistoryEntry \{ title\?: string; from: string \| null; to: string; at: string; reason: string; code\?: string; atPeriodEnd\?: boolean; actor_id\?: string; actor_name\?: string; actor_kind\?: string \}$/,
        ...(ordered ? [/^\/\*\* The order this object declares for its states/, /^export const stateOrder: DeclaredStateOrder = \{"not_started":/, /^const stateWords: \{ object: string; labels: Record<string, string> \} = \{"object":"task"/] : []),
        /^ {2}\/\/ s249-m03 \(Interface 8\): told who is acting, the store signs every line it writes with them; told no one, a line names no one\.$/,
        /^ {2}const signature: Pick<HistoryEntry, 'actor_id' \| 'actor_name' \| 'actor_kind'> = options\.actor \? \{ actor_id: options\.actor\.id, actor_name: options\.actor\.name, actor_kind: options\.actor\.kind \} : \{\};$/,
        ...(ordered ? [/^ {4}\/\/ s249-m03 \(Interface 10\): the declared order is kept\./, /^ {4}\/\/ refused\.$/, /^ {4}const moving = changed\.includes\("status"\);$/,
          /^ {4}if \(moving\) \{ const refusal = declaredMoveRefusal\(stateOrder, before\.status, values\.status, stateWords\); if \(refusal\) throw new Error\(refusal\); \}$/] : []),
        /^ {6}const entry: HistoryEntry = \{ title: moved .*, \.\.\.signature \};$/,
        /^ {6}\/\/ One search rule \(recordMatchesSearch\): any text or number at any depth, its history included; never a key name\.$/,
        /^ {10}&& recordMatchesSearch\(record, query\.search\);$/,
        /^ {6}const entry: HistoryEntry = \{ title: enumOptionLabel\(target\).*atPeriodEnd: deferred, \.\.\.signature \};$/,
      ];
      expect(added).toHaveLength(named.length);
      added.forEach((line, index) => expect(line, `${object} line ${index}`).toMatch(named[index]!));
    });
  }
});

/** An edit of the record's title and a move to every declared state, each from a fresh store: what is saved, or why not. */
const UPDATE_SCRIPT = `
const attempt = (run) => { try { return { record: run() }; } catch (error) { return { refused: String(error.message) }; } };
const fresh = () => store.createStore({ latency: 0, now: () => '2026-11-20T09:00:00.000Z' });
const states = [...new Set(fresh().list({ pageSize: 1000 }).records.map((record) => record.status))];
const out = [];
for (const record of fresh().list({ pageSize: 1000 }).records) {
  out.push({ edit: attempt(() => fresh().update({ ...record, [store.titleField]: 'Renamed in the comparison' })) });
  for (const status of states) out.push({ status, result: attempt(() => fresh().update({ ...record, status })) });
}
process.stdout.write(JSON.stringify(out));
`;

describe('an object that declares no order saves as before (s249-m03, Interface 10)', () => {
  for (const object of ['Subscription', 'Transaction'] as const) {
    it(`${object}: an edit and every status move preserve the historical record with current history titles`, () => {
      const old = runGeneratedStore(beforeFiles(object), UPDATE_SCRIPT);
      const now = runGeneratedStore(apps[object].react.files, UPDATE_SCRIPT);
      expect(now).toEqual(expectedHistory(object, old));
      expect((old as unknown[]).length).toBeGreaterThan(10);
    });
  }
});
