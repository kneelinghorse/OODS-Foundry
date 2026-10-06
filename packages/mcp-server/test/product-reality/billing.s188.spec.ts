import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, type ComponentType } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { parseBillingAmount } from '@oods/component-contracts';
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

type BillingComponent = 'BillingSummaryBadge' | 'BillingAmountInput' | 'BillingIntervalSelector';
const cases: Array<{ id: string; component: BillingComponent; props: Record<string, unknown>; text: string }> = [
  ...[[1999, 'usd', 100, '$19.99'], [0, 'usd', 100, '$0.00'], [1999, 'jpy', 1, '¥1,999']].map(([amount, currency, minorUnits, text]) => ({
    id: `summary-${currency}-${amount}`, component: 'BillingSummaryBadge' as const, props: { amount, currency, minorUnits, interval: 'monthly' }, text: `${text} · monthly`,
  })),
  { id: 'amount', component: 'BillingAmountInput', props: { amount: 1999, currency: 'usd', minorUnits: 100 }, text: 'Billing amountUSD' },
  { id: 'amount-zero', component: 'BillingAmountInput', props: { amount: 0 }, text: 'Billing amountUSD' },
  { id: 'amount-empty', component: 'BillingAmountInput', props: {}, text: 'Billing amountUSD' },
  { id: 'amount-invalid', component: 'BillingAmountInput', props: { amount: -1 }, text: 'Billing amountUSDEnter a non-negative amount.' },
  { id: 'interval', component: 'BillingIntervalSelector', props: { interval: 'monthly', intervals: ['monthly', 'yearly'] }, text: 'Billing intervalMonthlyYearly' },
  { id: 'interval-invalid', component: 'BillingIntervalSelector', props: { interval: 'weekly', intervals: ['monthly', 'yearly'] }, text: 'Billing intervalweeklyMonthlyYearlyChoose a valid billing interval.' },
];

function snapshot(html: string, component: string) {
  const document = new JSDOM(html).window.document;
  const root = document.querySelector(`[data-oods-component="${component}"]`)!;
  expect(root).not.toBeNull();
  const control = root.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  return {
    text: root.textContent?.trim(), name: computeAccessibleName(control ?? root),
    value: control?.value ?? null, invalid: control?.getAttribute('aria-invalid') ?? null,
    options: [...root.querySelectorAll('option:not([disabled])')].map((option) => option.textContent),
    error: root.querySelector('[role="alert"]')?.textContent ?? null,
  };
}

describe('Sprint 188 Billable list/form contracts', () => {
  it('computes HTML/React/Vue visible-text and accessible-name parity with no allowlisted differences', async () => {
    const receipts = [];
    for (const entry of cases) {
      const props = { id: entry.id, ...entry.props };
      const html = snapshot(renderMappedComponent({ id: entry.id, component: entry.component, props })!, entry.component);
      const react = snapshot(renderReact(createElement(ReactComponents[entry.component] as ComponentType, props)), entry.component);
      const vue = snapshot(await renderVue(h(VueComponents[entry.component], props)), entry.component);
      expect(html.text, entry.id).toBe(entry.text);
      expect(react, `${entry.id}: React vs HTML`).toEqual(html);
      expect(vue, `${entry.id}: Vue vs HTML`).toEqual(html);
      receipts.push({ id: entry.id, html, react, vue, differences: [] });
    }
    if (process.env.BILLING_PARITY_RECEIPT) writeFileSync(process.env.BILLING_PARITY_RECEIPT, JSON.stringify({ allowlist: [], receipts }, null, 2) + '\n');
  });

  it('keeps decimal half-up rounding deterministic at money boundaries', () => {
    for (const [input, units, value] of [['19.99', 100, 1999], ['1.005', 100, 101], ['0.5', 1, 1], ['', 100, undefined], ['0', 100, 0]] as const) {
      expect(parseBillingAmount(input, units)).toEqual({ valid: true, value });
    }
    for (const input of ['-1', '-0', 'NaN', '1e3', '1.2.3', '9007199254740992']) expect(parseBillingAmount(input).valid).toBe(false);
  });

  it.each(['react', 'vue'] as const)('%s rejects unsupported runtime values and emits valid typed billing props', async (framework) => {
    for (const [component, props] of [
      ['BillingSummaryBadge', { amount: '1999' }], ['BillingAmountInput', { minorUnits: 0 }], ['BillingIntervalSelector', { intervals: [1, 2] }],
    ] as const) {
      const result = await generate({ schema: { version: '2026.02', screens: [{ id: 'billing', component, props }] }, framework, profile: 'build' });
      expect(result.status).toBe('error');
      expect(result.errors?.some((error) => error.code === 'OODS-V007')).toBe(true);
    }
    for (const entry of cases.filter((entry) => !entry.id.includes('invalid'))) {
      const result = await generate({ schema: { version: '2026.02', screens: [{ id: entry.id, component: entry.component, props: entry.props }] }, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    }
    for (const [component, type] of [['BillingAmountInput', 'number | undefined'], ['BillingIntervalSelector', 'string']] as const) {
      const result = await generate({ schema: { version: '2026.02', screens: [{ id: 'update', component, bindings: { onChange: 'handleBillingChange' } }] }, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      expect(result.artifact?.actions.find((action) => action.name === 'handleBillingChange')?.parameters[0]?.type).toBe(type);
    }
  });
});
