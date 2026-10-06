import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { buildVizSpecFromRows } from '../builder/spec-builder.js';
import { resolveCategoricalPalette, resolveSingleSeriesColor, toHex } from '../tokens/categorical-palette.js';
import { resolveOodsVegaConfig } from '../tokens/oods-vega-config.js';
import { getVizScaleTokens } from '../tokens/scale-token-mapper.js';
import { resolveTokenToColor } from './echarts/token-resolver.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

// Mutation-guard for the brand-fidelity palette bake (sprint-138 m02), colocated with
// the adapter it guards (s143 m03; s138-review confirmed gap). The bake — a nominal color
// channel gets the fixed-6 OODS palette as scale.range (convertBinding), and a single-series
// chart gets its single-series token as mark.color (createMark) — was previously tested ONLY
// downstream in mcp-server (certify's contentHash/consistency-lock specs run against
// viz-core's DIST). So disabling the bake in the source passed `pnpm --filter @oods/viz-core
// test` 315/315 and was caught only after a dist rebuild. These IMPORT THE SOURCE ADAPTER
// DIRECTLY (relative, not the @oods/viz-core barrel) so a src mutation fails HERE, at the
// viz-core unit level — the bake can never be silently removed again.
//
// Specs are built via buildVizSpecFromRows so the color binding carries trait
// 'EncodingColor' exactly as viz.render emits it (a plain {field} color would infer
// quantitative and never trigger the nominal bake — a hand-authored shortcut would test
// the wrong thing).

const ROWS = [
  { quarter: 'Q1', revenue: 100, region: 'North' },
  { quarter: 'Q2', revenue: 120, region: 'South' },
  { quarter: 'Q3', revenue: 90, region: 'East' },
];

// The fixed 6-slot OODS categorical viz-scale palette (default, no config.tokens override).
// The literal pin ALSO catches a token/palette drift; the resolveCategoricalPalette tie
// proves the baked bytes come from the SAME resolver certify grades.
// Sprint 195 m05's qualified Role-A revision changes light slot05 by one blue unit.
// s222-m02 (#2502 ruling 12): brand A's recipe palette: the indigo accent's step 9, then the hues 60° apart from it, each
// held to 3:1 on the canvas and CIEDE2000 12 apart under the three dichromacies (recipe.mjs vizPalette).
const OODS_CATEGORICAL_6 = ['#3E63DD', '#B98E00', '#800883', '#0C7B2D', '#7B0008', '#00A3B3'];

describe('vega-lite-adapter — OODS categorical palette bake (s138 m02; mutation guard s143 m03)', () => {
  it('multi-series: a nominal color encoding bakes the fixed-6 OODS palette into encoding.color.scale.range', () => {
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' }, color: { field: 'region' } },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as {
      encoding?: { color?: { type?: string; scale?: { range?: unknown } } };
    };

    // The bake landed on the color channel's scale.range as the OODS hex[] — NOT Vega's
    // default tableau10. Disabling the convertBinding color bake drops scale.range, so
    // this fails at the viz-core unit level (previously only mcp-server's dist run caught it).
    expect(compiled.encoding?.color?.type).toBe('nominal');
    expect(compiled.encoding?.color?.scale?.range).toEqual(OODS_CATEGORICAL_6);
    // Tie to the SHARED resolver both the adapter (bake) and certify-contrast (grade) call,
    // so "certified == rendered" holds by construction (categorical-palette.ts).
    expect(compiled.encoding?.color?.scale?.range).toEqual(resolveCategoricalPalette(spec));
  });

  it('s149 #853a: an EMPTY range:[] on a nominal color channel still bakes the palette (no dead-zone)', () => {
    // Pre-#853a the bake guard was `!binding.range`, which stepped aside for an empty
    // `range: []` too, while the F5 range-write guard (length>0) also skipped it — so
    // NEITHER write fired and the OODS palette was silently dropped. The length-based
    // `!binding.range?.length` guard bakes on empty-range, so the categorical channel
    // still gets its colors. Fails here (scale.range undefined) if the guard regresses.
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' }, color: { field: 'region', range: [] } },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as {
      encoding?: { color?: { type?: string; scale?: { range?: unknown } } };
    };
    expect(compiled.encoding?.color?.type).toBe('nominal');
    expect(compiled.encoding?.color?.scale?.range).toEqual(OODS_CATEGORICAL_6);
  });

  it('single-series: NO color encoding bakes the single-series token as mark.color', () => {
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as {
      encoding?: { color?: unknown };
      mark?: { color?: unknown };
    };

    // A single-series chart renders ONE color; the adapter bakes the single-series token as mark.color
    // so the render matches the slot certify grades. Disabling the createMark single-series
    // bake drops mark.color, so this fails here rather than silently downstream.
    expect(compiled.encoding?.color).toBeUndefined();
    // s222-m02: the one series is the first series, the accent's solid; the governed token carries it.
    expect(compiled.mark?.color).toBe(OODS_CATEGORICAL_6[0]);
    expect(compiled.mark?.color).toBe(resolveSingleSeriesColor(spec));
  });

  it('a continuous (quantitative) color channel is a gradient — NOT baked (role-B exempt)', () => {
    // Locks the nominal/ordinal SCOPING of the bake: removing that guard would wrongly bake a
    // categorical range onto a sequential gradient. A linear color scale stays range-free.
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: {
        x: { field: 'region' },
        y: { field: 'revenue', aggregate: 'sum' },
        color: { field: 'revenue', scale: 'linear' },
      },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as {
      encoding?: { color?: { type?: string; scale?: { range?: unknown } } };
    };
    expect(compiled.encoding?.color?.type).toBe('quantitative');
    expect(compiled.encoding?.color?.scale?.range).toBeUndefined();
  });
});

