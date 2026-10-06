import { describe, expect, it } from 'vitest';
import {
  applyCrossFilter,
  computeKpi,
  reduceSelections,
  resolveCrossFilter,
  resolveDashboardLayout,
  type KpiPanel,
  type Panel,
  type SelectionAction,
} from '@oods/viz-core';

// Headless dashboard determinism goldens (sprint-113 m06), layer 1 of 2. Pins the
// pure m02 layout + m03 KPI + m03/m04 cross-filter/selection outputs so a behavior
// change must update a committed snapshot, with a run-twice byte-identity sibling
// (the determinism gate) per the golden-echarts-options.spec.ts idiom.
const jsonSafe = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const PANELS: Panel[] = [
  { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'sales', encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } } },
  { id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } } },
  { id: 'kpi-rev', kind: 'kpi', datasetId: 'sales', field: 'revenue', aggregate: 'sum' },
  { id: 'kpi-units', kind: 'kpi', datasetId: 'sales', field: 'units', aggregate: 'average' },
  { id: 'geo', kind: 'chart', chartType: 'choropleth', geo: { geojson: { type: 'FeatureCollection', features: [] }, valueField: 'revenue' } },
];
const LAYOUT = { columns: 12, placements: [{ panelId: 'geo', gridSpan: 12, order: 5 }] };

const ROWS = [
  { region: 'West', month: 'Jan', revenue: 100, units: 10 },
  { region: 'East', month: 'Jan', revenue: 80, units: 9 },
  { region: 'West', month: 'Feb', revenue: 120, units: 12 },
  { region: 'East', month: 'Feb', revenue: 90, units: 8 },
];

const KPI_PANEL: KpiPanel = { id: 'kpi-rev', kind: 'kpi', datasetId: 'sales', field: 'revenue', aggregate: 'sum', comparison: { basis: 'prior_period' }, threshold: { direction: 'above', value: 350 } };

const ACTIONS: SelectionAction[] = [
  { type: 'SET_SELECTION', selection: { sourceWidgetId: 'breakdown', dimension: 'region', values: ['West'], kind: 'categorical' } },
  { type: 'SET_SELECTION', selection: { sourceWidgetId: 'geo', dimension: 'region', values: ['West', 'East'], kind: 'point' } },
  { type: 'CLEAR_SELECTION', sourceWidgetId: 'geo' },
];

describe('dashboard headless determinism goldens (sprint-113 m06)', () => {
  it('auto-layout {x,y,w,h} matches the committed golden', () => {
    expect(jsonSafe(resolveDashboardLayout(PANELS, LAYOUT))).toMatchSnapshot();
  });

  it('auto-layout: same input -> byte-identical placement (determinism gate)', () => {
    expect(JSON.stringify(resolveDashboardLayout(PANELS, LAYOUT))).toBe(JSON.stringify(resolveDashboardLayout(PANELS, LAYOUT)));
  });

  it('KPI compute matches the committed golden', () => {
    expect(jsonSafe(computeKpi(KPI_PANEL, ROWS))).toMatchSnapshot();
  });

  it('KPI compute: same rows -> byte-identical payload (determinism gate)', () => {
    expect(JSON.stringify(computeKpi(KPI_PANEL, ROWS))).toBe(JSON.stringify(computeKpi(KPI_PANEL, ROWS)));
  });

  it('reduceSelections replay -> byte-stable SelectionState + derived filter (golden)', () => {
    const state = reduceSelections(ACTIONS);
    const predicates = resolveCrossFilter(state, 'kpi-rev');
    const filtered = applyCrossFilter(ROWS, predicates);
    expect(jsonSafe({ state, predicates, filtered })).toMatchSnapshot();
  });

  it('reduceSelections replay: same actions -> byte-identical state (determinism gate)', () => {
    expect(JSON.stringify(reduceSelections(ACTIONS))).toBe(JSON.stringify(reduceSelections(ACTIONS)));
  });
});
