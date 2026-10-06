import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';

import { adaptTreemapToECharts } from './treemap-adapter.js';
import { adaptSunburstToECharts } from './sunburst-adapter.js';
import { adaptSankeyToECharts } from './sankey-adapter.js';
import { adaptChordToECharts } from './chord-adapter.js';
import { adaptGraphToECharts } from './graph-adapter.js';
import { adaptChoroplethToECharts } from '../spatial/echarts-choropleth-adapter.js';
import { adaptBubbleToECharts } from '../spatial/echarts-bubble-adapter.js';
import { adaptFlowLineToECharts } from '../spatial/echarts-flow-line-adapter.js';
import { resolveOodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';
import type { HierarchyInput, SankeyInput, NetworkInput } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';
import type { SpatialSpec } from '../../spec/spatial.js';

// Bake-fires mutation guard for the OODS ECharts chrome bake (sprint-145 m03, memo §6) —
// the ECharts mirror of the s144 vega-lite-adapter.spec.ts `compiled.config` deepEquals.
// The golden-echarts-options snapshot can be blindly regenerated with `-u`, so a silent
// un-wire (someone drops `chrome.title` from a title, or `chrome.visualMapLabel` from a
// visualMap) would still "pass" a re-baked golden. These EXPLICIT equality assertions
// against the SOURCE resolver output cannot be `-u`'d away — they fail loud the moment an
// adapter stops threading the chrome. They import the SOURCE adapters + resolver directly
// (relative, not the @oods/viz-core barrel) so the guard fails at the viz-core unit level.
//
// CRITIC AMENDMENT (memo §6/§11.7): `title.textStyle.color` AND `visualMap.textStyle.color`
// are ECharts-DEFAULT today (net-new bakes) — the two most likely to be silently un-wired
// yet still pass a tripwire that only sees the resolver output. They are asserted
// explicitly here (title on every group-A adapter, visualMap on every geo adapter).

const chrome = resolveOodsEchartsChrome({ config: {} } as never);

// A probe shape covering every chrome field the 8 adapters thread (all optional — each
// adapter populates the subset it owns). Casting the EChartsOption to this lets us read the
// baked values without depending on echarts' full option union.
interface ChromeProbe {
  backgroundColor?: string;
  title?: { textStyle?: { color?: string } };
  legend?: { textStyle?: { color?: string } };
  visualMap?: { textStyle?: { color?: string } };
  series?: ReadonlyArray<{
    label?: { color?: string; textBorderColor?: string; textBorderWidth?: number };
    upperLabel?: { color?: string; textBorderColor?: string; textBorderWidth?: number };
    breadcrumb?: { itemStyle?: { color?: string; borderColor?: string }; textStyle?: { color?: string } };
    itemStyle?: { borderColor?: string };
    emphasis?: { itemStyle?: { borderColor?: string } };
  }>;
}
const probe = (option: unknown): ChromeProbe => option as ChromeProbe;

// --- fixtures (mirror golden-echarts-options.spec.ts) -----------------------
function groupASpec(id: string, name: string, mark: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id,
    name,
    data: { values: [] },
    marks: [{ trait: mark }],
    encoding: {},
    a11y: { description: `${name} chrome-bake fixture.` },
  } as NormalizedVizSpec;
}

const HIERARCHY: HierarchyInput = {
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
const SANKEY: SankeyInput = {
  nodes: [{ name: 'Coal' }, { name: 'Grid' }, { name: 'Homes' }],
  links: [
    { source: 'Coal', target: 'Grid', value: 100 },
    { source: 'Grid', target: 'Homes', value: 60 },
  ],
};
const CHORD: SankeyInput = {
  nodes: [{ name: 'AMER' }, { name: 'EMEA' }, { name: 'APAC' }],
  links: [
    { source: 'AMER', target: 'EMEA', value: 42 },
    { source: 'EMEA', target: 'APAC', value: 31 },
  ],
};
const NETWORK: NetworkInput = {
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

const GEO_DIMS = { width: 860, height: 520 } as const;
const GEO_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      properties: { region: 'CA' },
      geometry: { type: 'Polygon', coordinates: [[[-124, 32], [-114, 32], [-114, 42], [-124, 42], [-124, 32]]] },
    },
  ],
};
const GEO_SALES = [{ state: 'CA', sales: 580 }, { state: 'NV', sales: 96 }];
const GEO_CITIES = [{ city: 'SF', lng: -122.4, lat: 37.8, pop: 874 }];
const GEO_FLOWS = [
  { oLng: -120, oLat: 37, dLng: -116, dLat: 39, volume: 540 },
  { oLng: -116, oLat: 39, dLng: -120, dLat: 37, volume: 210 },
];

const choroplethSpec: SpatialSpec = {
  id: 'viz:choropleth',
  name: 'State sales',
  type: 'spatial',
  data: { type: 'data.geo.join', source: 'inline', geoSource: 'inline', joinKey: 'state', geoKey: 'region' },
  layers: [{ type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } }],
  a11y: { description: 'Choropleth chrome-bake fixture.' },
} as SpatialSpec;
const bubbleSpec: SpatialSpec = {
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
        size: { field: 'pop', scale: 'sqrt' },
        color: { field: 'pop', scale: 'linear' },
      },
    },
  ],
  a11y: { description: 'Bubble chrome-bake fixture.' },
} as SpatialSpec;
const flowSpec: SpatialSpec = {
  id: 'viz:flow',
  name: 'Trade flows',
  type: 'spatial',
  data: { values: [] },
  layers: [
    {
      type: 'route',
      encoding: {
        start: { longitude: 'oLng', latitude: 'oLat' },
        end: { longitude: 'dLng', latitude: 'dLat' },
        strokeWidth: { field: 'volume' },
      },
    },
  ],
  a11y: { description: 'Flow chrome-bake fixture.' },
  // s153 F1 (feedbackId 81): the new viz-core typecheck gate surfaces this pre-existing TS2352 —
  // the route-layer fixture's start/end omit the `field` RouteEndpointEncoding requires. The
  // sanctioned #822 double-cast keeps the fixture runtime-identical while satisfying the gate.
} as unknown as SpatialSpec;