// Mutation-guard for the OODS chrome config bake (sprint-144 m02), colocated with the
// adapter it guards (mirrors the s138/s143 palette guard above). The chrome bake attaches
// the OODS-tokened Vega `config` theme — background/axes/gridlines/typography/legend/view —
// at the toVegaLiteSpec seam. Like the palette bake it was otherwise tested ONLY downstream
// in mcp-server against viz-core's DIST (the fidelity snapshots), so disabling the bake in
// SOURCE would pass `pnpm --filter @oods/viz-core test` and be caught only after a dist
// rebuild. This imports the SOURCE adapter + resolver DIRECTLY (relative, not the
// @oods/viz-core barrel) so a src mutation fails HERE, at the viz-core unit level.
describe('vega-lite-adapter — OODS chrome config bake (s144 m02; mutation guard s144 m03)', () => {
  it('a cartesian spec carries the OODS chrome config (background/axis/font/gridlines/view)', () => {
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' } },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as {
      config?: {
        background?: string;
        font?: string;
        title?: { color?: string; fontSize?: number; fontWeight?: number; anchor?: string };
        axis?: { titleColor?: string; labelColor?: string; gridColor?: string; domainColor?: string; tickColor?: string };
        axisX?: { grid?: boolean };
        axisY?: { grid?: boolean };
        legend?: { titleColor?: string; labelColor?: string };
        view?: { stroke?: unknown };
        mark?: unknown;
        range?: unknown;
      };
    };

    // Background = the surface-canvas the render sits on (also the canvas certify grades against). s222-m01 (#2502
    // ruling 4): the neutral-first canvas and text; s222-m02 (ruling 12): the brand's own sans, Geist for brand A.
    expect(compiled.config?.background).toBe('#FFFFFF');
    expect(compiled.config?.font).toBe("Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif");
    // Title chrome (left-anchored heading-lg).
    expect(compiled.config?.title?.color).toBe('#0A0A0A');
    expect(compiled.config?.title?.fontSize).toBe(24);
    expect(compiled.config?.title?.fontWeight).toBe(600);
    expect(compiled.config?.title?.anchor).toBe('start');
    // Axis chrome: text-primary titles, text-neutral labels, subtle H-grid, neutral domain/ticks.
    // Neutral steps: text 12 and 11, the grid the subtle border (step 6), domain and ticks the strong one (step 7).
    expect(compiled.config?.axis?.titleColor).toBe('#0A0A0A');
    expect(compiled.config?.axis?.labelColor).toBe('#525252');
    expect(compiled.config?.axis?.gridColor).toBe('#E5E5E5');
    expect(compiled.config?.axis?.domainColor).toBe('#D4D4D4');
    expect(compiled.config?.axis?.tickColor).toBe('#D4D4D4');
    // Gridlines are horizontal-only (Y grid on, X grid off) — regardless of orientation.
    expect(compiled.config?.axisX?.grid).toBe(false);
    expect(compiled.config?.axisY?.grid).toBe(true);
    // Legend chrome + the grey plot box killed.
    expect(compiled.config?.legend?.titleColor).toBe('#0A0A0A');
    expect(compiled.config?.legend?.labelColor).toBe('#525252');
    expect(compiled.config?.view?.stroke).toBeNull();

    // The whole config block is exactly the shared resolver's output (single source), plus the two keys a chart the compile
    // sizes adds. s222-m02 (#2502 ruling 12): this summed bar over three quarters is a small categorical chart now (its y is
    // quantitative as the compile infers it, not only when declared); its labels fit the narrowest render, so they are kept
    // level, and its y axis labels about five values at most.
    const shared = resolveOodsVegaConfig(spec);
    expect(compiled.config).toEqual({ ...shared, axisX: { ...shared.axisX, labelAngle: 0 }, axisY: { ...shared.axisY, tickCount: { expr: 'min(5, ceil(height / 40))' } } });
  });

  it('chrome-only guardrail: the bake emits NO series-color surface (config.mark / config.range)', () => {
    // certify reads encoding/mark-level color, NOT config — a config-level series color would
    // be graded-invisible yet render-visible (a render/certify drift hole). The default cartesian
    // bake (no caller config.mark) must therefore carry neither config.mark nor config.range.
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' }, color: { field: 'region' } },
    } as never);
    const compiled = toVegaLiteSpec(spec) as unknown as { config?: { mark?: unknown; range?: unknown } };
    expect(compiled.config?.mark).toBeUndefined();
    expect(compiled.config?.range).toBeUndefined();
  });

  it("backward-compat (#84): a caller's config.mark survives the merge alongside the chrome", () => {
    // The chrome config carries no `mark` key; a caller mark is spread LAST so it wins its own
    // key with zero collision. The chrome (background) must remain present under the merge.
    const { spec } = buildVizSpecFromRows({
      rows: ROWS,
      chartType: 'bar',
      encodings: { x: { field: 'quarter' }, y: { field: 'revenue', aggregate: 'sum' } },
    } as never);
    const withMark = { ...spec, config: { ...spec.config, mark: { tooltip: true } } };
    const compiled = toVegaLiteSpec(withMark) as unknown as {
      config?: { mark?: { tooltip?: boolean }; background?: string };
    };
    expect(compiled.config?.mark?.tooltip).toBe(true);
    expect(compiled.config?.background).toBe('#FFFFFF');
  });
});

