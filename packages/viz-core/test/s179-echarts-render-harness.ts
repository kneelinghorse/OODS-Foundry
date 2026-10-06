import { createHash } from "node:crypto";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import {
  adaptBubbleToECharts,
  adaptChordToECharts,
  adaptChoroplethToECharts,
  adaptFlowLineToECharts,
  adaptGraphToECharts,
  adaptSankeyToECharts,
  adaptSunburstToECharts,
  adaptTreemapToECharts,
  registerGeoJson,
  type HierarchyInput,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
  type SpatialSpec,
} from "@oods/viz-core";
import {
  ECHARTS_OPERAND_CASES,
  type EChartsOperandCase,
} from "./fixtures/s172-echarts-operands.js";

export const SSR_WIDTH = 600;
export const SSR_HEIGHT = 400;

export type CanonicalChartType =
  | "treemap"
  | "sunburst"
  | "sankey"
  | "chord"
  | "force_graph"
  | "choropleth"
  | "bubble_map"
  | "flow_map";

export const STABLE_CHART_TYPES = [
  "treemap",
  "sunburst",
  "sankey",
  "chord",
  "choropleth",
  "bubble_map",
  "flow_map",
] as const satisfies readonly CanonicalChartType[];

interface PrimaryConfig {
  readonly mark: string;
  readonly label: string;
  readonly noun: string;
}

// Byte-mirrors buildEChartsPrimarySpec's lookup inputs without importing the MCP
// server. The harness must exercise viz-core's public adapters in isolation.
const ECHARTS_PRIMARY: Readonly<Record<CanonicalChartType, PrimaryConfig>> = {
  treemap: { mark: "MarkTreemap", label: "Treemap", noun: "hierarchical data" },
  sunburst: {
    mark: "MarkSunburst",
    label: "Sunburst",
    noun: "hierarchical data",
  },
  sankey: { mark: "MarkSankey", label: "Sankey diagram", noun: "flow data" },
  force_graph: {
    mark: "MarkGraph",
    label: "Force-directed graph",
    noun: "network data",
  },
  choropleth: {
    mark: "MarkChoropleth",
    label: "Choropleth map",
    noun: "regional values",
  },
  bubble_map: {
    mark: "MarkBubble",
    label: "Bubble map",
    noun: "geographic points",
  },
  flow_map: {
    mark: "MarkFlow",
    label: "Flow map",
    noun: "origin→destination flows",
  },
  chord: {
    mark: "MarkChord",
    label: "Chord diagram",
    noun: "category↔category weighted flows",
  },
};

interface GeoBranch {
  readonly geojson?: unknown;
  readonly topojson?: unknown;
  readonly topoObjectName?: string;
  readonly rows?: unknown[];
  readonly join?: {
    readonly dataKey: string;
    readonly featureProperty: string;
  };
  readonly valueField?: string;
  readonly colorScale?:
    | "quantize"
    | "quantile"
    | "threshold"
    | "linear"
    | "ordinal"
    | "diverging";
  readonly longitudeField?: string;
  readonly latitudeField?: string;
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly originLongitudeField?: string;
  readonly originLatitudeField?: string;
  readonly destinationLongitudeField?: string;
  readonly destinationLatitudeField?: string;
  readonly strengthField?: string;
  readonly curvature?: number;
}

interface RegistrationCarrier {
  readonly name: string;
  readonly geoJson: Parameters<typeof echarts.registerMap>[1];
}

export interface RenderCapture {
  readonly rawSvg: string;
  readonly normalizedSvg: string;
  readonly normalizedHash: string;
}

export interface SequentialRenderCapture {
  readonly first: RenderCapture;
  readonly second: RenderCapture;
}

export interface ProjectionProofOptions {
  readonly rawOption: EChartsOption;
  readonly projectedOption: Record<string, unknown>;
}

const DEFAULT_GEO_DIMENSIONS = { width: 860, height: 520 } as const;
const BASELINE_GENERATED_TOKEN = /zr\d+-(?:cls-\d+|ani-\d+|[sgpc]\d+)/g;

function canonicalChartType(chartType: string): CanonicalChartType {
  if (Object.hasOwn(ECHARTS_PRIMARY, chartType)) {
    return chartType as CanonicalChartType;
  }
  throw new Error(`Unexpected canonical ECharts chart type: ${chartType}`);
}

function buildPrimarySpec(operand: EChartsOperandCase): NormalizedVizSpec {
  const chartType = canonicalChartType(operand.chartType);
  const config = ECHARTS_PRIMARY[chartType];
  if (operand.trait !== config.mark) {
    throw new Error(
      `${chartType} fixture trait ${operand.trait} does not match ${config.mark}.`,
    );
  }

  const description = `${config.label} of ${operand.name ?? config.noun}.`;
  return {
    $schema: "https://oods-foundry.com/viz-spec/v1",
    id: `viz:${chartType}`,
    ...(operand.name ? { name: operand.name } : {}),
    data: { values: [] },
    marks: [{ trait: config.mark }],
    encoding: {},
    a11y: { description },
  } as NormalizedVizSpec;
}

