import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { fieldLabel } from '../../src/compose/label-generator.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import type { UiElement } from '../../src/schemas/generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import * as ReactComponents from '../../../components-react/src/index.js';
// Resolve Vue from its package, since the MCP server has no direct Vue dependency.
const vueRequire = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = vueRequire('vue');
const { renderToString } = vueRequire('@vue/server-renderer');
const VueComponents = vueRequire('@oods/components-vue');

const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
describe('form and detail reconcile their declared semantics', () => {
  it('uses names for identification and keeps descriptions below controls', async () => {
    expect(fieldLabel('cancellation_reason', 'Free-form explanation captured during cancellation workflows.')).toBe('Cancellation reason');
    const { schema } = await compose({ object: 'Subscription', context: 'form' });
    for (const node of walk(schema.screens).filter(node => ['Input', 'Select', 'Checkbox', 'StatusSelector'].includes(node.component))) {
      expect(String(node.props?.label)).not.toMatch(/[.!?]|^Field \d+$/);
      expect(String(node.props?.label).length).toBeLessThanOrEqual(40);
      const field = String(node.props?.field);
      const sharedHelp: Record<string, string> = { status: 'Choose the current status.', label: 'Name shown for this record.', owner_id: 'Identifier of the owner.', owner_type: 'Choose the kind of owner.', placeholder: 'Shown when the label is empty.', tag_count: 'Number of tags assigned to this record.' };
      expect(node.props?.help).toBe(sharedHelp[field] ?? schema.objectSchema![field].description);
    }
    const date = walk(schema.screens).find(node => node.props?.field === 'cancellation_requested_at');
    expect(date?.component).toBe('Input'); expect(date?.props?.type).toBe('datetime-local');
  });

  it('leaves each recipe as the sole owner of its fields and keeps native Save', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'form' });
    const nodes = walk(schema.screens);
    for (const field of ['amount', 'billing_interval', 'cancellation_reason', 'cancellation_reason_code', 'status']) {
      expect(nodes.filter(node => ['Input', 'Select', 'Textarea'].includes(node.component) && node.props?.field === field), field).toHaveLength(0);
    }
    expect(nodes.find(node => node.component === 'CancellationForm')?.props?.embedded).toBe(true);
    expect(nodes.filter(node => node.component === 'Button' && node.props?.type === 'submit')).toHaveLength(1);
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      expect(result.code).not.toMatch(/>Submit<|>Change<|>Cancel subscription</);
      expect(result.code).toContain('Save');
    }
  });

  it('keeps only populated unique detail tabs and reads the declared history', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'detail' });
    const nodes = walk(schema.screens);
    const panels = nodes.find(node => node.component === 'Tabs')!.children!;
    const labels = panels.map(node => node.props?.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every(label => typeof label === 'string' && !/\d/.test(label))).toBe(true);
    expect(panels.every(panel => walk(panel.children ?? []).some(node => !['Stack', 'Card'].includes(node.component)))).toBe(true);
    // s191-m03 A3: lifecycle history is not a substitute for a declared audit log.
    expect(nodes.filter(node => node.component === 'AuditTimeline')).toHaveLength(0);
    expect(nodes.filter(node => node.component === 'StatusTimeline')).toHaveLength(1);
    expect(nodes.some(node => ['Input', 'Textarea', 'Checkbox', 'CancellationForm'].includes(node.component))).toBe(false);
  });

  it('lowers HTML summary booleans, dates and unknown reason codes without losing values', () => {
    const html = (component: string, props: Record<string, unknown>) => renderMappedComponent({ id: 'value-check', component, props }, '')!;
    expect(html('ArchiveSummary', { isArchived: false })).toContain('<dd>No</dd>');
    const summary = html('CancellationSummary', { cancelAtPeriodEnd: false, requestedAt: '2026-09-08T12:00:00Z', reason: 'Budget', code: 'customer_request' });
    expect(summary).toContain('Sep 8, 2026, 12:00 PM'); expect(summary).toContain('<dd>Customer Request</dd>');
    expect(html('CancellationForm', { reasonCode: 'customer_request', allowedReasons: ['budget'], embedded: true })).toMatch(/value="customer_request"[^>]*selected/);
    expect(html('Input', { type: 'datetime-local', value: '2026-09-08T12:00:00Z', label: 'Requested at', help: 'When requested.' })).toContain('value="2026-09-08T12:00"');
  });

  it('retains explicit public tab labels on populated panels', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'detail', preferences: { tabLabels: ['Account billing', 'Payment history'] } });
    const labels = walk(schema.screens).find(node => node.component === 'Tabs')!.children!.map(node => node.props?.label);
    expect(labels).toEqual(expect.arrayContaining(['Account billing', 'Payment history']));
  });

  it('keeps HTML, React and Vue summary terms and values identical', async () => {
    const values = { isArchived: false, archivedAt: '2026-09-08T12:00:00Z', reason: 'Budget', cancelAtPeriodEnd: true, requestedAt: '2026-09-08T12:00:00Z', code: 'customer_request' };
    const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    for (const component of ['ArchiveSummary', 'CancellationSummary'] as const) {
      const props = component === 'ArchiveSummary' ? { isArchived: values.isArchived, archivedAt: values.archivedAt, reason: values.reason } : { cancelAtPeriodEnd: values.cancelAtPeriodEnd, requestedAt: values.requestedAt, reason: values.reason, code: values.code };
      const html = text(renderMappedComponent({ id: 'values', component, props }, '')!);
      expect(text(renderToStaticMarkup(createElement(ReactComponents[component], props)))).toBe(html);
      expect(text(await renderToString(h(VueComponents[component], props)))).toBe(html);
    }
  });

  it.each(['react', 'vue'] as const)('%s workflow compiles its on-demand cancellation and native form', async framework => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const app = result.artifact!.files.find(file => /src\/App\./.test(file.path))!.contents;
    expect(app).toContain('state.cancelOpen'); expect(app).toContain('<CancellationForm'); expect(app).toContain('Confirm cancellation');
    expect(app).not.toContain('Cancellation details');
    const checked = typecheckWorkflow(result.artifact!);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  }, 30_000);
});
