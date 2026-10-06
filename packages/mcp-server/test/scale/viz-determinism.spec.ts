/**
 * Q1 determinism gate — VIZ half (sprint-110 m05).
 *
 * Extends the map.apply-only scale coverage with the data-aware viz pipeline:
 * at 100/500/1000 rows, the SAME seed must yield a byte-identical
 *   rows -> FieldProfile[] -> SchemaIntent -> ranking -> NormalizedVizSpec.
 *
 * This is the enforcement behind "same rows -> same profile -> same
 * recommendation". It runs under vitest.scale.config (test/scale/**) and rides
 * the #408 closeout gate + the scale-determinism CI job.
 */
import { describe, expect, it } from 'vitest';
import {
  adaptBubbleToECharts,
  adaptChoroplethToECharts,
  adaptGraphToECharts,
  adaptSankeyToECharts,
  adaptSunburstToECharts,
  adaptTreemapToECharts,
  buildVizSpecFromRows,
  inferFieldProfile,
  suggestPatterns,
  toSchemaIntent,
  validateNormalizedVizSpec,
  type NormalizedVizSpec,
  type SpatialSpec,
} from '@oods/viz-core';
import {
  synthesizeGeoInput,
  synthesizeHierarchyInput,
  synthesizeNetworkInput,
  synthesizeSankeyInput,
  synthesizeVizRows,
  type VizScaleTier,
} from './viz-synth.js';

const TIERS: VizScaleTier[] = [100, 500, 1000];
const SEED = 42;

const profileJson = (rows: Array<Record<string, unknown>>) => JSON.stringify(inferFieldProfile(rows));
const intentJson = (rows: Array<Record<string, unknown>>) =>
  JSON.stringify(toSchemaIntent(inferFieldProfile(rows), rows));
const rankingJson = (rows: Array<Record<string, unknown>>) =>
  JSON.stringify(
    suggestPatterns(toSchemaIntent(inferFieldProfile(rows), rows), { limit: 20 }).map((s) => [
      s.pattern.id,
      s.score,
    ]),
  );
const specJson = (rows: Array<Record<string, unknown>>) => JSON.stringify(buildVizSpecFromRows({ rows }).spec);

describe('viz scale-tier determinism', () => {
  for (const tier of TIERS) {
    it(`tier=${tier}: same seed -> byte-identical rows`, () => {
      const a = synthesizeVizRows({ tier, seed: SEED });
      const b = synthesizeVizRows({ tier, seed: SEED });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
      expect(a).toHaveLength(tier);
    });

    it(`tier=${tier}: same seed -> byte-identical FieldProfile[]`, () => {
      const a = synthesizeVizRows({ tier, seed: SEED });
      const b = synthesizeVizRows({ tier, seed: SEED });
      expect(profileJson(a)).toEqual(profileJson(b));
    });

    it(`tier=${tier}: same seed -> byte-identical SchemaIntent`, () => {
      const a = synthesizeVizRows({ tier, seed: SEED });
      const b = synthesizeVizRows({ tier, seed: SEED });
      expect(intentJson(a)).toEqual(intentJson(b));
    });

    it(`tier=${tier}: same seed -> byte-identical recommendation ranking`, () => {
      const a = synthesizeVizRows({ tier, seed: SEED });
      const b = synthesizeVizRows({ tier, seed: SEED });
      expect(rankingJson(a)).toEqual(rankingJson(b));
    });

    it(`tier=${tier}: same seed -> byte-identical, valid NormalizedVizSpec`, () => {
      const rows = synthesizeVizRows({ tier, seed: SEED });
      const rerun = synthesizeVizRows({ tier, seed: SEED });
      expect(specJson(rows)).toEqual(specJson(rerun));
      expect(validateNormalizedVizSpec(buildVizSpecFromRows({ rows }).spec).valid).toBe(true);
    });

    it(`tier=${tier}: different seeds -> different rows (synth is seed-sensitive)`, () => {
      const a = synthesizeVizRows({ tier, seed: 1 });
      const b = synthesizeVizRows({ tier, seed: 2 });
      expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
    });
  }
});

// sprint-111 m05: the network/hierarchy adapters' OPTION is deterministic — at
// scale, the SAME seed must yield a byte-identical ECharts option for each of the 4
// new types. (JSON.stringify drops the tooltip-formatter closure, so this compares
// the transmittable, deterministic option — matching what viz.render returns. The
// client-side force LAYOUT is not part of the option and is out of scope.)
function metaSpec(mark: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: `viz:${mark}`,
    name: mark,
    data: { values: [] },
    marks: [{ trait: mark }],
    encoding: {},
    a11y: { description: `${mark} scale-tier determinism fixture.` },
  } as NormalizedVizSpec;
}

