/**
 * s249-m02: the four pages. A detail page of User, Organization, Agent and Grant ends with its related lists, drawn from
 * the same resolved lists (@oods/component-contracts resolveRelatedListRows) alike in React, Vue and HTML, and on a
 * generated app's detail screen from records it copied and its own live store. These specs pin:
 * - for every sample of the four objects, the region says the same words, with the same lists, rows and disclosures, in
 *   all three renderers, and no object that declares no list draws one;
 * - each list is a labelled section with a heading that counts what it names; an empty list names the seat it read; the
 *   page says once what no list can see, and the organization its billing note, and the Under way list its sentence;
 * - generated apps carry related-data.ts and relatedRows only where lists are declared, type-check strictly, list what
 *   the engine lists, label copied records as copied, and read their own object's records from the live store;
 * - the grant's page shows what Interface 4 says: Tidewater's 4 records and 9 lines beside the product's count, the
 *   ended Northwind grant's task under way at its end and now, and Kestrel's parties as they stand.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 600_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, RELATED_COPIED_NOTE } from '@oods/component-contracts';
import { loadObject } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { HTML_INTERACTIONS } from '../../src/render/html-interactions.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedStore } from '../product-reality/render-generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
type Sample = Record<string, any>;
const OBJECTS = ['User', 'Organization', 'Agent', 'Grant'] as const;
const NAME: Record<string, string> = { User: 'name', Organization: 'label', Agent: 'name', Grant: 'name' };
const RENDERERS = ['html', 'react', 'vue'] as const;
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
/** Every text node's words, joined by spaces, as the HTML cells' measure reads a page (s215-html-measure.ts). */
const textOf = (node: Node): string => {
  const pieces: string[] = [];
  const visit = (current: Node) => { if (current.nodeType === 3) { if (current.textContent?.trim()) pieces.push(current.textContent); return; } current.childNodes.forEach(visit); };
  visit(node);
  return words(pieces.join(' '));
};
const samplesOf = (object: string) => (loadObject(object).samples ?? []) as Sample[];

/** What a page's related region says and holds, read the same way from each renderer's markup. */
function region(html: string) {
  const document = new JSDOM(html).window.document;
  const area = document.querySelector('[data-oods-collection="related"]');
  if (!area) return undefined;
  const sections = [...area.querySelectorAll('section.oods-related')];
  return {
    text: textOf(area),
    lists: sections.map(section => ({
      id: section.getAttribute('data-oods-list'),
      heading: textOf(section.querySelector('h2')!),
      labelled: section.getAttribute('aria-labelledby') === section.querySelector('h2')?.id,
      rows: section.querySelectorAll(':scope li.oods-related-row').length,
      disclosures: section.querySelectorAll('details').length,
      links: section.querySelectorAll('a').length,
      buttons: section.querySelectorAll('button').length,
    })),
    notes: [...area.querySelectorAll(':scope > .oods-related-note')].map(note => textOf(note)),
  };
}

