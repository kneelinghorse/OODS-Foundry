import { describe, expect, it } from 'vitest';
import { analyzeVizSpec, toEChartsOption, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-161 m5 — c6: ECharts visualMap facet-limit honesty (SSOT §2-m5, Fork-4=A). A faceted
// aggregated MarkRect heatmap truncated by layout.columns.limit / layout.maxPanels draws only the
// RENDERED panels in ECharts, but buildHeatmapVisualMap computed its extent over ALL aggregated
// cells → it legended a value drawn on no panel (the s160 review's facet-limit phantom: visualMap
// max=94 vs ECharts-drawn max=30). The fix scopes the ECharts visualMap to the rendered cells; the
// shared a11y narrative stays at the FULL-data extremum (94) — honest for the Vega-PRIMARY render,
// which draws every panel (convertFacetField ignores limit). RED-first: repro_facet_limit_phantom.mjs.
// MUTATION gate: revert the visualMap scoping (drop facetRenderedCellFilter) → visualMap max returns
// to 94 while the ECharts render draws max 30 → the truncated cases below go RED.
// ============================================================================

const B = (field: string, trait: string, extra: Record<string, unknown> = {}) => ({ field, trait, ...extra });

// Aggregated heatmap, one cell per site: A=10, B=30, C=94 (hand oracle). `layout` chooses truncation.
function limitedFacetHeatmap(layout: Record<string, unknown>): NormalizedVizSpec {
  const color = B('temp', 'EncodingColor', { scale: 'linear', aggregate: 'sum' });
  const encoding = { x: B('region', 'EncodingX', { scale: 'band' }), y: B('hour', 'EncodingY', { scale: 'band' }), color };
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'lf',
    name: 'limited facet heatmap',
    data: {
      name: 'lf',
      values: [
        { site: 'A', region: 'N', hour: '9', temp: 10 },
        { site: 'B', region: 'N', hour: '9', temp: 30 },
        { site: 'C', region: 'N', hour: '9', temp: 94 },
      ],
    },
    marks: [{ trait: 'MarkRect', encodings: { ...encoding } }],
    encoding,
    layout,
    a11y: { description: 'temp' },
  } as unknown as NormalizedVizSpec;
}

// The ECharts-drawn cells: base dataset rows whose site is referenced by a rendered panel filter.
function echartsDrawnMax(spec: NormalizedVizSpec): number {
  const o = toEChartsOption(spec) as {
    dataset: { source?: Record<string, unknown>[]; fromDatasetId?: string; transform?: { config: { dimension: string; eq: unknown } }[] }[];
  };
  const panelSites = o.dataset
    .filter((d) => d.fromDatasetId !== undefined)
    .flatMap((p) => (p.transform ?? []).filter((t) => t.config.dimension === 'site').map((t) => t.config.eq));
  const source = o.dataset[0].source ?? [];
  const drawn = source.filter((r) => panelSites.includes(r.site));
  return Math.max(...drawn.map((r) => Number(r.temp)));
}

function visualMapMax(spec: NormalizedVizSpec): number | undefined {
  return (toEChartsOption(spec) as { visualMap?: { max?: number } }).visualMap?.max;
}

describe('s161 m5 — truncated facet: the ECharts visualMap spans only the RENDERED cells', () => {
  for (const [label, layout] of [
    ['columns.limit:2', { trait: 'LayoutFacet', columns: { field: 'site', limit: 2 } }],
    ['maxPanels:2', { trait: 'LayoutFacet', columns: { field: 'site' }, maxPanels: 2 }],
  ] as const) {
    it(`${label}: visualMap max == ECharts-drawn max (30), NOT the dropped panel's 94`, () => {
      const spec = limitedFacetHeatmap(layout);
      expect(echartsDrawnMax(spec)).toBe(30); // panels A(10), B(30) — site C dropped
      expect(visualMapMax(spec)).toBe(30); // the mutation seed: revert scoping → 94 → RED
    });

    it(`${label}: the a11y narrative STAYS at the full-data extremum (94, Vega-primary honest)`, () => {
      const spec = limitedFacetHeatmap(layout);
      expect(analyzeVizSpec(spec).max?.value).toBe(94);
    });
  }
});

describe('s161 m5 — KEEP-CONTROLS: untruncated / non-faceted heatmaps are unchanged', () => {
  it('an UNtruncated facet (all three panels drawn) → visualMap spans all cells (max 94)', () => {
    const spec = limitedFacetHeatmap({ trait: 'LayoutFacet', columns: { field: 'site' } });
    expect(echartsDrawnMax(spec)).toBe(94); // all of A/B/C rendered
    expect(visualMapMax(spec)).toBe(94);
  });

  it('a NON-faceted heatmap → visualMap spans all cells (predicate is undefined → no filtering)', () => {
    const color = B('temp', 'EncodingColor', { scale: 'linear', aggregate: 'sum' });
    const encoding = { x: B('region', 'EncodingX', { scale: 'band' }), y: B('hour', 'EncodingY', { scale: 'band' }), color };
    const spec = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'nf',
      name: 'nf',
      data: { name: 'nf', values: [{ region: 'N', hour: '9', temp: 10 }, { region: 'S', hour: '9', temp: 94 }] },
      marks: [{ trait: 'MarkRect', encodings: { ...encoding } }],
      encoding,
      a11y: { description: 'temp' },
    } as unknown as NormalizedVizSpec;
    expect(visualMapMax(spec)).toBe(94);
  });
});
