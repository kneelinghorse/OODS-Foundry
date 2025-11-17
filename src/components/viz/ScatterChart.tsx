import { useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX, MutableRefObject } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { EChartsType } from 'echarts';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { toVegaLiteSpec } from '../../viz/adapters/vega-lite-adapter.js';
import type { VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { toEChartsOption, type EChartsOption } from '../../viz/adapters/echarts-adapter.js';
import { bindEChartsInteractions } from '../../viz/adapters/echarts-interactions.js';
import type { EChartsRuntime } from '../../viz/adapters/echarts-interactions.js';
import { selectVizRenderer, type VizRendererId } from '../../viz/adapters/renderer-selector.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { AccessibleTable } from './AccessibleTable.js';

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';
type ScatterVariant = 'scatter' | 'bubble';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 360;
const DEFAULT_MIN_HEIGHT = 320;

export interface ScatterChartProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: VizRendererId | 'auto';
  readonly vegaRenderer?: 'svg' | 'canvas';
  readonly echartsRenderer?: 'canvas' | 'svg';
  readonly showTable?: boolean;
  readonly showDescription?: boolean;
  readonly responsive?: boolean;
  readonly minHeight?: number;
  readonly enableKeyboardNavigation?: boolean;
}

interface ScatterChartBaseProps extends ScatterChartProps {
  readonly variant: ScatterVariant;
}

export function ScatterChart(props: ScatterChartProps): JSX.Element {
  return <ScatterChartBase {...props} variant="scatter" />;
}

export function ScatterChartBase({
  spec,
  renderer = 'auto',
  vegaRenderer = 'svg',
  echartsRenderer = 'canvas',
  showTable = true,
  showDescription = true,
  responsive = true,
  minHeight = DEFAULT_MIN_HEIGHT,
  enableKeyboardNavigation = true,
  className,
  variant,
  ...props
}: ScatterChartBaseProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);

  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const selection = useMemo(() => {
    if (renderer !== 'auto') {
      return { renderer, reason: 'user-preference' as const };
    }
    try {
      return selectVizRenderer(spec);
    } catch {
      return { renderer: 'vega-lite' as const, reason: 'default' as const };
    }
  }, [renderer, spec]);

  const layout = spec.config?.layout ?? {};
  const baseWidth = layout.width ?? DEFAULT_WIDTH;
  const baseHeight = layout.height ?? DEFAULT_HEIGHT;
  const resolvedWidth = responsive ? measuredWidth ?? baseWidth : baseWidth;
  const resolvedHeight = Math.max(minHeight, baseHeight);

  const embedOptions = useMemo<EmbedOptions>(
    () => ({
      actions: false,
      renderer: vegaRenderer,
    }),
    [vegaRenderer]
  );

  useEffect(() => {
    if (!responsive) {
      setMeasuredWidth(null);
      return undefined;
    }

    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    let frame: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (!width || Number.isNaN(width)) {
        return;
      }

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => setMeasuredWidth(width));
    });

    observer.observe(surface);
    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [responsive]);

  useEffect(() => {
    return () => {
      cleanupEmbed(embedHandle);
      cleanupECharts(echartsInstance);
    };
  }, []);

  useEffect(() => {
    if (selection.renderer !== 'vega-lite') {
      return;
    }

    const target = chartRef.current;
    if (!target) {
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    target.innerHTML = '';
    cleanupECharts(echartsInstance);

    let vegaSpec: VegaLiteAdapterSpec | undefined;

    try {
      vegaSpec = applyLayoutOverrides(toVegaLiteSpec(spec), resolvedWidth, resolvedHeight);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to render chart';
      setStatus('error');
      setErrorMessage(message);
      return undefined;
    }

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
        const message = error instanceof Error ? error.message : 'Unable to render chart';
        setStatus('error');
        setErrorMessage(message);
      }
    })();

    return () => {
      cancelled = true;
      cleanupEmbed(embedHandle);
    };
  }, [embedOptions, resolvedHeight, resolvedWidth, selection.renderer, spec]);

  useEffect(() => {
    if (selection.renderer !== 'echarts') {
      return;
    }

    const target = chartRef.current;
    if (!target) {
      return undefined;
    }

    let cancelled = false;
    let interactionCleanup: (() => void) | undefined;

    setStatus('loading');
    setErrorMessage(null);
    target.innerHTML = '';
    cleanupEmbed(embedHandle);

    void (async () => {
      try {
        const option = stripRendererTitle(toEChartsOption(spec));
        const echarts = await import('echarts');
        if (cancelled) {
          return;
        }
        const instance = echarts.init(target, undefined, { renderer: echartsRenderer, useDirtyRect: true });
        instance.setOption(option, true);
        const runtime = createEChartsRuntime(instance);
        interactionCleanup = bindEChartsInteractions(runtime, spec);
        echartsInstance.current = instance;
        setStatus('ready');
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to render chart';
        setStatus('error');
        setErrorMessage(message);
      }
    })();

    return () => {
      cancelled = true;
      interactionCleanup?.();
      cleanupECharts(echartsInstance);
    };
  }, [echartsRenderer, selection.renderer, spec]);

  useEffect(() => {
    if (selection.renderer !== 'echarts') {
      return;
    }
    if (!responsive) {
      return;
    }
    const instance = echartsInstance.current;
    if (!instance) {
      return;
    }
    instance.resize({ width: resolvedWidth, height: resolvedHeight });
  }, [responsive, resolvedHeight, resolvedWidth, selection.renderer]);

  const rendererTestId = variant === 'bubble' ? 'bubble-chart-renderer' : 'scatter-chart-renderer';
  const surfaceTestId = variant === 'bubble' ? 'bubble-chart-surface' : 'scatter-chart-surface';
  const errorText = errorMessage ?? 'Unable to render chart';

  return (
    <VizContainer
      spec={spec}
      className={className}
      chart={
        <div
          ref={surfaceRef}
          className="relative min-h-[320px]"
          style={{ minHeight: `${resolvedHeight}px` }}
          data-testid={surfaceTestId}
        >
          <div
            ref={chartRef}
            className={status === 'error' ? 'hidden' : 'h-full w-full'}
            data-renderer={selection.renderer}
            data-testid={rendererTestId}
            aria-hidden="true"
          />
          {status === 'error' ? (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface-raised/80 text-center text-sm text-text"
            >
              <p className="font-semibold">Unable to render chart</p>
              <p className="mt-2 text-text-muted">{errorText}</p>
            </div>
          ) : null}
        </div>
      }
      description={showDescription ? <ChartDescription spec={spec} /> : undefined}
      fallback={
        showTable ? <AccessibleTable spec={spec} enableKeyboardNavigation={enableKeyboardNavigation} /> : undefined
      }
      {...props}
    />
  );
}

