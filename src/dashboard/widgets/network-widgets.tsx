/**
 * Network Dashboard Widget Definitions
 *
 * Dashboard widget definitions for Network & Flow visualizations:
 * - Treemap (hierarchical data)
 * - Sunburst (hierarchical data)
 * - ForceGraph (network data)
 * - Sankey (flow data)
 *
 * Follows the spatial widget pattern from dashboard-spatial-context.tsx
 */
import type { ReactNode } from 'react';
import type { RenderContext } from '@/types/render-context.js';
import type { CanonicalRegionID } from '@/types/regions.js';
import type { ViewExtension } from '@/types/view-extension.js';

export type NetworkDashboardWidgetKind = 'treemap' | 'sunburst' | 'force-graph' | 'sankey';

export type NetworkDataCategory = 'hierarchy' | 'network' | 'flow';

export interface GridSpan {
  readonly cols: number;
  readonly rows: number;
}

export const DEFAULT_NETWORK_GRID_SPAN: GridSpan = Object.freeze({ cols: 2, rows: 2 });

/**
 * Default sizes for network widget types
 */
export const NETWORK_WIDGET_DEFAULTS: Readonly<Record<NetworkDashboardWidgetKind, GridSpan>> = Object.freeze({
  treemap: { cols: 4, rows: 3 },
  sunburst: { cols: 3, rows: 3 },
  'force-graph': { cols: 4, rows: 4 },
  sankey: { cols: 4, rows: 3 },
});

/**
 * Minimum sizes for network widget types
 */
export const NETWORK_WIDGET_MIN_SIZES: Readonly<Record<NetworkDashboardWidgetKind, GridSpan>> = Object.freeze({
  treemap: { cols: 2, rows: 2 },
  sunburst: { cols: 2, rows: 2 },
  'force-graph': { cols: 3, rows: 3 },
  sankey: { cols: 3, rows: 2 },
});

/**
 * Data categories for network widget types
 */
export const NETWORK_WIDGET_CATEGORIES: Readonly<Record<NetworkDashboardWidgetKind, NetworkDataCategory>> = Object.freeze({
  treemap: 'hierarchy',
  sunburst: 'hierarchy',
  'force-graph': 'network',
  sankey: 'flow',
});

export interface NetworkWidgetDataRequirements {
  /** Required trait for this widget type */
  readonly trait: 'hierarchical' | 'networkable' | 'flowable';
  /** Minimum data rows required */
  readonly minRows: number;
  /** Optional: required fields */
  readonly requiredFields?: readonly string[];
}

/**
 * Data requirements for each network widget type
 */
export const NETWORK_WIDGET_DATA_REQUIREMENTS: Readonly<Record<NetworkDashboardWidgetKind, NetworkWidgetDataRequirements>> = Object.freeze({
  treemap: {
    trait: 'hierarchical',
    minRows: 2,
    requiredFields: ['name', 'value'],
  },
  sunburst: {
    trait: 'hierarchical',
    minRows: 2,
    requiredFields: ['name', 'value'],
  },
  'force-graph': {
    trait: 'networkable',
    minRows: 2,
    requiredFields: ['nodes', 'links'],
  },
  sankey: {
    trait: 'flowable',
    minRows: 2,
    requiredFields: ['source', 'target', 'value'],
  },
});

export interface NetworkDashboardWidget<Data = unknown> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly kind: NetworkDashboardWidgetKind;
  readonly gridSpan?: GridSpan;
  readonly minSize?: GridSpan;
  /** Associated data category */
  readonly category: NetworkDataCategory;
  /** Data requirements for this widget */
  readonly dataRequirements: NetworkWidgetDataRequirements;
  /** Render function */
  readonly render: (ctx: RenderContext<Data>) => ReactNode;
  /** Renderer note (v1.0: ECharts only) */
  readonly rendererNote?: string;
}

export interface RegisterNetworkWidgetsOptions<Data = unknown> {
  readonly traitId: string;
  readonly widgets: readonly NetworkDashboardWidget<Data>[];
  readonly region?: CanonicalRegionID;
  readonly viewportWidth?: number;
}

/**
 * Resolve grid span with responsive fallback
 * On narrow viewports (< 720px), collapses to single column
 */
export function resolveNetworkGridSpan(
  kind: NetworkDashboardWidgetKind,
  span?: GridSpan,
  viewportWidth?: number
): GridSpan {
  const defaultSpan = NETWORK_WIDGET_DEFAULTS[kind];
  const resolved: GridSpan = {
    cols: span?.cols ?? defaultSpan.cols,
    rows: span?.rows ?? defaultSpan.rows,
  };

  // Responsive: collapse to single column on narrow viewports
  if (viewportWidth !== undefined && viewportWidth < 720) {
    return { ...resolved, cols: 1 };
  }

  return resolved;
}

