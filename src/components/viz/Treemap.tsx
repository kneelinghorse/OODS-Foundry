/**
 * Treemap React Component
 *
 * React wrapper for ECharts treemap visualization. v1.0 uses ECharts exclusively.
 * Provides simplified props API while leveraging the full power of the ECharts adapter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX } from 'react';
import type { EChartsType } from 'echarts';

import type { HierarchyInput } from '../../types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { adaptTreemapToECharts } from '../../viz/adapters/echarts/treemap-adapter.js';
import { TreemapA11yFallback } from './a11y/TreemapA11yFallback.js';

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TreemapNode {
  readonly name: string;
  readonly value: number;
  readonly depth: number;
  readonly path: readonly string[];
}

export interface TreemapProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Hierarchical data (nested or adjacency list format) */
  readonly data: HierarchyInput;
  /** Width in pixels */
  readonly width?: number;
  /** Height in pixels */
  readonly height?: number;
  /** Name/title for the visualization */
  readonly name?: string;
  /** Enable drill-down on click */
  readonly drilldown?: boolean;
  /** Show breadcrumb navigation */
  readonly breadcrumb?: boolean;
  /** Enable zoom/pan */
  readonly zoom?: boolean;
  /** Callback when a node is selected */
  readonly onSelect?: (node: TreemapNode) => void;
  /** Callback when drilling down */
  readonly onDrillDown?: (path: readonly string[]) => void;
  /** Renderer (v1.0: only 'echarts' supported) */
  readonly renderer?: 'echarts';
  /** Accessibility description */
  readonly description?: string;
  /** Show accessible table fallback */
  readonly showTable?: boolean;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;

/**
 * Build NormalizedVizSpec from component props
 */
function buildSpec(props: TreemapProps): NormalizedVizSpec & { interaction?: Record<string, boolean> } {
  return {
    $schema: 'https://oods.dev/viz-spec/v1',
    id: 'component:treemap',
    name: props.name ?? 'Treemap',
    data: { values: [] },
    marks: [{ trait: 'MarkRect' }],
    encoding: {},
    config: {
      layout: {
        width: props.width ?? DEFAULT_WIDTH,
        height: props.height ?? DEFAULT_HEIGHT,
      },
    },
    a11y: {
      description: props.description ?? 'Treemap visualization showing hierarchical data',
    },
    interaction: {
      drilldown: props.drilldown ?? true,
      zoom: props.zoom ?? false,
      breadcrumb: props.breadcrumb ?? true,
    },
  };
}

/**
 * Treemap visualization component
 *
 * Renders hierarchical data as a treemap using ECharts. Supports nested and
 * adjacency list input formats. Includes drill-down navigation and accessible
 * table fallback.
 *
 * @example
 * ```tsx
 * <Treemap
 *   data={{
 *     type: 'nested',
 *     data: {
 *       name: 'Revenue',
 *       children: [
 *         { name: 'Product A', value: 100 },
 *         { name: 'Product B', value: 200 },
 *       ],
 *     },
 *   }}
 *   width={600}
 *   height={400}
 *   onSelect={(node) => console.log('Selected:', node)}
 * />
 * ```
 */
export function Treemap({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  name,
  drilldown = true,
  breadcrumb = true,
  zoom = false,
  onSelect,
  onDrillDown,
  renderer = 'echarts',
  description,
  showTable = true,
  className,
  'aria-label': ariaLabel,
  ...props
}: TreemapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // v1.0: Warn if non-echarts renderer requested
  if (renderer !== 'echarts') {
    console.warn(
      `Treemap: renderer="${renderer}" is not supported in v1.0. ` +
        'Using ECharts. Vega-Lite support planned for v1.1+'
    );
  }

  const spec = useMemo(
    () => buildSpec({ data, width, height, name, drilldown, breadcrumb, zoom, description }),
    [data, width, height, name, drilldown, breadcrumb, zoom, description]
  );

  const option = useMemo(() => {
    try {
      return adaptTreemapToECharts(spec, data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to build treemap');
      return null;
    }
  }, [spec, data]);

  // Event handler for node clicks
  const handleClick = useCallback(
    (params: { name?: string; value?: number; treePathInfo?: readonly { name?: string }[]; data?: { depth?: number } }) => {
      if (!params.name) return;

      const path = params.treePathInfo?.map((p) => p.name ?? '').filter(Boolean) ?? [params.name];
      const node: TreemapNode = {
        name: params.name,
        value: typeof params.value === 'number' ? params.value : 0,
        depth: params.data?.depth ?? 0,
        path,
      };

      onSelect?.(node);
      if (drilldown) {
        onDrillDown?.(path);
      }
    },
    [onSelect, onDrillDown, drilldown]
  );

  // Initialize and render ECharts
  useEffect(() => {
    if (!option) {
      setStatus('error');
      return undefined;
    }

    const target = containerRef.current;
    if (!target) return undefined;

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    const render = async () => {
      try {
        const echarts = await import('echarts');
        if (cancelled) return;

        // Dispose existing instance
        if (echartsInstance.current) {
          echartsInstance.current.dispose();
        }

        const instance = echarts.init(target, undefined, {
          renderer: 'canvas',
          useDirtyRect: true,
        });

        instance.setOption(option, true);
        instance.on('click', handleClick as never);

        echartsInstance.current = instance;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to render treemap');
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (echartsInstance.current) {
        echartsInstance.current.off('click', handleClick as never);
        echartsInstance.current.dispose();
        echartsInstance.current = null;
      }
    };
  }, [option, handleClick]);

  // Handle resize
  useEffect(() => {
    const instance = echartsInstance.current;
    if (!instance) return;

    instance.resize({ width, height });
  }, [width, height]);

  const resolvedAriaLabel = ariaLabel ?? name ?? 'Treemap visualization';

  return (
    <div
      className={`min-w-0 w-full overflow-hidden ${className ?? ''}`}
      role="figure"
      aria-label={resolvedAriaLabel}
      {...props}
    >
      {/* Chart container */}
      <div
        ref={containerRef}
        style={{ width, height }}
        aria-hidden="true"
        data-testid="treemap-chart"
        data-status={status}
      />

      {/* Error state */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
          style={{ width, height }}
        >
          <p>Unable to render treemap: {errorMessage ?? 'Unknown error'}</p>
        </div>
      )}

      {/* Accessible table fallback */}
      {showTable && status === 'ready' && (
        <TreemapA11yFallback data={data} name={name} />
      )}
    </div>
  );
}

export default Treemap;
