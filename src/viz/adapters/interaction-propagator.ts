import type {
  LayoutDefinition,
  LayoutFacet,
  NormalizedVizSpec,
} from '@/viz/spec/normalized-viz-spec.js';

export interface InteractionPropagationPlan {
  readonly syncInteractions: boolean;
  readonly baseSeriesCount: number;
  readonly panelCount: number;
}

export function createInteractionPropagationPlan(spec: NormalizedVizSpec): InteractionPropagationPlan {
  return {
    syncInteractions: shouldSyncInteractions(spec.layout),
    baseSeriesCount: spec.marks.length,
    panelCount: derivePanelCount(spec),
  };
}

export function shouldPropagateInteractions(plan: InteractionPropagationPlan): boolean {
  return plan.syncInteractions && plan.panelCount > 1;
}

function shouldSyncInteractions(layout?: LayoutDefinition): boolean {
  if (!layout) {
    return false;
  }

  if (layout.trait === 'LayoutLayer') {
    return layout.syncInteractions !== false;
  }

  return true;
}

function derivePanelCount(spec: NormalizedVizSpec): number {
  const layout = spec.layout;

  if (!layout) {
    return 1;
  }

  if (layout.trait === 'LayoutLayer') {
    return 1;
  }

  if (layout.trait === 'LayoutConcat') {
    return layout.sections?.length ?? 1;
  }

  if (layout.trait === 'LayoutFacet') {
    return inferFacetPanelCount(layout, spec);
  }

  return 1;
}

function inferFacetPanelCount(layout: LayoutFacet, spec: NormalizedVizSpec): number {
  const rows = Array.isArray(spec.data.values) ? spec.data.values : undefined;
  const rowDomain = collectDomain(rows, layout.rows?.field, layout.rows?.limit);
  const columnDomain = collectDomain(rows, layout.columns?.field, layout.columns?.limit);
  const panels = Math.max(rowDomain.length, 1) * Math.max(columnDomain.length, 1);

  if (layout.maxPanels && layout.maxPanels > 0) {
    return Math.min(layout.maxPanels, panels);
  }

  return panels > 0 ? panels : 1;
}

function collectDomain(
  rows: readonly Record<string, unknown>[] | undefined,
  field?: string,
  limit?: number
): string[] {
  if (!field) {
    return ['single'];
  }

  const values = new Set<string>();

  if (rows) {
    for (const row of rows) {
      const value = row[field];

      if (value === undefined || value === null) {
        continue;
      }

      values.add(String(value));
      if (limit && values.size >= limit) {
        break;
      }
    }
  }

  if (values.size > 0) {
    return [...values];
  }

  const fallbackCount = limit && limit > 0 ? limit : 1;
  return Array.from({ length: fallbackCount }, (_, index) => `facet-${field}-${index + 1}`);
}
