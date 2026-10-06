import { describe, expect, it } from 'vitest';
// Item #16 / sprint-152 F1 — the LIBRARY-CONSUMER CONTRACT witness.
//
// Unlike the s151 adapter specs (which import the SOURCE adapter relatively to fail at the
// unit level), THIS example imports the adapters AND the core IR types from the `@oods/viz-core`
// PACKAGE ROOT — because the contract under test is precisely "a build-time importer can name
// the IR shapes (`Mark`, `datasets` via `NormalizedVizSpec['datasets']`) from the package root
// with NO deep `@/` / `spec/` import." The viz-core vitest alias resolves `@oods/viz-core` →
// `src/index.ts`, so this exercises the real barrel re-export chain
// (normalized-viz-spec.types.ts → normalized-viz-spec.ts barrel → index.ts). If F1's barrel
// re-export of `Mark` regresses, `const medianRule: Mark` stops type-checking (deep import
// again required) — the type-level teeth for the contract.
//
// Named puller: Forge-Demos "Demo 03 — The Design DNA of the Web", Hero B, which sets
// marks[1].from='gov_median' over a 2-row {site,median} median-rule layer. This is that spec.
import {
  toEChartsOption,
  toVegaLiteSpec,
  type Mark,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// The primary bar rows (Hero B: per-site accessibility score) — resolve against `data.values`.
const LADDER_ROWS = [
  { site: 'Gov A', score: 92 },
  { site: 'Gov B', score: 74 },
];

// A NAMED median-rule layer, authored by name via `Mark.from` — the exact shape a Demo-03
// build-time importer writes. Typing it `Mark` requires the F1 package-root re-export.
const medianRule: Mark = {
  trait: 'MarkLine',
  from: 'gov_median',
  encodings: {
    // rows are keyed {site, median} (y-field first) — the assertions below prove BOTH
    // adapters bind by field NAME, never by column position.
    x: { field: 'median', trait: 'EncodingX' },
    y: { field: 'site', trait: 'EncodingY' },
  },
};

// The backing named row-array, typed via the public indexed access on the IR — also requires
// the datasets slot to be a first-class, nameable part of the public contract.
const govMedian: NormalizedVizSpec['datasets'] = {
  gov_median: [
    { site: 'Gov A', median: 80 },
    { site: 'Gov B', median: 80 },
  ],
};

const heroBSpec: NormalizedVizSpec = {
  $schema: 'https://oods-foundry.com/viz-spec/v1',
  id: 'design-dna-ladder',
  name: 'The Design DNA of the Web — accessibility ladder',
  data: { name: 'design-dna-ladder', values: LADDER_ROWS },
  marks: [
    // primary bar layer — INLINE, no `from`; resolves against the primary dataset.
    {
      trait: 'MarkBar',
      encodings: {
        x: { field: 'site', trait: 'EncodingX' },
        y: { field: 'score', trait: 'EncodingY' },
      },
    },
    // the named government-median rule layer, resolving against datasets['gov_median'].
    medianRule,
  ],
  encoding: {
    x: { field: 'site', trait: 'EncodingX' },
    y: { field: 'score', trait: 'EncodingY' },
  },
  a11y: { description: 'Accessibility ladder with a government-median rule overlay.' },
  datasets: govMedian,
};

interface EChartsDatasetLike {
  readonly id: string;
  readonly source?: readonly Record<string, unknown>[];
  readonly dimensions?: readonly string[];
}
interface EChartsSeriesLike {
  readonly type: string;
  readonly datasetId?: string;
  readonly encode?: { x?: string; y?: string };
}

describe('median-rule-layer example — #16 library-consumer contract (Demo-03 Hero B)', () => {
  it('exposes the runtime adapter surface from the @oods/viz-core package root', () => {
    // The package-root import resolved to real functions (not undefined) — the runtime half
    // of "importable from the package root, no deep import."
    expect(typeof toVegaLiteSpec).toBe('function');
    expect(typeof toEChartsOption).toBe('function');
  });

  it('resolves marks[1].from=gov_median into a materialized ECharts dataset entry', () => {
    const option = toEChartsOption(heroBSpec) as unknown as {
      dataset: readonly EChartsDatasetLike[];
      series: readonly EChartsSeriesLike[];
    };

    // The dataset array carries the primary PLUS the named gov_median entry.
    expect(option.dataset.length).toBe(2);
    expect(option.dataset[0]?.id).toBe('design-dna-ladder');
    const govDataset = option.dataset.find((d) => d.id === 'gov_median');
    expect(govDataset).toBeDefined();
    expect(govDataset?.source).toEqual(govMedian?.gov_median);
    // dimensions come from the row keys (site-first) — both names present so `encode`
    // resolves by name irrespective of column order.
    expect(govDataset?.dimensions).toEqual(['site', 'median']);

    // The rule series' datasetId (mark.from) now names a REGISTERED dataset, and its
    // encode references the layer's OWN field NAMES (x:'median', y:'site').
    const lineSeries = option.series.find((s) => s.type === 'line');
    expect(lineSeries?.datasetId).toBe('gov_median');
    expect(lineSeries?.encode?.x).toBe('median');
    expect(lineSeries?.encode?.y).toBe('site');
  });

  it('resolves marks[1].from=gov_median into the Vega-Lite top-level datasets block', () => {
    const compiled = toVegaLiteSpec(heroBSpec) as unknown as {
      datasets?: Record<string, unknown>;
      layer?: readonly { data?: { name?: string }; encoding?: { x?: { field?: string } } }[];
    };

    // The backing datasets map is present at the Vega-Lite top level (native).
    expect(compiled.datasets).toEqual(govMedian);

    // The secondary layer's data:{name} names the REGISTERED dataset (no longer dangling),
    // binding fields by encoding field NAME (columnar resolution).
    const secondary = compiled.layer?.find((l) => l.data?.name === 'gov_median');
    expect(secondary).toBeDefined();
    expect(secondary?.encoding?.x?.field).toBe('median');
  });
});
