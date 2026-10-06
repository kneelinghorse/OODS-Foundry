import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import inputSchema from '../../src/schemas/fidelity.preview.input.json';
import outputSchema from '../../src/schemas/fidelity.preview.output.json';
import uiSchema from '../../src/schemas/repl.ui.schema.json';
import { handle as preview, FIXTURE_PATHS } from '../../src/tools/fidelity.preview.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { createSchemaRef, createValueRef } from '../../src/tools/schema-ref.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const schema: UiSchema = { version: '2026.02', screens: [{ id: 'screen', component: 'Stack', layout: { type: 'stack' }, children: [{ id: 'body', component: 'Card', layout: { type: 'grid' }, children: [{ id: 'title', component: 'Text', props: { field: 'name' } }, { id: 'state', component: 'StatusBadge', props: { statusField: 'status' }, meta: { confidence: 0.4 } }] }] }], objectSchema: { name: { type: 'string', required: true }, status: { type: 'string', required: true } } };
describe('composed fidelity follows the actual screen instead of catalog entity cards', () => {
  it('wireframe preserves nesting, layouts, component identities and field bindings without mutating input', async () => {
    const before = JSON.stringify(schema);
    const result = await preview({ fidelityKind: 'wireframe', schema } as any);
    expect(result.status).toBe('ok');
    const doc = new JSDOM(result.html).window.document;
    expect(doc.querySelectorAll('[data-wire-node]')).toHaveLength(4);
    expect(doc.querySelector('[data-wire-node="body"] [data-wire-node="state"]')?.textContent).toContain('statusField → status');
    expect(doc.querySelector('[data-wire-node="body"]')?.getAttribute('data-layout')).toBe('grid');
    expect(doc.querySelector('[data-wire-node="title"]')?.textContent).toContain('Text');
    expect(doc.querySelector('[data-wire-node="title"]')?.textContent).toContain('field → name');
    expect(JSON.stringify(schema)).toBe(before);
  });
  it.each(['list', 'detail', 'form'] as const)('composes a real %s screen from a registered object', async context => {
    const result = await preview({ fidelityKind: 'wireframe', object: 'Product', context } as any);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(new JSDOM(result.html).window.document.querySelectorAll('[data-wire-node]').length).toBeGreaterThan(8);
    expect(result.html).toContain(`Product ${context}`);
  });
  it.each(['wireframe', 'review', 'branded-mockup', 'boxes-arrows'] as const)('accepts a composed schemaRef for %s', async fidelityKind => {
    const result = await preview({ fidelityKind, schemaRef: createSchemaRef(schema, 'compose', 'Custom screen').ref } as any);
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    if (fidelityKind === 'review') { expect(result.html).toContain('40%'); expect(result.html).toContain('Not recorded'); }
    if (fidelityKind === 'boxes-arrows') { expect(result.svg).toContain('Component containment'); expect(result.svg).toContain('polyline'); expect(result.meta.edgeCount).toBe(3); }
  });
  it('refuses missing, non-UI and ambiguous sources explicitly', async () => {
    for (const input of [{ schemaRef: 'missing-ref' }, { schemaRef: createValueRef({ rows: [] }, 'dataset').ref }, { schema, object: 'User' }]) {
      const result = await preview({ fidelityKind: 'wireframe', ...input } as any);
      expect(result.status).toBe('error'); expect(result.html).toBe(''); expect(result.errors.length).toBeGreaterThan(0);
    }
  });
  it('public wire schemas accept each new source and the exact returned envelope', async () => {
    const ajv = new Ajv({ strict: false, validateFormats: false }); ajv.addSchema(uiSchema);
    const input = ajv.compile(inputSchema), output = ajv.compile(outputSchema);
    for (const fidelityKind of ['wireframe', 'review', 'branded-mockup', 'boxes-arrows'] as const) {
      for (const source of [{ schema }, { object: 'Product', context: 'card' as const }]) {
        const request = { fidelityKind, ...source };
        expect(input(request), JSON.stringify(input.errors)).toBe(true);
        const response = await preview(request);
        expect(response.status, JSON.stringify(response.errors)).not.toBe('error');
        expect(output(response), JSON.stringify(output.errors)).toBe(true);
      }
    }
    expect(input({ fidelityKind: 'wireframe', schema, schemaRef: 'ambiguous' })).toBe(false);
  });
  it('keeps declared relationships separate from composition containment', async () => {
    const result = await preview({ fidelityKind: 'boxes-arrows', object: 'Transaction' });
    expect(result.svg).toContain('via user_id'); expect(result.svg).not.toContain('Component containment');
  });
  it('ships all nine vetted fixtures as registry data and keeps every legacy view working', async () => {
    expect(Object.keys(FIXTURE_PATHS)).toHaveLength(9);
    for (const [fixture, file] of Object.entries(FIXTURE_PATHS)) {
      expect(file).toContain('/registry/fidelity-fixtures/'); expect(fs.existsSync(file)).toBe(true);
      for (const fidelityKind of ['wireframe', 'boxes-arrows', 'review', 'branded-mockup'] as const) {
        const named = await preview({ fidelityKind, fixture });
        const inline = await preview({ fidelityKind, manifest: JSON.parse(fs.readFileSync(file, 'utf8')) });
        expect(named.errors, `${fixture}/${fidelityKind}`).toEqual(inline.errors);
        expect(named.html, `${fixture}/${fidelityKind}`).toBe(inline.html);
        expect(named.errors.some(issue => issue.code === 'OODS-FP-002')).toBe(false);
      }
    }
  });
  it('draws chart field bindings, collection sources and safe untrusted labels', async () => {
    const result = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
    const drawing = await preview({ fidelityKind: 'wireframe', schema: result.schema } as any);
    expect(drawing.html).toContain('chart.amountField → amount');
    const unsafe = structuredClone(schema); unsafe.screens[0].meta = { label: '<script>bad()</script>' };
    const doc = new JSDOM((await preview({ fidelityKind: 'wireframe', schema: unsafe } as any)).html).window.document;
    expect(doc.querySelector('script')).toBeNull(); expect(doc.body.textContent).toContain('<script>bad()</script>');
  });
});
