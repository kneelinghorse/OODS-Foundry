import type { HTMLAttributes, JSX } from 'react';
import type { NormalizedVizSpec, TraitBinding } from '../../viz/spec/normalized-viz-spec.js';
import { analyzeVizSpec, getEncodingBinding } from '../../viz/a11y/data-analysis.js';
import { formatDimension } from '../../viz/a11y/format.js';
import { getVizScaleTokens } from '../../viz/tokens/scale-token-mapper.js';

export interface SharedLegendProps extends HTMLAttributes<HTMLDivElement> {
  readonly spec: NormalizedVizSpec;
  readonly heading?: string;
  readonly maxItems?: number;
}

const MAX_CATEGORICAL_ITEMS = 6;

interface LegendCategory {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export function SharedLegend({
  spec,
  heading = 'Legend',
  maxItems = MAX_CATEGORICAL_ITEMS,
  className,
  ...props
}: SharedLegendProps): JSX.Element | null {
  const binding = getEncodingBinding(spec, 'color');
  if (!binding?.field) {
    return null;
  }

  const analysis = analyzeVizSpec(spec);
  const limit = Math.min(Math.max(1, maxItems), MAX_CATEGORICAL_ITEMS);
  const categories = deriveLegendCategories(analysis.rows, binding.field, limit);
  if (categories.length === 0) {
    return null;
  }

  const palette = getVizScaleTokens('categorical', { count: categories.length });
  const legendLabel = resolveLegendTitle(binding) ?? binding.title ?? heading;

  const rootClassName = [
    'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} {...props}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{legendLabel}</p>
      <ul className="mt-3 grid gap-2 text-sm text-text sm:grid-cols-2" role="list">
        {categories.map((category, index) => (
          <li key={category.key} className="flex items-center gap-2" data-testid="shared-legend-item">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-slate-300"
              style={{ backgroundColor: `var(${palette[index]})` }}
            />
            <span className="truncate">{category.label}</span>
            <span className="ml-auto text-xs font-medium text-text-muted">{category.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function deriveLegendCategories(rows: readonly Record<string, unknown>[], field: string, maxItems: number): LegendCategory[] {
  const seen = new Map<string, LegendCategory>();

  for (const row of rows) {
    const raw = row[field];
    const key = classifyLegendKey(raw);
    const existing = seen.get(key);
    if (existing) {
      seen.set(key, { ...existing, count: existing.count + 1 });
      continue;
    }
    if (seen.size >= maxItems) {
      continue;
    }
    seen.set(key, {
      key,
      label: formatDimension(raw) ?? 'Unspecified',
      count: 1,
    });
  }

  return Array.from(seen.values());
}

function classifyLegendKey(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return 'object';
    }
  }
  return String(value);
}

function resolveLegendTitle(binding: TraitBinding | undefined): string | undefined {
  if (!binding?.legend || typeof binding.legend !== 'object') {
    return undefined;
  }
  const candidate = (binding.legend as { title?: unknown }).title;
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}
