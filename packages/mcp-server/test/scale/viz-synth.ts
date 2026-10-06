/**
 * Scale-tier VIZ dataset synthesizer (sprint-110 m05).
 *
 * Generates realistic row datasets at 100/500/1000 rows for the data-aware viz
 * determinism gate. Same seed -> byte-identical rows across runs (mulberry32,
 * no Math.random()/Date.now() leaks), so the whole profile -> recommendation ->
 * spec pipeline can be asserted byte-stable at scale.
 *
 * Shape mirrors a real BI extract: a monthly temporal axis, a small categorical
 * dimension, a high-cardinality categorical code, and two correlated measures —
 * enough to exercise every data-aware signal (temporal regularity, cardinality,
 * correlation, negativity, stats).
 */

export type VizScaleTier = 100 | 500 | 1000;

export interface VizSynthOptions {
  tier: VizScaleTier;
  seed: number;
}

// mulberry32: small, fast, well-distributed PRNG with explicit state. Same seed
// -> same sequence. (Matches test/scale/synth.ts:27-36.)
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ['North', 'South', 'East', 'West', 'Central'] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Synthesize a viz row dataset. Deterministic for a given (tier, seed). The
 * temporal axis is regularly spaced by construction; the two measures are
 * positively correlated with seeded noise so the recommender has real signal.
 */
