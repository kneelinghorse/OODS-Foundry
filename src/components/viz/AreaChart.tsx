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
import { applyStackTransformsToSpec, type StackTransformMetadata } from '../../viz/transforms/stack-transform.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { AccessibleTable } from './AccessibleTable.js';
import { useReducedMotion } from '../../overlays/manager/hooks.js';

export interface AreaChartProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: VizRendererId | 'auto';
  readonly vegaRenderer?: 'svg' | 'canvas';
  readonly echartsRenderer?: 'canvas' | 'svg';
  readonly showTable?: boolean;
  readonly showDescription?: boolean;
  readonly responsive?: boolean;
  readonly minHeight?: number;
  readonly animate?: boolean;
  readonly enableKeyboardNavigation?: boolean;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 360;
const DEFAULT_MIN_HEIGHT = 320;

export function AreaChart({
  spec,
  renderer = 'auto',
  vegaRenderer = 'svg',
  echartsRenderer = 'canvas',
  showTable = true,
  showDescription = true,
  responsive = true,
  minHeight = DEFAULT_MIN_HEIGHT,
  animate = true,
  enableKeyboardNavigation = true,
  className,
  ...props
}: AreaChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const prepared = useMemo(() => prepareAreaChartSpec(spec), [spec]);

  const rendererSelection = useMemo(() => {
    if (renderer !== 'auto') {
      return { renderer, reason: 'user-preference' as const };
    }
    try {
      return selectVizRenderer(prepared.spec);
    } catch {
      return { renderer: 'vega-lite' as const, reason: 'default' as const };
    }
  }, [prepared.spec, renderer]);

  const motionEnabled = animate && !prefersReducedMotion;
  const baseWidth = prepared.spec.config?.layout?.width ?? DEFAULT_WIDTH;
  const baseHeight = prepared.spec.config?.layout?.height ?? DEFAULT_HEIGHT;
  const aspectRatio =
    baseWidth > 0 && baseHeight > 0 ? baseHeight / baseWidth : DEFAULT_HEIGHT / DEFAULT_WIDTH;
  const resolvedWidth = responsive ? measuredWidth ?? baseWidth : baseWidth;
  const resolvedHeight = responsive ? Math.max(minHeight, Math.round(resolvedWidth * aspectRatio)) : Math.max(minHeight, baseHeight);

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

    const surface = containerRef.current;
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
    if (rendererSelection.renderer !== 'vega-lite') {
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
      vegaSpec = buildVegaSpec(prepared.spec, prepared.stack, resolvedWidth, resolvedHeight);
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
  }, [embedOptions, prepared.spec, prepared.stack, rendererSelection.renderer, resolvedHeight, resolvedWidth]);

  useEffect(() => {
    if (rendererSelection.renderer !== 'echarts') {
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
        const option = buildEChartsOption(prepared.spec, prepared.stack, spec);
        const echarts = await import('echarts');
        if (cancelled) {
          return;
        }
        const instance = echarts.init(target, undefined, { renderer: echartsRenderer, useDirtyRect: true });
        instance.setOption(option, true);
        const runtime = createEChartsRuntime(instance);
        interactionCleanup = bindEChartsInteractions(runtime, prepared.spec);
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
  }, [echartsRenderer, prepared.spec, prepared.stack, rendererSelection.renderer, resolvedHeight, spec]);

  useEffect(() => {
    if (rendererSelection.renderer !== 'echarts') {
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
  }, [rendererSelection.renderer, resolvedHeight, resolvedWidth, responsive]);

  const chartClassName = [
    status === 'error' ? 'hidden' : 'h-full w-full min-w-0',
    motionEnabled ? 'transition-opacity duration-500 ease-out' : undefined,
    motionEnabled ? (status === 'ready' ? 'opacity-100' : 'opacity-0') : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const errorText = errorMessage ?? 'Unable to render chart';

  return (
    <VizContainer
      spec={spec}
      className={className}
      chart={
        <div
          ref={containerRef}
          className="relative w-full min-w-0 overflow-hidden"
          style={{ minHeight: `${resolvedHeight}px` }}
          data-testid="area-chart-surface"
        >
          <div
            ref={chartRef}
            className={chartClassName || 'h-full w-full'}
            aria-hidden="true"
            data-testid="area-chart-renderer"
            data-renderer={rendererSelection.renderer}
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
      fallback={showTable ? <AccessibleTable spec={spec} enableKeyboardNavigation={enableKeyboardNavigation} /> : undefined}
      {...props}
    />
  );
}

function prepareAreaChartSpec(
  spec: NormalizedVizSpec
): { readonly spec: NormalizedVizSpec; readonly stack?: StackTransformMetadata & { readonly valueField: string } } {
  const result = applyStackTransformsToSpec(spec);
  return {
    spec: result.spec,
    stack: result.metadata,
  };
}

function buildVegaSpec(
  spec: NormalizedVizSpec,
  stackMeta: (StackTransformMetadata & { readonly valueField: string }) | undefined,
  width: number,
  height: number
): VegaLiteAdapterSpec {
  const base = toVegaLiteSpec(spec);
  const sized = applyLayoutOverrides(base, width, height);
  if (!stackMeta) {
    return sized;
  }
  return applyStackEncoding(sized, stackMeta);
}

function buildEChartsOption(
  spec: NormalizedVizSpec,
  stackMeta: (StackTransformMetadata & { readonly valueField: string }) | undefined,
  original: NormalizedVizSpec,
): EChartsOption {
  const baseline = resolveBaseline(spec);
  const option = toEChartsOption(spec);
  const stacked = stackMeta ? applySeriesStack(option, stackMeta) : option;
  const bounds = resolveValueBounds(original, stackMeta?.valueField ?? findValueField(original));
  const withBaseline = applyBaseline(stacked, baseline, bounds);
  return stripRendererTitle(withBaseline);
}

function applySeriesStack(option: EChartsOption, stackMeta: StackTransformMetadata): EChartsOption {
  const seriesArray = option.series;
  const stackName = stackMeta.groupby.length > 0 ? stackMeta.groupby.join(':') : 'stack';

  const patchedSeries = seriesArray.map((entry) => {
    if (!entry) {
      return entry;
    }
    return {
      ...entry,
      stack: entry.stack ?? stackName,
    };
  });

  return {
    ...option,
    series: patchedSeries,
  };
}

function applyBaseline(option: EChartsOption, baseline: 'zero' | 'min' | undefined, bounds?: { readonly min: number; readonly max: number }): EChartsOption {
  if (!baseline) {
    return option;
  }

  const yAxisArray = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis];
  const baselineMin = baseline === 'zero' ? 0 : bounds?.min;

  if (baselineMin === undefined) {
    return option;
  }

  const patched = yAxisArray.map((axis) => ({
    ...(axis ?? {}),
    min: axis?.min ?? baselineMin,
  }));

  return {
    ...option,
    yAxis: Array.isArray(option.yAxis) ? patched : patched[0],
  };
}

function resolveBaseline(spec: NormalizedVizSpec): 'zero' | 'min' | undefined {
  for (const mark of spec.marks) {
    if (!mark?.trait?.toLowerCase().includes('markarea')) {
      continue;
    }
    const options = mark.options ?? {};
    const baseline = (options as Record<string, unknown>).baseline;
    if (baseline === 'zero' || baseline === 'min') {
      return baseline;
    }
  }
  return undefined;
}

function resolveValueBounds(spec: NormalizedVizSpec, field?: string): { readonly min: number; readonly max: number } | undefined {
  if (!field) {
    return undefined;
  }
  const rows = Array.isArray(spec.data.values) ? spec.data.values : [];
  if (rows.length === 0) {
    return undefined;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  rows.forEach((row) => {
    const raw = row[field as keyof typeof row];
    const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : undefined;
    if (numeric === undefined || Number.isNaN(numeric)) {
      return;
    }
    if (numeric < min) {
      min = numeric;
    }
    if (numeric > max) {
      max = numeric;
    }
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }
  return { min, max };
}

function findValueField(spec: NormalizedVizSpec): string | undefined {
  const top = spec.encoding?.y?.field;
  if (typeof top === 'string') {
    return top;
  }
  for (const mark of spec.marks) {
    const field = mark.encodings?.y?.field;
    if (typeof field === 'string') {
      return field;
    }
  }
  return undefined;
}

function applyStackEncoding(
  spec: VegaLiteAdapterSpec,
  metadata: StackTransformMetadata & { readonly valueField: string }
): VegaLiteAdapterSpec {
  if ('layer' in spec && Array.isArray(spec.layer)) {
    return {
      ...spec,
      layer: spec.layer.map((layer) => ({
        ...layer,
        encoding: patchEncoding(layer.encoding, metadata),
      })),
    };
  }

  if ('encoding' in spec) {
    return {
      ...spec,
      encoding: patchEncoding(spec.encoding, metadata),
    };
  }

  return spec;
}

function patchEncoding(
  encoding: Record<string, unknown>,
  metadata: StackTransformMetadata & { readonly valueField: string }
): Record<string, unknown> {
  const y = getEncodingRecord(encoding.y);
  const field = typeof y?.field === 'string' ? y.field : undefined;

  if (!y || field !== metadata.valueField) {
    return encoding;
  }

  const y2 = getEncodingRecord(encoding.y2);

  return {
    ...encoding,
    y: {
      ...y,
      field: metadata.fields[1],
      stack: null,
    },
    y2: {
      ...(y2 ?? {}),
      field: metadata.fields[0],
    },
  };
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

function cleanupEmbed(handleRef: MutableRefObject<EmbedResult | null>): void {
  if (handleRef.current) {
    handleRef.current.view?.finalize();
    handleRef.current = null;
  }
}

function cleanupECharts(instanceRef: MutableRefObject<EChartsType | null>): void {
  if (instanceRef.current) {
    instanceRef.current.dispose();
    instanceRef.current = null;
  }
}

function stripRendererTitle(option: EChartsOption): EChartsOption {
  const title = option.title;
  if (Array.isArray(title)) {
    return {
      ...option,
      title: title.map((entry) => ({ ...entry, show: false })),
    };
  }
  if (title) {
    return {
      ...option,
      title: { ...title, show: false },
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

function getEncodingRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}
