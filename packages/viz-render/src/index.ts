// @oods/viz-render — the deterministic Vega-Lite -> SVG rendering runtime.
//
// The rendering runtime (vega + vega-lite) lives in THIS package only; @oods/viz-core
// stays the zero-runtime spec transformer (m01 seam (a)).

import type { RenderVegaLiteResult, RenderVegaLiteToSvgOptions, VegaLiteSpec } from "./emitter.js";

const VEGA_EMITTER_MODULE = "./emitter.js";

export type { VegaLiteSpec, RenderVegaLiteResult, RenderVegaLiteToSvgOptions } from "./emitter.js";

// Keep Vega's async ESM graph behind the already-async API. In particular, this
// lets CommonJS consumers load the package and use the ECharts worker without
// synchronously requiring Vega-Lite's top-level-await module graph.
export async function renderVegaLiteToSvg(
  spec: VegaLiteSpec,
  options?: RenderVegaLiteToSvgOptions,
): Promise<string> {
  // Keep this specifier indirect so the CJS bundle retains a native dynamic
  // import instead of hoisting Vega-Lite's ESM/TLA graph into require().
  const emitter = await import(VEGA_EMITTER_MODULE);
  return emitter.renderVegaLiteToSvg(spec, options);
}

export async function renderVegaLiteWithSpec(
  spec: VegaLiteSpec,
  options?: RenderVegaLiteToSvgOptions,
): Promise<RenderVegaLiteResult> {
  const emitter = await import(VEGA_EMITTER_MODULE);
  return emitter.renderVegaLiteWithSpec(spec, options);
}
export {
  getEChartsRenderWorkerState,
  renderEChartsToSvg,
  sampleEChartsRenderWorkerResources,
  warmEChartsRenderWorker,
} from "./echarts-renderer.js";
export {
  ECHARTS_FORCE_SEED_VERSION,
  ECHARTS_INPUT_LIMITS,
  ECHARTS_INTERNAL_GEO_ALIAS,
  ECHARTS_RENDER_ERROR_CODES,
  ECHARTS_SSR_DIMENSIONS,
  EChartsRenderError,
} from "./echarts-worker-protocol.js";
export type {
  EChartsRenderErrorCode,
  EChartsRenderWorkerState,
  EChartsSsrDimensions,
  EChartsWorkerResourceSample,
} from "./echarts-worker-protocol.js";
export {
  discoverEChartsStructuralTokens,
  normalizeEChartsSvg,
} from "./echarts-svg-normalizer.js";
export { createFirstAppearanceRemap } from "./first-appearance-remap.js";
