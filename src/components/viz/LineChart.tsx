import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { toVegaLiteSpec } from '../../viz/adapters/vega-lite-adapter.js';
import type { VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { AccessibleTable } from './AccessibleTable.js';
import { useReducedMotion } from '../../overlays/manager/hooks.js';

export interface LineChartProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: 'svg' | 'canvas';
  readonly showTable?: boolean;
  readonly showDescription?: boolean;
  readonly responsive?: boolean;
  readonly animate?: boolean;
  readonly minHeight?: number;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 360;
const DEFAULT_MIN_HEIGHT = 320;

export function LineChart({
  spec,
  renderer = 'svg',
  showTable = true,
  showDescription = true,
  responsive = true,
  animate = true,
  minHeight = DEFAULT_MIN_HEIGHT,
  className,
  ...props
}: LineChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = animate && !prefersReducedMotion;

  const baseWidth = spec.config?.layout?.width ?? DEFAULT_WIDTH;
  const baseHeight = spec.config?.layout?.height ?? DEFAULT_HEIGHT;
  const aspectRatio =
    baseWidth > 0 && baseHeight > 0 ? baseHeight / baseWidth : DEFAULT_HEIGHT / DEFAULT_WIDTH;

  const resolvedWidth = responsive ? measuredWidth ?? baseWidth : baseWidth;
  const resolvedHeight = responsive
    ? Math.max(minHeight, Math.round(resolvedWidth * aspectRatio))
    : Math.max(minHeight, baseHeight);

  const baseSpec = useMemo<VegaLiteAdapterSpec>(() => toVegaLiteSpec(spec), [spec]);
  const vegaSpec = useMemo<VegaLiteAdapterSpec>(() => {
    return applyLayoutOverrides(baseSpec, resolvedWidth, resolvedHeight);
  }, [baseSpec, resolvedHeight, resolvedWidth]);

  const embedOptions = useMemo<EmbedOptions>(
    () => ({
      actions: false,
      renderer,
    }),
    [renderer]
  );

  useEffect(() => {
    if (!responsive) {
      setMeasuredWidth(null);
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let widthTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleWidth = (explicit?: number) => {
      const measured = explicit ?? container.getBoundingClientRect().width ?? container.clientWidth;
      if (!measured || Number.isNaN(measured) || measured <= 0) {
        return;
      }

      if (widthTimer) {
        clearTimeout(widthTimer);
      }

      widthTimer = setTimeout(() => {
        widthTimer = null;
        setMeasuredWidth((current) => {
          if (current !== null && Math.abs(current - measured) < 1) {
            return current;
          }
          return measured;
        });
      }, 16);
    };

    scheduleWidth();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver((entries) => {
        const [entry] = entries;
        scheduleWidth(entry?.contentRect?.width);
      });

      observer.observe(container);
      return () => {
        if (widthTimer) {
          clearTimeout(widthTimer);
        }
        observer.disconnect();
      };
    }

    if (typeof window !== 'undefined') {
      const handleResize = () => scheduleWidth();
      window.addEventListener('resize', handleResize);
      return () => {
        if (widthTimer) {
          clearTimeout(widthTimer);
        }
        window.removeEventListener('resize', handleResize);
      };
    }

    return () => {
      if (widthTimer) {
        clearTimeout(widthTimer);
      }
    };
  }, [responsive]);

  useEffect(() => {
    const target = chartRef.current;
    if (!target) {
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    void (async () => {
      try {
        const embed = await loadVegaEmbed();
        const result = await embed(target, vegaSpec as unknown as VisualizationSpec, embedOptions);
        if (cancelled) {
          result.view?.finalize();
          return;
        }
        embedHandle.current = result;
        setStatus('ready');
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        const message = error instanceof Error ? error.message : 'Unable to render chart';
        setErrorMessage(message);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- surfaced only for local debugging
          console.error('LineChart failed to render via Vega-Lite adapter', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (embedHandle.current) {
        embedHandle.current.view?.finalize();
        embedHandle.current = null;
      }
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
    };
  }, [embedOptions, vegaSpec]);

  const chartClassName = [
    status === 'error' ? 'hidden' : 'h-full w-full min-w-0',
    motionEnabled ? 'transition-opacity duration-300 ease-out' : undefined,
    motionEnabled ? (status === 'ready' ? 'opacity-100' : 'opacity-0') : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const surfaceStyle: CSSProperties = {
    minHeight: `${resolvedHeight}px`,
  };

  return (
    <VizContainer
      spec={spec}
      className={className}
      chart={
        <div className="relative w-full min-w-0 overflow-hidden" style={surfaceStyle} ref={containerRef} data-testid="line-chart-surface">
          <div
            ref={chartRef}
            aria-hidden="true"
            data-testid="line-chart-renderer"
            className={chartClassName || 'h-full w-full'}
          />
          {status === 'error' ? (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface-raised/80 text-center text-sm text-text"
            >
              <p className="font-semibold">Unable to render chart</p>
              <p className="mt-2 text-text-muted">{errorMessage ?? 'Check the viz spec and try again.'}</p>
            </div>
          ) : null}
        </div>
      }
      description={showDescription ? <ChartDescription spec={spec} /> : undefined}
      fallback={showTable ? <AccessibleTable spec={spec} /> : undefined}
      {...props}
    />
  );
}

function applyLayoutOverrides(
  spec: VegaLiteAdapterSpec,
  width?: number,
  height?: number
): VegaLiteAdapterSpec {
  if (width === undefined && height === undefined) {
    return spec;
  }

  return {
    ...spec,
    ...(width !== undefined ? { width: Math.round(width) } : {}),
    ...(height !== undefined ? { height: Math.round(height) } : {}),
  };
}