// Item #16 (sprint-151 m03): a layered mark's `from` resolves against the new top-level
// `datasets` slot. Before m03 the adapter emitted the layer's `data:{name:mark.from}`
// (vega-lite-adapter.ts:185) but NEVER the backing top-level `datasets` map — a DANGLING
// name-reference. m03 threads `spec.datasets` onto baseSpec (Vega-Lite's native top-level
// `datasets` block) so the layer name resolves. Hand-authored specs so the layered `from`
// path is exercised directly (buildVizSpecFromRows never emits `from`/`datasets`).
describe('vega-lite-adapter — item #16 datasets slot resolves Mark.from (s151 m03)', () => {
  // median rows keyed differently (median before site) than the encoding channels, to
  // document that Vega-Lite resolves named-dataset fields by NAME natively (not by order).
  const MEDIAN_ROWS = [
    { median: 83, site: 'Site A' },
    { median: 83, site: 'Site B' },
  ];
  const LADDER_ROWS = [
    { site: 'Site A', score: 92 },
    { site: 'Site B', score: 74 },
  ];

  function ladderSpec(withDatasets: boolean) {
    return {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'ladder',
      name: 'Accessibility Ladder',
      data: { name: 'ladder', values: LADDER_ROWS },
      marks: [
        {
          trait: 'MarkBar',
          encodings: {
            x: { field: 'site', trait: 'EncodingX' },
            y: { field: 'score', trait: 'EncodingY' },
          },
        },
        {
          trait: 'MarkLine',
          from: withDatasets ? 'gov_median' : undefined,
          encodings: {
            x: { field: 'median', trait: 'EncodingX' },
            y: { field: 'site', trait: 'EncodingY' },
          },
        },
      ],
      encoding: {
        x: { field: 'site', trait: 'EncodingX' },
        y: { field: 'score', trait: 'EncodingY' },
      },
      a11y: { description: 'Accessibility ladder with a government-median rule overlay.' },
      ...(withDatasets ? { datasets: { gov_median: MEDIAN_ROWS } } : {}),
    } as never;
  }

  it('emits the top-level datasets map + the layer data:{name} that resolves against it (fails at HEAD: no top-level datasets)', () => {
    const compiled = toVegaLiteSpec(ladderSpec(true)) as unknown as {
      datasets?: Record<string, unknown>;
      layer?: readonly { data?: { name?: string }; encoding?: { x?: { field?: string } } }[];
    };

    // The backing datasets map is now present at the top level (Vega-Lite native).
    expect(compiled.datasets).toEqual({ gov_median: MEDIAN_ROWS });

    // The secondary layer's data:{name} names a REGISTERED dataset (no longer dangling),
    // and its fields bind by encoding field NAME (Vega-Lite columnar resolution).
    const secondary = compiled.layer?.find((l) => l.data?.name === 'gov_median');
    expect(secondary).toBeDefined();
    expect(secondary?.encoding?.x?.field).toBe('median');
  });

  it('primary (inline) layer data path is byte-UNCHANGED by the datasets slot (mixed-spec contract)', () => {
    const withDs = toVegaLiteSpec(ladderSpec(true)) as unknown as {
      data?: unknown;
      layer?: readonly { data?: unknown; mark?: { type?: string } }[];
    };
    const noDs = toVegaLiteSpec(ladderSpec(false)) as unknown as {
      data?: unknown;
      layer?: readonly { data?: unknown; mark?: { type?: string } }[];
    };

    // Top-level primary data unchanged.
    expect(withDs.data).toEqual(noDs.data);
    // The primary bar layer carries NO own `data` (inherits top-level data) in both cases —
    // only `from`-referenced layers gain a data:{name}.
    const primaryWith = withDs.layer?.find((l) => l.mark?.type === 'bar');
    const primaryNo = noDs.layer?.find((l) => l.mark?.type === 'bar');
    expect(primaryWith?.data).toBeUndefined();
    expect(primaryWith).toEqual(primaryNo);
  });

  it('OMITS top-level datasets when spec.datasets is absent → no datasets key (gate-leak guard)', () => {
    const compiled = toVegaLiteSpec(ladderSpec(false)) as unknown as Record<string, unknown>;
    // Not `datasets: undefined`, not `datasets: {}` — the key must be entirely absent so a
    // Forge spec without the slot compiles byte-identically to pre-#16.
    expect('datasets' in compiled).toBe(false);
  });
});

