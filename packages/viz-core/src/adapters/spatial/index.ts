// Headless spatial (geo) ECharts adapters (sprint-112 m01 port).
//
// The choropleth + bubble_map beachhead: the slim spatial spec lives in
// ../../spec/spatial.ts; these modules build deterministic, transmittable ECharts
// options from a parsed FeatureCollection + tabular data. Vega-Lite spatial
// adapters and the async geo-fetch / geo-data-resolver / geo-format-parser modules
// are intentionally NOT ported (out of the headless beachhead).

export * from './geo-data-joiner.js';
export * from './spatial-tooltip-config.js';
export * from './echarts-geo-registration.js';
export * from './echarts-visualmap-generator.js';
export * from './echarts-choropleth-adapter.js';
export * from './echarts-bubble-adapter.js';
export * from './echarts-flow-line-adapter.js';
export * from './echarts-spatial-adapter.js';
