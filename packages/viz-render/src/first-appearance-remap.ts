/**
 * Build a deterministic token map in first-appearance order.
 *
 * Renderer-specific callers own discovery and replacement boundaries. This
 * helper owns only the shared ordering rule so Vega and ECharts cannot drift
 * into subtly different counter-normalization semantics.
 */
export function createFirstAppearanceRemap(
  occurrences: Iterable<string>,
  replacementFor: (index: number, token: string) => string,
): ReadonlyMap<string, string> {
  const replacements = new Map<string, string>();

  for (const token of occurrences) {
    if (!replacements.has(token)) {
      replacements.set(token, replacementFor(replacements.size, token));
    }
  }

  return replacements;
}
