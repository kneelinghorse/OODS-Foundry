/**
 * Message and public-state contracts for the isolated ECharts SSR worker.
 *
 * This module must remain free of ECharts imports. The main process imports it
 * during MCP startup, before there is a renderable operand, and that import is
 * part of the worker/ECharts lazy-cost boundary.
 */

export const ECHARTS_SSR_DIMENSIONS = Object.freeze({
  width: 600,
  height: 400,
} as const);

export interface EChartsSsrDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Force-directed rendering enforces the ratified node ceiling. Link-count and
 * payload-byte ceilings remain unresolved until their contracts are ratified;
 * null is not an unlimited-input claim.
 */
export const ECHARTS_INPUT_LIMITS = Object.freeze({
  forceNodes: 250,
  forceLinks: null,
  payloadBytes: null,
} as const);

export const ECHARTS_FORCE_SEED_VERSION = "oods-echarts-lcg-v1" as const;
export const ECHARTS_INTERNAL_GEO_ALIAS = "__oods_echarts_ssr_geo__" as const;

export const ECHARTS_RENDER_ERROR_CODES = [
  "ECHARTS_INVALID_OPTION",
  "ECHARTS_INVALID_DIMENSIONS",
  "ECHARTS_INPUT_LIMIT",
  "ECHARTS_INVALID_REGISTRATION",
  "ECHARTS_NO_MAP",
  "ECHARTS_UNSUPPORTED_OPTION",
  "ECHARTS_RENDER_FAULT",
  "ECHARTS_UNREADABLE_SVG",
  "ECHARTS_WORKER_FAULT",
] as const;

export type EChartsRenderErrorCode =
  (typeof ECHARTS_RENDER_ERROR_CODES)[number];

export class EChartsRenderError extends Error {
  readonly code: EChartsRenderErrorCode;

  constructor(
    code: EChartsRenderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EChartsRenderError";
    this.code = code;
  }
}

export interface EChartsWorkerMetrics {
  readonly loadCount: number;
  readonly activeJobs: number;
  readonly maxActiveJobs: number;
  readonly completedJobs: number;
  readonly chartsCreated: number;
  readonly chartsDisposed: number;
  readonly activeCharts: number;
  readonly renderFaults: number;
  readonly geoRegistrationCount: number;
  readonly geoRegistrySize: number;
  readonly lastGeometryHash: string | null;
  readonly randomRestored: boolean;
  readonly clockGuardRestored: boolean;
  readonly ambientAccesses: number;
}

export interface EChartsRenderWorkerState extends EChartsWorkerMetrics {
  readonly workerCreated: boolean;
  readonly echartsLoaded: boolean;
  readonly spawnCount: number;
  readonly queuedJobs: number;
}

/** On-demand worker-isolate memory evidence for the opt-in resource gate. */
export interface EChartsWorkerResourceSample {
  readonly workerHeapUsedBytes: number;
  readonly processRssBytes: number;
  readonly forcedGc: boolean;
  readonly metrics: EChartsWorkerMetrics;
}

export interface SerializedEChartsRenderError {
  readonly code: EChartsRenderErrorCode;
  readonly message: string;
}

export interface EChartsWorkerTestHooks {
  readonly forceRenderFault?: "after-chart-created";
  readonly forceUnreadableSvg?: true;
  readonly skipGeoRegistration?: true;
}

export interface PreparedEChartsRenderInput {
  readonly projectedOption: Record<string, unknown>;
  readonly canonicalProjectedBytes: string;
  readonly dimensions: EChartsSsrDimensions;
}

export interface EChartsRenderWorkerRequest {
  readonly kind: "render";
  readonly requestId: number;
  readonly projectedOption: Record<string, unknown>;
  readonly dimensions: EChartsSsrDimensions;
  readonly testHooks?: EChartsWorkerTestHooks;
}

export interface EChartsStateWorkerRequest {
  readonly kind: "state";
  readonly requestId: number;
  readonly forceGc: boolean;
}

export type EChartsWorkerRequest =
  | EChartsRenderWorkerRequest
  | EChartsStateWorkerRequest;

export interface EChartsRenderWorkerSuccess {
  readonly kind: "render-result";
  readonly requestId: number;
  readonly svg: string;
  readonly metrics: EChartsWorkerMetrics;
}

export interface EChartsRenderWorkerFailure {
  readonly kind: "render-error";
  readonly requestId: number;
  readonly error: SerializedEChartsRenderError;
  readonly metrics: EChartsWorkerMetrics;
}

export interface EChartsStateWorkerResponse {
  readonly kind: "state-result";
  readonly requestId: number;
  readonly metrics: EChartsWorkerMetrics;
  readonly resources: Omit<EChartsWorkerResourceSample, "metrics">;
}

export type EChartsWorkerResponse =
  | EChartsRenderWorkerSuccess
  | EChartsRenderWorkerFailure
  | EChartsStateWorkerResponse;

