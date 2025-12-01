/**
 * MapLegend
 *
 * Legend component for spatial visualizations. Supports continuous gradients,
 * categorical swatches, and size examples for bubble maps.
 */

import { useMemo, type JSX } from 'react';
import type { ColorScale } from './utils/color-scale-utils.js';
import type { SizeScale } from './utils/size-scale-utils.js';
import { createLinearScale } from './utils/color-scale-utils.js';
import { createLinearSizeScale } from './utils/size-scale-utils.js';
import { useOptionalSpatialContext } from './SpatialContext.js';
import type { SpatialLayer } from '../../../types/viz/spatial.js';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MapLegendProps {
  colorScale?: {
    type: 'continuous' | 'categorical';
    scale: ColorScale;
    label?: string;
    format?: (value: number) => string;
  };
  sizeScale?: {
    scale: SizeScale;
    label?: string;
    format?: (value: number) => string;
  };
  position?: Position;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const POSITION_CLASSES: Record<Position, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

const DEFAULT_COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-01, var(--sys-surface-strong))',
  'var(--oods-viz-scale-sequential-04, var(--sys-accent-subtle))',
  'var(--oods-viz-scale-sequential-07, var(--sys-accent-strong))',
];

const DEFAULT_SIZE_RANGE: [number, number] = [6, 28];

function formatNumber(value: number, formatter?: (value: number) => string): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return formatter ? formatter(value) : value.toLocaleString();
}

function buildCategories(scale: ColorScale, formatter?: (value: number) => string): string[] {
  if (scale.thresholds && scale.thresholds.length > 0) {
    const labels: string[] = [];
    const thresholds = scale.thresholds;
    const domainMin = scale.domain[0];
    labels.push(`≤ ${formatNumber(thresholds[0], formatter) || formatNumber(domainMin, formatter)}`);
    for (let i = 0; i < thresholds.length - 1; i += 1) {
      labels.push(
        `${formatNumber(thresholds[i], formatter)} - ${formatNumber(thresholds[i + 1], formatter)}`
      );
    }
    const last = thresholds[thresholds.length - 1];
    labels.push(`≥ ${formatNumber(last, formatter)}`);
    return labels;
  }

  // Fallback labels for ordinal scales
  return scale.range.map((_value, index) => `Category ${index + 1}`);
}

function deriveScaleFromLayer(layer: SpatialLayer | undefined, joinedValues: number[]): ColorScale {
  if (!layer || layer.type !== 'regionFill') {
    return createLinearScale([0, 1], DEFAULT_COLOR_RANGE);
  }
  const encoding = layer.encoding?.color;
  const range = encoding?.range ?? DEFAULT_COLOR_RANGE;
  const domain =
    encoding?.domain && encoding.domain.length === 2
      ? (encoding.domain as [number, number])
      : (joinedValues.length > 0
          ? ([Math.min(...joinedValues), Math.max(...joinedValues)] as [number, number])
          : ([0, 1] as [number, number]));
  return createLinearScale(domain, range);
}

function deriveSizeScaleFromLayer(layer: SpatialLayer | undefined, joinedValues: number[]): SizeScale {
  if (!layer || layer.type !== 'symbol') {
    return createLinearSizeScale([0, 1], DEFAULT_SIZE_RANGE);
  }
  const encoding = layer.encoding?.size;
  const range = encoding?.range ?? DEFAULT_SIZE_RANGE;
  const domain =
    encoding?.range && joinedValues.length > 0
      ? ([Math.min(...joinedValues), Math.max(...joinedValues)] as [number, number])
      : ([0, 1] as [number, number]);
  return createLinearSizeScale(domain, range as [number, number]);
}

