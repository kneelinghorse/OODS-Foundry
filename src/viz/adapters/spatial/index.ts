/**
 * Geo Data Resolver Module
 *
 * Exports for the geo data resolver utilities.
 */

export * from './geo-data-resolver.js';
export * from './geo-format-parser.js';
export * from './geo-fetch.js';
export * from './geo-data-joiner.js';
export * from './vega-lite-projection-map.js';
export * from './vega-lite-scale-map.js';
export { buildChoroplethLayer } from './vega-lite-choropleth-adapter.js';
export type { VegaLiteLayer as VegaLiteChoroplethLayer } from './vega-lite-choropleth-adapter.js';
export { buildBubbleLayers } from './vega-lite-bubble-adapter.js';
export type { VegaLiteLayer as VegaLiteBubbleLayer } from './vega-lite-bubble-adapter.js';
export { adaptToVegaLite } from './vega-lite-spatial-adapter.js';
export * from './echarts-geo-registration.js';
export * from './echarts-visualmap-generator.js';
export * from './echarts-choropleth-adapter.js';
export * from './echarts-bubble-adapter.js';
export * from './echarts-spatial-adapter.js';
