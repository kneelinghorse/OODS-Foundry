import type { ColorEncoding } from '@/types/viz/spatial.js';

interface VegaLiteScale {
  type?: string;
  range?: readonly string[];
  domain?: unknown;
}

const DEFAULT_SEQUENTIAL_RANGE: readonly string[] = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
];

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function normalizeRange(range?: readonly string[]): readonly string[] | undefined {
  if (range && range.length > 0) {
    return range;
  }
  return DEFAULT_SEQUENTIAL_RANGE;
}

/**
 * Maps OODS color scale configuration to Vega-Lite scale definition.
 */
export function mapColorScale(encoding: ColorEncoding): VegaLiteScale | undefined {
  if (encoding.value) {
    return undefined;
  }

  const type = encoding.scale ?? 'quantize';
  const range = normalizeRange(encoding.range);
  const domain = encoding.domain;

  return pruneUndefined({
    type,
    range,
    domain,
  }) as VegaLiteScale;
}
