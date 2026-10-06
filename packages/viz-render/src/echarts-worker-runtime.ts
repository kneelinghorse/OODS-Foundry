import { createHash } from "node:crypto";
import type { EChartsCoreOption } from "echarts/core";
import { normalizeEChartsSvg } from "./echarts-svg-normalizer.js";
import { accessibleSvg } from "./svg-accessibility.js";
import {
  ECHARTS_FORCE_SEED_VERSION,
  ECHARTS_INTERNAL_GEO_ALIAS,
  EChartsRenderError,
  prepareEChartsRenderInput,
  type EChartsRenderWorkerRequest,
  type EChartsWorkerMetrics,
  type EChartsWorkerResourceSample,
} from "./echarts-worker-protocol.js";

type EChartsCore = typeof import("echarts/core");

interface LoadedECharts {
  readonly init: EChartsCore["init"];
  readonly getMap: EChartsCore["getMap"];
  readonly registerMap: EChartsCore["registerMap"];
}

interface MutableWorkerMetrics {
  loadCount: number;
  activeJobs: number;
  maxActiveJobs: number;
  completedJobs: number;
  chartsCreated: number;
  chartsDisposed: number;
  activeCharts: number;
  renderFaults: number;
  geoRegistrationCount: number;
  geoRegistrySize: number;
  lastGeometryHash: string | null;
  randomRestored: boolean;
  clockGuardRestored: boolean;
  ambientAccesses: number;
}

const NATIVE_DATE = globalThis.Date;
const MASKED_HEADLESS_GLOBALS = [
  "document",
  "window",
  "navigator",
  "OffscreenCanvas",
  "CanvasRenderingContext2D",
  "Image",
] as const;

const metrics: MutableWorkerMetrics = {
  loadCount: 0,
  activeJobs: 0,
  maxActiveJobs: 0,
  completedJobs: 0,
  chartsCreated: 0,
  chartsDisposed: 0,
  activeCharts: 0,
  renderFaults: 0,
  geoRegistrationCount: 0,
  geoRegistrySize: 0,
  lastGeometryHash: null,
  randomRestored: true,
  clockGuardRestored: true,
  ambientAccesses: 0,
};

let loadedECharts: Promise<LoadedECharts> | undefined;
const registeredGeoAliases = new Set<string>();
let environmentFaultPending =
  process.env.OODS_ECHARTS_TEST_FORCE_RENDER_FAULT === "after-chart-created";

installTestAmbientGuards();

export function getWorkerMetrics(): EChartsWorkerMetrics {
  return { ...metrics };
}

/**
 * Sample heap from this worker isolate and RSS from the shared process. GC is
 * explicit because the release soak compares retained memory, not allocation
 * churn. The caller must launch Node with --expose-gc; the returned flag keeps
 * that precondition observable instead of silently substituting an unforced
 * sample.
 */
export function sampleWorkerResources(
  forceGc: boolean,
): Omit<EChartsWorkerResourceSample, "metrics"> {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (forceGc && gc) gc();
  const memory = process.memoryUsage();
  return {
    workerHeapUsedBytes: memory.heapUsed,
    processRssBytes: memory.rss,
    forcedGc: forceGc && typeof gc === "function",
  };
}

