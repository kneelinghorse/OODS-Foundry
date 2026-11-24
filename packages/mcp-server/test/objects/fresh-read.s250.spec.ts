/**
 * s250-m05: what the fresh read before the bump found, held (artifacts/product-reality/sprint-250/m05/fresh-read.md).
 * - A page prints one note under its lists, about every list it draws. A grant's page looks its parties up by the ids the
 *   grant holds ("Its parties now"), so a note that says every list shows records naming the grant was false of that
 *   list: a page with a list that reads another of its record's fields through `key` prints that list's sentence, which
 *   is true of both kinds of list, and every other page still names its record. Alike in HTML, React and Vue.
 * - A row line's validation messages name every form a line item takes, `{ field, except }` among them.
 * - A closure's own lines agree with the records here: a line that says no recorded change names its grant is true.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { dump, load } from 'js-yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as validate } from '../../src/tools/object.validate.js';
import { getObjectFilePath, loadObject } from '../../src/objects/object-loader.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
type Sample = Record<string, any>;
const RENDERERS = ['html', 'react', 'vue'] as const;
const KEYED = 'These lists show only records here, matched by id; records named only in words, or that another product keeps, are not listed.';
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const samplesOf = (object: string) => (loadObject(object).samples ?? []) as Sample[];

describe('the note under a page\'s lists is true of every list it draws', () => {
  const ID: Record<string, string> = { Grant: 'grant_id', User: 'user_id' };
  const drawn: Record<string, { schema: UiSchema; workflow: UiSchema; code: Record<'react' | 'vue', { code: string; actions: string[] }> }> = {};
  beforeAll(async () => {
    for (const object of Object.keys(ID)) {
      const schema = (await compose({ object, context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
      const workflow = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
      const code = {} as Record<'react' | 'vue', { code: string; actions: string[] }>;
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact };
        expect(result.status).toBe('ok');
        code[framework] = { code: result.code, actions: result.artifact.actions.map(action => action.name) };
      }
      drawn[object] = { schema, workflow, code };
    }
  });
  const notes = (object: string, record: Sample) => {
    const { schema, workflow, code } = drawn[object]!;
    const seeded = workflowSampleRecords(workflow).find(row => row[ID[object]!] === record[ID[object]!])!;
    const established = Object.fromEntries(Object.entries(seeded).map(([field, value]) => [snakeToCamel(field), value]));
    const model = { ...seedPreviewModel({ schema, context: 'detail', object, established }), related: resolveRelatedLists(object, record) };
    const read = (html: string) => [...new JSDOM(html).window.document.querySelectorAll('[data-oods-collection="related"] > .oods-related-note')].map(note => words(note.textContent));
    return {
      html: read(renderRecordBody(schema, { objectName: object, sampleModel: model } as never)),
      react: read(renderGenerated('react', code.react.code, model, code.react.actions)),
      vue: read(renderGenerated('vue', code.vue.code, model, code.vue.actions)),
    };
  };

  it('a grant\'s page, whose parties are looked up by the ids the grant holds, says its rows were matched by id', () => {
    for (const record of samplesOf('Grant')) {
      const lists = resolveRelatedLists('Grant', record);
      expect(lists.find(list => list.id === 'parties')!.keyed, record.name).toBe(true);
      expect(lists[0]!.keyed, record.name).toBeUndefined();
      const page = notes('Grant', record);
      for (const renderer of RENDERERS) expect(page[renderer], `${record.name} ${renderer}`).toEqual([KEYED]);
    }
  });

  it('a person\'s page, whose every list reads the person\'s own id, still names the person', () => {
    const record = samplesOf('User').find(user => user.name === 'Dana Whitfield')!;
    expect(resolveRelatedLists('User', record).some(list => list.keyed)).toBe(false);
    const page = notes('User', record);
    for (const renderer of RENDERERS) {
      expect(page[renderer], renderer).toEqual(['These lists show only records here that name Dana Whitfield by id; records that hold the name only in words, or that another product keeps, are not listed.']);
    }
  });
});

describe('a row line\'s messages name every form a line item takes', () => {
  const user = load(fs.readFileSync(getObjectFilePath('User')!, 'utf8')) as Record<string, any>;
  const withLine = (line: unknown) => dump({ ...user, metadata: { ...user.metadata, relatedLists: user.metadata.relatedLists.map((list: any) => list.id === 'sponsors' ? { ...list, sources: [{ ...list.sources[0], row: { line } }] } : list) } });
  const at = 'metadata.relatedLists[5].sources[0].row.line';

  it('a line item that is none of the three forms is told all three', async () => {
    const result = await validate({ yaml: withLine([42]) });
    const problem = result.errors.find(error => error.path === `${at}[0]`);
    expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
    expect(problem!.message).toBe(`${at}[0] must be a field, a field left out for given values ({ field, except }), or fixed words with the values that show them ({ says, when }).`);
  });

  it('a line that is not a list is told what it may list', async () => {
    const result = await validate({ yaml: withLine('acts_for') });
    const problem = result.errors.find(error => error.path === at);
    expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
    expect(problem!.message).toBe(`${at} must be a list of fields, fields left out for given values ({ field, except }) and fixed words ({ says, when }).`);
  });
});

describe('a closure\'s own lines agree with the records here', () => {
  const HISTORIES = ['Task', 'Approval', 'Transaction', 'Grant'];
  const named = (grantId: string) => HISTORIES.flatMap(object => samplesOf(object).filter(record => (record.state_history ?? []).some((line: Sample) => line.grant_id === grantId)).map(record => `${object} ${record.name ?? record.title ?? ''}`));

  it('a line that says no recorded change names its grant is true, and no line says no record here names it', () => {
    for (const closure of samplesOf('Closure')) {
      for (const line of closure.state_history as Sample[]) {
        expect(String(line.reason), closure.name).not.toMatch(/no record here names it/);
        if (/no recorded change here names it/.test(String(line.reason))) expect(named(closure.closes_id), closure.name).toEqual([]);
      }
    }
    // The spring grant's own page lists the grant that replaced it, so a record here does name it, by id.
    const spring = samplesOf('Grant').find(grant => grant.name === 'Northwind spring order replies')!;
    expect(samplesOf('Grant').filter(grant => grant.replaces_id === spring.grant_id).map(grant => grant.name)).toEqual(['Northwind customer replies']);
  });

  it('the page lists the grant and its party as they stand now, under a heading that says so', () => {
    const replies = samplesOf('Closure').find(closure => closure.closes_name === 'Northwind customer replies')!;
    const ended = resolveRelatedLists('Closure', replies).find(list => list.id === 'ended')!;
    expect(ended.heading).toBe('The grant and its party now (2)');
    expect(ended.rows.map(row => [row.seat, row.title, row.state])).toEqual([['Grant', 'Northwind customer replies', 'revoked'], ['For', 'Northwind Traders', 'active']]);
  });
});