// s156-m04 (NASA #4 + band M2): a diverging color scale is a continuous quantitative
// gradient centered at zero. The IR carries `scale:'diverging'` on the color channel;
// the adapter must (i) type the color quantitative (so Vega renders a gradient, not a
// discrete palette) and (ii) bake the OODS diverging viz-scale as `scale.range` + a
// `domainMid:0` so the two hues diverge about zero. The range is resolved through the
// SAME token→hex chain certify/the categorical bake use, so "rendered == certified".
// At HEAD `scale:'diverging'` was schema-invalid AND typed nominal with no range → RED.
const OODS_DIVERGING_HEX = getVizScaleTokens('diverging')
  .map((token) => toHex(resolveTokenToColor(token) ?? ''))
  .filter((color): color is string => Boolean(color));

function divergingColorSpec(): NormalizedVizSpec {
  const color = {
    field: 'delta',
    trait: 'EncodingColor',
    scale: 'diverging' as const,
    title: 'Impact',
  };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'diverging-bar',
    name: 'Impact by Driver',
    data: {
      name: 'drivers',
      values: [
        { driver: 'A', delta: -40 },
        { driver: 'B', delta: 15 },
        { driver: 'C', delta: 60 },
      ],
    },
    marks: [
      {
        trait: 'MarkBar',
        encodings: {
          x: { field: 'driver', trait: 'EncodingX' },
          y: { field: 'delta', trait: 'EncodingY' },
          color: { ...color },
        },
      },
    ],
    encoding: {
      x: { field: 'driver', trait: 'EncodingX' },
      y: { field: 'delta', trait: 'EncodingY' },
      color: { ...color },
    },
    a11y: { description: 'Impact delta by driver, diverging about zero.' },
  } as NormalizedVizSpec;
}

describe('vega-lite-adapter — diverging color scale (s156 m04)', () => {
  it('bakes the OODS diverging range + domainMid:0 and types the color quantitative (fails at HEAD: nominal, no range)', () => {
    const compiled = toVegaLiteSpec(divergingColorSpec()) as unknown as {
      encoding?: { color?: { type?: string; scale?: { range?: unknown; domainMid?: number } } };
    };

    // A gradient, not a categorical swatch set — diverging is inherently continuous.
    expect(compiled.encoding?.color?.type).toBe('quantitative');
    // The neutral hue lands on zero so positive/negative read as opposite directions.
    expect(compiled.encoding?.color?.scale?.domainMid).toBe(0);
    // The baked range is the OODS diverging scale, resolved through the shared chain.
    expect(OODS_DIVERGING_HEX.length).toBeGreaterThan(2);
    expect(compiled.encoding?.color?.scale?.range).toEqual(OODS_DIVERGING_HEX);
  });
});
