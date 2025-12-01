import type { ReactNode } from 'react';
import type { GeoFeature } from '@/components/viz/spatial/SpatialContext.js';
import type { DataRecord } from '@/viz/adapters/spatial/geo-data-joiner.js';
import type { SpatialLayer } from '@/types/viz/spatial.js';
import type { RenderContext } from '@/types/render-context.js';
import type { CanonicalRegionID } from '@/types/regions.js';
import type { ViewExtension } from '@/types/view-extension.js';
import {
  createClearSpatialFilterAction,
  createPointFilterAction,
  createRegionFilterAction,
  type SpatialFilterAction,
} from '../interactions/spatial-filter-actions.js';

export type SpatialDashboardWidgetKind = 'choropleth' | 'bubble' | 'route';

export interface GridSpan {
  readonly cols: number;
  readonly rows: number;
}

export const DEFAULT_SPATIAL_GRID_SPAN: GridSpan = Object.freeze({ cols: 2, rows: 2 });

export interface SpatialDashboardWidget<Data = unknown> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly kind: SpatialDashboardWidgetKind;
  readonly gridSpan?: GridSpan;
  readonly layers?: readonly SpatialLayer[];
  readonly render: (ctx: RenderContext<Data>) => ReactNode;
}

export interface RegisterSpatialWidgetsOptions<Data = unknown> {
  readonly traitId: string;
  readonly widgets: readonly SpatialDashboardWidget<Data>[];
  readonly region?: CanonicalRegionID;
  readonly viewportWidth?: number;
}

export function registerSpatialDashboardWidgets<Data = unknown>(
  options: RegisterSpatialWidgetsOptions<Data>
): ViewExtension<Data>[] {
  const {
    traitId,
    widgets,
    region = 'main',
    viewportWidth,
  } = options;

  return widgets.map<ViewExtension<Data>>((widget, index) => {
    const span = resolveGridSpan(widget.gridSpan, viewportWidth);
    return {
      id: `${traitId}:${widget.id}`,
      region,
      type: 'section',
      priority: 50 + index,
      metadata: {
        sourceTrait: traitId,
        tags: ['spatial-widget', widget.kind, 'dashboard'],
        notes: widget.description,
      },
      render: (ctx) => (
        <div
          data-dashboard-widget="spatial"
          data-spatial-kind={widget.kind}
          data-grid-span-cols={span.cols}
          data-grid-span-rows={span.rows}
        >
          {widget.render(ctx)}
        </div>
      ),
    };
  });
}

export function resolveGridSpan(span?: GridSpan, viewportWidth?: number): GridSpan {
  const resolved: GridSpan = {
    cols: span?.cols ?? DEFAULT_SPATIAL_GRID_SPAN.cols,
    rows: span?.rows ?? DEFAULT_SPATIAL_GRID_SPAN.rows,
  };

  if (viewportWidth !== undefined && viewportWidth < 720) {
    return { ...resolved, cols: 1 };
  }

  return resolved;
}

export interface SpatialInteractionBindings {
  readonly onRegionClick: (feature: GeoFeature, datum: DataRecord | null) => void;
  readonly onPointClick: (datum: DataRecord) => void;
  readonly clear: () => void;
}

export function createSpatialInteractionBindings(
  sourceWidgetId: string,
  dispatch?: (action: SpatialFilterAction) => void
): SpatialInteractionBindings {
  const send = dispatch ?? (() => {});

  return {
    onRegionClick: (feature, datum) => send(createRegionFilterAction(sourceWidgetId, feature, datum)),
    onPointClick: (datum) => send(createPointFilterAction(sourceWidgetId, datum)),
    clear: () => send(createClearSpatialFilterAction(sourceWidgetId)),
  };
}
