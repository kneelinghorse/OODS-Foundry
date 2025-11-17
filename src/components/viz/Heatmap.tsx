import { useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX, MutableRefObject } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { EChartsType } from 'echarts';
import type { NormalizedVizSpec, TraitBinding } from '../../viz/spec/normalized-viz-spec.js';
import { toVegaLiteSpec, type VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { toEChartsOption, type EChartsOption } from '../../viz/adapters/echarts-adapter.js';
import { bindEChartsInteractions } from '../../viz/adapters/echarts-interactions.js';
import type { EChartsRuntime } from '../../viz/adapters/echarts-interactions.js';
import { selectVizRenderer, type VizRendererId } from '../../viz/adapters/renderer-selector.js';
import { createColorIntensityMapper, type ColorIntensityMapper } from '../../viz/encoding/color-intensity-mapper.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { AccessibleTable } from './AccessibleTable.js';
import { formatDimension, formatValue } from '../../viz/a11y/format.js';

export interface HeatmapProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: VizRendererId | 'auto';
  readonly vegaRenderer?: 'svg' | 'canvas';
  readonly echartsRenderer?: 'canvas' | 'svg';
  readonly showDescription?: boolean;
  readonly showLegend?: boolean;
  readonly showTable?: boolean;
  readonly responsive?: boolean;
  readonly minHeight?: number;
  readonly enableKeyboardNavigation?: boolean;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 360;
const DEFAULT_MIN_HEIGHT = 320;

export function Heatmap({
  spec,
  renderer = 'auto',
  vegaRenderer = 'svg',
  echartsRenderer = 'canvas',
  showDescription = true,
  showLegend = true,
  showTable = true,
  responsive = true,
  minHeight = DEFAULT_MIN_HEIGHT,
  enableKeyboardNavigation = true,
  className,
  ...props
}: HeatmapProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const echartsInstance = useRef<EChartsType | null>(null);

  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const matrix = useMemo(() => buildHeatmapMatrix(spec), [spec]);
  const mapper = useMemo(
    () =>
      createColorIntensityMapper({
        min: matrix?.min,
        max: matrix?.max,
        stops: 7,
      }),
    [matrix?.max, matrix?.min]
  );

  const rendererSelection = useMemo(() => {
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
  const resolvedHeight = Math.max(minHeight, layout.height ?? baseHeight);

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

    const target = surfaceRef.current;
    if (!target || typeof ResizeObserver !== 'function') {
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

    observer.observe(target);
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
      vegaSpec = applyHeatmapColorScale(
        toVegaLiteSpec(spec),
        mapper.resolvedColors(),
        resolvedWidth,
        resolvedHeight
      );
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
  }, [embedOptions, mapper, rendererSelection.renderer, resolvedHeight, resolvedWidth, spec]);

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
        const option = applyHeatmapVisualMap(stripRendererTitle(toEChartsOption(spec)), mapper, matrix);
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
  }, [echartsRenderer, mapper, matrix, rendererSelection.renderer, spec]);

  useEffect(() => {
    if (!responsive || rendererSelection.renderer !== 'echarts') {
      return;
    }
    const instance = echartsInstance.current;
    if (!instance) {
      return;
    }
    instance.resize({ width: resolvedWidth, height: resolvedHeight });
  }, [rendererSelection.renderer, responsive, resolvedHeight, resolvedWidth]);

  const errorText = errorMessage ?? 'Unable to render chart';
  const fallbackContent =
    showLegend || showTable ? (
      <div className="space-y-4">
        {showLegend ? <HeatmapLegend mapper={mapper} matrix={matrix} /> : null}
        {showTable ? (
          <HeatmapTable
            spec={spec}
            matrix={matrix}
            mapper={mapper}
            enableKeyboardNavigation={enableKeyboardNavigation}
          />
        ) : null}
      </div>
    ) : undefined;

  return (
    <VizContainer
      spec={spec}
      className={className}
      chart={
        <div
          ref={surfaceRef}
          className="relative min-h-[320px]"
          style={{ minHeight: `${resolvedHeight}px` }}
          data-testid="heatmap-chart-surface"
        >
          <div
            ref={chartRef}
            className={status === 'error' ? 'hidden' : 'h-full w-full'}
            aria-hidden="true"
            data-renderer={rendererSelection.renderer}
            data-testid="heatmap-chart-renderer"
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
      fallback={fallbackContent}
      {...props}
    />
  );
}

interface HeatmapLegendProps {
  readonly mapper: ColorIntensityMapper;
  readonly matrix: HeatmapMatrix | null;
}

function HeatmapLegend({ mapper, matrix }: HeatmapLegendProps): JSX.Element | null {
  if (!matrix) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Color intensity</p>
      <p className="mt-1 text-sm text-text">{matrix.valueLabel}</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{formatValue(mapper.min)}</span>
        <div
          className="h-3 flex-1 rounded-full"
          style={{ backgroundImage: mapper.gradient() }}
          aria-hidden="true"
          data-testid="heatmap-legend-bar"
        />
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{formatValue(mapper.max)}</span>
      </div>
    </div>
  );
}