export function synthesizeVizRows(options: VizSynthOptions): Array<Record<string, unknown>> {
  const rand = mulberry32(options.seed);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < options.tier; i += 1) {
    // Regular monthly axis (wraps across years) — deterministic, UTC-safe text.
    const year = 2020 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    const region = REGIONS[i % REGIONS.length];
    const skuCode = `sku-${pad2(i % 64)}`; // high-cardinality categorical code
    // Correlated measures: revenue tracks units with bounded seeded noise.
    const units = 50 + Math.floor(rand() * 200);
    const revenue = Math.round(units * 9.5 + (rand() - 0.5) * 120);
    rows.push({
      month: `${year}-${pad2(month)}`,
      region,
      sku: skuCode,
      units,
      revenue,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Network/hierarchy synthesizers (sprint-111 m05).
//
// The viz scale tier above feeds the tabular profiler/recommender determinism
// gate. These produce the NEW network/hierarchy contracts (HierarchyInput /
// SankeyInput / NetworkInput) at the same tiers, so "same seed -> byte-identical
// ECharts option" can be asserted at scale for treemap/sunburst/sankey/force_graph.
// Same (tier, seed) -> identical structure (mulberry32, no Math.random/Date leaks).
// Each is constructed to be VALID for its adapter (sankey: every link valued +
// referencing existing nodes; hierarchy: every parentId references an earlier node).
// ---------------------------------------------------------------------------

const GROUPS = ['frontend', 'backend', 'data', 'infra'] as const;

/** Deterministic adjacency_list hierarchy: node 0 is the root, every later node
 *  attaches to an earlier node (an acyclic tree by construction). */
export function synthesizeHierarchyInput(options: VizSynthOptions): {
  type: 'adjacency_list';
  data: Array<{ id: string; parentId: string | null; value: number; name: string }>;
} {
  const rand = mulberry32(options.seed);
  const data: Array<{ id: string; parentId: string | null; value: number; name: string }> = [];
  for (let i = 0; i < options.tier; i += 1) {
    const parentIndex = i === 0 ? null : Math.floor(rand() * i); // always an earlier node
    data.push({
      id: `n${i}`,
      parentId: parentIndex === null ? null : `n${parentIndex}`,
      value: 1 + Math.floor(rand() * 100),
      name: `Node ${i}`,
    });
  }
  return { type: 'adjacency_list', data };
}

/** Deterministic sankey: a forward chain (n_i -> n_{i+1}) so every link is valued
 *  and references existing nodes (passes validateSankeyInput). */
export function synthesizeSankeyInput(options: VizSynthOptions): {
  nodes: Array<{ name: string }>;
  links: Array<{ source: string; target: string; value: number }>;
} {
  const rand = mulberry32(options.seed);
  const nodes = Array.from({ length: options.tier }, (_, i) => ({ name: `n${i}` }));
  const links: Array<{ source: string; target: string; value: number }> = [];
  for (let i = 0; i < options.tier - 1; i += 1) {
    links.push({ source: `n${i}`, target: `n${i + 1}`, value: 1 + Math.floor(rand() * 50) });
  }
  return { nodes, links };
}

/** Deterministic network: grouped nodes + forward links between existing nodes. */
export function synthesizeNetworkInput(options: VizSynthOptions): {
  nodes: Array<{ id: string; group: string; value: number }>;
  links: Array<{ source: string; target: string; value: number }>;
} {
  const rand = mulberry32(options.seed);
  const nodes = Array.from({ length: options.tier }, (_, i) => ({
    id: `n${i}`,
    group: GROUPS[i % GROUPS.length],
    value: 1 + Math.floor(rand() * 20),
  }));
  const links: Array<{ source: string; target: string; value: number }> = [];
  for (let i = 0; i < options.tier - 1; i += 1) {
    const target = i + 1 + Math.floor(rand() * Math.max(1, options.tier - i - 1));
    links.push({
      source: `n${i}`,
      target: `n${Math.min(target, options.tier - 1)}`,
      value: 1 + Math.floor(rand() * 10),
    });
  }
  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Geo synthesizer (sprint-112 m03).
//
// Produces a VALID-by-construction GeoJSON FeatureCollection (a deterministic
// grid of small square "regions", each with a unique 'region' property) plus rows
// joinable on that key — the rows also double as lng/lat/value points for the
// bubble adapter. The geometry is positioned deterministically by index; ONLY the
// per-region value is seeded, so "same seed -> byte-identical option" holds while
// "different seed -> different option" still flips (the value drives the visualMap
// domain + region colours). Latitudes/longitudes stay inside [-90,90]/[-180,180]
// at every tier up to 1000.
// ---------------------------------------------------------------------------

const GEO_GRID_COLS = 36;

export function synthesizeGeoInput(options: VizSynthOptions): {
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id: string;
      properties: { region: string };
      geometry: { type: 'Polygon'; coordinates: number[][][] };
    }>;
  };
  rows: Array<{ region: string; lng: number; lat: number; value: number }>;
} {
  const rand = mulberry32(options.seed);
  const features: Array<{
    type: 'Feature';
    id: string;
    properties: { region: string };
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }> = [];
  const rows: Array<{ region: string; lng: number; lat: number; value: number }> = [];
  for (let i = 0; i < options.tier; i += 1) {
    const region = `r${i}`;
    const col = i % GEO_GRID_COLS;
    const rowIdx = Math.floor(i / GEO_GRID_COLS) % 34; // keep latitude band in range
    const x = -180 + col * 5;
    const y = -85 + rowIdx * 5;
    features.push({
      type: 'Feature',
      id: region,
      properties: { region },
      geometry: {
        type: 'Polygon',
        coordinates: [[[x, y], [x + 4, y], [x + 4, y + 4], [x, y + 4], [x, y]]],
      },
    });
    rows.push({ region, lng: x + 2, lat: y + 2, value: 1 + Math.floor(rand() * 1000) });
  }
  return { geojson: { type: 'FeatureCollection', features }, rows };
}

// ---------------------------------------------------------------------------
// Dashboard synthesizer (sprint-113 m06).
//
// Composes the per-type synths into a LEAN metric-overview DashboardSpec scaled
// to the tier. The shared tabular dataset (KPI row + trend + breakdown) scales to
// `tier` rows — that is the cross-filter/KPI determinism-relevant path; the geo
// panel is CAPPED to a small fixed region count (sliced from the seeded geo synth)
// so the heavy ECharts render stays bounded under the 60s scale budget. Same
// (tier, seed) -> byte-identical composed dashboard; different seed -> divergent
// (the seeded tabular + geo values differ). Realistic dashboards are 4-12 panels;
// this is 4. mulberry32-only via the per-type synths; no Math.random/Date leaks.
// ---------------------------------------------------------------------------

/** Region cap for the geo panel — keeps the per-render cost flat across tiers. */
const DASHBOARD_GEO_CAP = 24;

export function synthesizeDashboardSpec(options: VizSynthOptions): Record<string, unknown> {
  const rows = synthesizeVizRows(options);
  const geo = synthesizeGeoInput(options);
  const geoFeatures = geo.geojson.features.slice(0, DASHBOARD_GEO_CAP);
  const geoRows = geo.rows.slice(0, DASHBOARD_GEO_CAP).map((r) => ({ region: r.region, value: r.value }));

  return {
    schemaVersion: 'v0.1',
    title: `Synthetic ${options.tier}-row dashboard`,
    datasets: [{ id: 'main', rows }],
    panels: [
      { id: 'kpi-rev', kind: 'kpi', title: 'Total Revenue', datasetId: 'main', field: 'revenue', aggregate: 'sum', comparison: { basis: 'prior_period' } },
      { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'main', encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } } },
      { id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'main', encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } } },
      {
        id: 'geo',
        kind: 'chart',
        chartType: 'choropleth',
        geo: {
          geojson: { type: 'FeatureCollection', features: geoFeatures },
          rows: geoRows,
          join: { dataKey: 'region', featureProperty: 'region' },
          valueField: 'value',
        },
      },
    ],
    layout: { columns: 12 },
    links: [{ source: 'breakdown', target: 'trend', sourceField: 'region', operator: 'in' }],
    a11y: { description: `Synthetic metric-overview dashboard over ${options.tier} rows.`, readingOrder: 'kpi-first' },
  };
}
