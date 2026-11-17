/**
 * s250-m03: where an ending meets its closure, and the person's page inputs of next step 1888. A closure shows where a
 * person looks for it, by id, since a list reads ids only and there is no two-step join:
 * - a grant's page lists its closure once the grant has ended, with the closure's lines; a grant that stands shows no such
 *   list, and one with no closure here (a request declined, a grant that ended with its outer grant, a grant revoked in a
 *   generated app, which writes no closure) says only what the list reads: "No closure here is of this grant.";
 * - the page of the one who answers for a closure (a person's id only) and the page of the party the grant was for each
 *   list their closures, one heading per seat, since one heading cannot be true of both;
 * - the last use shows on a grant's own list row and on three of a person's lists, and reads right where a grant holds
 *   none;
 * - grants given for a person by someone else that stand are kept apart from the ones that ended, each list's empty
 *   sentence true of a person whose such grants have all ended, and the sentence on who may end one names the rule and
 *   claims no check;
 * - a request that was never given is in no list whose heading says gave, held or given.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveRelatedListRows, type RelatedList, type RelatedObject } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { relatedAppData, resolveRelatedLists } from '../../src/compose/related-records.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
type Sample = Record<string, any>;
const RENDERERS = ['html', 'react', 'vue'] as const;
const TIDEWATER = '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c01';
const DANA = '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d01';
const PRIYA = '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d03';
// s250-m05 (the fresh read): a grant that ended with its outer grant gets no closure of its own, though your product may
// name it in words in a line of the outer grant's closure, so the sentence says no closure here is of it.
const NO_CLOSURE = 'No closure here is of this grant.';
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const textOf = (node: Node): string => {
  const pieces: string[] = [];
  const visit = (current: Node) => { if (current.nodeType === 3) { if (current.textContent?.trim()) pieces.push(current.textContent); return; } current.childNodes.forEach(visit); };
  visit(node);
  return words(pieces.join(' '));
};
const samplesOf = (object: string) => (loadObject(object).samples ?? []) as Sample[];
const sample = (object: string, field: string, value: string) => samplesOf(object).find(record => record[field] === value)!;
const listOf = (object: string, record: Sample, id: string) => resolveRelatedLists(object, record).find(list => list.id === id)!;

/** One list of a subject's page, resolved over fixture records added to the shipped ones (as a generated app reads them). */
function withFixtures(subject: string, record: Sample, id: string, fixtures: Record<string, Sample[]>) {
  const app = relatedAppData(subject)!;
  const list = app.lists.find(found => found.id === id)! as unknown as RelatedList;
  const objects: Record<string, RelatedObject> = {};
  for (const [name, object] of Object.entries(app.objects)) objects[name] = { ...object, records: [...(object.records ?? []), ...(fixtures[name] ?? [])] };
  objects[subject] = { ...app.own, records: [...samplesOf(subject), ...(fixtures[subject] ?? [])] };
  return resolveRelatedListRows(list, app.own, record, objects);
}

/** A grant for a party, given by someone (or never given), ended or standing, as a product keeps it. */
const grant = (id: string, fields: Sample, history: Array<[string | null, string, string]>): Sample => ({
  grant_id: id, name: fields.name, scope: fields.scope ?? 'A fixture grant', status: history.at(-1)![1],
  granted_to_id: '6a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a02', granted_to_name: 'Support Agent', granted_to_kind: 'agent', ...fields,
  state_history: history.map(([from, to, at]) => ({ title: to, from, to, at, reason: `Moved to ${to}` })),
  created_at: history[0]![2],
});

