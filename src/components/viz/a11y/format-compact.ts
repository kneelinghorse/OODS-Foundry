/**
 * Compact value formatting shared by the non-cartesian a11y fallback tables
 * (Treemap / Sunburst / Sankey / Graph). Extracted (sprint-128 m03) so the four
 * fallbacks stop each carrying a byte-identical copy of this formatter.
 *
 * NOTE: this is the PRESENTATION format (1.5K / 2.3M suffixes) the React fallback
 * tables render — distinct from the engine's @oods/viz-core a11y `formatNumeric`
 * (Intl.NumberFormat, no magnitude suffix), which backs the headless
 * generateAccessibleTable cells. The two are intentionally separate surfaces.
 */
export function formatCompactValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
