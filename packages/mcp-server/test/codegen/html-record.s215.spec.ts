import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { emit } from '../../src/codegen/html-emitter.js';
import { bindRecordSchema } from '../../src/render/record-renderer.js';
import { renderSeed } from '../../src/codegen/render-seed.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as render } from '../../src/tools/repl.render.js';
const body = (html: string) => html.match(/<main id="oods-preview-root">([\s\S]*)<\/main>/)![1];
describe('s215 HTML shows the composed record', () => {
  it('HTML and repl share the bound body, full styles, scope, title and drawn chart', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
    const html = await generate({ schema, framework: 'html', profile: 'draft', options: { brand: 'A', theme: 'dark' } });
    const repl = await render({ schema: { ...schema, theme: 'dark' }, apply: true, brand: 'A', output: { compact: false } });
    expect(html.status).toBe('ok'); expect(repl.status).toBe('ok');
    expect(body(html.code)).toBe(body(repl.html!));
    for (const output of [html.code, repl.html!]) {
      // s219-m01: the preview record is an authored sample whose payments the chart draws. s222-m03 (#2502 ruling 14): it
      // is Lindqvist Bakery's Starter subscription, billed in EUR, with its eleven payments (a refund among them).
      expect(output).toContain('Starter'); expect(output).toContain('Current status: Active');
      expect(output).toContain('Payments recorded for this subscription, in EUR'); // s223-m01 (#2527 ruling 5) expect(output).not.toContain('No recorded payments'); expect(output).toContain('<svg');
      expect(output).toContain('role="tablist"'); expect(output).toContain('data-oods-runtime="tabs"');
      expect(output).toContain('<title>Subscription detail</title>');
      expect(output).toContain('data-brand="A"'); expect(output).toContain('data-theme="dark"');
      expect(output).toContain('.oods-field');
      expect(body(output)).not.toMatch(/\[planName\]|\[status\]|data-prop-|align-items:space-between|preview \(\d/);
    }
  });
  it('the form and standalone app use the preview record while values stay editable', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'form', options: { transient: true } });
    schema.objectSchema!.plan_name!.examples = ['Authored input plan'];
    const html = await generate({ schema, framework: 'html', profile: 'draft' });
    expect(html.code).toContain('value="Authored input plan"');
    expect(html.code).toContain('value="active" selected');
    for (const framework of ['react', 'vue'] as const) {
      const app = await generate({ schema, framework, profile: 'build', options: { output: 'application' } });
      expect(app.status).toBe('ok');
      expect(app.artifact?.files.find(file => /src\/App\./.test(file.path))?.contents).toContain('Authored input plan');
    }
  });
  it('seeds plural and multiword screen names using the composer’s labels', async () => {
    for (const [object, context] of [['Product', 'list'], ['ComparisonSignal', 'list']] as const) {
      const result = await compose({ object, context, options: { transient: true } });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const schema = result.schema;
      const seed = await renderSeed(schema);
      expect(seed.title).toBe(`${object} ${context}`);
      expect(Object.keys(seed.record).length).toBeGreaterThan(1);
    }
  });
  it('expands real sorted list rows once, without loading or error branches or duplicated IDs', async () => {
    const { schema } = await compose({ object: 'Product', context: 'list', options: { transient: true } });
    schema.objectSchema!.label!.examples = ['Zulu product', 'Alpha product'];
    const seed = await renderSeed(schema);
    const bound = bindRecordSchema(schema, seed.model);
    const html = emit(bound, { typescript: true, styling: 'tokens', sampleModel: seed.model }).code;
    expect(html.indexOf('Alpha product')).toBeGreaterThan(-1);
    expect(html.indexOf('Alpha product')).toBeLessThan(html.indexOf('Zulu product'));
    expect(html).not.toContain('data-state="loading"');
    expect(html).not.toContain('data-state="error"');
    const ids = [...body(html).matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('escapes raw identifiers in the native reference disclosure', () => {
    const schema: UiSchema = { version: '2026.09', objectSchema: { user_id: { type: 'uuid', required: true } }, screens: [{ id: 'screen-detail-1', component: 'Text', props: { text: 'Record' } }] };
    const result = emit(schema, { typescript: true, styling: 'tokens', sampleModel: { userId: '<img src=x onerror=alert(1)>' } });
    expect(body(result.code)).toContain('Reference details');
    expect(body(result.code)).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(body(result.code)).not.toContain('<img');
  });
  it('escapes sample content and treats expression-looking values as data', () => {
    const hostile = '<script>alert(1)</script>';
    const schema: UiSchema = { version: '2026.09', objectSchema: { title: { type: 'string', required: true } }, screens: [{ id: 'safe-screen', component: 'Text', props: { field: 'title' } }] };
    const result = emit(schema, { typescript: true, styling: 'tokens', sampleModel: { title: hostile } });
    expect(body(result.code)).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body(result.code)).not.toContain('<script>');
    expect(schema.screens[0].props).toEqual({ field: 'title' });
  });

});
