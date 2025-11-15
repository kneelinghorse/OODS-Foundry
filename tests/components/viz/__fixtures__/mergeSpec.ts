import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';

export function mergeSpec(
  base: NormalizedVizSpec,
  overrides: Partial<NormalizedVizSpec> = {}
): NormalizedVizSpec {
  const merged = structuredClone(base);

  for (const [key, value] of Object.entries(overrides) as [keyof NormalizedVizSpec, unknown][]) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // @ts-expect-error -- safe recursive merge for normalized specs
      merged[key] = mergeObject(merged[key] as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }

    // @ts-expect-error -- assignment is safe for normalized spec overrides
    merged[key] = value as never;
  }

  return merged;
}

function mergeObject(target: Record<string, unknown> | undefined, value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = target ? structuredClone(target) : {};

  for (const [innerKey, innerValue] of Object.entries(value)) {
    if (innerValue && typeof innerValue === 'object' && !Array.isArray(innerValue)) {
      next[innerKey] = mergeObject(next[innerKey] as Record<string, unknown>, innerValue as Record<string, unknown>);
    } else {
      next[innerKey] = innerValue;
    }
  }

  return next;
}