export async function renderEChartsInWorker(
  request: EChartsRenderWorkerRequest,
): Promise<string> {
  metrics.activeJobs += 1;
  metrics.maxActiveJobs = Math.max(metrics.maxActiveJobs, metrics.activeJobs);

  try {
    return await withDeterministicHeadlessRealm(async () => {
      const prepared = prepareEChartsRenderInput(
        request.projectedOption,
        request.dimensions,
      );
      const runtime = await loadECharts();
      const renderOption = prepared.projectedOption;
      applySnapshotPolicy(renderOption);

      const chart = runtime.init(null, null, {
        renderer: "svg",
        ssr: true,
        width: prepared.dimensions.width,
        height: prepared.dimensions.height,
      });
      metrics.chartsCreated += 1;
      metrics.activeCharts += 1;

      const originalRandom = Math.random;
      const usesForce = hasForceSeries(renderOption);
      if (usesForce) {
        Math.random = createSeededRandom(prepared.canonicalProjectedBytes);
      }

      try {
        if (
          request.testHooks?.forceRenderFault === "after-chart-created" ||
          environmentFaultPending
        ) {
          environmentFaultPending = false;
          throw new EChartsRenderError(
            "ECHARTS_RENDER_FAULT",
            "Forced ECharts render fault after chart creation.",
          );
        }

        registerInlineMap(
          runtime,
          renderOption,
          request.testHooks?.skipGeoRegistration === true,
        );

        try {
          chart.setOption(renderOption as EChartsCoreOption);
        } catch (error) {
          throw new EChartsRenderError(
            "ECHARTS_UNSUPPORTED_OPTION",
            error instanceof Error
              ? error.message
              : "ECharts rejected the projected option.",
            { cause: error },
          );
        }

        let rawSvg: string;
        try {
          rawSvg = request.testHooks?.forceUnreadableSvg
            ? "not-an-svg"
            : chart.renderToSVGString({ useViewBox: true });
        } catch (error) {
          throw new EChartsRenderError(
            "ECHARTS_RENDER_FAULT",
            error instanceof Error
              ? error.message
              : "ECharts failed while producing SVG.",
            { cause: error },
          );
        }
        if (!/^\s*<svg\b/.test(rawSvg)) {
          throw new EChartsRenderError(
            "ECHARTS_UNREADABLE_SVG",
            "ECharts returned output that is not an SVG document.",
          );
        }
        const title = Array.isArray(renderOption.title) ? renderOption.title[0] : renderOption.title;
        const description = (renderOption.aria as { description?: string } | undefined)?.description;
        return accessibleSvg(normalizeEChartsSvg(suppressZeroWidthChordStroke(rawSvg)), (title as { text?: string } | undefined)?.text, description);
      } finally {
        Math.random = originalRandom;
        metrics.randomRestored = Math.random === originalRandom;
        chart.dispose();
        if (chart.isDisposed()) metrics.chartsDisposed += 1;
        metrics.activeCharts -= 1;
      }
    });
  } catch (error) {
    metrics.renderFaults += 1;
    throw error;
  } finally {
    metrics.activeJobs -= 1;
    metrics.completedJobs += 1;
  }
}

async function loadECharts(): Promise<LoadedECharts> {
  if (!loadedECharts) {
    loadedECharts = Promise.all([
      import("echarts/core"),
      import("echarts/charts"),
      import("echarts/components"),
      import("echarts/renderers"),
    ]).then(([core, charts, components, renderers]) => {
      core.use([
        charts.TreemapChart,
        charts.SunburstChart,
        charts.SankeyChart,
        charts.ChordChart,
        charts.GraphChart,
        charts.MapChart,
        charts.ScatterChart,
        charts.LinesChart,
        components.TitleComponent,
        components.LegendComponent,
        components.TooltipComponent,
        components.AriaComponent,
        components.GeoComponent,
        components.VisualMapComponent,
        renderers.SVGRenderer,
      ]);
      metrics.loadCount += 1;
      return {
        init: core.init,
        getMap: core.getMap,
        registerMap: core.registerMap,
      };
    });
  }
  return loadedECharts;
}

function applySnapshotPolicy(option: Record<string, unknown>): void {
  option.animation = false;
  for (const series of asSeriesArray(option.series)) {
    if (series.type !== "graph" || series.layout !== "force") {
      continue;
    }
    const force = isRecord(series.force) ? series.force : {};
    series.force = { ...force, layoutAnimation: false };
  }
}

function registerInlineMap(
  runtime: LoadedECharts,
  option: Record<string, unknown>,
  skipRegistration: boolean,
): void {
  const registration = option.__registration as
    | { readonly geoJson: Parameters<LoadedECharts["registerMap"]>[1] }
    | undefined;
  if (!registration) {
    return;
  }

  const mapAlias = ECHARTS_INTERNAL_GEO_ALIAS;
  rewriteMapReference(option.geo, mapAlias);
  for (const series of asSeriesArray(option.series)) {
    if (typeof series.map === "string") {
      series.map = mapAlias;
    }
  }
  delete option.__registration;

  if (!skipRegistration) {
    try {
      registerTrackedMap(runtime, mapAlias, registration.geoJson);
    } catch (error) {
      throw new EChartsRenderError(
        "ECHARTS_INVALID_REGISTRATION",
        error instanceof Error
          ? error.message
          : "ECharts rejected the inline map registration.",
        { cause: error },
      );
    }
  }
  if (!runtime.getMap(mapAlias)) {
    throw new EChartsRenderError(
      "ECHARTS_NO_MAP",
      "The fixed internal ECharts map alias was not registered before rendering.",
    );
  }
}