describe('ECharts chrome bake-fires guard (s145 m03, memo §6) — the bake carries the resolver chrome', () => {
  it('treemap: background + title + on-canvas breadcrumb + ON-TILE mechanism + neutral borders + emphasis', () => {
    const p = probe(adaptTreemapToECharts(groupASpec('viz:treemap', 'Org', 'MarkTreemap'), HIERARCHY));
    const series = p.series?.[0];
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.title?.textStyle?.color).toBe(chrome.title); // critic-flagged net-new bake
    // Breadcrumb sits on the canvas → on-canvas label + surface fill + neutral border.
    expect(series?.breadcrumb?.textStyle?.color).toBe(chrome.labelOnCanvas);
    expect(series?.breadcrumb?.itemStyle?.color).toBe(chrome.surfaceFill);
    expect(series?.breadcrumb?.itemStyle?.borderColor).toBe(chrome.tileBorder);
    // Node + header labels sit ON the tile → the legibility mechanism (halo), not a fixed colour.
    expect(series?.label?.color).toBe(chrome.onTileLabelMechanism.color);
    expect(series?.label?.textBorderColor).toBe(chrome.onTileLabelMechanism.textBorderColor);
    expect(series?.label?.textBorderWidth).toBe(chrome.onTileLabelMechanism.textBorderWidth);
    expect(series?.upperLabel?.textBorderColor).toBe(chrome.onTileLabelMechanism.textBorderColor);
    expect(series?.upperLabel?.textBorderWidth).toBeGreaterThan(0);
    expect(series?.itemStyle?.borderColor).toBe(chrome.tileBorder);
    expect(series?.emphasis?.itemStyle?.borderColor).toBe(chrome.emphasisBorder);
  });

  it('sunburst: background + title + ON-TILE arc mechanism + ring-separator (surface, by-usage) + emphasis', () => {
    const p = probe(adaptSunburstToECharts(groupASpec('viz:sunburst', 'Org', 'MarkSunburst'), HIERARCHY));
    const series = p.series?.[0];
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.title?.textStyle?.color).toBe(chrome.title);
    expect(series?.label?.textBorderColor).toBe(chrome.onTileLabelMechanism.textBorderColor);
    expect(series?.label?.textBorderWidth).toBeGreaterThan(0);
    // The series border is the RING separator → surface-canvas (by-usage), NOT tileBorder.
    expect(series?.itemStyle?.borderColor).toBe(chrome.surfaceFill);
    expect(series?.emphasis?.itemStyle?.borderColor).toBe(chrome.emphasisBorder);
  });

  it('sankey: background + title + on-canvas node label + neutral node border', () => {
    const p = probe(adaptSankeyToECharts(groupASpec('viz:sankey', 'Energy', 'MarkSankey'), SANKEY));
    const series = p.series?.[0];
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.title?.textStyle?.color).toBe(chrome.title);
    expect(series?.label?.color).toBe(chrome.labelOnCanvas);
    expect(series?.itemStyle?.borderColor).toBe(chrome.tileBorder);
  });

  it('chord: background + title + on-canvas arc label + neutral arc border', () => {
    const p = probe(adaptChordToECharts(groupASpec('viz:chord', 'Trade', 'MarkChord'), CHORD));
    const series = p.series?.[0];
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.title?.textStyle?.color).toBe(chrome.title);
    expect(series?.label?.color).toBe(chrome.labelOnCanvas);
    expect(series?.itemStyle?.borderColor).toBe(chrome.tileBorder);
  });

  it('force_graph: background + title + on-canvas node label + governed legend text', () => {
    const p = probe(adaptGraphToECharts(groupASpec('viz:graph', 'Service map', 'MarkGraph'), NETWORK));
    const series = p.series?.[0];
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.title?.textStyle?.color).toBe(chrome.title);
    expect(series?.label?.color).toBe(chrome.labelOnCanvas);
    // Category legend text folds into the governed secondary-chrome (text-neutral) set.
    expect(p.legend?.textStyle?.color).toBe(chrome.visualMapLabel);
  });

  it('choropleth: background + baked visualMap tick label (critic-flagged net-new bake)', () => {
    const p = probe(adaptChoroplethToECharts(choroplethSpec, GEO_FC, GEO_SALES, GEO_DIMS));
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.visualMap?.textStyle?.color).toBe(chrome.visualMapLabel);
  });

  it('bubble_map: background + baked visualMap tick label', () => {
    const p = probe(adaptBubbleToECharts(bubbleSpec, GEO_FC, GEO_CITIES, GEO_DIMS));
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.visualMap?.textStyle?.color).toBe(chrome.visualMapLabel);
  });

  it('flow_map: background + baked visualMap tick label', () => {
    const p = probe(adaptFlowLineToECharts(flowSpec, GEO_FC, GEO_FLOWS, GEO_DIMS));
    expect(p.backgroundColor).toBe(chrome.background);
    expect(p.visualMap?.textStyle?.color).toBe(chrome.visualMapLabel);
  });
});
