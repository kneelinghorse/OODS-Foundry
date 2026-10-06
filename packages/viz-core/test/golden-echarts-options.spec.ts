import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import {
  adaptBubbleToECharts,
  adaptChordToECharts,
  adaptChoroplethToECharts,
  adaptGraphToECharts,
  adaptSankeyToECharts,
  adaptSunburstToECharts,
  adaptTreemapToECharts,
  type HierarchyInput,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
  type SpatialSpec,
} from '@oods/viz-core';

// Committed golden harness for the sprint-111 network/hierarchy ECharts options
// (the m05 determinism gate). For treemap/sunburst/sankey/force_graph the OPTION is
// a pure, deterministic function of (spec, input) — so it can be pinned to a golden.
// The iterative force LAYOUT (rendered node x/y) is client-side and explicitly NOT
// goldened (m04 audit). We golden the JSON-SAFE projection (JSON.parse(JSON.stringify))
// — the function-free, transmittable form viz.render actually returns; the tooltip
// formatter closure is intentionally excluded (it does not survive JSON transport).
//
// The snapshot IS the golden: any drift in an adapter (a changed default, a dropped
// field, a reordered series) flips it. Determinism is separately asserted (run twice
// -> byte-identical) so the gate also catches nondeterminism the snapshot can't show.

const jsonSafe = (option: unknown): unknown => JSON.parse(JSON.stringify(option));

function spec(id: string, name: string, mark: string, description: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id,
    name,
    data: { values: [] },
    marks: [{ trait: mark }],
    encoding: {},
    a11y: { description },
  } as NormalizedVizSpec;
}

// --- fixtures: small, fully-specified, real-shaped --------------------------
const HIERARCHY_NESTED: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Org',
    value: 100,
    children: [
      { name: 'Engineering', value: 60, children: [{ name: 'Frontend', value: 25 }, { name: 'Backend', value: 35 }] },
      { name: 'Sales', value: 40, children: [{ name: 'AMER', value: 24 }, { name: 'EMEA', value: 16 }] },
    ],
  },
};
const HIERARCHY_ADJACENCY: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 0, name: 'Company' },
    { id: 'a', parentId: 'root', value: 12, name: 'Alpha' },
    { id: 'b', parentId: 'root', value: 18, name: 'Beta' },
    { id: 'a1', parentId: 'a', value: 7, name: 'Alpha-1' },
  ],
};
const SANKEY_FLOW: SankeyInput = {
  nodes: [{ name: 'Coal' }, { name: 'Grid' }, { name: 'Homes' }, { name: 'Industry' }],
  links: [
    { source: 'Coal', target: 'Grid', value: 100 },
    { source: 'Grid', target: 'Homes', value: 60 },
    { source: 'Grid', target: 'Industry', value: 40 },
  ],
};
const NETWORK_GRAPH: NetworkInput = {
  nodes: [
    { id: 'web', group: 'frontend', value: 9 },
    { id: 'api', group: 'backend', value: 6 },
    { id: 'db', group: 'data', value: 4 },
    { id: 'cache', group: 'data' },
  ],
  links: [
    { source: 'web', target: 'api', value: 3 },
    { source: 'api', target: 'db', value: 2 },
    { source: 'api', target: 'cache', value: 1 },
  ],
};
// chord reuses the SankeyInput contract (required-value links) but renders as a
// native series.type:'chord' ring — sankey-shaped data, distinct ECharts series.
const CHORD_FLOW: SankeyInput = {
  nodes: [{ name: 'AMER' }, { name: 'EMEA' }, { name: 'APAC' }],
  links: [
    { source: 'AMER', target: 'EMEA', value: 42 },
    { source: 'EMEA', target: 'APAC', value: 31 },
    { source: 'APAC', target: 'AMER', value: 25 },
  ],
};

