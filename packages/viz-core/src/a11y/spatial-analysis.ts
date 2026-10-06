// Input-shaped spatial a11y analyzer (sprint-128 m02, Forge-Demos FD#10).
//
// The spatial families (choropleth / bubble_map / flow_map) render from a
// SpatialSpec + a SEPARATE geoData (FeatureCollection) + data (DataRecord[]) that
// the spec never carries — the per-feature geometry, labels, and join resolve at
// render time. So analyzeSpatial does NOT re-derive that join: it accepts the
// per-feature rows the React fallback (AccessibleMapFallback / SpatialContainer)
// already builds (feature-id join → per-feature value) and emits the EXISTING
// VizDataAnalysis shape, so the spatial narrative routes through the SAME
// generateNarrativeSummary path as every other type. This is the deliberate
// reading of "analyzeSpatial(SpatialSpec)": the rows are fed in, not re-joined.

import { buildVizDataAnalysis, type DataPoint, type VizDataAnalysis } from './data-analysis.js';

/**
 * One feature's accessible row: the feature-id, its display label, and the
 * joined data record — the exact shape AccessibleMapFallback/SpatialContainer
 * already derive. Fed in so the engine never re-implements the geo join.
 */
export interface SpatialFeatureRow {
  readonly id: string;
  readonly featureLabel: string;
  readonly values: Record<string, unknown>;
}

export interface SpatialAnalysisInput {
  readonly features: readonly SpatialFeatureRow[];
  /**
   * The measure field to narrate (e.g. the choropleth color field). When omitted,
   * the first field that is numeric across ALL features is used.
   */
  readonly valueField?: string;
}

/**
 * Derive a11y analysis from per-feature spatial rows. Each row becomes one table
 * record (feature label + joined values); the measure field drives the extrema /
 * total so the narrative reads "N features totaling X, max is <feature>".
 */
export function analyzeSpatial(input: SpatialAnalysisInput): VizDataAnalysis {
  const measureField = input.valueField ?? detectNumericField(input.features);
  const rows = input.features.map((feature) => ({ feature: feature.featureLabel, ...feature.values }));
  const dataPoints: DataPoint[] = measureField
    ? input.features.flatMap((feature) => {
        const value = feature.values[measureField];
        return typeof value === 'number' && Number.isFinite(value)
          ? [{ label: feature.featureLabel, value }]
          : [];
      })
    : [];

  return buildVizDataAnalysis({
    mark: 'unknown',
    rows,
    dataPoints,
    dimensionField: 'feature',
    measureField,
  });
}

/** First field whose value is numeric on EVERY feature that carries it (deterministic by key order). */
function detectNumericField(features: readonly SpatialFeatureRow[]): string | undefined {
  const tally = new Map<string, { numeric: number; total: number }>();
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.values)) {
      const entry = tally.get(key) ?? { numeric: 0, total: 0 };
      entry.total += 1;
      if (typeof value === 'number' && Number.isFinite(value)) {
        entry.numeric += 1;
      }
      tally.set(key, entry);
    }
  }
  for (const [key, entry] of tally) {
    if (entry.total > 0 && entry.numeric === entry.total) {
      return key;
    }
  }
  return undefined;
}
