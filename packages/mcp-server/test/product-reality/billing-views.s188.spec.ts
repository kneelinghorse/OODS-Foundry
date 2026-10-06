import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, type ComponentType } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { describe, expect, it } from 'vitest';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { handle as generate } from '../../src/tools/code.generate.js';

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');
const requireReact = createRequire(new URL('../../../components-react/package.json', import.meta.url));
const requireTesting = createRequire(requireReact.resolve('@testing-library/react'));
const requireDom = createRequire(requireTesting.resolve('@testing-library/dom'));
const { computeAccessibleName } = requireDom('dom-accessibility-api');

type Component = 'CycleProgressCard' | 'PaymentTimeline' | 'PaymentEventTimeline' | 'BillingCardMeta' | 'ArchivedRowOverlay';
const period = { periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-01-31T00:00:00Z', now: '2026-01-13T00:00:00Z' };
const payment = { lastPayment: '2026-01-01T00:00:00Z', nextPayment: '2026-02-01T00:00:00Z', amount: 1999, currency: 'usd', paymentStatus: 'succeeded' };
const cases: Array<{ id: string; component: Component; props: Record<string, unknown>; text: string; children?: string }> = [
  { id: 'cycle-explicit', component: 'CycleProgressCard', props: { ...period, progress: 0.4 }, text: '40% complete · 18 days remaining' },
  { id: 'cycle-dates', component: 'CycleProgressCard', props: { ...period, now: '2026-01-16T00:00:00Z' }, text: '50% complete · 15 days remaining' },
  { id: 'cycle-ended', component: 'CycleProgressCard', props: { ...period, progress: 0.4, now: '2026-02-01T00:00:00Z' }, text: '100% complete · 0 days remaining' },
  { id: 'cycle-missing', component: 'CycleProgressCard', props: { now: period.now }, text: 'Progress unavailable · Remaining days unavailable' },
  { id: 'payment-detail', component: 'PaymentTimeline', props: { ...payment, paymentMethod: 'card' }, text: 'Payment method: card' },
  { id: 'payment-events', component: 'PaymentEventTimeline', props: payment, text: '$19.99 USD · succeeded' },
  { id: 'payment-empty-next', component: 'PaymentTimeline', props: { ...payment, nextPayment: undefined }, text: 'No payment scheduled' },
  { id: 'payment-empty-last', component: 'PaymentEventTimeline', props: {}, text: 'No previous payment' },
  { id: 'card', component: 'BillingCardMeta', props: { amount: 1999, currency: 'usd', minorUnits: 100, interval: 'monthly' }, text: '$19.99 · monthly' },
  { id: 'card-zero', component: 'BillingCardMeta', props: { amount: 0, interval: 'yearly' }, text: '$0.00 · yearly' },
  { id: 'card-jpy', component: 'BillingCardMeta', props: { amount: 1999, currency: 'jpy', minorUnits: 1, interval: 'yearly' }, text: '¥1,999 · yearly' },
  { id: 'archived', component: 'ArchivedRowOverlay', props: { isArchived: true, label: 'Team', tabLabel: 'Archived' }, children: 'Team', text: 'TeamArchived' },
  { id: 'active', component: 'ArchivedRowOverlay', props: { isArchived: false }, children: 'Team', text: 'Team' },
];
function snapshot(html: string, component: string) {
  const document = new JSDOM(html).window.document;
  const root = document.querySelector(`[data-oods-component="${component}"]`)!;
  expect(root).not.toBeNull();
  const progress = root.querySelector('progress');
  return { text: root.textContent?.trim(), name: computeAccessibleName(root), role: root.getAttribute('role'), progress: progress ? { value: progress.getAttribute('value'), name: computeAccessibleName(progress) } : null,
    dates: [...root.querySelectorAll('time')].map((node) => ({ at: node.getAttribute('datetime'), text: node.textContent })), archived: root.getAttribute('data-archived'), hidden: root.getAttribute('aria-hidden'), tab: root.getAttribute('data-archive-tab') };
}
describe('Sprint 188 five remaining trait rows', () => {
  it('computes value and accessible-name parity across HTML, React and Vue with an empty difference allowlist', async () => {
    const receipts = [];
    for (const entry of cases) {
      const props = { id: entry.id, ...entry.props };
      const html = snapshot(renderMappedComponent({ id: entry.id, component: entry.component, props }, entry.children)!, entry.component);
      const react = snapshot(renderReact(createElement(ReactComponents[entry.component] as ComponentType, props, entry.children)), entry.component);
      const vue = snapshot(await renderVue(h(VueComponents[entry.component], props, entry.children ? { default: () => entry.children } : undefined)), entry.component);
      expect(html.text).toContain(entry.text); expect(html.text).not.toContain('undefined');
      expect(react, entry.id).toEqual(html); expect(vue, entry.id).toEqual(html);
      receipts.push({ id: entry.id, html, react, vue, differences: [] });
    }
    if (process.env.S188_M05_PARITY_OUTPUT) writeFileSync(process.env.S188_M05_PARITY_OUTPUT, JSON.stringify({ allowlist: [], receipts }, null, 2) + '\n');
  });
  it.each(['react', 'vue'] as const)('%s generates every value scenario and rejects wrong runtime types', async (framework) => {
    for (const entry of cases) {
      const schema = { version: '2026.02' as const, screens: [{ id: entry.id, component: entry.component, props: entry.props }] };
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    }
    for (const [component, props] of [['CycleProgressCard', { progress: '40' }], ['PaymentTimeline', { amount: '1999' }], ['PaymentEventTimeline', { nextPayment: 2 }], ['BillingCardMeta', { minorUnits: 0 }], ['ArchivedRowOverlay', { isArchived: 'false' }]] as const) {
      const result = await generate({ schema: { version: '2026.02', screens: [{ id: 'invalid', component, props }] }, framework, profile: 'build' });
      expect(result.status).toBe('error'); expect(result.errors?.some((error) => error.code === 'OODS-V007')).toBe(true);
    }
  });
});