describe('viz network/hierarchy scale-tier option determinism', () => {
  for (const tier of TIERS) {
    it(`tier=${tier}: treemap option is byte-identical for the same seed`, () => {
      const a = adaptTreemapToECharts(metaSpec('MarkTreemap'), synthesizeHierarchyInput({ tier, seed: SEED }));
      const b = adaptTreemapToECharts(metaSpec('MarkTreemap'), synthesizeHierarchyInput({ tier, seed: SEED }));
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });

    it(`tier=${tier}: sunburst option is byte-identical for the same seed`, () => {
      const a = adaptSunburstToECharts(metaSpec('MarkSunburst'), synthesizeHierarchyInput({ tier, seed: SEED }));
      const b = adaptSunburstToECharts(metaSpec('MarkSunburst'), synthesizeHierarchyInput({ tier, seed: SEED }));
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });

    it(`tier=${tier}: sankey option is byte-identical for the same seed`, () => {
      const a = adaptSankeyToECharts(metaSpec('MarkSankey'), synthesizeSankeyInput({ tier, seed: SEED }));
      const b = adaptSankeyToECharts(metaSpec('MarkSankey'), synthesizeSankeyInput({ tier, seed: SEED }));
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });

    it(`tier=${tier}: force_graph option is byte-identical for the same seed`, () => {
      const a = adaptGraphToECharts(metaSpec('MarkGraph'), synthesizeNetworkInput({ tier, seed: SEED }));
      const b = adaptGraphToECharts(metaSpec('MarkGraph'), synthesizeNetworkInput({ tier, seed: SEED }));
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });

    it(`tier=${tier}: different seeds -> different graph option (synth is seed-sensitive)`, () => {
      const a = adaptGraphToECharts(metaSpec('MarkGraph'), synthesizeNetworkInput({ tier, seed: 1 }));
      const b = adaptGraphToECharts(metaSpec('MarkGraph'), synthesizeNetworkInput({ tier, seed: 2 }));
      expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
    });
  }
});

// sprint-112 m03: the geo adapters' OPTION is deterministic at scale too — same
// seed -> byte-identical choropleth/bubble ECharts option for 100/500/1000 regions
// (JSON.stringify drops the tooltip-formatter closure; bubble sizes survive as
// per-datum numbers, so this compares the transmittable option viz.render returns).
// The stateless registration + code-point-ordered join are what make this hold.
const GEO_DIMS = { width: 860, height: 520 } as const;

function geoChoroSpec(): SpatialSpec {
  return {
    id: 'viz:choropleth',
    name: 'choropleth',
    type: 'spatial',
    data: { type: 'data.geo.join', source: 'inline', geoSource: 'inline', joinKey: 'region', geoKey: 'region' },
    layers: [{ type: 'regionFill', encoding: { color: { field: 'value', scale: 'linear' } } }],
    a11y: { description: 'choropleth scale-tier determinism fixture.' },
  };
}
function geoBubbleSpec(): SpatialSpec {
  return {
    id: 'viz:bubble',
    name: 'bubble',
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lng' },
          latitude: { field: 'lat' },
          size: { field: 'value', scale: 'sqrt' },
          color: { field: 'value', scale: 'linear' },
        },
      },
    ],
    a11y: { description: 'bubble scale-tier determinism fixture.' },
  };
}

const choroOption = (seed: number, tier: VizScaleTier) => {
  const g = synthesizeGeoInput({ tier, seed });
  return adaptChoroplethToECharts(
    geoChoroSpec(),
    g.geojson as Parameters<typeof adaptChoroplethToECharts>[1],
    g.rows,
    GEO_DIMS,
  );
};
const bubbleOption = (seed: number, tier: VizScaleTier) => {
  const g = synthesizeGeoInput({ tier, seed });
  return adaptBubbleToECharts(
    geoBubbleSpec(),
    g.geojson as Parameters<typeof adaptBubbleToECharts>[1],
    g.rows,
    GEO_DIMS,
  );
};

describe('viz geo scale-tier option determinism', () => {
  for (const tier of TIERS) {
    it(`tier=${tier}: choropleth option is byte-identical for the same seed`, () => {
      expect(JSON.stringify(choroOption(SEED, tier))).toEqual(JSON.stringify(choroOption(SEED, tier)));
    });

    it(`tier=${tier}: bubble option is byte-identical for the same seed`, () => {
      expect(JSON.stringify(bubbleOption(SEED, tier))).toEqual(JSON.stringify(bubbleOption(SEED, tier)));
    });

    it(`tier=${tier}: different seeds -> different choropleth option (synth is seed-sensitive)`, () => {
      expect(JSON.stringify(choroOption(1, tier))).not.toEqual(JSON.stringify(choroOption(2, tier)));
    });
  }
});