function resolveFeatureCollection(
  geo: GeoBranch,
): ReturnType<typeof registerGeoJson>["geoJson"] | undefined {
  const source = geo.geojson ?? geo.topojson;
  if (!source) {
    return undefined;
  }
  return registerGeoJson(
    "geo",
    source as Parameters<typeof registerGeoJson>[1],
    {
      topoObjectName: geo.topoObjectName,
    },
  ).geoJson;
}

// This is the production geo builder's option-shaping path. It intentionally lives
// here, rather than importing mcp-server, so the baseline is owned by viz-core.
function buildGeoOption(
  spec: NormalizedVizSpec,
  chartType: "choropleth" | "bubble_map" | "flow_map",
  geo: GeoBranch,
): EChartsOption {
  const rows = (geo.rows ?? []) as Array<Record<string, unknown>>;
  const id = spec.id ?? `viz:${chartType}`;
  const name = spec.name;
  const description = spec.a11y.description;

  if (chartType === "choropleth") {
    const geoData = resolveFeatureCollection(geo);
    if (!geoData || !geo.valueField) {
      throw new Error(
        "The canonical choropleth operand requires geometry and valueField.",
      );
    }
    const spatialSpec: SpatialSpec = {
      id,
      ...(name ? { name } : {}),
      type: "spatial",
      data: geo.join
        ? {
            type: "data.geo.join",
            source: "inline",
            geoSource: "inline",
            joinKey: geo.join.dataKey,
            geoKey: geo.join.featureProperty,
          }
        : { values: rows },
      layers: [
        {
          type: "regionFill",
          encoding: {
            color: {
              field: geo.valueField,
              ...(geo.colorScale ? { scale: geo.colorScale } : {}),
            },
          },
        },
      ],
      a11y: { description },
    };
    return adaptChoroplethToECharts(
      spatialSpec,
      geoData,
      rows,
      DEFAULT_GEO_DIMENSIONS,
    );
  }

  if (chartType === "flow_map") {
    const geoData = resolveFeatureCollection(geo);
    if (
      !geoData ||
      !geo.originLongitudeField ||
      !geo.originLatitudeField ||
      !geo.destinationLongitudeField ||
      !geo.destinationLatitudeField ||
      rows.length === 0
    ) {
      throw new Error(
        "The canonical flow-map operand requires geometry, endpoints, and rows.",
      );
    }
    const spatialSpec: SpatialSpec = {
      id,
      ...(name ? { name } : {}),
      type: "spatial",
      data: { values: [] },
      layers: [
        {
          type: "route",
          encoding: {
            start: {
              field: geo.originLongitudeField,
              longitude: geo.originLongitudeField,
              latitude: geo.originLatitudeField,
            },
            end: {
              field: geo.destinationLongitudeField,
              longitude: geo.destinationLongitudeField,
              latitude: geo.destinationLatitudeField,
            },
            ...(geo.strengthField
              ? { strokeWidth: { field: geo.strengthField } }
              : {}),
            ...(geo.curvature !== undefined
              ? { curvature: { value: geo.curvature } }
              : {}),
          },
        },
      ],
      a11y: { description },
    };
    return adaptFlowLineToECharts(
      spatialSpec,
      geoData,
      rows,
      DEFAULT_GEO_DIMENSIONS,
    );
  }

  if (!geo.longitudeField || !geo.latitudeField || rows.length === 0) {
    throw new Error(
      "The canonical bubble-map operand requires longitude, latitude, and rows.",
    );
  }
  const spatialSpec: SpatialSpec = {
    id,
    ...(name ? { name } : {}),
    type: "spatial",
    data: { values: [] },
    layers: [
      {
        type: "symbol",
        encoding: {
          longitude: { field: geo.longitudeField },
          latitude: { field: geo.latitudeField },
          ...(geo.sizeField ? { size: { field: geo.sizeField, scale: 'area' } } : {}),
          ...(geo.colorField
            ? {
                color: {
                  field: geo.colorField,
                  ...(geo.colorScale ? { scale: geo.colorScale } : {}),
                },
              }
            : {}),
        },
      },
    ],
    a11y: { description },
  };
  return adaptBubbleToECharts(
    spatialSpec,
    resolveFeatureCollection(geo),
    rows,
    DEFAULT_GEO_DIMENSIONS,
  );
}

