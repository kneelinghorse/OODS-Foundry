import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { JSDOM } from 'jsdom';
import { composedWireframe } from '../../src/codegen/composed-fidelity.js';
import { neutralFieldValue, workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import { deriveConsumerModel } from '../../src/codegen/preview-model.js';
import { composeDashboardHtml } from '../../src/tools/dashboard.render.html.js';
import type { UiSchema } from '../../src/schemas/generated.js';

describe('s218 review carries: labels must explain the data actually shown', () => {
  it.each([false, true])('omits grouping noise while retaining authored text and bindings, review=%s', review => {
    const schema: UiSchema = { version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: [
      { id: 'group', component: 'Stack' },
      { id: 'text', component: 'Text', props: { content: 'Stock decisions' } },
      { id: 'value', component: 'Text', props: { field: 'units_on_hand' } },
    ] }] };
    const doc = new JSDOM(composedWireframe(schema, { title: 'Warehouse' }, review).html).window.document;
    expect(doc.querySelector('[data-wire-node="group"] .wire-bindings') === null).toBe(true);
    expect(doc.body.textContent).not.toContain('No field binding');
    expect(doc.body.textContent).toContain('Stock decisions');
    expect(doc.body.textContent).toContain('field → units_on_hand');
  });

  it('qualifies link operands by panel so same-named columns do not read value > value', async () => {
    const panels = ['current', 'total'].map(id => ({ id, kind: 'kpi' as const, title: id === 'current' ? 'Current stock' : 'Recorded total', value: 9, trendDirection: 'flat' as const }));
    const html = await composeDashboardHtml({ columns: 12, panels: panels as any, layout: [], a11y: {} as any, links: [{ source: 'current', target: 'total', sourceField: 'value', operator: '>' }] });
    const text = new JSDOM(html).window.document.querySelector('.oods-dashboard-links')!.textContent;
    expect(text).toContain('Current stock.value > Recorded total.value');
    expect(text).not.toContain(': value > value');
    expect(text).toContain('does not apply filters');
  });

  it('keeps the sparkline stroke legible when a phone scales its viewBox down', async () => {
    const html = await composeDashboardHtml({ columns: 12, panels: [{ id: 'stock', kind: 'kpi', value: 9, trendDirection: 'increasing', sparkline: [2, 4, 9] }] as any, layout: [], a11y: {} as any });
    const line = new JSDOM(html).window.document.querySelector('.oods-kpi-sparkline polyline');
    expect(line?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });

  it.each(['date', 'datetime'])('an unauthored required %s cannot invent January 1970', type => {
    expect(neutralFieldValue({ type, required: true })).toBe('');
    expect(neutralFieldValue({ type, required: false })).toBeUndefined();
    const schema: UiSchema = { version: '2026.02', screens: [], objectSchema: { at: { type, required: true, examples: ['2026-09-01'] } } };
    expect(workflowSampleData(schema).records[0].at).toBe('2026-09-01');
  });

  it('does not fabricate an optional relationship ID that the screen then cannot resolve', () => {
    expect(neutralFieldValue({ type: 'uuid', required: false })).toBeUndefined();
    const schema: UiSchema = { version: '2026.02', screens: [], objectSchema: { warehouse_id: { type: 'uuid', required: true }, organization_id: { type: 'uuid' } } };
    expect(workflowSampleData(schema).records[0].organization_id).toBeUndefined();
  });

  it('required references without examples remain unrecorded while record keys stay distinct', () => {
    expect(neutralFieldValue({ type: 'uuid', required: true })).toBe('');
    const schema: UiSchema = { version: '2026.02', screens: [], objectSchema: { relationship_id: { type: 'uuid', required: true }, source_id: { type: 'uuid', required: true } } };
    const record = workflowSampleData(schema).records[0];
    expect(record.relationship_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(record.source_id).toBe('');
  });

  it('standalone preview absence matches the workflow model and the optional non-nullable prop contract', () => {
    const schema: UiSchema = { version: '2026.02', screens: [], objectSchema: {
      published_at: { type: 'datetime', required: false, examples: [null, '2026-09-01T12:00:00Z'] },
      archived_at: { type: 'datetime?', required: false, examples: [null] },
      created_at: { type: 'datetime', required: true },
    } };
    const model = deriveConsumerModel(schema);
    // An unpublished Article has no publishedAt value; passing null would fail its generated string|undefined prop.
    expect(model.publishedAt).toBeUndefined();
    expect(model.publishedAt).toBe(workflowSampleData(schema).records[0].published_at);
    expect(model.archivedAt).toBeNull(); // Explicit nullable contracts retain authored null.
    expect(model.createdAt).toBe(''); // Missing required dates still do not invent an event.
    expect(deriveConsumerModel(schema, { publishedAt: '2026-09-02T12:00:00Z' }).publishedAt).toBe('2026-09-02T12:00:00Z');
  });

  it('Warehouse authors operating status to agree with its stocked sample records', () => {
    const object = yaml.load(fs.readFileSync(new URL('../fixtures/team-definitions/Warehouse.object.yaml', import.meta.url), 'utf8')) as any;
    expect(object.schema.status?.examples?.length ?? 0).toBeGreaterThan(0);
    expect(object.schema.status?.examples?.every((status: string) => status === 'active')).toBe(true);
    expect(object.schema.last_event.examples).toEqual(['restocked']);
    expect(Number.isFinite(Date.parse(object.schema.last_event_at.examples[0]))).toBe(true);
  });
});