export function MapLegend({
  colorScale,
  sizeScale,
  position = 'bottom-right',
  orientation = 'vertical',
  className = '',
}: MapLegendProps): JSX.Element | null {
  const context = useOptionalSpatialContext();

  const contextValues = useMemo(() => {
    if (!context) {
      return { colorValues: [] as number[], sizeValues: [] as number[] };
    }
    const values: number[] = [];
    const sizeValues: number[] = [];
    for (const datum of context.joinedData.values()) {
      if (typeof (datum as Record<string, unknown>).value === 'number') {
        values.push((datum as Record<string, number>).value);
      }
      if (typeof (datum as Record<string, unknown>).magnitude === 'number') {
        sizeValues.push((datum as Record<string, number>).magnitude);
      }
    }
    return { colorValues: values, sizeValues };
  }, [context]);

  const derivedColorScale = useMemo(() => {
    if (colorScale) {
      return colorScale.scale;
    }
    const regionLayer = context?.layers.find((entry) => entry.layer.type === 'regionFill')?.layer;
    return deriveScaleFromLayer(regionLayer, contextValues.colorValues);
  }, [colorScale, context?.layers, contextValues.colorValues]);

  const derivedSizeScale = useMemo(() => {
    if (sizeScale) {
      return sizeScale.scale;
    }
    const symbolLayer = context?.layers.find((entry) => entry.layer.type === 'symbol')?.layer;
    return deriveSizeScaleFromLayer(symbolLayer, contextValues.sizeValues);
  }, [context?.layers, contextValues.sizeValues, sizeScale]);

  const resolvedColorLegend =
    colorScale ??
    (context
      ? {
          type: 'continuous' as const,
          scale: derivedColorScale,
          label: 'Value',
          format: undefined,
        }
      : null);

  const resolvedSizeLegend =
    sizeScale ??
    (context
      ? {
          scale: derivedSizeScale,
          label: 'Size',
          format: undefined,
        }
      : null);

  const hasLegend = resolvedColorLegend || resolvedSizeLegend;
  if (!hasLegend) {
    return null;
  }

  const gradientDirection = orientation === 'horizontal' ? '90deg' : '180deg';
  const orientationClasses =
    orientation === 'horizontal' ? 'flex-row items-center gap-4' : 'flex-col gap-4';

  const containerClasses = [
    'absolute',
    POSITION_CLASSES[position],
    'border',
    'border-[--sys-border-subtle]',
    'rounded-md',
    'shadow-sm',
    'p-4',
    'min-w-[220px]',
    'max-w-[320px]',
    'text-sm',
    orientationClasses,
    className,
  ]
    .join(' ')
    .trim();

  const containerStyle = {
    background: 'var(--sys-surface)',
    color: 'var(--sys-text)',
  } as const;

  const categories = useMemo(
    () => buildCategories(derivedColorScale, resolvedColorLegend?.format),
    [derivedColorScale, resolvedColorLegend?.format]
  );

  return (
    <div className={containerClasses} aria-label="Map legend" style={containerStyle}>
      {resolvedColorLegend && (
        <div className="flex w-full flex-col gap-2">
          {resolvedColorLegend.label && <div className="font-semibold">{resolvedColorLegend.label}</div>}
          {resolvedColorLegend.type === 'continuous' ? (
            <>
              <div
                aria-label="Color scale"
                className={`rounded-sm ${orientation === 'horizontal' ? 'h-3 w-full' : 'h-24 w-3'}`}
                style={{
                  background: `linear-gradient(${gradientDirection}, ${derivedColorScale.range.join(', ')})`,
                }}
              />
              <div className="flex w-full justify-between text-xs text-[--sys-text-subtle]">
                <span>{formatNumber(derivedColorScale.domain[0] ?? 0, resolvedColorLegend.format)}</span>
                <span>{formatNumber(derivedColorScale.domain[1] ?? 0, resolvedColorLegend.format)}</span>
              </div>
            </>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Categories">
              {derivedColorScale.range.map((color, index) => (
                <li key={`${color}-${index}`} className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded-sm border border-[--sys-border-subtle]"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{categories[index] ?? `Category ${index + 1}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {resolvedSizeLegend && (
        <div className="flex w-full flex-col gap-2" aria-label="Size scale">
          {resolvedSizeLegend.label && <div className="font-semibold">{resolvedSizeLegend.label}</div>}
          <div className="flex items-end gap-4">
            {([0, 0.5, 1] as const).map((point, index) => {
              const value =
                derivedSizeScale.domain[0] +
                (derivedSizeScale.domain[1] - derivedSizeScale.domain[0]) * point;
              const radius = derivedSizeScale.getValue(value);
              return (
                <div key={point} className="flex flex-col items-center gap-1">
                  <span
                    className="flex items-center justify-center rounded-full border border-[--sys-border-subtle]"
                    style={{
                      width: `${radius * 2}px`,
                      height: `${radius * 2}px`,
                      minWidth: `${radius * 2}px`,
                      minHeight: `${radius * 2}px`,
                      background:
                        'var(--oods-viz-map-symbol-fill, var(--sys-surface-strong, rgba(0,0,0,0.08)))',
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-[--sys-text-subtle]">
                    {formatNumber(value, resolvedSizeLegend.format)}
                  </span>
                  {index === 1 && <span className="sr-only">Median size example</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