/** Build both sides of the JSON projection boundary for a discrimination proof. */
export function buildProjectionProofOptions(
  operand: EChartsOperandCase,
): ProjectionProofOptions {
  const chartType = canonicalChartType(operand.chartType);
  const spec = buildPrimarySpec(operand);
  let rawOption: EChartsOption;

  switch (chartType) {
    case "treemap":
      rawOption = adaptTreemapToECharts(
        spec,
        operand.branchData as HierarchyInput,
      );
      break;
    case "sunburst":
      rawOption = adaptSunburstToECharts(
        spec,
        operand.branchData as HierarchyInput,
      );
      break;
    case "sankey":
      rawOption = adaptSankeyToECharts(spec, operand.branchData as SankeyInput);
      break;
    case "chord":
      rawOption = adaptChordToECharts(spec, operand.branchData as SankeyInput);
      break;
    case "force_graph":
      rawOption = adaptGraphToECharts(spec, operand.branchData as NetworkInput);
      break;
    case "choropleth":
    case "bubble_map":
    case "flow_map":
      rawOption = buildGeoOption(
        spec,
        chartType,
        operand.branchData as GeoBranch,
      );
      break;
  }

  // Match the wire boundary: formatter functions disappear, join diagnostics do
  // not ship, while __registration remains for a renderer to consume.
  const projected = JSON.parse(JSON.stringify(rawOption)) as Record<
    string,
    unknown
  >;
  delete projected.__joinDiagnostics;
  return { rawOption, projectedOption: projected };
}

/** Build the JSON-transmittable option that viz.render serves for one fixture. */
export function buildProjectedOption(
  operand: EChartsOperandCase,
): Record<string, unknown> {
  return buildProjectionProofOptions(operand).projectedOption;
}

/** Render a projected option in a fresh ECharts SSR chart at the pinned viewport. */
export function renderProjectedOption(
  projected: Record<string, unknown>,
): string {
  const renderOption = structuredClone(projected);
  const registration = renderOption.__registration as
    | RegistrationCarrier
    | undefined;
  if (registration) {
    echarts.registerMap(registration.name, registration.geoJson);
    delete renderOption.__registration;
  }

  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: SSR_WIDTH,
    height: SSR_HEIGHT,
  });
  try {
    chart.setOption(renderOption as EChartsOption);
    return chart.renderToSVGString({ useViewBox: true });
  } finally {
    chart.dispose();
  }
}

/**
 * Baseline-evidence normalizer only: remap ECharts/ZRender allocator tokens in
 * first-appearance order. This deliberately is not a production normalizer.
 */
export function normalizeBaselineGeneratedTokens(svg: string): string {
  const replacements = new Map<string, string>();
  let next = 0;
  return svg.replace(BASELINE_GENERATED_TOKEN, (token) => {
    let replacement = replacements.get(token);
    if (replacement === undefined) {
      replacement = `oods-zr-${next}`;
      next += 1;
      replacements.set(token, replacement);
    }
    return replacement;
  });
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function completeCapture(rawSvg: string): RenderCapture {
  const normalizedSvg = normalizeBaselineGeneratedTokens(rawSvg);
  return { rawSvg, normalizedSvg, normalizedHash: sha256(normalizedSvg) };
}

/** Capture two back-to-back raw renders for all eight cases before normalizing. */
export function captureSequentialRenders(): Record<
  CanonicalChartType,
  SequentialRenderCapture
> {
  const rawPairs = new Map<CanonicalChartType, readonly [string, string]>();
  for (const operand of ECHARTS_OPERAND_CASES) {
    const chartType = canonicalChartType(operand.chartType);
    const projected = buildProjectedOption(operand);
    rawPairs.set(chartType, [
      renderProjectedOption(projected),
      renderProjectedOption(projected),
    ]);
  }

  return Object.fromEntries(
    [...rawPairs].map(([chartType, [first, second]]) => [
      chartType,
      { first: completeCapture(first), second: completeCapture(second) },
    ]),
  ) as Record<CanonicalChartType, SequentialRenderCapture>;
}

/** One seven-family raw capture, normalized only after every SVG has rendered. */
export function captureStableNormalizedHashes(): Record<
  (typeof STABLE_CHART_TYPES)[number],
  string
> {
  const raw = new Map<(typeof STABLE_CHART_TYPES)[number], string>();
  for (const chartType of STABLE_CHART_TYPES) {
    const operand = ECHARTS_OPERAND_CASES.find(
      (candidate) => candidate.chartType === chartType,
    );
    if (!operand) {
      throw new Error(`Missing canonical ${chartType} operand.`);
    }
    raw.set(chartType, renderProjectedOption(buildProjectedOption(operand)));
  }

  return Object.fromEntries(
    [...raw].map(([chartType, svg]) => [
      chartType,
      sha256(normalizeBaselineGeneratedTokens(svg)),
    ]),
  ) as Record<(typeof STABLE_CHART_TYPES)[number], string>;
}

/** Return only SVG elements ECharts marks as chart data, not titles or chrome. */
export function chartDataElements(svg: string): string[] {
  return [
    ...svg.matchAll(
      /<(?:path|rect|circle|polygon)\b[^>]*\becmeta_ssr_type="chart"[^>]*>/g,
    ),
  ].map(([element]) => element);
}

export function svgAttribute(
  element: string,
  attribute: string,
): string | undefined {
  return new RegExp(`\\b${attribute}="([^"]*)"`).exec(element)?.[1];
}