// --- geo fixtures (sprint-112 m03): two adjacent states + joinable rows + points -
const GEO_DIMS = { width: 860, height: 520 } as const;
const GEO_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      properties: { region: 'CA', state_name: 'California' },
      geometry: { type: 'Polygon', coordinates: [[[-124, 32], [-114, 32], [-114, 42], [-124, 42], [-124, 32]]] },
    },
    {
      type: 'Feature',
      id: 'NV',
      properties: { region: 'NV', state_name: 'Nevada' },
      geometry: { type: 'Polygon', coordinates: [[[-120, 35], [-114, 35], [-114, 42], [-120, 42], [-120, 35]]] },
    },
  ],
};
const GEO_SALES = [
  { state: 'CA', sales: 580 },
  { state: 'NV', sales: 96 },
];
const GEO_CITIES = [
  { city: 'San Francisco', lng: -122.4, lat: 37.8, pop: 874 },
  { city: 'Las Vegas', lng: -115.1, lat: 36.2, pop: 646 },
];

function choroplethSpec(): SpatialSpec {
  return {
    id: 'viz:choropleth',
    name: 'State sales',
    type: 'spatial',
    data: { type: 'data.geo.join', source: 'inline', geoSource: 'inline', joinKey: 'state', geoKey: 'region' },
    layers: [{ type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } }],
    a11y: { description: 'Choropleth of state sales.' },
  };
}
function bubbleSpec(): SpatialSpec {
  return {
    id: 'viz:bubble',
    name: 'City population',
    type: 'spatial',
    data: { values: [] },
    layers: [
      {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lng' },
          latitude: { field: 'lat' },
          size: { field: 'pop', scale: 'area' },
          color: { field: 'pop', scale: 'linear' },
        },
      },
    ],
    a11y: { description: 'Bubble map of city population.' },
  };
}

const CASES: ReadonlyArray<readonly [string, () => unknown]> = [
  ['treemap (nested)', () => adaptTreemapToECharts(spec('viz:treemap', 'Org', 'MarkTreemap', 'Treemap of org headcount.'), HIERARCHY_NESTED)],
  ['treemap (adjacency)', () => adaptTreemapToECharts(spec('viz:treemap-adj', 'Company', 'MarkTreemap', 'Treemap from adjacency list.'), HIERARCHY_ADJACENCY)],
  ['sunburst (nested)', () => adaptSunburstToECharts(spec('viz:sunburst', 'Org', 'MarkSunburst', 'Sunburst of org headcount.'), HIERARCHY_NESTED)],
  ['sankey (flow)', () => adaptSankeyToECharts(spec('viz:sankey', 'Energy', 'MarkSankey', 'Sankey of energy flow.'), SANKEY_FLOW)],
  ['force_graph (network)', () => adaptGraphToECharts(spec('viz:graph', 'Service map', 'MarkGraph', 'Force graph of services.'), NETWORK_GRAPH)],
  // sprint-112 m03 geo: the JSON-safe option drops the tooltip-formatter closure
  // (same known limitation); bubble sizes survive as per-datum numbers. The resolved
  // colours + __registration FeatureCollection are pinned. Both adapters are pure → goldenable.
  ['choropleth (join)', () => adaptChoroplethToECharts(choroplethSpec(), GEO_FC, GEO_SALES, GEO_DIMS)],
  ['bubble_map (points)', () => adaptBubbleToECharts(bubbleSpec(), GEO_FC, GEO_CITIES, GEO_DIMS)],
  // sprint-120 m01: native series.type:'chord'. The JSON-safe option keeps the
  // string-template tooltip (no closure to drop) and the per-arc resolved colours.
  // NOTE: the describe title is intentionally NOT widened — the snapshot key is
  // prefixed by that title, so renaming it would re-key (delete + rewrite) the 7
  // existing goldens, violating the additive-floor 0-deletion constraint. Adding a
  // CASES row alone keys exactly ONE new snapshot (a pure addition).
  ['chord (ring)', () => adaptChordToECharts(spec('viz:chord', 'Trade corridors', 'MarkChord', 'Chord of regional trade.'), CHORD_FLOW)],
];

describe('golden ECharts options — treemap / sunburst / sankey / force_graph / choropleth / bubble_map', () => {
  for (const [name, build] of CASES) {
    it(`${name}: JSON-safe option matches the committed golden`, () => {
      expect(jsonSafe(build())).toMatchSnapshot();
    });

    it(`${name}: same (spec, input) -> byte-identical option (determinism gate)`, () => {
      expect(JSON.stringify(jsonSafe(build()))).toBe(JSON.stringify(jsonSafe(build())));
    });
  }
});
