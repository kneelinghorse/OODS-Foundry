import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import {
  adaptChoroplethToECharts,
  adaptToECharts,
  joinGeoWithData,
  registerGeoJson,
  type SpatialSpec,
} from '@oods/viz-core';

// sprint-112 m01 — the choropleth (region-fill) geo beachhead. These tests travel
// with the port and import through the package barrel (aliased to src/ in
// vitest.config.ts), so they also prove the new spatial adapters + slim spatial
// spec are reachable on the public surface the viz.render handler (m02) consumes.
//
// They encode the WHY of the headless geo path, not just the shapes:
//   - the choropleth series is built from the FeatureCollection (+ optional join),
//     NOT the IR — geo data lives outside the spec, like the s111 network types;
//   - the FeatureCollection travels back on the option via __registration so the
//     spec is the transmittable artifact (the m02 self-containment contract);
//   - registration is STATELESS — the m01 audit dropped the src/ module-level
//     cache that would bleed geoJson across requests sharing the default map name;
//   - the output is DETERMINISTIC (the Q1 moat) — identical input → identical spec.

const DIMENSIONS = { width: 720, height: 480 } as const;

/** Two adjacent square "states" with a join key (`region`) in their properties. */
const GEO: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      properties: { name: 'California', region: 'CA' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
    },
    {
      type: 'Feature',
      id: 'NV',
      properties: { name: 'Nevada', region: 'NV' },
      geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] },
    },
  ],
};

const SALES = [
  { state: 'CA', sales: 100 },
  { state: 'NV', sales: 40 },
];

/** A choropleth spec whose data is a geo+data JOIN (rows merged into features). */
function choroplethSpec(overrides: Partial<SpatialSpec> = {}): SpatialSpec {
  return {
    id: 'viz:choropleth-test',
    name: 'State Sales',
    type: 'spatial',
    data: {
      type: 'data.geo.join',
      source: 'states.geojson',
      geoSource: 'states',
      joinKey: 'state',
      geoKey: 'region',
    },
    layers: [
      { type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } },
    ],
    a11y: { description: 'Sales by US state.' },
    ...overrides,
  };
}

describe('joinGeoWithData — merges tabular rows into feature properties (order-stable)', () => {
  it('joins by key and preserves the input feature order (no sort / locale dependence)', () => {
    const joined = joinGeoWithData(GEO.features, SALES, { geoKey: 'region', dataKey: 'state' });
    expect(joined.features.map((f) => f.id)).toEqual(['CA', 'NV']);
    expect(joined.features[0].properties?.sales).toBe(100);
    expect(joined.features[1].properties?.sales).toBe(40);
    expect(joined.unmatchedFeatures).toEqual([]);
  });

  it('reports a feature with no matching data row as unmatched (no silent fabrication)', () => {
    const partial = [{ state: 'CA', sales: 100 }];
    const joined = joinGeoWithData(GEO.features, partial, { geoKey: 'region', dataKey: 'state' });
    expect(joined.unmatchedFeatures).toEqual(['NV']);
  });

  it('reports a DATA row whose join key has no matching feature as unmatchedData (sprint-118 m06)', () => {
    const withOrphan = [...SALES, { state: 'XX', sales: 99 }];
    const joined = joinGeoWithData(GEO.features, withOrphan, { geoKey: 'region', dataKey: 'state' });
    expect(joined.unmatchedData).toContain('XX');
    expect(joined.features.map((f) => f.id)).toEqual(['CA', 'NV']); // the orphan is NOT fabricated into a feature
  });
});

describe('adaptChoroplethToECharts — decoupled spec+geo → renderable map option', () => {
  it('builds a map series from the joined FeatureCollection, not the IR', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('map');
    const seriesData = series.data as Record<string, unknown>[];
    // Region names come from the join geoKey; values from the merged `sales` row.
    expect(seriesData.map((d) => d.name)).toEqual(['CA', 'NV']);
    expect(seriesData.map((d) => d.value)).toEqual([100, 40]);
  });

  it('binds the geo component to the join property, and only when a join is present', () => {
    const joined = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    expect((joined.geo as { nameProperty?: string }).nameProperty).toBe('region');

    const withoutJoin = adaptChoroplethToECharts(
      choroplethSpec({ data: { values: SALES } }),
      GEO,
      SALES,
      DIMENSIONS
    );
    expect(Object.hasOwn(withoutJoin.geo as object, 'nameProperty')).toBe(false);
  });

  it('emits a visualMap whose domain spans the joined values', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    const visualMap = option.visualMap as { min?: number; max?: number };
    expect(visualMap.min).toBe(40);
    expect(visualMap.max).toBe(100);
  });

  it('carries the FeatureCollection back via __registration (the m02 self-containment contract)', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    const registration = (option as Record<string, unknown>).__registration as {
      name: string;
      geoJson: FeatureCollection;
    };
    expect(registration.geoJson.type).toBe('FeatureCollection');
    expect(registration.geoJson.features).toHaveLength(2);
    // The geometry travels so the client can re-register the map by name.
    expect(registration.geoJson.features[0].geometry.type).toBe('Polygon');
  });

  it('emits RESOLVED colours (rgb/hex) through the shared resolver, never `var(--token)` — canvas can\'t use CSS', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    const serialized = JSON.stringify(option);
    expect(serialized).not.toContain('var(');
    // The base-map colours fall back to concrete hex; the visualMap ramp resolves
    // the sequential tokens to rgb.
    const geo = option.geo as { itemStyle?: { areaColor?: string } };
    expect(geo.itemStyle?.areaColor).toMatch(/^(#|rgb\()/);
    const visualMap = option.visualMap as { inRange?: { color?: string[] } };
    for (const colour of visualMap.inRange?.color ?? []) {
      expect(colour).toMatch(/^(#|rgb\()/);
    }
  });

  it('throws when the spec has no regionFill layer (fail loud, do not render an empty map)', () => {
    const noRegion = choroplethSpec({ layers: [] });
    expect(() => adaptChoroplethToECharts(noRegion, GEO, SALES, DIMENSIONS)).toThrow(/regionFill/);
  });

  it('flows a11y into the aria contract and carries usermeta provenance', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe('Sales by US state.');
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:choropleth-test');
  });

  it('surfaces an unmatched corridor on __joinDiagnostics (sprint-118 m06; silently dropped before)', () => {
    const withOrphan = [...SALES, { state: 'XX', sales: 99 }];
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, withOrphan, DIMENSIONS) as Record<string, unknown>;
    const diagnostics = option.__joinDiagnostics as { unmatchedData?: string[] } | undefined;
    expect(diagnostics?.unmatchedData).toContain('XX');
  });

  it('attaches NO __joinDiagnostics when every row matches (additive: absent on the happy path)', () => {
    const option = adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS) as Record<string, unknown>;
    expect(option.__joinDiagnostics).toBeUndefined();
  });

  it('is DETERMINISTIC — identical (spec, geo, data) yields a byte-identical serialized option', () => {
    // The Q1 determinism moat. Compared via JSON so the tooltip formatter closure
    // (a non-serialized function) does not introduce false reference inequality —
    // this mirrors how m03 will golden the serializable ECharts option.
    const a = JSON.stringify(adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS));
    const b = JSON.stringify(adaptChoroplethToECharts(choroplethSpec(), GEO, SALES, DIMENSIONS));
    expect(a).toBe(b);
  });
});

