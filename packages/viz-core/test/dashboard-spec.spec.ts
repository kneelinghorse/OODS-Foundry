import { describe, expect, it } from 'vitest';
import {
  assertDashboardSpec,
  DashboardSpecError,
  dashboardSpecSchema,
  isDashboardSpec,
  validateDashboardSpec,
  type DashboardSpec,
  type Selection,
  type SelectionOperator,
  type SelectionState,
} from '@oods/viz-core';

// A minimal-but-complete "metric overview" dashboard: KPI row + trend (line) +
// breakdown (bar) + geo (choropleth), one shared dataset, a cross-filter link,
// and all 5 frozen seams populated.
function validFixture(): DashboardSpec {
  return {
    schemaVersion: 'v0.1',
    id: 'dash-revenue',
    title: 'Revenue Overview',
    datasets: [
      {
        id: 'sales',
        rows: [
          { region: 'West', month: 'Jan', revenue: 100 },
          { region: 'East', month: 'Jan', revenue: 80 },
          { region: 'West', month: 'Feb', revenue: 120 },
        ],
      },
    ],
    panels: [
      {
        id: 'kpi-rev',
        kind: 'kpi',
        title: 'Total Revenue',
        datasetId: 'sales',
        field: 'revenue',
        aggregate: 'sum',
        comparison: { basis: 'prior_period', field: 'month' },
        threshold: { direction: 'above', value: 150 },
        format: 'currency',
      },
      {
        id: 'trend',
        kind: 'chart',
        chartType: 'line',
        datasetId: 'sales',
        encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } },
      },
      {
        id: 'breakdown',
        kind: 'chart',
        chartType: 'bar',
        datasetId: 'sales',
        encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } },
      },
      {
        id: 'geo',
        kind: 'chart',
        chartType: 'choropleth',
        geo: { geojson: { type: 'FeatureCollection', features: [] }, valueField: 'revenue' },
      },
    ],
    layout: {
      columns: 12,
      placements: [{ panelId: 'kpi-rev', gridSpan: 3, order: 0 }],
    },
    links: [{ id: 'l1', source: 'breakdown', target: 'trend', sourceField: 'region', operator: 'in' }],
    crossFilter: { combine: 'and', ignoreSelfSource: true },
    onPanelError: 'placeholder',
    a11y: { description: 'Revenue overview dashboard: total revenue, trend, regional breakdown, and a map.', readingOrder: 'kpi-first' },
    tokenCssRef: 'tokens.build',
  };
}

