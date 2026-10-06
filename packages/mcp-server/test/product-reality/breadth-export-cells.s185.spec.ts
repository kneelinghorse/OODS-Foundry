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
const COMPONENTS = ['DetailHeader', 'CardHeader', 'ColorSwatch', 'ColorizedBadge', 'VizAreaPreview'] as const;
const CELLS = (['react', 'vue'] as const).flatMap((framework) => (
  COMPONENTS.map((component) => ({ framework, component, cell: `${framework}/${component}` }))
));

// Keep exactly one test per package/target cell. Namespace imports let a missing
// root export fail only its cell instead of aborting named-import collection for
// every test; each mutation rebuilds the selected package before this spec runs.
describe('Sprint 185 built package export cells', () => {
  it.each(CELLS)('$cell', async ({ framework, component }) => {
    const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === component);
    expect(scenario, component).toBeDefined();
    const implementation = framework === 'react'
      ? (ReactComponents as Record<string, unknown>)[component]
      : (VueComponents as Record<string, unknown>)[component];
    expect(implementation, `${framework}/${component} built root export`).toBeDefined();
    const slot = scenario!.slots.default;
    const html: string = framework === 'react'
      ? renderReact(createElement(
          implementation as ComponentType,
          { ...scenario!.props },
          slot === undefined ? undefined : String(slot),
        ))
      : await renderVue(h(
          implementation,
          { ...scenario!.props },
          slot === undefined ? undefined : { default: () => String(slot) },
        ));
    const fragment = JSDOM.fragment(html);
    const root = fragment.querySelector(`[data-oods-component="${component}"]`);
    expect(root, `${framework}/${component} SSR marker`).not.toBeNull();
    expect(root!.textContent!.trim().length).toBeGreaterThan(0);
    if (component === 'DetailHeader') {
      expect(root!.querySelector('h1')?.textContent).toBe('Subscription details');
    } else if (component === 'CardHeader') {
      expect(root!.querySelector('h2')?.textContent).toBe('Account summary');
    } else if (component === 'ColorSwatch') {
      expect(root!.getAttribute('data-swatch-color')).toBe('#2563eb');
      expect(root!.textContent).toContain('Ocean blue');
    } else if (component === 'ColorizedBadge') {
      expect(root!.getAttribute('data-badge-color')).toBe('#15803d');
      expect(root!.textContent).toContain('Approved');
    } else {
      expect(root!.getAttribute('data-viz-preview-type')).toBe('area');
      expect(root!.textContent).toBe('Authored area preview content');
    }
    expect(preflightTargetCapabilities([
      { id: `export-${component}`, component, props: { ...scenario!.props } },
    ], framework)).toEqual([]);
  });
});
