// viz.render network/hierarchy render-fidelity goldens (sprint-111 m05).
//
// The viz.render.fidelity goldens (sibling file) snapshot the Vega-Lite specs the 5
// tabular beachhead charts compile to. The 4 network/hierarchy types have NO
// Vega-Lite equivalent — their renderable payload is the ECharts option (echartsSpec,
// auto-promoted). This suite closes the analogous gap at the viz.render BOUNDARY:
// for treemap/sunburst/sankey/force_graph it pins the produced echartsSpec to a
// golden, so any drift in the engine -> handler -> ECharts payload is caught, and it
// asserts determinism (same input -> byte-identical echartsSpec).
//
// echartsSpec is already JSON-safe (the handler drops the tooltip-formatter closure),
// so the snapshot is the deterministic, transmittable option the agent receives. The
// client-side force LAYOUT is not part of the option (m04 audit) and is not goldened.
//
// #2411 (s216-m04, 8edb5e4b9): these inputs are unnamed, so each option carries its chart
// type's default accessible name in usermeta.oods.a11y.ariaLabel.

import { describe, expect, it } from 'vitest';
import type { VizRenderInput } from '../schemas/generated.js';
import { handle } from './viz.render.js';

const render = (input: Record<string, unknown>) => handle(input as unknown as VizRenderInput);

const HIERARCHY = {
  type: 'nested',
  data: {
    name: 'Org',
    value: 100,
    children: [
      { name: 'Engineering', value: 60, children: [{ name: 'Frontend', value: 25 }, { name: 'Backend', value: 35 }] },
      { name: 'Sales', value: 40 },
    ],
  },
};
const SANKEY = {
  nodes: [{ name: 'Coal' }, { name: 'Grid' }, { name: 'Homes' }, { name: 'Industry' }],
  links: [
    { source: 'Coal', target: 'Grid', value: 100 },
    { source: 'Grid', target: 'Homes', value: 60 },
    { source: 'Grid', target: 'Industry', value: 40 },
  ],
};
const NETWORK = {
  nodes: [
    { id: 'web', group: 'frontend', value: 9 },
    { id: 'api', group: 'backend', value: 6 },
    { id: 'db', group: 'data', value: 4 },
  ],
  links: [
    { source: 'web', target: 'api', value: 3 },
    { source: 'api', target: 'db', value: 2 },
  ],
};
// sprint-120 m01 chord — sankey-shaped (required-value links), but rendered as a
// native series.type:'chord' ring (its own ECharts-primary type, the 'chord' branch).
const CHORD = {
  nodes: [{ name: 'AMER' }, { name: 'EMEA' }, { name: 'APAC' }],
  links: [
    { source: 'AMER', target: 'EMEA', value: 42 },
    { source: 'EMEA', target: 'APAC', value: 31 },
    { source: 'APAC', target: 'AMER', value: 25 },
  ],
};

const CASES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['treemap', { chartType: 'treemap', hierarchy: HIERARCHY }],
  ['sunburst', { chartType: 'sunburst', hierarchy: HIERARCHY }],
  ['sankey', { chartType: 'sankey', sankey: SANKEY }],
  ['force_graph', { chartType: 'force_graph', network: NETWORK }],
  ['chord', { chartType: 'chord', chord: CHORD }],
];

describe('viz.render network/hierarchy render-fidelity goldens', () => {
  for (const [name, input] of CASES) {
    it(`${name}: the produced echartsSpec matches the committed golden`, async () => {
      const out = await render(input);
      expect(out.status).toBe('ok');
      expect(out.chartType).toBe(name);
      // The renderable payload is the ECharts option; pin it (specRef trio is
      // per-call unique, so snapshot only the payload).
      expect(out.echartsSpec).toMatchSnapshot();
    });

    it(`${name}: same input -> byte-identical echartsSpec (determinism gate)`, async () => {
      const a = await render(input);
      const b = await render(input);
      expect(JSON.stringify(a.echartsSpec)).toBe(JSON.stringify(b.echartsSpec));
    });
  }
});
