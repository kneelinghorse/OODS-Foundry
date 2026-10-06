import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHART_SPAN,
  DEFAULT_COLUMNS,
  DEFAULT_KPI_SPAN,
  MOBILE_BREAKPOINT_PX,
  resolveDashboardLayout,
  type DashboardLayout,
  type Panel,
} from '@oods/viz-core';

function kpi(id: string): Panel {
  return { id, kind: 'kpi', datasetId: 'd', field: 'v' };
}
function chart(id: string): Panel {
  return { id, kind: 'chart', chartType: 'line', datasetId: 'd', encodings: { x: 'a', y: 'v' } };
}

// Metric-overview shape: 4 KPI tiles + trend + breakdown + geo.
function metricOverviewPanels(): Panel[] {
  return [
    chart('trend'),
    chart('breakdown'),
    kpi('kpi-a'),
    kpi('kpi-b'),
    kpi('kpi-c'),
    kpi('kpi-d'),
    chart('geo'),
  ];
}

describe('@oods/viz-core — resolveDashboardLayout', () => {
  it('is deterministic — running twice is byte-identical (no Date.now/Math.random)', () => {
    const panels = metricOverviewPanels();
    const layout: DashboardLayout = { columns: 12, placements: [{ panelId: 'geo', gridSpan: 12, order: 5 }] };
    const a = JSON.stringify(resolveDashboardLayout(panels, layout));
    const b = JSON.stringify(resolveDashboardLayout(panels, layout));
    expect(a).toBe(b);
  });

  it('places KPI panels before chart panels (KPI-row-first convention)', () => {
    const placements = resolveDashboardLayout(metricOverviewPanels());
    const firstChart = placements.find((p) => p.id === 'trend')!;
    const lastKpi = placements.find((p) => p.id === 'kpi-d')!;
    // every KPI sits on row 0; the first chart wraps below them.
    expect(placements.filter((p) => p.id.startsWith('kpi-')).every((p) => p.y === 0)).toBe(true);
    expect(firstChart.y).toBeGreaterThan(lastKpi.y);
  });

  it('packs the 4 default KPI tiles into a single 12-col row (span 3 each)', () => {
    const placements = resolveDashboardLayout([kpi('a'), kpi('b'), kpi('c'), kpi('d')]);
    expect(placements.map((p) => [p.x, p.y, p.w])).toEqual([
      [0, 0, DEFAULT_KPI_SPAN],
      [3, 0, DEFAULT_KPI_SPAN],
      [6, 0, DEFAULT_KPI_SPAN],
      [9, 0, DEFAULT_KPI_SPAN],
    ]);
  });

  it('wraps a panel that overflows the current row to the next row', () => {
    // two default charts (span 6) fill a 12-col row; the third wraps.
    const placements = resolveDashboardLayout([chart('c1'), chart('c2'), chart('c3')]);
    expect(placements[0]).toMatchObject({ id: 'c1', x: 0, y: 0, w: DEFAULT_CHART_SPAN });
    expect(placements[1]).toMatchObject({ id: 'c2', x: 6, y: 0 });
    expect(placements[2]).toMatchObject({ id: 'c3', x: 0 });
    expect(placements[2].y).toBeGreaterThan(0);
  });

  it('honors an explicit per-panel gridSpan from the IR', () => {
    const layout: DashboardLayout = { columns: 12, placements: [{ panelId: 'wide', gridSpan: 12 }] };
    const [p] = resolveDashboardLayout([chart('wide')], layout);
    expect(p.w).toBe(12);
  });

  it('clamps a gridSpan larger than the column count down to the grid width', () => {
    const layout: DashboardLayout = { columns: 8, placements: [{ panelId: 'huge', gridSpan: 99 }] };
    const [p] = resolveDashboardLayout([chart('huge')], layout);
    expect(p.w).toBe(8);
  });

  it('respects explicit order hints (negative floats front, positive sinks back)', () => {
    const panels = [chart('mid'), chart('first'), chart('last')];
    const layout: DashboardLayout = {
      columns: 12,
      placements: [
        { panelId: 'first', order: -1 },
        { panelId: 'last', order: 5 },
      ],
    };
    const order = resolveDashboardLayout(panels, layout).map((p) => p.id);
    expect(order).toEqual(['first', 'mid', 'last']);
  });

  it('collapses to a single stacked column below the mobile breakpoint', () => {
    const panels = [kpi('a'), kpi('b'), chart('c')];
    const placements = resolveDashboardLayout(panels, { columns: 12 }, { viewportWidth: MOBILE_BREAKPOINT_PX - 1 });
    expect(placements.every((p) => p.x === 0 && p.w === 1)).toBe(true);
    // each panel on its own row; y increments by the PRIOR row's shelf height
    // (kpi h=1 then kpi h=1), so the chart lands at y=2.
    expect(placements.map((p) => p.y)).toEqual([0, 1, 2]);
    expect(placements.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('does NOT collapse at exactly the breakpoint width', () => {
    const placements = resolveDashboardLayout([kpi('a'), kpi('b')], { columns: 12 }, { viewportWidth: MOBILE_BREAKPOINT_PX });
    expect(placements.every((p) => p.w === DEFAULT_KPI_SPAN)).toBe(true);
  });

  it('defaults to a 12-column grid when layout is omitted', () => {
    const placements = resolveDashboardLayout([chart('a'), chart('b'), chart('c')]);
    // chart span 6 -> two per 12-col row -> third wraps
    expect(placements[2].y).toBeGreaterThan(0);
    expect(DEFAULT_COLUMNS).toBe(12);
  });

  it('returns an empty array for no panels', () => {
    expect(resolveDashboardLayout([])).toEqual([]);
  });

  it('de-dupes placement entries by panelId (first wins, deterministic)', () => {
    const layout: DashboardLayout = {
      columns: 12,
      placements: [
        { panelId: 'a', gridSpan: 4 },
        { panelId: 'a', gridSpan: 12 },
      ],
    };
    const [p] = resolveDashboardLayout([chart('a')], layout);
    expect(p.w).toBe(4);
  });
});
