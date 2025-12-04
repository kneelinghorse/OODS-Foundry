/**
 * ForceGraph React Component
 *
 * React wrapper for ECharts force-directed graph visualization.
 * v1.0 uses ECharts exclusively. Provides simplified props API for network data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX } from 'react';
import type { EChartsType } from 'echarts';

import type { NetworkInput } from '../../types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { adaptGraphToECharts } from '../../viz/adapters/echarts/graph-adapter.js';
import { GraphA11yFallback } from './a11y/GraphA11yFallback.js';

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly group?: string;
  readonly value?: number;
}

export interface GraphLink {
  readonly source: string;
  readonly target: string;
  readonly value?: number;
}

export interface ForceGraphProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Network data (nodes and links) */
  readonly data: NetworkInput;
  /** Width in pixels */
  readonly width?: number;
  /** Height in pixels */
  readonly height?: number;
  /** Name/title for the visualization */
  readonly name?: string;
  /** Field to use for node color grouping */
  readonly colorField?: string;
  /** Enable zoom/pan */
  readonly zoom?: boolean;
  /** Enable node dragging */
  readonly draggable?: boolean;
  /** Show node labels */
  readonly showLabels?: boolean;
  /** Show edge labels */
  readonly showEdgeLabels?: boolean;
  /** Show legend for color groups */
  readonly showLegend?: boolean;
  /** Force layout parameters */
  readonly force?: {
    readonly repulsion?: number;
    readonly gravity?: number;
    readonly edgeLength?: number;
    readonly friction?: number;
  };
  /** Callback when a node is selected */
  readonly onSelect?: (node: GraphNode) => void;
  /** Callback when a link is selected */
  readonly onLinkSelect?: (link: GraphLink) => void;
  /** Renderer (v1.0: only 'echarts' supported) */
  readonly renderer?: 'echarts';
  /** Accessibility description */
  readonly description?: string;
  /** Show accessible table fallback */
  readonly showTable?: boolean;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

/**
 * Build NormalizedVizSpec from component props
 * Uses type assertions for extended properties that the graph adapter expects
 */
function buildSpec(props: ForceGraphProps): NormalizedVizSpec {
  const base: NormalizedVizSpec = {
    $schema: 'https://oods.dev/viz-spec/v1',
    id: 'component:force-graph',
    name: props.name ?? 'Force Graph',
    data: { values: [] },
    marks: [{ trait: 'MarkNetwork' }],
    encoding: {},
    config: {
      layout: {
        width: props.width ?? DEFAULT_WIDTH,
        height: props.height ?? DEFAULT_HEIGHT,
      },
    },
    a11y: {
      description: props.description ?? 'Force-directed graph showing network relationships',
    },
  };

  // Extended properties for the graph adapter (not in base NormalizedVizSpec)
  // Type assertion via unknown because adapter expects additional properties
  return {
    ...base,
    encoding: {
      color: props.colorField ? { field: props.colorField } : undefined,
      label: { show: props.showLabels ?? true },
      edgeLabel: { show: props.showEdgeLabels ?? false },
    },
    interaction: {
      zoom: props.zoom ?? true,
      drag: props.draggable ?? true,
    },
    layout: {
      force: props.force,
    },
    legend: {
      show: props.showLegend ?? true,
    },
  } as unknown as NormalizedVizSpec;
}

/**
 * ForceGraph visualization component
 *
 * Renders network data as an interactive force-directed graph using ECharts.
 * Supports node dragging, zoom/pan, and color grouping by category.
 *
 * @example
 * ```tsx
 * <ForceGraph
 *   data={{
 *     nodes: [
 *       { id: 'a', group: 'type1' },
 *       { id: 'b', group: 'type2' },
 *       { id: 'c', group: 'type1' },
 *     ],
 *     links: [
 *       { source: 'a', target: 'b', value: 10 },
 *       { source: 'b', target: 'c', value: 5 },
 *     ],
 *   }}
 *   width={800}
 *   height={600}
 *   colorField="group"
 *   onSelect={(node) => console.log('Selected:', node)}
 * />
 * ```
 */
export function ForceGraph({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  name,
  colorField = 'group',
  zoom = true,
  draggable = true,
  showLabels = true,
  showEdgeLabels = false,
  showLegend = true,
  force,
  onSelect,
  onLinkSelect,
  renderer = 'echarts',
  description,
  showTable = true,
  className,
  'aria-label': ariaLabel,
  ...props
}: ForceGraphProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // v1.0: Warn if non-echarts renderer requested
  if (renderer !== 'echarts') {
    console.warn(
      `ForceGraph: renderer="${renderer}" is not supported in v1.0. ` +
        'Using ECharts. Vega-Lite support planned for v1.1+'
    );
  }

  const spec = useMemo(
    () =>
      buildSpec({
        data,
        width,
        height,
        name,
        colorField,
        zoom,
        draggable,
        showLabels,
        showEdgeLabels,
        showLegend,
        force,
        description,
      }),
    [data, width, height, name, colorField, zoom, draggable, showLabels, showEdgeLabels, showLegend, force, description]
  );

  const option = useMemo(() => {
    try {
      return adaptGraphToECharts(spec, data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to build graph');
      return null;
    }
  }, [spec, data]);

  // Event handler for clicks
  const handleClick = useCallback(
    (params: {
      dataType?: string;
      name?: string;
      value?: number;
      data?: { id?: string; category?: number; source?: string; target?: string; value?: number };
    }) => {
      if (params.dataType === 'edge') {
        // Link clicked
        if (params.data?.source && params.data?.target) {
          onLinkSelect?.({
            source: params.data.source,
            target: params.data.target,
            value: params.data.value,
          });
        }
      } else if (params.name) {
        // Node clicked
        const nodeData = data.nodes.find((n) => n.id === params.data?.id || (n as { name?: string }).name === params.name);
        onSelect?.({
          id: params.data?.id ?? params.name,
          name: params.name,
          group: nodeData?.group,
          value: typeof params.value === 'number' ? params.value : undefined,
        });
      }
    },
    [data.nodes, onSelect, onLinkSelect]
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
        setErrorMessage(err instanceof Error ? err.message : 'Failed to render graph');
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

  const resolvedAriaLabel = ariaLabel ?? name ?? 'Force-directed graph visualization';

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
        data-testid="force-graph-chart"
        data-status={status}
      />

      {/* Error state */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
          style={{ maxWidth: width, height }}
        >
          <p>Unable to render graph: {errorMessage ?? 'Unknown error'}</p>
        </div>
      )}

      {/* Accessible table fallback */}
      {showTable && status === 'ready' && (
        <GraphA11yFallback data={data} name={name} />
      )}
    </div>
  );
}

export default ForceGraph;