describe('@oods/viz-core — DashboardSpec validator', () => {
  it('accepts a complete metric-overview dashboard', () => {
    const result = validateDashboardSpec(validFixture());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts heterogeneous panels across every data branch (tabular / hierarchy / sankey / network / geo)', () => {
    const spec = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'd', rows: [{ a: 1 }] }],
      a11y: { description: 'All panel kinds.' },
      panels: [
        { id: 'kpi', kind: 'kpi', datasetId: 'd', field: 'a' },
        { id: 'p-bar', kind: 'chart', chartType: 'bar', datasetId: 'd', encodings: { x: 'a', y: 'a' } },
        {
          id: 'p-tree',
          kind: 'chart',
          chartType: 'treemap',
          hierarchy: { type: 'adjacency_list', data: [{ id: 'r', parentId: null, value: 1 }] },
        },
        {
          id: 'p-sankey',
          kind: 'chart',
          chartType: 'sankey',
          sankey: { nodes: [{ name: 'a' }, { name: 'b' }], links: [{ source: 'a', target: 'b', value: 5 }] },
        },
        {
          id: 'p-force',
          kind: 'chart',
          chartType: 'force_graph',
          network: { nodes: [{ id: 'n1' }], links: [] },
        },
        {
          id: 'p-bubble',
          kind: 'chart',
          chartType: 'bubble_map',
          geo: { longitudeField: 'lon', latitudeField: 'lat', rows: [{ lon: 1, lat: 2 }] },
        },
      ],
    };
    const result = validateDashboardSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a missing required field and reports the path', () => {
    const { schemaVersion: _omit, ...noVersion } = validFixture();
    const result = validateDashboardSpec(noVersion);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === 'required' && /schemaVersion/.test(e.message))).toBe(true);
  });

  it('rejects an empty cross-panel a11y summary (SEAM d) at the right path', () => {
    const spec = { ...validFixture(), a11y: { description: '' } };
    const result = validateDashboardSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ path: '/a11y/description' });
  });

  it('rejects unknown top-level keys (additionalProperties-clean)', () => {
    const spec = { ...validFixture(), surprise: true };
    const result = validateDashboardSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects a bad schemaVersion const', () => {
    const spec = { ...validFixture(), schemaVersion: 'v9.9' };
    expect(validateDashboardSpec(spec).valid).toBe(false);
  });

  describe('panel data-branch conditionals (SEAM a — viz.render-shaped panels)', () => {
    it('rejects a tabular chart panel missing datasetId + encodings', () => {
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[1] = { id: 'trend', kind: 'chart', chartType: 'line' } as DashboardSpec['panels'][number];
      const result = validateDashboardSpec({ ...spec, panels });
      expect(result.valid).toBe(false);
    });

    it('rejects a tabular chart panel missing the x encoding', () => {
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[1] = {
        id: 'trend',
        kind: 'chart',
        chartType: 'line',
        datasetId: 'sales',
        encodings: { y: 'revenue' },
      } as DashboardSpec['panels'][number];
      expect(validateDashboardSpec({ ...spec, panels }).valid).toBe(false);
    });

    it('rejects a sankey panel that omits its sankey data branch', () => {
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[3] = { id: 'flow', kind: 'chart', chartType: 'sankey' } as DashboardSpec['panels'][number];
      expect(validateDashboardSpec({ ...spec, panels }).valid).toBe(false);
    });

    it('rejects a choropleth panel missing geo.valueField', () => {
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[3] = {
        id: 'geo',
        kind: 'chart',
        chartType: 'choropleth',
        geo: { geojson: { type: 'FeatureCollection', features: [] } },
      } as DashboardSpec['panels'][number];
      expect(validateDashboardSpec({ ...spec, panels }).valid).toBe(false);
    });
  });

  describe('frozen seams', () => {
    it('rejects an inline color on a KPI threshold (SEAM e — tokens deferred, no inline color)', () => {
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[0] = {
        ...(panels[0] as Record<string, unknown>),
        threshold: { direction: 'above', value: 150, color: '#ff0000' },
      } as DashboardSpec['panels'][number];
      const result = validateDashboardSpec({ ...spec, panels });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.keyword === 'additionalProperties')).toBe(true);
    });

    it('rejects an unsupported cross-source combine mode (SEAM c — v1 AND only)', () => {
      const spec = { ...validFixture(), crossFilter: { combine: 'or' } };
      expect(validateDashboardSpec(spec).valid).toBe(false);
    });

    it('rejects an out-of-grammar link operator (SectionFilter grammar reuse)', () => {
      const spec = validFixture();
      const links = [{ source: 'breakdown', target: 'trend', operator: '~=' }];
      expect(validateDashboardSpec({ ...spec, links }).valid).toBe(false);
    });

    it('rejects an unknown onPanelError policy (SEAM b)', () => {
      const spec = { ...validFixture(), onPanelError: 'explode' };
      expect(validateDashboardSpec(spec).valid).toBe(false);
    });

    it('ACCEPTS a KpiPanel carrying the inert measureRef descriptor (SEAM vi — sprint-116 Phase-3 beachhead)', () => {
      // measureRef is an optional bare string on the additionalProperties:false
      // KpiPanel. It must VALIDATE (the descriptor is parsed) — it stays inert at
      // compute time, but the IR seam must ACCEPT it, else any spec carrying a
      // governed-measure provenance tag is AJV-rejected at the boundary.
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[0] = { ...(panels[0] as Record<string, unknown>), measureRef: 'gm.revenue' } as DashboardSpec['panels'][number];
      const result = validateDashboardSpec({ ...spec, panels });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a non-string measureRef — it is a BARE STRING, never an inline object (SEAM vi, memo §3.3)', () => {
      // The object form {name,field,aggregate,role} is explicitly disallowed so the
      // descriptor cannot drift against the authoritative field/aggregate inputs.
      const spec = validFixture();
      const panels = [...spec.panels];
      panels[0] = { ...(panels[0] as Record<string, unknown>), measureRef: { name: 'gm.revenue' } } as DashboardSpec['panels'][number];
      expect(validateDashboardSpec({ ...spec, panels }).valid).toBe(false);
    });
  });

  describe('assert / is / schema surface', () => {
    it('assertDashboardSpec returns the input for a valid spec', () => {
      const spec = validFixture();
      expect(assertDashboardSpec(spec)).toBe(spec);
    });

    it('assertDashboardSpec throws DashboardSpecError carrying errors for an invalid spec', () => {
      try {
        assertDashboardSpec({ schemaVersion: 'v0.1' });
        throw new Error('expected assertDashboardSpec to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DashboardSpecError);
        expect((err as DashboardSpecError).errors.length).toBeGreaterThan(0);
      }
    });

    it('isDashboardSpec narrows true for valid, false for invalid', () => {
      expect(isDashboardSpec(validFixture())).toBe(true);
      expect(isDashboardSpec({ schemaVersion: 'v0.1' })).toBe(false);
    });

    it('exposes the source schema via dashboardSpecSchema', () => {
      expect((dashboardSpecSchema as { title?: string }).title).toBe('Dashboard Spec v0.1');
    });
  });

  // Selection / SelectionState are frozen in m01 so m03 + m04 depend only here.
  // Type-level usage + runtime construction documents + locks the shape.
  it('freezes the Selection / SelectionState types (m03 + m04 contract)', () => {
    const op: SelectionOperator = 'in';
    const selection: Selection = {
      sourceWidgetId: 'breakdown',
      dimension: 'region',
      values: ['West', 'East'],
      kind: 'categorical',
      predicate: { field: 'region', operator: op, value: ['West', 'East'] },
    };
    const state: SelectionState = { [selection.sourceWidgetId]: selection };

    expect(Object.keys(state)).toEqual(['breakdown']);
    expect(state.breakdown.values).toEqual(['West', 'East']);
    expect(state.breakdown.predicate?.operator).toBe('in');
  });
});