/**
 * Register network dashboard widgets as ViewExtensions
 *
 * Converts NetworkDashboardWidget definitions into ViewExtension objects
 * that can be registered with the view system.
 *
 * @example
 * ```ts
 * const extensions = registerNetworkDashboardWidgets({
 *   traitId: 'OrgHierarchy',
 *   widgets: [
 *     {
 *       id: 'org-treemap',
 *       title: 'Organization Treemap',
 *       kind: 'treemap',
 *       category: 'hierarchy',
 *       dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS.treemap,
 *       render: (ctx) => <Treemap data={ctx.data} />,
 *     },
 *   ],
 * });
 * ```
 */
export function registerNetworkDashboardWidgets<Data = unknown>(
  options: RegisterNetworkWidgetsOptions<Data>
): ViewExtension<Data>[] {
  const {
    traitId,
    widgets,
    region = 'main',
    viewportWidth,
  } = options;

  return widgets.map<ViewExtension<Data>>((widget, index) => {
    const span = resolveNetworkGridSpan(widget.kind, widget.gridSpan, viewportWidth);
    const minSize = widget.minSize ?? NETWORK_WIDGET_MIN_SIZES[widget.kind];

    return {
      id: `${traitId}:${widget.id}`,
      region,
      type: 'section',
      priority: 50 + index,
      metadata: {
        sourceTrait: traitId,
        tags: ['network-widget', widget.kind, widget.category, 'dashboard'],
        notes: widget.description,
        dataRequirements: widget.dataRequirements,
        rendererNote: widget.rendererNote ?? 'Requires ECharts (v1.0)',
      },
      render: (ctx: RenderContext<Data>) => (
        <div
          data-dashboard-widget="network"
          data-network-kind={widget.kind}
          data-network-category={widget.category}
          data-grid-span-cols={span.cols}
          data-grid-span-rows={span.rows}
          data-grid-min-cols={minSize.cols}
          data-grid-min-rows={minSize.rows}
        >
          {widget.render(ctx)}
        </div>
      ),
    };
  });
}

/**
 * Create a treemap widget definition
 */
export function createTreemapWidget<Data = unknown>(
  config: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly gridSpan?: GridSpan;
    readonly render: (ctx: RenderContext<Data>) => ReactNode;
  }
): NetworkDashboardWidget<Data> {
  return {
    ...config,
    kind: 'treemap',
    category: 'hierarchy',
    dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS.treemap,
    rendererNote: 'Requires ECharts (v1.0)',
  };
}

/**
 * Create a sunburst widget definition
 */
export function createSunburstWidget<Data = unknown>(
  config: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly gridSpan?: GridSpan;
    readonly render: (ctx: RenderContext<Data>) => ReactNode;
  }
): NetworkDashboardWidget<Data> {
  return {
    ...config,
    kind: 'sunburst',
    category: 'hierarchy',
    dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS.sunburst,
    rendererNote: 'Requires ECharts (v1.0)',
  };
}

/**
 * Create a force-graph widget definition
 */
export function createForceGraphWidget<Data = unknown>(
  config: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly gridSpan?: GridSpan;
    readonly render: (ctx: RenderContext<Data>) => ReactNode;
  }
): NetworkDashboardWidget<Data> {
  return {
    ...config,
    kind: 'force-graph',
    category: 'network',
    dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS['force-graph'],
    rendererNote: 'Requires ECharts (v1.0)',
  };
}

/**
 * Create a sankey widget definition
 */
export function createSankeyWidget<Data = unknown>(
  config: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly gridSpan?: GridSpan;
    readonly render: (ctx: RenderContext<Data>) => ReactNode;
  }
): NetworkDashboardWidget<Data> {
  return {
    ...config,
    kind: 'sankey',
    category: 'flow',
    dataRequirements: NETWORK_WIDGET_DATA_REQUIREMENTS.sankey,
    rendererNote: 'Requires ECharts (v1.0)',
  };
}

/**
 * Validate that data meets widget requirements
 */
export function validateWidgetData(
  kind: NetworkDashboardWidgetKind,
  data: unknown
): { valid: boolean; errors: string[] } {
  const requirements = NETWORK_WIDGET_DATA_REQUIREMENTS[kind];
  const errors: string[] = [];

  if (!data) {
    errors.push('Data is required');
    return { valid: false, errors };
  }

  const dataObj = data as Record<string, unknown>;

  // Check required fields
  if (requirements.requiredFields) {
    for (const field of requirements.requiredFields) {
      // For network/flow types, check for nodes/links arrays
      if (field === 'nodes' || field === 'links') {
        const arr = dataObj[field];
        if (!Array.isArray(arr)) {
          errors.push(`Missing required field: ${field} (expected array)`);
        } else if (arr.length < requirements.minRows) {
          errors.push(`${field} requires at least ${requirements.minRows} items`);
        }
      }
    }
  }

  // For hierarchy types, check for nested or adjacency structure
  if (requirements.trait === 'hierarchical') {
    const hasNested = 'type' in dataObj && dataObj.type === 'nested' && 'data' in dataObj;
    const hasAdjacency = 'type' in dataObj && dataObj.type === 'adjacency_list' && 'data' in dataObj;
    if (!hasNested && !hasAdjacency) {
      errors.push('Hierarchical data must have type: "nested" or "adjacency_list" with data property');
    }
  }

  return { valid: errors.length === 0, errors };
}
