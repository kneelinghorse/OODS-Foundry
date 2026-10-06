import { createRequire } from 'node:module';
import { sharedScenarios } from '@oods/component-contracts';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { JSDOM } from 'jsdom';
import { createElement, type ComponentType } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { preflightTargetCapabilities } from '../../src/codegen/target-readiness.js';

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');
export const S187_COMPONENTS = [
  'ArchiveSummary', 'ArchivePill', 'CancellationBadge', 'CancellationForm', 'PriceCardMeta',
  'OwnerBadge', 'OwnershipSummary', 'OwnershipMeta', 'TagSummary',
  'LabelCell', 'InlineLabel', 'FormLabelGroup', 'ClassificationBadge', 'ClassificationEditor',
] as const;
const CELLS = (['react', 'vue'] as const).flatMap((framework) => (
  S187_COMPONENTS.map((component) => ({ framework, component, cell: `${framework}/${component}` }))
));

// One named test per built package export: deletion must kill only its own cell.
describe('Sprint 187 built package export cells', () => {
  it.each(CELLS)('$cell', async ({ framework, component }) => {
    const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === component)!;
    expect(scenario, component).toBeDefined();
    const implementation = (framework === 'react' ? ReactComponents : VueComponents)[component];
    expect(implementation, `${framework}/${component} built root export`).toBeDefined();
    const html = framework === 'react'
      ? renderReact(createElement(implementation as ComponentType, { ...scenario.props }))
      : await renderVue(h(implementation, { ...scenario.props }));
    const root = JSDOM.fragment(html).querySelector(`[data-oods-component="${component}"]`)!;
    expect(root, `${framework}/${component} SSR marker`).not.toBeNull();
    if (component === 'LabelCell') {
      expect(root.querySelector('[data-oods-label-cell-primary]')?.textContent).toBe('Long pr...');
      expect(root.querySelector('[data-oods-label-cell-description]')?.textContent).toBe('Long su...');
    } else if (component === 'InlineLabel') {
      expect(root.textContent).toBe('Long in...');
    } else if (component === 'FormLabelGroup') {
      expect(root.tagName).toBe('LABEL');
      expect(root.getAttribute('for')).toBe('product-name');
      expect(root.querySelector('[data-oods-form-hint]')?.textContent).toBe('Name shown to customers');
    } else if (component === 'ClassificationBadge') {
      expect(root.querySelector('[data-oods-badge-label]')?.textContent).toBe('Electronics');
      expect(root.getAttribute('data-badge-status')).toBe('strict');
      expect(root.getAttribute('data-badge-variant')).toBe('classification');
    } else if (component === 'ClassificationEditor') {
      expect(root.tagName).toBe('FORM');
      expect(root.querySelector('input[name="category"]')?.getAttribute('value')).toBe('Electronics');
      expect(root.querySelector('input[name="tags"]')?.getAttribute('value')).toBe('["alpha","beta"]');
      // Display labels are humanized; the submitted enum remains unchanged.
      expect(root.querySelector('option[selected]')?.textContent).toBe('Flexible');
      expect(root.querySelector('option[selected]')?.getAttribute('value')).toBe('flexible');
    }
    if (component === 'OwnerBadge') {
      expect(root.textContent).toBe('user-7');
      expect(root.getAttribute('data-badge-variant')).toBe('owner');
    } else if (component === 'OwnershipSummary') {
      // s213-m01: Sprint 212 m02 (806ce6ded, #2326) shows an owner only by an explicitly resolved label; a bare id is honest
      // unavailability, never a name. This expectation still read the id (learning #723).
      expect([...root.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['Owner reference not resolved', 'person', 'administrator']);
      expect(root.getAttribute('role')).toBeNull();
    } else if (component === 'OwnershipMeta') {
      expect([...root.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Owner Type: organization', 'Role: custodian']);
      expect(root.getAttribute('role')).toBeNull();
    } else if (component === 'TagSummary') {
      expect([...root.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['0', 'alpha, beta']);
    }
    if (component === 'ArchivePill' || component === 'CancellationBadge') {
      // s220-m01 (#2461): the archive flag reads in words, as the cancellation flag does; the status stays literal.
      expect(root.textContent).toBe(component === 'CancellationBadge' ? 'No cancellation scheduled' : 'Not archived');
      expect(root.getAttribute('data-badge-status')).toBe('false');
    } else if (component === 'ArchiveSummary') {
      expect([...root.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['No', 'Sep 5, 2026, 12:00 PM', 'Retention policy']);
    } else if (component === 'CancellationForm') {
      expect(root.querySelector('option[selected]')?.textContent).toBe('Budget');
      expect(root.querySelector('option[selected]')?.getAttribute('value')).toBe('budget');
      expect(root.querySelector('textarea')?.textContent).toBe('Costs changed');
    } else if (component === 'PriceCardMeta') {
      // s220-m01: pricing codes read as PriceSummary reads them (formatPriceCode).
      expect([...root.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Model: Flat', 'Interval: Monthly']);
    }
    expect(preflightTargetCapabilities([{ id: `export-${component}`, component, props: { ...scenario.props } }], framework)).toEqual([]);
  });
});
