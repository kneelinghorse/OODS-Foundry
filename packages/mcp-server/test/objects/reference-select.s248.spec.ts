/**
 * s248-m01 (next step 1861): a reference select never shows a different person than the record holds. A form's select for
 * a reference lists the related object's own samples; where the record's value is not among them, a native select shows
 * its first option (React and HTML) or nothing (Vue), so Article's form read "Dana Whitfield" for an article Elena Park
 * wrote, and PAY-2026-0404's read a user it was not made by. The select now names the record's own value by its kept name,
 * the name the record keeps beside the reference, in React, Vue, HTML and the generated app; a select whose value is among
 * its options looks as it did; an id with no kept name reads "<label> reference not resolved", never another record.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { selectOptionsWithValue } from '@oods/component-contracts';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
type Sample = Record<string, unknown>;
const RENDERERS = ['html', 'react', 'vue'] as const;

/** The option a select shows, by the label beside it, as a person reads the form. */
function chosen(html: string, label: string): { value: string | null; text: string } | undefined {
  const page = JSDOM.fragment(html);
  for (const select of page.querySelectorAll('select')) {
    const id = select.getAttribute('id');
    const name = ((id ? page.querySelector(`label[for="${id}"]`) : null) ?? select.closest('label'))?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!name.startsWith(label)) continue;
    const option = select.querySelector('option[selected]') ?? select.querySelector('option');
    return option ? { value: option.getAttribute('value'), text: (option.textContent ?? '').trim() } : undefined;
  }
  return undefined;
}

const composed = async (object: string, context: string): Promise<UiSchema> => {
  const result = await compose({ object, context, options: { transient: true } } as never);
  expect(result.status, `${object}/${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
  return result.schema as UiSchema;
};
const model = (schema: UiSchema, record: Sample) => Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), record[field] ?? null]));
async function forms(object: string, record: Sample): Promise<Record<(typeof RENDERERS)[number], string>> {
  const schema = await composed(object, 'form');
  const sample = seedPreviewModel({ schema, context: 'form', object, established: model(schema, record) });
  const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
  for (const framework of ['react', 'vue'] as const) {
    const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
    expect(result.status, `${object}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
    out[framework] = renderGenerated(framework, result.code!, sample, result.artifact!.actions.map(({ name }: { name: string }) => name));
  }
  return out;
}
async function appForms(object: string): Promise<Record<'react' | 'vue', Array<{ record: Sample; html: string }>>> {
  const workflow = await composed(object, 'workflow');
  const out = {} as Record<'react' | 'vue', Array<{ record: Sample; html: string }>>;
  for (const framework of ['react', 'vue'] as const) {
    const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never);
    expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
    const files = result.artifact!.files;
    const records = runGeneratedStore(files, `
const records = store.createStore({ latency: 0 }).list({ pageSize: 1000 }).records;
process.stdout.write(JSON.stringify(records.map(record => ({ ...store.screenProps(record), uiState: 'success' }))));
`) as Sample[];
    const screen = { entry: `src/screens/Form.${framework === 'react' ? 'tsx' : 'vue'}`, files };
    const code = files.find(file => file.path === screen.entry)!.contents;
    const pages = renderGeneratedModels(framework, code, records, result.artifact!.actions.map(({ name }: { name: string }) => name), screen);
    out[framework] = records.map((record, index) => ({ record, html: pages[index]! }));
  }
  return out;
}

describe('selectOptionsWithValue names the record\'s own value where the select does not list it', () => {
  const options = [{ value: 'u1', label: 'Dana Whitfield' }, { value: 'u2', label: 'Ruth Adeyemi' }];
  it('keeps the options as they are where the select lists the value, or the record holds none', () => {
    expect(selectOptionsWithValue(options, 'u2', 'Ruth Adeyemi', 'Author')).toEqual(options);
    expect(selectOptionsWithValue(options, '', 'Elena Park', 'Author')).toEqual(options);
    expect(selectOptionsWithValue(options, null, undefined, 'Author')).toEqual(options);
  });
  it('puts the record\'s own value first, by its kept name; an id with no name is not resolved; another value reads as itself', () => {
    expect(selectOptionsWithValue(options, 'u9', 'Elena Park', 'Author')).toEqual([{ value: 'u9', label: 'Elena Park' }, ...options]);
    expect(selectOptionsWithValue(options, '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0e01', undefined, 'Author')[0]).toEqual({ value: '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0e01', label: 'Author reference not resolved' });
    // A kept name that is itself an id is not a name (formatReferenceLabel's rule).
    expect(selectOptionsWithValue(options, '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0e01', '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0e01', 'Author')[0]!.label).toBe('Author reference not resolved');
    expect(selectOptionsWithValue(options, 'PLAN_TEAM', '', 'Plan')[0]).toEqual({ value: 'PLAN_TEAM', label: 'PLAN_TEAM' });
  });
});

