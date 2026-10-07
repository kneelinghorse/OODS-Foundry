import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactComponents from '../../../components-react/src/index.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { reconcileFormDetail } from '../../src/compose/form-detail.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import type { ComposedObject } from '../../src/objects/trait-composer.js';
const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString } = requireVue('@vue/server-renderer');
const VueComponents = requireVue('@oods/components-vue');
const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('s191 craft values agree across render targets', () => {
  it.each(['StatusTimeline', 'AuditTimeline'] as const)('%s humanizes domain codes and preserves authored titles in HTML, React and Vue', async component => {
    const events = [{ event: 'billing_cycle_started', at: '2026-09-01T12:00:00Z' }, { from: 'active', to: 'pending_cancellation', at: '2026-09-08T12:00:00Z' }, { title: 'Subscription created', event: 'internal_code' }];
    const props = { events };
    const outputs = [renderMappedComponent({ id: 'timeline', component, props }, '')!, renderToStaticMarkup(createElement(ReactComponents[component], props)), await renderToString(h(VueComponents[component], props))].map(text);
    for (const output of outputs) {
      expect(output).toContain('Billing Cycle Started');
      expect(output).toContain('Active → Pending Cancellation');
      expect(output).toContain('Subscription created');
      expect(output).not.toMatch(/billing_cycle_started|pending_cancellation|internal_code/);
    }
    expect(new Set(outputs).size).toBe(1);
  });
  it('keeps only a declared audit log and derives currency help from the converting control', () => {
    const schema: UiSchema = { version: '2026.02', objectSchema: { audit_log: { type: 'object[]' }, amount: { type: 'integer', description: 'Minor units.' } }, screens: [{ id: 'root', component: 'Stack', children: [{ id: 'real', component: 'AuditTimeline', props: { auditLogField: 'audit_log' } }, { id: 'missing', component: 'AuditTimeline', props: { auditLogField: 'state_history' } }, { id: 'unbound', component: 'AuditTimeline' }] }] };
    const composed = { traits: [], semantics: {} } as unknown as ComposedObject;
    reconcileFormDetail(schema, 'detail', composed);
    expect(walk(schema.screens).filter(node => node.component === 'AuditTimeline').map(node => node.id)).toEqual(['real']);
    schema.screens = [{ id: 'amount', component: 'BillingAmountInput', props: { amountField: 'amount', currency: 'eur' } }];
    reconcileFormDetail(schema, 'form', composed);
    expect(schema.screens[0]!.props!.help).toBe('Amount in EUR');
  });
  it('keeps declared codes and empty histories without adding generated form fields', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const records = workflowSampleRecords(schema);
    expect(records).toEqual(workflowSampleRecords(schema));
    // s219-m01: Subscription authors each sample's history and payments; the seed carries exactly those, and the
    // declared payment_history is internal, so no form or detail row is generated for it.
    const examples = (field: string) => schema.objectSchema![field]!.examples!;
    for (const record of records) {
      expect(schema.workflow!.data.recordedEvents).toContain(record.last_event);
      // s222-m03 (#2502 ruling 14): matched by the record's key, since the authored samples' customers now share plans.
      const authored = examples('subscription_id').indexOf(record.subscription_id);
      expect(record.state_history).toEqual(examples('state_history')[authored]);
      expect(record.payment_history).toEqual(examples('payment_history')[authored]);
    }
    expect(walk(schema.screens).some(node => node.props?.field === 'payment_history')).toBe(false);
    expect(walk(schema.screens).filter(node => node.component === 'BillingAmountInput').every(node => node.props?.help === 'Amount in the selected currency')).toBe(true);
  });
  it('keeps one visible title when the static SVG already owns it, with a caption fallback otherwise', async () => {
    for (const svg of ['<svg><g class="role-title-text"><text>Payment amounts</text></g></svg>', '<svg><path d="M0,0L1,1"/></svg>']) {
      const props = { svg, title: 'Payment amounts' };
      const outputs = [renderMappedComponent({ id: 'chart', component: 'VizAreaPreview', props }, '')!, renderToStaticMarkup(createElement(ReactComponents.VizAreaPreview, props)), await renderToString(h(VueComponents.VizAreaPreview, props))];
      for (const output of outputs) expect(text(output).match(/Payment amounts/g)).toHaveLength(1);
    }
  });
  it('shares the row button classes and leaves room for a nonshrinking billing amount', async () => {
    const react = renderToStaticMarkup(createElement(ReactComponents.Button, { className: 'oods-collection-row' }, 'Team'));
    const vue = await renderToString(h(VueComponents.Button, { class: 'oods-collection-row' }, () => 'Team'));
    expect(react.match(/class="([^"]+)"/)![1]!.split(' ').sort()).toEqual(vue.match(/class="([^"]+)"/)![1]!.split(' ').sort());
    const css = readFileSync(new URL('../../../component-styles/src/components.css', import.meta.url), 'utf8');
    const badge = css.match(/\[data-oods-component='BillingSummaryBadge'\] \{([^}]+)\}/)![1];
    expect(badge).toContain('flex-shrink: 0'); expect(badge).toContain('white-space: nowrap');
    expect(css).not.toContain('.oods-collection-row > :first-child { min-width: 50%');
  });
});