describe('a grant\'s page shows its closure once it has ended', () => {
  let code: Record<'react' | 'vue', { code: string; actions: string[] }>;
  let schema: UiSchema;
  let workflow: UiSchema;
  beforeAll(async () => {
    schema = (await compose({ object: 'Grant', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    workflow = (await compose({ object: 'Grant', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    code = {} as typeof code;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact };
      expect(result.status).toBe('ok');
      code[framework] = { code: result.code, actions: result.artifact.actions.map(action => action.name) };
    }
  });
  const pages = (record: Sample) => {
    const seeded = workflowSampleRecords(workflow).find(row => row.grant_id === record.grant_id)!;
    const established = Object.fromEntries(Object.entries(seeded).map(([field, value]) => [snakeToCamel(field), value]));
    const model = { ...seedPreviewModel({ schema, context: 'detail', object: 'Grant', established }), related: resolveRelatedLists('Grant', record) };
    const region = (html: string) => {
      const section = new JSDOM(html).window.document.querySelector('section[data-oods-list="closure"]');
      return section ? { text: textOf(section), lines: section.querySelectorAll('details.oods-related-lines li').length } : undefined;
    };
    return {
      html: region(renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never)),
      react: region(renderGenerated('react', code.react.code, model, code.react.actions)),
      vue: region(renderGenerated('vue', code.vue.code, model, code.vue.actions)),
    };
  };

  it('draws Marlow Yoga class bookings\' closure, not known, with its lines in the row, alike in HTML, React and Vue', () => {
    const drawn = pages(sample('Grant', 'name', 'Marlow Yoga class bookings'));
    for (const renderer of RENDERERS) {
      expect(drawn[renderer], renderer).toEqual(drawn.html);
      expect(drawn[renderer]!.text, renderer).toBe('Its closure (1) Closure of Marlow Yoga class bookings Not known Not known; the booking service did not answer by the deadline. Jul 10, 2026, 8:55 AM UTC 3 lines'
        + ' Opened · Jul 10, 2026, 8:55 AM UTC · Marlow Yoga front desk · Opened when Jonah Marlow revoked the grant: the studio closed'
        + ' Booking service told · Jul 10, 2026, 9:00 AM UTC · Marlow Yoga front desk · Asked the booking service to stop the Scheduling Agent\'s waitlist offers'
        + ' No answer by the deadline · Jul 17, 2026, 8:55 AM UTC · Marlow Yoga front desk · The booking service did not answer by the deadline, so nothing is known');
      expect(drawn[renderer]!.lines, renderer).toBe(3);
    }
  });

  it('shows no such list on a grant that stands', () => {
    for (const name of ['Tidewater invoices and payments', 'Blue Harbor session bookings']) {
      const drawn = pages(sample('Grant', 'name', name));
      for (const renderer of RENDERERS) expect(drawn[renderer], `${renderer} ${name}`).toBeUndefined();
      expect(listOf('Grant', sample('Grant', 'name', name), 'closure').applies).toBe(false);
    }
  });

  it('says only what the list reads on a grant with no closure here: a declined request, and a grant that ended with its outer grant', () => {
    const declined = grant('4d7a9c2e-0000-4000-8000-00000000f001', { name: 'Declined fixture', granted_for_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a01', granted_for_name: 'Northwind Traders' },
      [[null, 'requested', '2026-05-01T10:00:00Z'], ['requested', 'declined', '2026-05-02T10:00:00Z']]);
    const inner = grant('4d7a9c2e-0000-4000-8000-00000000f002', { name: 'Inner fixture', within_id: TIDEWATER, granted_by_id: '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d02' },
      [[null, 'requested', '2026-09-28T21:05:00Z'], ['requested', 'active', '2026-09-28T21:12:00Z'], ['active', 'revoked', '2026-10-30T09:00:00Z']]);
    for (const subject of [declined, inner]) {
      const list = withFixtures('Grant', subject, 'closure', { Grant: [subject] });
      expect(list, subject.name).toMatchObject({ applies: true, rows: [], empty: NO_CLOSURE, heading: 'Its closure (0)' });
    }
  });

  it('in the generated Grant app, revoking the Tidewater grant shows at once that it has no closure here', async () => {
    const app = await generate({ schema: workflow, framework: 'react', profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact };
    expect(app.status).toBe('ok');
    const out = runGeneratedStore(app.artifact.files, `
const s = store.createStore({ latency: 0, now: () => '2026-11-20T09:00:00.000Z' });
const before = s.related(s.get(${JSON.stringify(TIDEWATER)})).find((list) => list.id === 'closure');
s.transition(${JSON.stringify(TIDEWATER)}, 'revoke', 'Moved to the new bank');
const after = s.related(s.get(${JSON.stringify(TIDEWATER)})).find((list) => list.id === 'closure');
process.stdout.write(JSON.stringify({ before: { applies: before.applies }, after: { applies: after.applies, rows: after.rows.length, empty: after.empty, copied: after.copied } }));
`) as { before: { applies: boolean }; after: { applies: boolean; rows: number; empty: string; copied: string } };
    expect(out.before.applies).toBe(false);
    expect(out.after).toEqual({ applies: true, rows: 0, empty: NO_CLOSURE, copied: 'Records of other objects here were copied from the samples when this app was made.' });
    // The app carries the shipped closures as copies, with their lines, and writes none of its own.
    const data = app.artifact.files.find(file => file.path === 'src/related-data.ts')!.contents;
    expect(data).toContain('"Closure of Northwind customer replies"');
    expect(data).toMatch(/"closes_id": "4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c05"/);
  });
});

describe('the party\'s and the answerer\'s pages list their closures', () => {
  const rowsOf = (object: string, field: string, value: string, id: string) => listOf(object, sample(object, field, value), id).rows;

  it('lists two closures on Dana Whitfield\'s and Northwind Traders\' pages and one on Jonah Marlow\'s and Marlow Yoga\'s, each with its name, state, line, the grant\'s end and its lines', () => {
    expect(rowsOf('User', 'name', 'Dana Whitfield', 'closures').map(row => row.title)).toEqual(['Closure of Northwind spring order replies', 'Closure of Northwind customer replies']);
    expect(rowsOf('Organization', 'label', 'Northwind Traders', 'closures').map(row => row.title)).toEqual(['Closure of Northwind spring order replies', 'Closure of Northwind customer replies']);
    expect(rowsOf('User', 'name', 'Jonah Marlow', 'closures').map(row => row.title)).toEqual(['Closure of Marlow Yoga class bookings']);
    expect(rowsOf('Organization', 'label', 'Marlow Yoga', 'closures').map(row => row.title)).toEqual(['Closure of Marlow Yoga class bookings']);
    const [, replies] = rowsOf('User', 'name', 'Dana Whitfield', 'closures');
    expect(replies).toMatchObject({ stateLabel: 'Still running', lineText: 'Still running; the reply about order NW-2207 waits on Dana Whitfield\'s answer.', timeText: 'Oct 8, 2026, 4:00 PM UTC', linesText: '3 lines' });
    // No shipped grant is for a person, so every person's "Closures of grants for" reads its empty sentence.
    for (const user of samplesOf('User')) expect(listOf('User', user, 'closures-for')).toMatchObject({ rows: [], empty: `No closure here is of a grant for ${user.name}.` });
  });

  it('reads a person\'s id only on "Closures {name} answers for", and keeps a closure of a grant for a person under its party, not under its answerer', () => {
    const dana = sample('User', 'name', 'Dana Whitfield');
    const declared = loadObject('User').metadata!.relatedLists!.find(list => list.id === 'closures')!;
    expect(declared.sources[0]!.when).toEqual({ owner_type: 'user' });
    // A team's id that happens to equal Dana's is not read as hers.
    const team = { ...samplesOf('Closure')[2]!, closure_id: '7c3e9b1d-0000-4000-8000-00000000f003', name: 'Closure answered for by a team', owner_type: 'team', owner_id: DANA };
    expect(withFixtures('User', dana, 'closures', { Closure: [team] }).rows.map(row => row.title)).not.toContain('Closure answered for by a team');
    // A grant for Priya Raman, answered for by Dana Whitfield: its closure is under Priya's "Closures of grants for", not her answers-for.
    const priya = sample('User', 'name', 'Priya Raman');
    const forPriya = { ...samplesOf('Closure')[2]!, closure_id: '7c3e9b1d-0000-4000-8000-00000000f004', name: 'Closure of a grant for Priya Raman', for_id: PRIYA, for_name: 'Priya Raman', owner_id: DANA, owner_type: 'user', owner_name: 'Dana Whitfield' };
    expect(withFixtures('User', priya, 'closures-for', { Closure: [forPriya] }).rows.map(row => row.title)).toEqual(['Closure of a grant for Priya Raman']);
    expect(withFixtures('User', priya, 'closures', { Closure: [forPriya] }).rows.map(row => row.title)).toEqual([]);
    expect(withFixtures('User', dana, 'closures', { Closure: [forPriya] }).rows.map(row => row.title)).toContain('Closure of a grant for Priya Raman');
  });
});

describe('next step 1888: the person\'s page inputs', () => {
  it('shows the last use on a grant\'s own list row, and nothing where a grant holds none', async () => {
    const html = String(((await pipeline({ object: 'Grant', context: 'list', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
    const rows = Object.fromEntries([...new JSDOM(html).window.document.querySelectorAll('[data-oods-collection="rows"] [data-oods-row]')].map(row => [JSON.parse((row as HTMLElement).dataset.oodsRow!).name, textOf(row)]));
    expect(rows['Tidewater invoices and payments']).toContain('28 Sep: asked for a standing yes to resend returned transfers Last used for');
    expect(rows['Northwind customer replies']).toContain('6 Oct: asked Dana Whitfield a question about order NW-2207 Last used for');
    for (const name of ['Marlow Yoga class bookings', 'Northwind spring order replies', 'Resend returned transfers']) expect(rows[name], name).not.toContain('Last used for');
  });

  it('shows the last use on a person\'s "gave", "answers for" and "given for" rows, and "No uses counted" where the count is 0', () => {
    const ruth = sample('User', 'name', 'Ruth Adeyemi');
    for (const id of ['gave', 'answers-for']) {
      const [tidewater] = listOf('User', ruth, id).rows;
      expect(tidewater!.lineText, id).toBe('Billing Agent · Tidewater Co-op · Invoices and payments · 28 Sep: asked for a standing yes to resend returned transfers');
      expect(tidewater!.inner![0]!.lineText, id).toBe('Billing Agent · Tidewater Co-op · Resend a payment the bank returned · No uses counted');
    }
    const priya = sample('User', 'name', 'Priya Raman');
    const given = grant('4d7a9c2e-0000-4000-8000-00000000f005', { name: 'Given for Priya fixture', granted_for_id: PRIYA, granted_for_name: 'Priya Raman', granted_by_id: DANA, granted_by_name: 'Dana Whitfield', uses: 1, last_use: '3 Nov: booked a room' },
      [[null, 'requested', '2026-11-01T10:00:00Z'], ['requested', 'active', '2026-11-01T11:00:00Z']]);
    const list = withFixtures('User', priya, 'given-for', { Grant: [given] });
    expect(list.rows.map(row => row.lineText)).toEqual(['Dana Whitfield · Support Agent · A fixture grant · 3 Nov: booked a room']);
    // Who may end one: the rule, in words, and no check claimed.
    expect(list.note).toBe('This list does not change grants. Only someone who may give grants for Priya Raman should end one, on the grant\'s own page; this app does not check who is asking.');
  });

  it('keeps a person\'s grants given by someone else that stand apart from the ones that ended, each empty sentence true when all have ended', () => {
    const priya = sample('User', 'name', 'Priya Raman');
    const ended = grant('4d7a9c2e-0000-4000-8000-00000000f006', { name: 'Ended for Priya fixture', granted_for_id: PRIYA, granted_for_name: 'Priya Raman', granted_by_id: DANA, granted_by_name: 'Dana Whitfield' },
      [[null, 'requested', '2026-10-01T10:00:00Z'], ['requested', 'active', '2026-10-01T11:00:00Z'], ['active', 'revoked', '2026-10-20T11:00:00Z']]);
    const standing = withFixtures('User', priya, 'given-for', { Grant: [ended] });
    const apart = withFixtures('User', priya, 'ended-given-for', { Grant: [ended] });
    expect(standing).toMatchObject({ rows: [], empty: 'No grant given for Priya Raman by someone else stands now.' });
    expect(standing.note).toBeUndefined();
    expect(apart).toMatchObject({ collapsed: true, label: 'Ended grants given for Priya Raman by someone else', empty: 'No grant given for Priya Raman by someone else has ended.' });
    expect(apart.rows.map(row => [row.title, row.state])).toEqual([['Ended for Priya fixture', 'revoked']]);
  });

  it('keeps a request that expired unanswered out of every list whose heading says gave, held or given, on a person\'s and an agent\'s page', () => {
    // Asked by Priya Raman for herself, of the Support Agent; no one gave it, and it expired.
    const request = grant('4d7a9c2e-0000-4000-8000-00000000f007', { name: 'Expired request fixture', granted_for_id: PRIYA, granted_for_name: 'Priya Raman', requested_by_id: PRIYA, requested_by_name: 'Priya Raman', owner_id: PRIYA, owner_type: 'user', owner_name: 'Priya Raman' },
      [[null, 'requested', '2026-10-01T10:00:00Z'], ['requested', 'expired', '2026-10-08T10:00:00Z']]);
    const priya = sample('User', 'name', 'Priya Raman');
    const support = sample('Agent', 'name', 'Support Agent');
    const heading = /gave|held|hold|given/i;
    for (const [object, record] of [['User', priya], ['Agent', support]] as const) {
      for (const list of relatedAppData(object)!.lists) {
        if (!heading.test(list.label)) continue;
        const resolved = withFixtures(object, record, list.id, { Grant: [request] });
        const titles = [...resolved.rows.map(row => row.title), ...resolved.rows.flatMap(row => (row.inner ?? []).map(inner => inner.title))];
        expect(titles, `${object} ${list.label}`).not.toContain('Expired request fixture');
      }
    }
    // The bite: with a giver, the same expired grant is listed as given and held.
    const givenAndExpired = { ...request, granted_by_id: DANA, granted_by_name: 'Dana Whitfield' };
    expect(withFixtures('Agent', support, 'ended-grants', { Grant: [givenAndExpired] }).rows.map(row => row.title)).toContain('Expired request fixture');
    expect(withFixtures('User', priya, 'ended-given-for', { Grant: [givenAndExpired] }).rows.map(row => row.title)).toContain('Expired request fixture');
  });
});