function cleanupEmbed(handleRef: MutableRefObject<EmbedResult | null>): void {
  const handle = handleRef.current;
  if (handle) {
    handle.view?.finalize();
    handleRef.current = null;
  }
}

function cleanupECharts(instanceRef: MutableRefObject<EChartsType | null>): void {
  if (instanceRef.current) {
    instanceRef.current.dispose();
    instanceRef.current = null;
  }
}

function applyLayoutOverrides(spec: VegaLiteAdapterSpec, width?: number, height?: number): VegaLiteAdapterSpec {
  if (width === undefined && height === undefined) {
    return spec;
  }

  return {
    ...spec,
    ...(width !== undefined ? { width: Math.round(width) } : {}),
    ...(height !== undefined ? { height: Math.round(height) } : {}),
  };
}

function stripRendererTitle(option: EChartsOption): EChartsOption {
  const title = option.title;

  if (Array.isArray(title)) {
    return {
      ...option,
      title: title.map((entry) => ({ ...entry, show: false })) as typeof title,
    };
  }

  if (title) {
    return {
      ...option,
      title: { ...title, show: false } as typeof title,
    };
  }

  return option;
}

function createEChartsRuntime(instance: EChartsType): EChartsRuntime {
  return {
    on: (event, handler) => {
      instance.on(event as never, handler as never);
    },
    off: (event, handler) => {
      if (typeof instance.off === 'function') {
        instance.off(event as never, handler as never);
      }
    },
    dispatchAction: (action) => {
      instance.dispatchAction(action as never);
    },
  };
}
