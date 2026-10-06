import { describe, expect, it, vi } from 'vitest';
import { expectedWorkflowFlow, assertWorkflowFlow } from '../../../../scripts/product-reality/s188-m03-app-consumers.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { componentRenderers } from '../../src/render/component-map.js';
import type { UiElement } from '../../src/schemas/generated.js';

vi.mock('../../src/objects/object-loader.js', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/objects/object-loader.js')>();
  return { ...original, loadObject(name: string) {
    if (name !== 'S192AuditSort') return original.loadObject(name);
    const object = structuredClone(original.loadObject('Product'));
    object.object.name = name;
    object.traits.push({ name: 'lifecycle/Auditable' }, { name: 'behavioral/Sortable', parameters: { sortableFields: ['name'], defaultSortField: 'name', triStateSort: true } });
    return object;
  } };
});
const nodes = (roots: UiElement[]): UiElement[] => roots.flatMap(node => [node, ...nodes(node.children ?? [])]);
describe('retained declared trait recipes and Invoice writer ownership', () => {
  it.each([['detail', 'AuditSummaryCard'], ['list', 'SortIndicator'], ['timeline', 'TimelineEntryLabel']] as const)('places the declared %s recipe and emits both governed targets', async (context, component) => {
    const result = await compose({ object: 'S192AuditSort', context }); expect(result.status).toBe('ok');
    const placed = nodes(result.schema.screens).filter(node => node.component === component); expect(placed).toHaveLength(1);
    if (component === 'TimelineEntryLabel') {
      const header = nodes(result.schema.screens).find(node => node.id.startsWith('timeline-header-'))!;
      const events = nodes(result.schema.screens).find(node => node.collection?.source === 'events')!;
      expect(nodes(header.children ?? []).filter(node => node.component === component)).toEqual(placed);
      expect(nodes(events.children ?? []).filter(node => node.component === component)).toEqual([]);
    }
    if (component === 'SortIndicator') {
      expect(placed[0].props).toMatchObject({ sortableFields: ['name'], triStateSort: true, defaultSortField: 'name' });
      expect(placed[0].bindings).toEqual({ onChange: 'handleSortChange' });
      expect(nodes(result.schema.screens).filter(node => node.collectionControl === 'sort')).toEqual([]);
    }
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: result.schema, framework, profile: 'build' });
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      expect(generated.code).toContain(`<${component}`);
      expect(JSON.stringify(generated.validation?.warnings ?? [])).not.toMatch(/OODS-(V007|N0)/);
    }
  });
  it.each(['form', 'workflow'] as const)('Invoice %s never assigns an edit handler to a display header', async context => {
    const result = await compose({ object: 'Invoice', context });
    expect(nodes(result.schema.screens).filter(node => node.component === 'DetailHeader').every(node => !node.bindings?.onChange)).toBe(true);
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: result.schema, framework, profile: 'build' });
      expect(generated.status).toBe('ok'); expect(JSON.stringify(generated)).not.toContain('OODS-V007');
    }
  });
  it('uses real Auditable and Sortable declarations without changing the canonical objects', () => {
    expect(loadObject('Product').traits.some(trait => /Auditable|Sortable/.test(trait.name))).toBe(false);
    expect(loadObject('S192AuditSort').traits.map(trait => trait.name)).toEqual(expect.arrayContaining(['lifecycle/Auditable', 'behavioral/Sortable']));
  });
  it.each([['Article', 5], ['Organization', 6], ['Subscription', 9]] as const)('requires every declared %s workflow behavior without a three-object row-count assumption', async (object, count) => {
    const result = await compose({ object, context: 'workflow' });
    const expected = expectedWorkflowFlow(result.schema);
    expect(expected).toHaveLength(count);
    const rows = expected.map(name => ({ name, status: 'passed' as const }));
    expect(() => assertWorkflowFlow(rows, expected)).not.toThrow();
    expect(() => assertWorkflowFlow(rows.slice(0, -1), expected)).toThrow('Every declared flow obligation');
  });
  it('maps HTML summary aggregation, sort state and compact InlineLabel parity', () => {
    const summary = componentRenderers.AuditSummaryCard({ id: 'audit', component: 'AuditSummaryCard', props: { auditLog: [{ transitioned_at: '2026-09-06T12:00:00Z', actor_id: '<actor>', to_state: 'active' }] } });
    expect(summary).toContain('<dt>Transitions</dt><dd>1</dd>'); expect(summary).toContain('&lt;actor&gt;'); expect(summary).toContain('Sep 6, 2026, 12:00 PM');
    for (const [sortActive, sortDirection, state] of [[false, 'asc', 'none'], [true, 'asc', 'ascending'], [true, 'desc', 'descending']] as const) expect(componentRenderers.SortIndicator({ id: 'sort', component: 'SortIndicator', props: { sortActive, sortDirection } })).toContain(`aria-sort="${state}"`);
    const props = { label: 'A sufficiently long timeline label that needs truncation', maxLength: 8 };
    const inline = componentRenderers.InlineLabel({ id: 'label', component: 'InlineLabel', props });
    const timeline = componentRenderers.TimelineEntryLabel({ id: 'label', component: 'TimelineEntryLabel', props });
    expect(timeline.replace('TimelineEntryLabel', 'InlineLabel').replace(' data-timeline-label="true"', '').replace(' data-compact="true"', '')).toBe(inline);
  });
});
