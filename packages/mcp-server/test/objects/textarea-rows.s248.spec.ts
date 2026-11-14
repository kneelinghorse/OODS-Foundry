/**
 * s248-m01 (next step 1862): every text area the three renderers draw for a record field is the same height, four rows,
 * React's Textarea default. HTML's two paths set no rows, so a browser drew about two and Article's body showed its first
 * two steps and the rest only after scrolling inside the box; Vue's Textarea defaulted to three; and the raw text areas in
 * React's and Vue's CancellationForm and preference editor set none. These checks draw each such screen in HTML, React
 * and Vue and read every text area on it.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { loadObject } from '../../src/objects/object-loader.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const RENDERERS = ['html', 'react', 'vue'] as const;
const rowsOf = (html: string) => [...JSDOM.fragment(html).querySelectorAll('textarea')].map(area => ({ name: area.getAttribute('name') ?? area.getAttribute('id') ?? '', rows: area.getAttribute('rows') }));

async function pages(object: string, context: string): Promise<Record<(typeof RENDERERS)[number], string>> {
  const result = await compose({ object, context, options: { transient: true } } as never);
  expect(result.status, `${object}/${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
  const schema = result.schema as UiSchema;
  const record = (loadObject(object).samples ?? [])[0] as Record<string, unknown> | undefined;
  const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), record?.[field] ?? null]));
  const sample = seedPreviewModel({ schema, context, object, established });
  const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: sample } as never) } as Record<(typeof RENDERERS)[number], string>;
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
    expect(generated.status, `${object}/${context}/${framework}`).toBe('ok');
    out[framework] = renderGenerated(framework, generated.code!, sample, generated.artifact!.actions.map(({ name }: { name: string }) => name));
  }
  return out;
}

describe('every text area drawn for a record field is four rows, in HTML, React and Vue', () => {
  it.each([
    // A Textarea placed for a long-text field (Article's body and description), a CancellationForm's reason (Subscription's,
    // Transaction's and Task's forms), and the preference editor's document (User's and Organization's forms).
    ['Article', 'form'], ['Subscription', 'form'], ['Transaction', 'form'], ['Task', 'form'], ['User', 'form'], ['Organization', 'form'],
  ])('%s %s', async (object, context) => {
    const page = await pages(object, context);
    for (const renderer of RENDERERS) {
      const areas = rowsOf(page[renderer]);
      expect(areas.length, `${renderer}: the screen draws a text area`).toBeGreaterThan(0);
      for (const area of areas) expect(area.rows, `${renderer} ${object} ${context}: ${area.name}`).toBe('4');
    }
  });

  it('a text area the schema gives its own rows keeps them in HTML, as React and Vue do', () => {
    const html = renderTree({ version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: [{ id: 'notes', component: 'Textarea', props: { label: 'Notes', rows: 8 } }] }] } as UiSchema);
    expect(rowsOf(html)).toEqual([{ name: 'notes', rows: '8' }]);
  });
});