describe('a reference select shows the record\'s own reference on the form, in HTML, React, Vue and the generated app', () => {
  it('Article\'s form shows each sample\'s own author', async () => {
    const samples = loadObject('Article').samples as Sample[];
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      const page = await forms('Article', sample);
      for (const renderer of RENDERERS) expect(chosen(page[renderer], 'Author'), `${renderer}: ${String(sample.label)}`).toEqual({ value: sample.author_id, text: sample.author_name });
    }
    const app = await appForms('Article');
    for (const framework of ['react', 'vue'] as const) {
      expect(app[framework].length).toBe(samples.length);
      for (const { record, html } of app[framework]) expect(chosen(html, 'Author'), `${framework} app: ${String(record.label)}`).toEqual({ value: record.authorId, text: record.authorName });
    }
  });

  it('PAY-2026-0404\'s form shows Helen Rowe, and every other payment\'s shows its own user', async () => {
    const samples = loadObject('Transaction').samples as Sample[];
    const helen = samples.find(sample => sample.payment_reference === 'PAY-2026-0404')!;
    expect(helen.user_name).toBe('Helen Rowe');
    for (const sample of samples) {
      const page = await forms('Transaction', sample);
      for (const renderer of RENDERERS) {
        expect(chosen(page[renderer], 'User'), `${renderer}: ${String(sample.payment_reference)}`).toEqual({ value: sample.user_id, text: sample.user_name });
      }
    }
    const app = await appForms('Transaction');
    for (const framework of ['react', 'vue'] as const) {
      const row = app[framework].find(({ record }) => record.paymentReference === 'PAY-2026-0404')!;
      expect(chosen(row.html, 'User'), `${framework} app`).toEqual({ value: helen.user_id, text: 'Helen Rowe' });
    }
  });

  it('a select whose value is among its options looks as it did: the same options, the record\'s own one chosen', async () => {
    // Every invoice's subscription is one of Subscription's samples, so its select lists them all and adds none.
    const samples = loadObject('Invoice').samples as Sample[];
    const schema = await composed('Invoice', 'form');
    const authored = JSON.stringify(schema).match(/"field":"subscription_id","label":"Subscription","options":(\[[^\]]*\])/)?.[1];
    expect(authored).toBeTruthy();
    const options = JSON.parse(authored!) as Array<{ value: string; label: string }>;
    for (const sample of samples.slice(0, 3)) {
      expect(options.map(option => option.value)).toContain(sample.subscription_id);
      const page = await forms('Invoice', sample);
      for (const renderer of RENDERERS) {
        const select = [...JSDOM.fragment(page[renderer]).querySelectorAll('select')].find(node => node.querySelector(`option[value="${String(sample.subscription_id)}"]`))!;
        expect([...select.querySelectorAll('option')].map(option => (option.textContent ?? '').trim()), renderer).toEqual(options.map(option => option.label));
        expect(chosen(page[renderer], 'Subscription')?.value, renderer).toBe(sample.subscription_id);
      }
    }
  });
});

describe('a team\'s reference whose kept name the product writes (read-only) still names the select\'s value on the form', () => {
  let home: string;
  const previous = process.env.OODS_OBJECTS_DIR;
  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s248-1861-'));
    fs.mkdirSync(path.join(home, 'objects'));
    fs.writeFileSync(path.join(home, 'objects', 'Note.object.yaml'), [
      'object: { name: Note, version: 1.0.0, domain: test, description: A test note written by a person. }',
      'schema:',
      '  note_id: { type: string, required: true, description: The record\'s own id. }',
      '  name: { type: string, required: true, description: What the note says. }',
      '  author_id: { type: uuid, required: true, description: Who wrote it. }',
      '  author_name: { type: string, required: false, readOnly: true, description: Who wrote it, as shown. Kept on the record. }',
      'semantics:',
      '  name: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
      '  author_id: { semantic_type: content.note.author, token_mapping: tokenMap(text.body.*), ui_hints: { component: Text, displayLabelField: author_name } }',
      'relationships:',
      '  - { target: User, via: author_id, cardinality: many-to-one, label: Author }',
      'samples:',
      '  - { note_id: n_1, name: Order more flour, author_id: 8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0f01, author_name: Elena Park }',
      '  - { note_id: n_2, name: Call the bank, author_id: 8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d02, author_name: Ruth Adeyemi }',
    ].join('\n') + '\n');
    process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
    clearTraitCache(); clearObjectCache();
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.OODS_OBJECTS_DIR; else process.env.OODS_OBJECTS_DIR = previous;
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('keeps the read-only kept name in the form\'s record with no control, and the select names the author', async () => {
    const schema = await composed('Note', 'form');
    expect(schema.objectSchema?.author_name).toBeTruthy();
    expect(JSON.stringify(schema.screens)).not.toMatch(/"field":"author_name"/);
    const [unlisted, listed] = loadObject('Note').samples as Sample[];
    const page = await forms('Note', unlisted!);
    for (const renderer of RENDERERS) expect(chosen(page[renderer], 'Author'), renderer).toEqual({ value: unlisted!.author_id, text: 'Elena Park' });
    const other = await forms('Note', listed!);
    for (const renderer of RENDERERS) expect(chosen(other[renderer], 'Author'), renderer).toEqual({ value: listed!.author_id, text: 'Ruth Adeyemi' });
  });
});