describe('registerGeoJson — pure + stateless (the m01 headless-registration audit)', () => {
  it('returns the CURRENT input under a reused map name — no cross-call cache bleed', () => {
    const first = registerGeoJson('custom-geo', GEO);
    const single: FeatureCollection = { type: 'FeatureCollection', features: [GEO.features[0]] };
    const second = registerGeoJson('custom-geo', single);

    // The src/ original returned the FIRST registration on a name collision; the
    // stateless headless port must reflect THIS call (else m03 goldens would be
    // order-dependent across the suite).
    expect(first.geoJson.features).toHaveLength(2);
    expect(second.geoJson.features).toHaveLength(1);
  });

  it('normalizes a TopoJSON topology to a GeoJSON FeatureCollection', () => {
    const topo = {
      type: 'Topology',
      arcs: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      objects: {
        states: {
          type: 'GeometryCollection',
          geometries: [{ type: 'Polygon', properties: { region: 'CA' }, arcs: [[0]] }],
        },
      },
    } as unknown as Parameters<typeof registerGeoJson>[1];

    const registration = registerGeoJson('states', topo, { topoObjectName: 'states' });
    expect(registration.geoJson.type).toBe('FeatureCollection');
    expect(registration.geoJson.features).toHaveLength(1);
    expect(registration.geoJson.features[0].properties?.region).toBe('CA');
  });
});

describe('adaptToECharts — multi-layer dispatcher surfaces geo-join diagnostics (sprint-126 m06 / Forge-Demos #11)', () => {
  // Before this fix the dispatcher read result.series/visualMap/geo/registration but
  // DISCARDED result.diagnostics, so OODS-V134 unmatched-region warnings never reached
  // consumers on the multi-layer overlay path (only the single-layer choropleth adapter
  // attached __joinDiagnostics).
  const ORPHAN = [...SALES, { state: 'XX', sales: 99 }];

  it('keeps geo.nameProperty absent on the declared off-MCP multi-layer surface', () => {
    const { echartsOption } = adaptToECharts({
      spec: choroplethSpec(),
      geoData: GEO,
      data: SALES,
      dimensions: DIMENSIONS,
    });
    expect(Object.hasOwn(echartsOption.geo as object, 'nameProperty')).toBe(false);
  });

  it('surfaces an unmatched data row on __joinDiagnostics (was silently discarded)', () => {
    const { echartsOption } = adaptToECharts({
      spec: choroplethSpec(),
      geoData: GEO,
      data: ORPHAN,
      dimensions: DIMENSIONS,
    });
    const diagnostics = (echartsOption as Record<string, unknown>).__joinDiagnostics as
      | { unmatchedData?: string[] }
      | undefined;
    expect(diagnostics?.unmatchedData).toContain('XX');
  });

  it('attaches NO __joinDiagnostics when every row matches (additive: absent on the happy path)', () => {
    const { echartsOption } = adaptToECharts({
      spec: choroplethSpec(),
      geoData: GEO,
      data: SALES,
      dimensions: DIMENSIONS,
    });
    expect((echartsOption as Record<string, unknown>).__joinDiagnostics).toBeUndefined();
  });

  it('merges + dedupes diagnostics across multiple region layers (reports a shared orphan once)', () => {
    const twoRegionLayers = choroplethSpec({
      layers: [
        { type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } },
        { type: 'regionFill', encoding: { color: { field: 'sales', scale: 'linear' } } },
      ],
    });
    const { echartsOption } = adaptToECharts({
      spec: twoRegionLayers,
      geoData: GEO,
      data: ORPHAN,
      dimensions: DIMENSIONS,
    });
    const diagnostics = (echartsOption as Record<string, unknown>).__joinDiagnostics as
      | { unmatchedData?: string[] }
      | undefined;
    // The same orphan is unmatched in both layers but must be reported exactly once.
    expect(diagnostics?.unmatchedData?.filter((v) => v === 'XX')).toHaveLength(1);
  });
});
