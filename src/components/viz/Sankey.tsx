/**
 * Sankey React Component
 *
 * React wrapper for ECharts Sankey/flow diagram visualization.
 * v1.0 uses ECharts exclusively. Provides simplified props API for flow data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX } from 'react';
import type { EChartsType } from 'echarts';

import type { SankeyInput } from '../../types/viz/network-flow.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { adaptSankeyToECharts, SankeyValidationError } from '../../viz/adapters/echarts/sankey-adapter.js';
import { SankeyA11yFallback } from './a11y/SankeyA11yFallback.js';

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SankeyNodeOutput {
  readonly name: string;
  readonly value: number;
}

export interface SankeyLinkOutput {
  readonly source: string;
  readonly target: string;
  readonly value: number;
}

export interface SankeyProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Flow data (nodes and links with values) */
  readonly data: SankeyInput;
  /** Width in pixels */
  readonly width?: number;
  /** Height in pixels */
  readonly height?: number;
  /** Name/title for the visualization */
  readonly name?: string;
  /** Layout orientation */
  readonly orientation?: 'horizontal' | 'vertical';
  /** Node alignment */
  readonly nodeAlign?: 'justify' | 'left' | 'right';
  /** Node width in pixels */
  readonly nodeWidth?: number;
  /** Gap between nodes in pixels */
  readonly nodeGap?: number;
  /** Layout iterations (higher = better but slower) */
  readonly iterations?: number;
  /** Link color style */
  readonly linkColor?: 'gradient' | 'source' | 'target';
  /** Show node labels */
  readonly showLabels?: boolean;
  /** Callback when a node is selected */
  readonly onSelect?: (node: SankeyNodeOutput) => void;
  /** Callback when a link is selected */
  readonly onLinkSelect?: (link: SankeyLinkOutput) => void;
  /** Renderer (v1.0: only 'echarts' supported) */
  readonly renderer?: 'echarts';
  /** Accessibility description */
  readonly description?: string;
  /** Show accessible table fallback */
  readonly showTable?: boolean;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 500;

/**
 * Build NormalizedVizSpec from component props
 * Uses type assertions for extended properties that the Sankey adapter expects
 */
function buildSpec(props: SankeyProps): NormalizedVizSpec {
  const base: NormalizedVizSpec = {
    $schema: 'https://oods.dev/viz-spec/v1',
    id: 'component:sankey',
    name: props.name ?? 'Sankey',
    data: { values: [] },
    marks: [{ trait: 'MarkSankey' }],
    encoding: {},
    config: {
      layout: {
        width: props.width ?? DEFAULT_WIDTH,
        height: props.height ?? DEFAULT_HEIGHT,
      },
    },
    a11y: {
      description: props.description ?? 'Sankey diagram showing flow between categories',
    },
  };

  // Extended properties for the Sankey adapter (not in base NormalizedVizSpec)
  // Type assertion via unknown because adapter expects additional properties
  return {
    ...base,
    encoding: {
      link: props.linkColor ? { color: props.linkColor } : undefined,
      label: { show: props.showLabels ?? true },
    },
    layout: {
      orientation: props.orientation ?? 'horizontal',
      nodeAlign: props.nodeAlign ?? 'justify',
      nodeWidth: props.nodeWidth,
      nodeGap: props.nodeGap,
      iterations: props.iterations,
    },
  } as unknown as NormalizedVizSpec;
}

/**
 * Sankey visualization component
 *
 * Renders flow data as a Sankey diagram using ECharts. Flow widths
 * represent the magnitude of values between source and target nodes.
 * All links must have values - this is fundamental to Sankey diagrams.
 *
 * @example
 * ```tsx
 * <Sankey
 *   data={{
 *     nodes: [
 *       { name: 'Coal' },
 *       { name: 'Natural Gas' },
 *       { name: 'Electricity' },
 *       { name: 'Heat' },
 *     ],
 *     links: [
 *       { source: 'Coal', target: 'Electricity', value: 100 },
 *       { source: 'Coal', target: 'Heat', value: 50 },
 *       { source: 'Natural Gas', target: 'Electricity', value: 80 },
 *       { source: 'Natural Gas', target: 'Heat', value: 40 },
 *     ],
 *   }}
 *   width={800}
 *   height={400}
 *   onSelect={(node) => console.log('Node selected:', node)}
 *   onLinkSelect={(link) => console.log('Flow selected:', link)}
 * />
 * ```
 */
export function Sankey({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  name,
  orientation = 'horizontal',
  nodeAlign = 'justify',
  nodeWidth,
  nodeGap,
  iterations,
  linkColor = 'gradient',
  showLabels = true,
  onSelect,
  onLinkSelect,
  renderer = 'echarts',
  description,
  showTable = true,
  className,
  'aria-label': ariaLabel,
  ...props
}: SankeyProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // v1.0: Warn if non-echarts renderer requested
  if (renderer !== 'echarts') {
    console.warn(
      `Sankey: renderer="${renderer}" is not supported in v1.0. ` +
        'Using ECharts. Vega-Lite cannot render Sankey diagrams; Full Vega support planned for v1.1+'
    );
  }

  const spec = useMemo(
    () =>
      buildSpec({
        data,
        width,
        height,
        name,
        orientation,
        nodeAlign,
        nodeWidth,
        nodeGap,
        iterations,
        linkColor,
        showLabels,
        description,
      }),
    [data, width, height, name, orientation, nodeAlign, nodeWidth, nodeGap, iterations, linkColor, showLabels, description]
  );

  const option = useMemo(() => {
    try {
      return adaptSankeyToECharts(spec, data);
    } catch (err) {
      if (err instanceof SankeyValidationError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to build Sankey diagram');
      }
      return null;
    }
  }, [spec, data]);

  // Event handler for clicks
  const handleClick = useCallback(
    (params: {
      dataType?: string;
      name?: string;
      value?: number;
      data?: { source?: string; target?: string; value?: number };
    }) => {
      if (params.dataType === 'edge') {
        // Link clicked
        if (params.data?.source && params.data?.target && params.data?.value !== undefined) {
          onLinkSelect?.({
            source: params.data.source,
            target: params.data.target,
            value: params.data.value,
          });
        }
      } else if (params.name) {
        // Node clicked
        onSelect?.({
          name: params.name,
          value: typeof params.value === 'number' ? params.value : 0,
        });
      }
    },
    [onSelect, onLinkSelect]
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
        setErrorMessage(err instanceof Error ? err.message : 'Failed to render Sankey diagram');
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

  const resolvedAriaLabel = ariaLabel ?? name ?? 'Sankey flow diagram';

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
        data-testid="sankey-chart"
        data-status={status}
      />

      {/* Error state */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
          style={{ maxWidth: width, height }}
        >
          <p>Unable to render Sankey diagram: {errorMessage ?? 'Unknown error'}</p>
        </div>
      )}

      {/* Accessible table fallback */}
      {showTable && status === 'ready' && (
        <SankeyA11yFallback data={data} name={name} />
      )}
    </div>
  );
}

export default Sankey;
