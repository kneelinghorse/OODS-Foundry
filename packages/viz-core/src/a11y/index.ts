export * from './table-generator.js';
export * from './narrative-generator.js';
export * from './dashboard-narrative.js';
export * from './equivalence-rules.js';
// s159 m4: EXPLICIT allow-list (was `export *`) so the drawn-value guard — enforceDrawnValueInvariant
// + findNonDrawnNarrativeValues, exported from the module for the RELATIVE-PATH proof spec — stays OFF
// the public @oods/viz-core surface (the s158 findNonDrawnNarrativeValues deviation resolved: no public
// export; an export is an owned API move). This list is the module's ENTIRE prior public surface; add
// here only when a name is a deliberate public contract.
export {
  type ChartShape,
  type DataPoint,
  type VizDataAnalysis,
  type VizDataAnalysisInput,
  buildVizDataAnalysis,
  isMarkRectGrid,
  heatmapColorIsMeasure,
  analyzeVizSpec,
  resolvePrimaryChannels,
  getEncodingBinding,
  describeDataPoint,
} from './data-analysis.js';
export * from './non-cartesian-analysis.js';
export * from './spatial-analysis.js';
export * from './facet-table-generator.js';
