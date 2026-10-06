// Headless deterministic dashboard auto-layout (sprint-113 m02).
//
// Pure grid packer: a DashboardSpec's panels[] (+ optional layout hints) ->
// abstract [{id,x,y,w,h}] grid placements. Renderer-agnostic — the client sizes
// the canvas (matches viz.render's provenance-only dimensions posture). NO
// Date.now / Math.random / new Date; declared-panel-order stable; integer grid
// units; no new runtime dependency. The responsive-collapse idea is re-authored
// pure from src/viz/contexts/dashboard-spatial-context.tsx resolveGridSpan
// (the < 720px single-column collapse) with ZERO React/@/ imports.

import type { DashboardLayout, Panel, PanelPlacement } from '../spec/dashboard.types.js';

/** Abstract grid placement: column/row indices + spans (0-based, integer units). */
export interface GridPlacement {
  readonly id: string;
  /** Column index (0-based). */
  readonly x: number;
  /** Row index (0-based). */
  readonly y: number;
  /** Column span. */
  readonly w: number;
  /** Row span. */
  readonly h: number;
}

export interface AutoLayoutOptions {
  /**
   * Optional responsive hint. Below the mobile breakpoint the grid collapses to
   * a single column (every panel full-width, stacked) — the re-authored
   * resolveGridSpan behaviour. Omitted -> the full multi-column grid.
   */
  readonly viewportWidth?: number;
}

/** Mobile collapse breakpoint (px). Ported from resolveGridSpan's `< 720`. */
export const MOBILE_BREAKPOINT_PX = 720;

/** Default grid width when DashboardLayout.columns is absent. */
export const DEFAULT_COLUMNS = 12;

/** Default column span per panel kind when no gridSpan hint is given. */
export const DEFAULT_KPI_SPAN = 3;
export const DEFAULT_CHART_SPAN = 6;

/** Default row span (height) per panel kind. */
export const DEFAULT_KPI_HEIGHT = 1;
export const DEFAULT_CHART_HEIGHT = 2;

function isCollapsed(viewportWidth?: number): boolean {
  return viewportWidth !== undefined && viewportWidth < MOBILE_BREAKPOINT_PX;
}

function defaultSpan(kind: Panel['kind']): number {
  return kind === 'kpi' ? DEFAULT_KPI_SPAN : DEFAULT_CHART_SPAN;
}

function defaultHeight(kind: Panel['kind']): number {
  return kind === 'kpi' ? DEFAULT_KPI_HEIGHT : DEFAULT_CHART_HEIGHT;
}

function indexPlacements(placements?: readonly PanelPlacement[]): Map<string, PanelPlacement> {
  const byPanel = new Map<string, PanelPlacement>();
  for (const placement of placements ?? []) {
    // First placement for a panelId wins (deterministic; ignores later dupes).
    if (!byPanel.has(placement.panelId)) {
      byPanel.set(placement.panelId, placement);
    }
  }
  return byPanel;
}

/**
 * Resolve panels (+ optional layout hints) to a deterministic abstract grid.
 *
 * Ordering is a stable sort on `(order, kpi-first, declaredIndex)`:
 *  - explicit `placements[].order` (default 0) — a negative value floats a panel
 *    toward the front, a positive value sinks it toward the back;
 *  - KPI panels precede chart panels at equal order (the metric-overview
 *    KPI-row-first convention);
 *  - declared array index breaks remaining ties (declared-order stable).
 *
 * Placement is a left-to-right shelf packer: a panel that would overflow the
 * current row wraps to the next, the row height being the tallest panel on it.
 */
export function resolveDashboardLayout(
  panels: readonly Panel[],
  layout?: DashboardLayout,
  options?: AutoLayoutOptions,
): GridPlacement[] {
  const collapsed = isCollapsed(options?.viewportWidth);
  const columns = collapsed ? 1 : Math.max(1, Math.trunc(layout?.columns ?? DEFAULT_COLUMNS));
  const placementByPanel = indexPlacements(layout?.placements);

  const ordered = panels
    .map((panel, index) => ({ panel, index, placement: placementByPanel.get(panel.id) }))
    .sort((a, b) => {
      const orderA = a.placement?.order ?? 0;
      const orderB = b.placement?.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      const kpiRankA = a.panel.kind === 'kpi' ? 0 : 1;
      const kpiRankB = b.panel.kind === 'kpi' ? 0 : 1;
      if (kpiRankA !== kpiRankB) return kpiRankA - kpiRankB;
      return a.index - b.index;
    });

  const placements: GridPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;

  for (const { panel, placement } of ordered) {
    const desiredSpan = Math.max(1, Math.trunc(placement?.gridSpan ?? defaultSpan(panel.kind)));
    const w = Math.min(desiredSpan, columns);
    const h = defaultHeight(panel.kind);

    if (cursorX > 0 && cursorX + w > columns) {
      cursorY += shelfHeight;
      cursorX = 0;
      shelfHeight = 0;
    }

    placements.push({ id: panel.id, x: cursorX, y: cursorY, w, h });
    cursorX += w;
    shelfHeight = Math.max(shelfHeight, h);
  }

  return placements;
}