export function prepareEChartsRenderInput(
  projectedOption: Readonly<Record<string, unknown>>,
  dimensions?: EChartsSsrDimensions,
): PreparedEChartsRenderInput {
  if (
    projectedOption === null ||
    typeof projectedOption !== "object" ||
    Array.isArray(projectedOption)
  ) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_OPTION",
      "The projected ECharts option must be a JSON object.",
    );
  }

  const resolvedDimensions = dimensions ?? ECHARTS_SSR_DIMENSIONS;
  if (
    !Number.isSafeInteger(resolvedDimensions.width) || resolvedDimensions.width <= 0 ||
    !Number.isSafeInteger(resolvedDimensions.height) || resolvedDimensions.height <= 0
  ) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_DIMENSIONS",
      "ECharts SSR dimensions must be positive safe integers in pixels.",
    );
  }

  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(projectedOption);
  } catch (error) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_OPTION",
      "The projected ECharts option must be JSON-serializable.",
      { cause: error },
    );
  }
  if (serialized === undefined) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_OPTION",
      "The projected ECharts option must be JSON-serializable.",
    );
  }

  const cloned = JSON.parse(serialized) as Record<string, unknown>;
  const series = asSeriesArray(cloned.series);
  if (series.length === 0) {
    throw new EChartsRenderError(
      "ECHARTS_UNSUPPORTED_OPTION",
      "The projected ECharts option must contain at least one series.",
    );
  }
  const supportedSeriesTypes = new Set([
    "treemap",
    "sunburst",
    "sankey",
    "chord",
    "graph",
    "map",
    "scatter",
    "lines",
  ]);
  const unsupportedSeries = series.find(
    (candidate) =>
      typeof candidate.type !== "string" ||
      !supportedSeriesTypes.has(candidate.type),
  );
  if (unsupportedSeries) {
    throw new EChartsRenderError(
      "ECHARTS_UNSUPPORTED_OPTION",
      `Unsupported ECharts SSR series type: ${JSON.stringify(unsupportedSeries.type)}.`,
    );
  }

  const forceNodeCount = series.reduce((count, candidate) => {
    if (candidate.type !== "graph" || candidate.layout !== "force") {
      return count;
    }
    const nodes = Array.isArray(candidate.data)
      ? candidate.data
      : Array.isArray(candidate.nodes)
        ? candidate.nodes
        : [];
    return count + nodes.length;
  }, 0);
  if (forceNodeCount > ECHARTS_INPUT_LIMITS.forceNodes) {
    throw new EChartsRenderError(
      "ECHARTS_INPUT_LIMIT",
      `Force rendering supports at most ${ECHARTS_INPUT_LIMITS.forceNodes} nodes; received ${forceNodeCount}.`,
    );
  }

  const needsInlineMap =
    cloned.geo !== undefined ||
    series.some(
      (candidate) =>
        candidate.type === "map" ||
        candidate.coordinateSystem === "geo" ||
        typeof candidate.map === "string",
    );
  const registration = cloned.__registration;
  if (needsInlineMap && registration === undefined) {
    throw new EChartsRenderError(
      "ECHARTS_NO_MAP",
      "Geo rendering requires inline geometry in projectedOption.__registration; the renderer never fetches maps.",
    );
  }
  if (registration !== undefined && !isValidRegistration(registration)) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_REGISTRATION",
      "projectedOption.__registration must contain a name and a GeoJSON FeatureCollection.",
    );
  }
  if (
    registration !== undefined &&
    referencedMapNames(cloned, series).some(
      (name) => name !== registration.name,
    )
  ) {
    throw new EChartsRenderError(
      "ECHARTS_INVALID_REGISTRATION",
      "projectedOption.__registration.name must match every geo/series map reference.",
    );
  }

  return {
    projectedOption: cloned,
    canonicalProjectedBytes: canonicalizeJson(cloned),
    dimensions: { width: resolvedDimensions.width, height: resolvedDimensions.height },
  };
}

export function serializeEChartsRenderError(
  error: unknown,
): SerializedEChartsRenderError {
  if (error instanceof EChartsRenderError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "ECHARTS_RENDER_FAULT",
    message: error instanceof Error ? error.message : String(error),
  };
}

function asSeriesArray(value: unknown): Array<Record<string, unknown>> {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  return candidates.filter(
    (candidate): candidate is Record<string, unknown> =>
      candidate !== null &&
      typeof candidate === "object" &&
      !Array.isArray(candidate),
  );
}

function isValidRegistration(value: unknown): value is {
  readonly name: string;
  readonly geoJson: {
    readonly type: "FeatureCollection";
    readonly features: unknown[];
  };
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const registration = value as Record<string, unknown>;
  const geoJson = registration.geoJson;
  return (
    typeof registration.name === "string" &&
    registration.name.length > 0 &&
    geoJson !== null &&
    typeof geoJson === "object" &&
    !Array.isArray(geoJson) &&
    (geoJson as Record<string, unknown>).type === "FeatureCollection" &&
    Array.isArray((geoJson as Record<string, unknown>).features)
  );
}

function referencedMapNames(
  option: Record<string, unknown>,
  series: readonly Record<string, unknown>[],
): string[] {
  const geoComponents = Array.isArray(option.geo)
    ? option.geo
    : option.geo
      ? [option.geo]
      : [];
  return [...geoComponents, ...series]
    .filter(
      (candidate): candidate is Record<string, unknown> =>
        candidate !== null &&
        typeof candidate === "object" &&
        !Array.isArray(candidate),
    )
    .map((candidate) => candidate.map)
    .filter((name): name is string => typeof name === "string");
}

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
