import { createRequire } from 'node:module';
import { sharedScenarios } from '@oods/component-contracts';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { createElement, type ComponentType } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { preflightTargetCapabilities } from '../../src/codegen/target-readiness.js';
import { handle as generate } from '../../src/tools/code.generate.js';

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');
const components = ['BillingSummaryBadge', 'BillingAmountInput', 'BillingIntervalSelector'] as const;
const cells = (['react', 'vue'] as const).flatMap((framework) => components.map((component) => ({ framework, component, cell: `${framework}/${component}` })));

describe('Sprint 188 billing exports, readiness and generation cells', () => {
  it.each(cells)('$cell', async ({ framework, component }) => {
    const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === component)!;
    const node = { id: `billing-${component}`, component, props: { ...scenario.props } };
    // Generation is checked first so an export bite must reach the public build gate.
    const generated = await generate({ schema: { version: '2026.02', screens: [node] }, framework, profile: 'build' });
    expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
    expect(preflightTargetCapabilities([node], framework)).toEqual([]);
    const implementation = (framework === 'react' ? ReactComponents : VueComponents)[component];
    expect(implementation).toBeDefined();
    const html = framework === 'react'
      ? renderReact(createElement(implementation as ComponentType, { ...scenario.props }))
      : await renderVue(h(implementation, { ...scenario.props }));
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(component === 'BillingSummaryBadge' ? '$19.99' : component === 'BillingAmountInput' ? '19.99' : 'yearly');
  });
});