const composed: Record<string, UiSchema> = {};
const workflows: Record<string, UiSchema> = {};
const code: Record<string, Record<'react' | 'vue', { code: string; actions: string[] }>> = {};
beforeAll(async () => {
  for (const object of OBJECTS) {
    composed[object] = (await compose({ object, context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    workflows[object] = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    code[object] = {} as never;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: composed[object], framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(result.status, `${object} ${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      code[object]![framework] = { code: result.code, actions: result.artifact.actions.map(action => action.name) };
    }
  }
});

/** The detail page of one record, in each renderer, seeded as the cells seed a record and given its resolved lists. */
function pages(object: string, record: Sample) {
  const schema = composed[object]!;
  const seeded = workflowSampleRecords(workflows[object]!).find(row => row[NAME[object]!] === record[NAME[object]!])!;
  const established = Object.fromEntries(Object.entries(seeded).map(([field, value]) => [snakeToCamel(field), value]));
  const model = { ...seedPreviewModel({ schema, context: 'detail', object, established }), related: resolveRelatedLists(object, record) };
  return {
    html: renderRecordBody(schema, { objectName: object, sampleModel: model } as never),
    react: renderGenerated('react', code[object]!.react.code, model, code[object]!.react.actions),
    vue: renderGenerated('vue', code[object]!.vue.code, model, code[object]!.vue.actions),
  };
}

describe('the region draws the same lists, rows and words in React, Vue and HTML', () => {
  it.each(OBJECTS)('every %s sample', object => {
    const declared = loadObject(object).metadata.relatedLists!.map(list => list.id);
    for (const record of samplesOf(object)) {
      const name = String(record[NAME[object]!]);
      const drawn = Object.fromEntries(Object.entries(pages(object, record)).map(([renderer, html]) => [renderer, region(html)]));
      const resolved = resolveRelatedLists(object, record);
      for (const renderer of RENDERERS) {
        const page = drawn[renderer]!;
        expect(page, `${object} ${name} ${renderer}`).toBeDefined();
        // Each list is a labelled section headed by what it names and how many, in the declared order; a list that applies
        // only once its record has ended ("Recorded after it ended") is left out until then.
        const applying = resolved.filter(list => list.applies);
        expect(page.lists.map(list => list.id), `${object} ${name} ${renderer}`).toEqual(declared.filter(id => applying.some(list => list.id === id)));
        expect(page.lists.map(list => list.heading)).toEqual(applying.map(list => list.heading));
        expect(page.lists.every(list => list.labelled && list.links === 0 && list.buttons === 0), `${object} ${name} ${renderer}: labelled, no links, no buttons`).toBe(true);
        // Rows past the first five are counted, not drawn; the grants inside a grant are drawn under it.
        expect(page.lists.map(list => list.rows)).toEqual(applying.map(list => list.rows.slice(0, 5).reduce((total, row) => total + 1 + (row.inner?.length ?? 0), 0)));
        // The page says once what no list can see, and no copied note outside a generated app.
        expect(page.notes).toEqual([resolved[0]!.cannotSee]);
        expect(page.text).not.toContain(RELATED_COPIED_NOTE);
        expect(page.text).not.toMatch(/Not recorded|unavailable|not resolved/);
      }
      expect(drawn.react!.text, `${object} ${name}: React and HTML`).toBe(drawn.html!.text);
      expect(drawn.vue!.text, `${object} ${name}: Vue and HTML`).toBe(drawn.html!.text);
      expect(drawn.react!.lists).toEqual(drawn.html!.lists);
      expect(drawn.vue!.lists).toEqual(drawn.html!.lists);
    }
  });

  it('draws each row\'s badge from its object\'s own status table, as that object\'s record badge reads it', async () => {
    // The table each listed object's own detail page reads for its status badge.
    const ownTable: Record<string, string> = {};
    const tableOf = async (object: string) => {
      if (!ownTable[object]) {
        const schema = (await compose({ object, context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
        const domains = new Set<string>();
        const walk = (node: { component?: string; props?: Record<string, unknown>; children?: unknown[] }): void => {
          if (node.component === 'StatusBadge' && typeof node.props?.domain === 'string') domains.add(node.props.domain);
          (node.children as typeof node[] | undefined)?.forEach(walk);
        };
        schema.screens.forEach(walk);
        expect([...domains], object).toHaveLength(1);
        ownTable[object] = [...domains][0]!;
      }
      return ownTable[object]!;
    };
    let badges = 0;
    for (const object of OBJECTS) for (const record of samplesOf(object)) {
      // The rows as drawn, in document order: each row, then the rows inside it.
      const expected = resolveRelatedLists(object, record).filter(list => list.applies)
        .flatMap(list => list.rows.slice(0, 5).flatMap(row => [row, ...(row.inner ?? [])]));
      for (const row of expected) if (row.state) await tableOf(row.object);
      const drawn = pages(object, record);
      for (const renderer of RENDERERS) {
        const area = new JSDOM(drawn[renderer]).window.document.querySelector('[data-oods-collection="related"]')!;
        const rows = [...area.querySelectorAll('li.oods-related-row')];
        expect(rows.length, `${object} ${record[NAME[object]!]} ${renderer}`).toBe(expected.length);
        rows.forEach((row, index) => {
          const want = expected[index]!;
          const badge = row.querySelector(':scope > .oods-related-title [data-oods-component="StatusBadge"]');
          if (!want.state) { expect(badge).toBeNull(); return; }
          const presentation = getStatusPresentation(ownTable[want.object]!, want.state);
          const at = `${object} ${record[NAME[object]!]} ${renderer}: ${want.object} "${want.title}" ${want.state}`;
          expect(badge?.getAttribute('title'), at).toBe(presentation.description);
          if (badge?.hasAttribute('data-tone')) expect(badge.getAttribute('data-tone'), at).toBe(presentation.tone);
          badges += 1;
        });
      }
    }
    // An active grant's row is described as active, not as a paid subscription (the table every badge once fell back to).
    expect(badges).toBeGreaterThan(30);
    expect(Object.keys(ownTable).sort()).toEqual(expect.arrayContaining(['Agent', 'Grant', 'Task']));
    expect(getStatusPresentation('lifecycle', 'active').description).not.toMatch(/Subscription/);
  });

  it('draws no region for an object that declares no list, and none when a screen is given no lists', async () => {
    for (const object of ['Task', 'Approval', 'Transaction', 'Subscription']) {
      const schema = (await compose({ object, context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
      expect(JSON.stringify(schema), object).not.toContain('"source":"related"');
    }
    for (const object of OBJECTS) for (const context of ['list', 'form', 'timeline', 'card', 'inline'] as const) {
      const schema = (await compose({ object, context, options: { transient: true } } as never) as { schema: UiSchema }).schema;
      expect(JSON.stringify(schema), `${object} ${context}`).not.toContain('"source":"related"');
    }
    const schema = composed.Organization!;
    const established = Object.fromEntries(Object.entries(workflowSampleRecords(workflows.Organization!)[0]!).map(([field, value]) => [snakeToCamel(field), value]));
    const model = { ...seedPreviewModel({ schema, context: 'detail', object: 'Organization', established }), related: [] };
    expect(region(renderRecordBody(schema, { objectName: 'Organization', sampleModel: model } as never))).toBeUndefined();
    expect(region(renderGenerated('react', code.Organization!.react.code, model, code.Organization!.react.actions))).toBeUndefined();
    expect(region(renderGenerated('vue', code.Organization!.vue.code, model, code.Organization!.vue.actions))).toBeUndefined();
  });

  it('keeps related rows out of the HTML search, which reads only the list screen\'s rows', () => {
    expect(HTML_INTERACTIONS).toContain('[data-oods-collection="rows"]');
    expect(HTML_INTERACTIONS).not.toContain('related');
    const html = pages('Organization', samplesOf('Organization').find(sample => sample.label === 'Tidewater Co-op')!).html;
    const area = new JSDOM(html).window.document.querySelector('[data-oods-collection="related"]')!;
    expect(area.querySelectorAll('[data-oods-row], [data-oods-collection-list], [data-oods-action]').length).toBe(0);
  });
});

describe('the four pages say what Interface 4 says', () => {
  const page = (object: string, name: string) => region(pages(object, samplesOf(object).find(sample => sample[NAME[object]!] === name)!).html)!;

  // s249-m05 (the fresh read): headings that claim no permission, empty sentences without "by id", the page note in plain
  // words, state words in sentence case, and the grant's "Still under way" read at its end.
  it('the organization lists the agents holding a grant for it, one row per outer grant with the grants inside it, and says what it cannot see', () => {
    const tidewater = page('Organization', 'Tidewater Co-op');
    expect(tidewater.lists.map(list => list.heading)).toEqual(['Grants asked for Tidewater Co-op, not yet answered (0)', 'Agents holding a grant for Tidewater Co-op (1)', 'Recorded on behalf of Tidewater Co-op (4)',
      'Tasks for Tidewater Co-op (1)', 'Approvals for Tidewater Co-op (1)', 'Payments for Tidewater Co-op (1)', 'Ended grants for Tidewater Co-op (0)']);
    expect(tidewater.text).toContain('Tidewater invoices and payments Active Billing Agent · Invoices and payments · 28 Sep: asked for a standing yes to resend returned transfers At the end of 31 Dec 2026, Tauranga time 1 grant inside it Resend returned transfers Active Billing Agent · Resend a payment the bank returned · No uses counted');
    expect(tidewater.text).toContain('Subscriptions, usage and invoices name their customer in words, so they are not listed here.');
    expect(tidewater.notes).toEqual(['These lists show only records here that name Tidewater Co-op by id; records that name Tidewater Co-op only in words, or that another product keeps, are not listed.']);
    // An empty list names the seat it read; a standing list emptied by ended grants says so.
    const northwind = page('Organization', 'Northwind Traders');
    expect(northwind.text).toContain('Agents holding a grant for Northwind Traders (0) No agent holds a grant for Northwind Traders now. 2 other grants for Northwind Traders are asked for or have ended.');
  });

  it('a person sees what waits for their answer, and an agent the grants it holds, or why none now', () => {
    expect(page('User', 'Dana Whitfield').text).toContain('Waiting for Dana Whitfield\'s answer (1) Reply about order NW-2207 Needs input Support Agent Oct 7, 2026, 5:00 PM');
    expect(page('User', 'Ruth Adeyemi').text).toContain('Given for Ruth Adeyemi by someone else (0) No grant was given for Ruth Adeyemi by someone else.');
    expect(page('Agent', 'Support Agent').text).toContain('Grants Support Agent holds (0) Support Agent holds no grant now. 2 other grants to Support Agent are asked for or have ended.');
  });

  it('the grant\'s page shows what was recorded under it beside the product\'s count, what was under way at its end, and its parties now', () => {
    const tidewater = page('Grant', 'Tidewater invoices and payments');
    // "Recorded after it ended" is drawn only once a grant has ended.
    expect(tidewater.lists.map(list => list.id)).toEqual(['inside', 'replaced-by', 'recorded', 'under-way', 'parties']);
    expect(page('Grant', 'Northwind customer replies').lists.map(list => list.id)).toEqual(['inside', 'replaced-by', 'recorded', 'under-way', 'after-end', 'parties']);
    const recorded = resolveRelatedLists('Grant', samplesOf('Grant')[0]!).find(list => list.id === 'recorded')!;
    expect([recorded.rows.length, recorded.lineCount, recorded.beside]).toEqual([4, 9, 'Your product counts 6 uses.']);
    expect(tidewater.text).toContain('Recorded under it (4) Your product counts 6 uses.');
    // Where a grant holds no count, the sentence is left out, never "0 uses".
    for (const name of ['Marlow Yoga class bookings', 'Northwind spring order replies']) expect(page('Grant', name).text, name).not.toMatch(/Your product counts|0 uses/);
    const replies = page('Grant', 'Northwind customer replies');
    expect(replies.text).toContain('Still under way (1) Reply about order NW-2207 Needs input When the grant ended: needs input. Now: needs input. 2 lines Started · Oct 6, 2026, 2:00 PM');
    expect(replies.text).toContain('These are only the records here that name this grant; work under it elsewhere is not shown.');
    // Foundry's own words for what was under way never say it closed, stopped or was done (the fixed caution aside).
    for (const grant of samplesOf('Grant')) {
      const underWay = resolveRelatedLists('Grant', grant).find(list => list.id === 'under-way')!;
      const own = [underWay.heading, underWay.empty, underWay.filtered, ...underWay.rows.map(row => row.atEndText)].filter(Boolean).join(' ');
      expect(own, String(grant.name)).not.toMatch(/\b(closed|stopped|done|finished)\b/i);
    }
    const kestrel = page('Grant', 'Kestrel overdue invoices');
    expect(kestrel.text).toContain('Its parties now (4) Given by: Grace Okafor Suspended Held by: Collections Agent Paused For: Kestrel Print Co. Active Answers for it: Accounts team A team, named on this grant; no record of its own is here.');
    expect(kestrel.text).toContain('Still under way (0) No record that names this grant is under way. 2 records that name this grant have reached an end.');
  });
});

describe('generated apps list their records\' related records from copied records and their own live store', () => {
  const apps = {} as Record<string, Record<'react' | 'vue', GeneratedArtifact>>;
  beforeAll(async () => {
    for (const object of [...OBJECTS, 'Task']) {
      const workflow = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
      apps[object] = {} as never;
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact; errors?: unknown };
        expect(result.status, `${object} ${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
        apps[object]![framework] = result.artifact;
      }
    }
  });
  const file = (artifact: GeneratedArtifact, path: string) => artifact.files.find(entry => entry.path === path)?.contents;

  it('carry related-data.ts and relatedRows only where the object declares lists, and type-check strictly', () => {
    for (const framework of ['react', 'vue'] as const) {
      for (const object of OBJECTS) {
        const artifact = apps[object]![framework];
        expect(file(artifact, 'src/related-data.ts'), `${object} ${framework}`).toContain('export const relatedLists: RelatedList[]');
        expect(file(artifact, 'src/store.ts')).toContain('export function relatedRows(');
        const result = typecheckWorkflow(artifact);
        expect(result.status, `${object} ${framework}: ${result.stdout}${result.stderr}`).toBe(0);
      }
      expect(file(apps.Task![framework], 'src/related-data.ts')).toBeUndefined();
      expect(file(apps.Task![framework], 'src/store.ts')).not.toContain('relatedRows');
      expect(file(apps.Task![framework], 'src/application.ts')).not.toContain('related');
    }
  });

  it('list what the engine lists for every sample, and label the lists that read other objects\' records as copied', () => {
    for (const object of OBJECTS) {
      const out = runGeneratedStore(apps[object]!.react.files, `
const s = store.createStore({ latency: 0 });
const all = s.list({ pageSize: 1000 }).records;
process.stdout.write(JSON.stringify(all.map((record) => ({ record, related: s.related(record) }))));
`) as Array<{ record: Sample; related: ReturnType<typeof resolveRelatedLists> }>;
      expect(out).toHaveLength(samplesOf(object).length);
      for (const { record, related } of out) {
        const engine = resolveRelatedLists(object, samplesOf(object).find(sample => sample[NAME[object]!] === record[NAME[object]!])!);
        const strip = (lists: typeof engine) => lists.map(({ copied: _copied, warnings: _warnings, ...list }) => list);
        expect(strip(related), `${object} ${String(record[NAME[object]!])}`).toEqual(strip(engine));
        for (const list of related) {
          const readsOthers = loadObject(object).metadata.relatedLists!.find(declared => declared.id === list.id)!.sources.some(source => (Array.isArray(source.from) ? source.from : [source.from]).some(from => from !== object));
          expect(list.copied, `${object} ${list.id}`).toBe(readsOthers ? RELATED_COPIED_NOTE : undefined);
        }
      }
    }
  });

  it('in the Grant app, Grants inside it reads the live store: ending the standing yes through update shows it ended on its outer grant\'s page', () => {
    const out = runGeneratedStore(apps.Grant!.react.files, `
const s = store.createStore({ latency: 0, now: () => '2026-11-20T09:00:00.000Z' });
const all = s.list({ pageSize: 1000 }).records;
const outer = all.find((record) => record.name === 'Tidewater invoices and payments');
const inner = all.find((record) => record.name === 'Resend returned transfers');
const before = s.related(outer);
s.update({ ...inner, status: 'revoked', ended_reason: 'No longer needed' });
const after = s.related(s.get(String(outer.grant_id)));
process.stdout.write(JSON.stringify({ outer: s.get(String(outer.grant_id)), before, after }));
`) as { outer: Sample; before: ReturnType<typeof resolveRelatedLists>; after: ReturnType<typeof resolveRelatedLists> };
    const inside = (lists: ReturnType<typeof resolveRelatedLists>) => lists.find(list => list.id === 'inside')!;
    expect(inside(out.before).rows.map(row => [row.title, row.state])).toEqual([['Resend returned transfers', 'active']]);
    expect(inside(out.after).rows.map(row => [row.title, row.state])).toEqual([['Resend returned transfers', 'revoked']]);
    expect(inside(out.after).copied).toBeUndefined();
    // The outer grant's own page, drawn by the generated Detail screen with the app's props, shows it ended.
    for (const framework of ['react', 'vue'] as const) {
      const detail = apps.Grant![framework].files.find(entry => entry.path === `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`)!;
      const props = { ...Object.fromEntries(Object.entries(out.outer).map(([key, value]) => [snakeToCamel(key), value])), related: out.after, uiState: 'success' };
      const [html] = renderGeneratedModels(framework, detail.contents, [props], apps.Grant![framework].actions.map(action => action.name), { entry: detail.path, files: apps.Grant![framework].files });
      const drawn = region(html!)!;
      expect(drawn.text, framework).toContain('Grants inside it (1) Resend returned transfers Revoked');
      expect(drawn.notes, framework).toEqual([RELATED_COPIED_NOTE, 'These lists show only records here that name Tidewater invoices and payments by id; records that name Tidewater invoices and payments only in words, or that another product keeps, are not listed.']);
    }
  });
});