interface HeatmapTableProps {
  readonly spec: NormalizedVizSpec;
  readonly matrix: HeatmapMatrix | null;
  readonly mapper: ColorIntensityMapper;
  readonly enableKeyboardNavigation: boolean;
}

function HeatmapTable({ spec, matrix, mapper, enableKeyboardNavigation }: HeatmapTableProps): JSX.Element {
  if (!matrix) {
    return <AccessibleTable spec={spec} enableKeyboardNavigation={enableKeyboardNavigation} />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Accessible heatmap table</p>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full border-collapse text-sm" aria-live="polite">
          <caption className="sr-only">{matrix.caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text"
              >
                {matrix.yLabel}
              </th>
              {matrix.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, rowIndex) => (
              <tr
                key={row.key}
                className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/70"
              >
                <th
                  scope="row"
                  className="border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text"
                  tabIndex={enableKeyboardNavigation ? 0 : undefined}
                  aria-label={`${matrix.yLabel}: ${row.label}`}
                >
                  {row.label}
                </th>
                {matrix.columns.map((column, columnIndex) => {
                  const cellValue = matrix.values[rowIndex]?.[columnIndex] ?? null;
                  const valueText = cellValue === null ? '—' : formatValue(cellValue);
                  const background = mapper.mapToCss(cellValue);
                  const normalized = mapper.normalize(cellValue);
                  const textTone = normalized !== undefined && normalized > 0.6 ? 'text-white' : 'text-text';

                  return (
                    <td
                      key={`${row.key}:${column.key}`}
                      className={`border-b border-slate-100 px-3 py-2 text-sm font-medium transition-colors ${textTone}`}
                      style={{ background }}
                      data-value={cellValue ?? ''}
                      aria-label={describeCell(row.label, column.label, valueText, matrix.valueLabel)}
                      tabIndex={enableKeyboardNavigation ? 0 : undefined}
                    >
                      {valueText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface HeatmapAxisValue {
  readonly key: string;
  readonly label: string;
  readonly raw: unknown;
}

interface HeatmapMatrix {
  readonly rows: readonly HeatmapAxisValue[];
  readonly columns: readonly HeatmapAxisValue[];
  readonly values: readonly (readonly (number | null)[])[];
  readonly min: number;
  readonly max: number;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly valueLabel: string;
  readonly caption: string;
}

function buildHeatmapMatrix(spec: NormalizedVizSpec): HeatmapMatrix | null {
  const xInfo = resolveChannelInfo(spec, 'x');
  const yInfo = resolveChannelInfo(spec, 'y');
  const valueInfo = resolveChannelInfo(spec, 'color');

  if (!xInfo || !yInfo || !valueInfo) {
    return null;
  }

  const values = Array.isArray(spec.data.values) ? spec.data.values : [];
  if (values.length === 0) {
    return null;
  }

  const rowIndex = new Map<string, number>();
  const columnIndex = new Map<string, number>();
  const rows: HeatmapAxisValue[] = [];
  const columns: HeatmapAxisValue[] = [];

  const ensureAxisValue = (
    map: Map<string, number>,
    axis: HeatmapAxisValue[],
    raw: unknown
  ): number => {
    const key = createAxisKey(raw);
    if (map.has(key)) {
      return map.get(key)!;
    }
    const index = axis.length;
    map.set(key, index);
    axis.push({
      key,
      raw,
      label: formatAxisLabel(raw),
    });
    return index;
  };

  values.forEach((entry) => {
    ensureAxisValue(rowIndex, rows, entry[yInfo.field]);
    ensureAxisValue(columnIndex, columns, entry[xInfo.field]);
  });

  if (rows.length === 0 || columns.length === 0) {
    return null;
  }

  const grid: (number | null)[][] = rows.map(() => columns.map(() => null));
  let min: number | undefined;
  let max: number | undefined;

  values.forEach((entry) => {
    const rowKey = createAxisKey(entry[yInfo.field]);
    const columnKey = createAxisKey(entry[xInfo.field]);
    const rowIdx = rowIndex.get(rowKey);
    const columnIdx = columnIndex.get(columnKey);
    if (rowIdx === undefined || columnIdx === undefined) {
      return;
    }
    const numeric = extractNumeric(entry[valueInfo.field]);
    grid[rowIdx][columnIdx] = numeric;

    if (numeric !== null) {
      min = min === undefined ? numeric : Math.min(min, numeric);
      max = max === undefined ? numeric : Math.max(max, numeric);
    }
  });

  const resolvedMin = min ?? 0;
  const resolvedMax = max ?? resolvedMin;

  return {
    rows,
    columns,
    values: grid,
    min: resolvedMin,
    max: resolvedMax,
    xLabel: xInfo.label,
    yLabel: yInfo.label,
    valueLabel: valueInfo.label,
    caption: resolveHeatmapCaption(spec),
  };
}

function resolveChannelInfo(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding']
): { field: string; label: string } | null {
  const binding = resolveBinding(spec, channel);
  if (!binding?.field) {
    return null;
  }
  return {
    field: binding.field,
    label: resolveFieldLabel(binding, binding.field),
  };
}

function resolveBinding(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding']
): TraitBinding | undefined {
  const base = spec.encoding?.[channel];
  if (base?.field) {
    return base;
  }
  for (const mark of spec.marks) {
    const binding = mark.encodings?.[channel];
    if (binding?.field) {
      return binding;
    }
  }
  return undefined;
}

function resolveFieldLabel(binding: TraitBinding, fallbackField: string): string {
  if (binding.title) {
    return binding.title;
  }
  const legendTitle = typeof binding.legend === 'object' ? binding.legend?.title : undefined;
  if (typeof legendTitle === 'string' && legendTitle.trim() !== '') {
    return legendTitle;
  }
  return humanizeField(fallbackField);
}

function humanizeField(value: string): string {
  const withSpaces = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function resolveHeatmapCaption(spec: NormalizedVizSpec): string {
  if (spec.a11y.tableFallback?.caption) {
    return spec.a11y.tableFallback.caption;
  }
  return `Data table for ${spec.name ?? spec.id ?? 'visualization'}`;
}

function createAxisKey(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${typeof value}:${value}`;
  }
  if (typeof value === 'string') {
    return `string:${value}`;
  }
  return `object:${JSON.stringify(value)}`;
}

function formatAxisLabel(value: unknown): string {
  const formatted = formatDimension(value);
  if (formatted) {
    return formatted;
  }
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return formatValue(value);
  }
  return String(value);
}

function extractNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function describeCell(rowLabel: string, columnLabel: string, valueText: string, metric: string): string {
  const parts = [`${metric}: ${valueText}`];
  if (rowLabel) {
    parts.push(`${rowLabel}`);
  }
  if (columnLabel) {
    parts.push(`${columnLabel}`);
  }
  return parts.join(', ');
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

type LayeredVegaSpec = Extract<
  VegaLiteAdapterSpec,
  { layer: readonly { readonly encoding?: Record<string, unknown> }[] }
>;
type SingleVegaSpec = Extract<VegaLiteAdapterSpec, { encoding: Record<string, unknown> }>;

function applyHeatmapColorScale(
  spec: VegaLiteAdapterSpec,
  palette: readonly string[],
  width?: number,
  height?: number
): VegaLiteAdapterSpec {
  const sized = applyLayoutOverrides(spec, width, height);
  if (palette.length === 0) {
    return sized;
  }

  if ('layer' in sized && Array.isArray(sized.layer)) {
    const layered = sized as LayeredVegaSpec;
    return {
      ...layered,
      layer: layered.layer.map((layer) => {
        const updatedEncoding = applyColorEncoding(layer.encoding, palette);
        return updatedEncoding ? { ...layer, encoding: updatedEncoding } : layer;
      }),
    };
  }

  const single = sized as SingleVegaSpec;
  const updatedEncoding = applyColorEncoding(single.encoding, palette);
  if (!updatedEncoding) {
    return single;
  }

  return {
    ...single,
    encoding: updatedEncoding,
  };
}

function applyColorEncoding(
  encoding: Record<string, unknown> | undefined,
  palette: readonly string[]
): Record<string, unknown> | undefined {
  if (!encoding || !encoding.color) {
    return encoding;
  }
  const colorEncoding = encoding.color as Record<string, unknown>;
  return {
    ...encoding,
    color: {
      ...colorEncoding,
      scale: {
        ...(colorEncoding.scale as Record<string, unknown> | undefined),
        range: [...palette],
      },
    },
  };
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

function applyHeatmapVisualMap(
  option: EChartsOption,
  mapper: ColorIntensityMapper,
  matrix: HeatmapMatrix | null
): EChartsOption {
  if (!matrix) {
    return option;
  }

  const colors = mapper.resolvedColors().filter((color) => typeof color === 'string' && color.trim().length > 0);
  if (colors.length === 0) {
    return option;
  }

  return {
    ...option,
    visualMap: {
      min: mapper.min,
      max: mapper.max,
      calculable: false,
      orient: 'vertical',
      right: 16,
      top: 'middle',
      inRange: {
        color: colors,
      },
    },
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
