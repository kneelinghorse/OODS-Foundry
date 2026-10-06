// viz.render render-fidelity goldens (sprint-109 m06).
//
// The other viz.render tests prove the output is AJV-valid and that the embedded
// NormalizedVizSpec IR validates. That is necessary but NOT sufficient for the
// Phase-0 success outcome ("a genuinely renderable, data-bound Vega-Lite spec"):
// an AJV-valid Vega-Lite spec can still fail to compile or parse. This suite
// closes that gap by mirroring the spatial visual-regression test
// (tests/viz/adapters/spatial/vega-lite-visual-regression.test.ts): it takes the
// viz.render-produced spec for each beachhead chart type and runs the REAL
// Vega-Lite -> Vega -> View pipeline (vl.compile + vega.parse + new vega.View),
// asserting (a) the spec actually DRAWS data marks to SVG and (b) the input rows
// survive end-to-end in data.values. The 5 produced specs are snapshotted as
// goldens so any drift in the engine -> handler -> renderer payload is caught.

import * as vega from 'vega';
import * as vl from 'vega-lite';
import { describe, expect, it } from 'vitest';
import type { VizRenderInput } from '../schemas/generated.js';
import { handle } from './viz.render.js';

// Rich enough to exercise all five beachhead charts: two dimensions
// (region nominal, quarter ISO-temporal) and two measures (revenue, units).
import { SALES, CASES } from './__fixtures__/cartesian-render.js';
import type { FidelityCase } from './__fixtures__/cartesian-render.js';

const render = (input: Record<string, unknown>) => handle(input as unknown as VizRenderInput);

// Drive the full Vega-Lite -> Vega -> View pipeline and return the rendered SVG.
// Renders a DEEP CLONE on purpose: vega.parse + View tag every datum with a
// process-global Symbol(vega_id) by mutating data.values IN PLACE. Cloning first
// keeps the handler's spec (and thus the snapshot) pristine and free of
// allocation-order-dependent ids. Throws if the spec cannot be compiled or
// parsed — exactly the failure this suite is meant to catch.
async function renderSvg(spec: vl.TopLevelSpec): Promise<string> {
  const { spec: compiled } = vl.compile(structuredClone(spec) as vl.TopLevelSpec);
  const view = new vega.View(vega.parse(compiled), { renderer: 'none' });
  return view.toSVG();
}

// Vega's SVG renderer wraps each mark set in
//   <g class="mark-<type> role-mark marks"> …one geometry element per datum… </g>
// A degenerate render (empty data, wrong field, no encoding) still emits the
// <svg> shell plus axes but an EMPTY mark group. Asserting the group exists AND
// carries a geometry child is what makes "renderable" mean "the data drew",
// rather than merely "the View instantiated without throwing".
function assertDrewMarks(svg: string, markType: FidelityCase['svgMark']): void {
  const group = svg.match(new RegExp(`<g class="mark-${markType} role-mark[^"]*"[^>]*>(.*?)</g>`, 's'));
  expect(group, `rendered SVG is missing a mark-${markType} group`).toBeTruthy();
  expect(group?.[1], `mark-${markType} group drew no data geometry`).toMatch(/<(path|line|rect|symbol)\b/);
}

describe('viz.render render fidelity (renderable, not just AJV-valid)', () => {
  it.each(CASES)(
    '$chartType: viz.render produces a spec that compiles, parses, draws, and keeps its data',
    async ({ chartType, encodings, svgMark }) => {
      const out = await render({ rows: SALES, chartType, encodings });
      expect(out.status).toBe('ok');
      expect(out.chartType).toBe(chartType);

      const spec = out.spec as unknown as vl.TopLevelSpec;

      // Data-bound: the input rows survive end-to-end, byte-equal.
      const values = (spec as Record<string, any>).data?.values;
      expect(values).toHaveLength(SALES.length);
      expect(values).toEqual(SALES.map((row) => ({ ...row })));

      // Golden: lock the pristine handler payload. Snapshot BEFORE rendering so
      // the golden reflects the emitted spec, not vega's runtime-mutated copy.
      expect(spec).toMatchSnapshot();

      // Renderable: the real renderer pipeline actually draws the data marks.
      const svg = await renderSvg(spec);
      expect(svg).toContain('<svg');
      assertDrewMarks(svg, svgMark);
    },
  );

  it('explicit color range (F5): the agent-supplied scale wins over the baked OODS palette and stays renderable', async () => {
    // sprint-147 F5: an explicit color `range` overrides the s138 OODS categorical
    // bake on a nominal/ordinal color channel. This is the ONE net-new with-range
    // golden — the no-range CASES above stay byte-identical (the bake steps aside).
    const AGENT_RANGE = ['#264653', '#E76F51'] as const;
    const out = await render({
      rows: SALES,
      chartType: 'line',
      encodings: {
        x: { field: 'quarter', scale: 'temporal' },
        y: { field: 'revenue', aggregate: 'sum' },
        color: { field: 'region', range: [...AGENT_RANGE] },
      },
    });
    expect(out.status).toBe('ok');

    const spec = out.spec as unknown as vl.TopLevelSpec;

    // The agent range is baked into scale.range verbatim, in supplied order — NOT
    // the OODS palette. This is the load-bearing #564 tripwire: a forgotten builder
    // copy or a forgotten !binding.range bake guard would show the palette here.
    const colorScaleRange = (spec as Record<string, any>).encoding?.color?.scale?.range;
    expect(colorScaleRange).toEqual([...AGENT_RANGE]);

    // Golden: lock the pristine with-range payload.
    expect(spec).toMatchSnapshot();

    // Renderable: the overridden scale still compiles, parses, and draws marks.
    const svg = await renderSvg(spec);
    expect(svg).toContain('<svg');
    assertDrewMarks(svg, 'line');
  });

  it('suggest mode (no chartType): the data-aware pick is renderable and golden-locked at the render boundary', async () => {
    const out = await render({ rows: SALES });
    expect(out.status).toBe('ok');
    expect(out.mode).toBe('suggest');

    const spec = out.spec as unknown as vl.TopLevelSpec;
    // Data survives end-to-end.
    expect((spec as Record<string, any>).data?.values).toHaveLength(SALES.length);

    // Golden: lock the CHOSEN chartType + the pristine spec, so a recommendation
    // change surfaces as a snapshot diff at the render boundary (the CASES above
    // are all explicit chartType; this is the suggest-mode fidelity case).
    expect({ chartType: out.chartType, mark: out.meta?.mark, spec }).toMatchSnapshot();

    // Renderable: the recommended chart compiles, parses, and draws real geometry.
    const svg = await renderSvg(spec);
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/<(path|line|rect|symbol)\b/);
  });
});