function registerTrackedMap(
  runtime: LoadedECharts,
  mapName: string,
  geoJson: Parameters<LoadedECharts["registerMap"]>[1],
): void {
  runtime.registerMap(mapName, geoJson);
  registeredGeoAliases.add(mapName);
  metrics.geoRegistrationCount += 1;
  metrics.geoRegistrySize = registeredGeoAliases.size;
  metrics.lastGeometryHash = createHash("sha256")
    .update(JSON.stringify(geoJson))
    .digest("hex");
}

function rewriteMapReference(value: unknown, mapAlias: string): void {
  const geoComponents = Array.isArray(value) ? value : value ? [value] : [];
  for (const component of geoComponents) {
    if (isRecord(component) && typeof component.map === "string") {
      component.map = mapAlias;
    }
  }
}

function hasForceSeries(option: Record<string, unknown>): boolean {
  return asSeriesArray(option.series).some(
    (series) => series.type === "graph" && series.layout === "force",
  );
}

function createSeededRandom(canonicalProjectedBytes: string): () => number {
  const digest = createHash("sha256")
    .update(ECHARTS_FORCE_SEED_VERSION)
    .update("\0")
    .update(canonicalProjectedBytes)
    .digest();
  let state = digest.readUInt32BE(0) || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

async function withDeterministicHeadlessRealm<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const ambientDate = globalThis.Date;
  const descriptors = new Map<PropertyKey, PropertyDescriptor | undefined>();

  try {
    for (const key of MASKED_HEADLESS_GLOBALS) {
      descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: false,
        value: undefined,
        writable: true,
      });
    }
    globalThis.Date = fixedDateConstructor();
    return await operation();
  } finally {
    globalThis.Date = ambientDate;
    metrics.clockGuardRestored = globalThis.Date === ambientDate;
    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  }
}

function fixedDateConstructor(): DateConstructor {
  return new Proxy(NATIVE_DATE, {
    apply: (target, thisArg, argumentsList) =>
      argumentsList.length === 0
        ? new NATIVE_DATE(0).toString()
        : Reflect.apply(target, thisArg, argumentsList),
    construct: (target, argumentsList, newTarget) =>
      Reflect.construct(
        target,
        argumentsList.length === 0 ? [0] : argumentsList,
        newTarget,
      ),
    get: (target, property, receiver) =>
      property === "now" ? () => 0 : Reflect.get(target, property, receiver),
  }) as DateConstructor;
}

function installTestAmbientGuards(): void {
  const clockStep = Number(process.env.OODS_ECHARTS_TEST_CLOCK_STEP_MS);
  if (Number.isFinite(clockStep) && clockStep > 0) {
    let clock = 0;
    globalThis.Date = new Proxy(NATIVE_DATE, {
      apply: (target, thisArg, argumentsList) => {
        if (argumentsList.length > 0) {
          return Reflect.apply(target, thisArg, argumentsList);
        }
        const current = clock;
        clock += clockStep;
        return new NATIVE_DATE(current).toString();
      },
      construct: (target, argumentsList, newTarget) => {
        const resolved = argumentsList.length === 0 ? [clock] : argumentsList;
        if (argumentsList.length === 0) {
          clock += clockStep;
        }
        return Reflect.construct(target, resolved, newTarget);
      },
      get: (target, property, receiver) => {
        if (property === "now") {
          return () => {
            const current = clock;
            clock += clockStep;
            return current;
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }) as DateConstructor;
  }

  if (process.env.OODS_ECHARTS_TEST_POISON_AMBIENT !== "1") {
    return;
  }
  const poison = (name: string): never => {
    metrics.ambientAccesses += 1;
    throw new EChartsRenderError(
      "ECHARTS_RENDER_FAULT",
      `ECharts attempted to access poisoned ambient ${name}.`,
    );
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    get: () => poison("document"),
  });
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    get: () => poison("OffscreenCanvas"),
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: () => poison("fetch"),
    writable: true,
  });
}

function asSeriesArray(value: unknown): Array<Record<string, unknown>> {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  return candidates.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Native chord source/target paints name a fill rule, not a CSS stroke color.
 * ECharts 6 serializes the rule as a stroke even when its width is zero.
 * Suppress only that invisible stroke; preserve the resolved ribbon fill. */
export function suppressZeroWidthChordStroke(svg: string): string {
  return svg.replace(/<path\b[^>]*>/g, tag =>
    /\bstroke-width="0"/.test(tag)
      ? tag.replace(/\bstroke="(?:source|target)"/, 'stroke="none"')
      : tag);
}
