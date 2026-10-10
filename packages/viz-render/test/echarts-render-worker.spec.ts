import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ECHARTS_INPUT_LIMITS,
  ECHARTS_SSR_DIMENSIONS,
  EChartsRenderError,
  getEChartsRenderWorkerState,
  renderEChartsToSvg,
  sampleEChartsRenderWorkerResources,
} from "@oods/viz-render";
import {
  buildProjectedOption,
  type CanonicalChartType,
} from "../../viz-core/test/s179-echarts-render-harness.js";
import {
  ECHARTS_OPERAND_CASES,
  GEO_BUBBLE_NO_GEOMETRY_BRANCH,
  GEO_CHOROPLETH_UNMATCHED_BRANCH,
  type EChartsOperandCase,
} from "../../viz-core/test/fixtures/s172-echarts-operands.js";

type ProjectedOption = Record<string, unknown>;

// The synchronous, layoutAnimation:false snapshot under oods-echarts-lcg-v1.
// The full projected option seeds the force layout. s197-m05's generated
// palette change therefore changed geometry, even though that color is unused
// by this operand. This exact replacement hash is retained in the qualified m05
// force_graph/A/light matrix; keep the convergence and intervening-RNG assertions.
// s201-m06 moved it once more: sparse graphs spread to the canvas (edge length and
// repulsion follow the room each node has) and the title band is centred at 14px/600;
// the certified matrix was re-qualified (artifacts/product-reality/sprint-201/m06/certified-matrix).
// s211-m03: ECharts/ZRender 6.1.0 closes the legend swatches' rounded rectangles with an explicit `Z`; the converged
// geometry is unchanged (artifacts/product-reality/sprint-211/m03/echarts-6.1.0/ holds both renders).
// s216-m04: root SVG role/title/description only; stripping metadata reproduces the prior geometry hash.
// s222-m02 (#2502 ruling 12, with m01's chrome from #2505): the projected option carries brand A's recipe palette and
// m01's chrome, so the seeded layout moved with it, as at s197-m05; convergence and the RNG isolation are unchanged
// (artifacts/product-reality/sprint-222/m02/charts/geometry/ holds the pinned and the new render). The edges then took the
// opacity at which they reach 3:1 over the canvas (the s222-m02 follow-up), which the option carries into the seed too.
// s241: phone media changes the full-option seed; before/after and repeats are retained in m02/graph-epoch.
const CONVERGED_CANONICAL_FORCE_HASH =
  "a917bc8387756fca735878ca08edfb40f4689193c2db6b9c208775dd010b68d2";

const optionFor = (chartType: string): ProjectedOption => {
  const operand = ECHARTS_OPERAND_CASES.find(
    (candidate) => candidate.chartType === chartType,
  );
  if (!operand) {
    throw new Error(`Missing canonical ${chartType} operand.`);
  }
  return buildProjectedOption(operand);
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

async function expectTypedError(
  run: () => Promise<unknown> | unknown,
  code: string,
): Promise<EChartsRenderError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(EChartsRenderError);
    expect(error).toMatchObject({ name: "EChartsRenderError", code });
    return error as EChartsRenderError;
  }
  throw new Error(`Expected EChartsRenderError(${code}).`);
}

function noGeometryBubbleOption(): ProjectedOption {
  const standard = ECHARTS_OPERAND_CASES.find(
    ({ chartType }) => chartType === "bubble_map",
  );
  if (!standard) {
    throw new Error("Missing canonical bubble_map operand.");
  }
  const operand: EChartsOperandCase = {
    ...standard,
    branchData: GEO_BUBBLE_NO_GEOMETRY_BRANCH,
  };
  return buildProjectedOption(operand);
}

function unmatchedChoroplethOption(): ProjectedOption {
  const standard = ECHARTS_OPERAND_CASES.find(
    ({ chartType }) => chartType === "choropleth",
  );
  if (!standard) {
    throw new Error("Missing canonical choropleth operand.");
  }
  return buildProjectedOption({
    ...standard,
    branchData: GEO_CHOROPLETH_UNMATCHED_BRANCH,
  });
}

function graphSeries(option: ProjectedOption): Record<string, unknown> {
  const series = option.series as Array<Record<string, unknown>> | undefined;
  if (!series?.[0]) {
    throw new Error("Expected a graph series.");
  }
  return series[0];
}

function adversarialForceOption(): ProjectedOption {
  const option = optionFor("force_graph");
  const series = graphSeries(option);
  series.data = [
    { id: "left", name: "left", value: 0, x: 0, y: 0, category: 0 },
    { id: "right", name: "right", value: 0, x: 0, y: 0, category: 0 },
    { id: "top", name: "top", value: 1, x: 1, y: 0, category: 1 },
    { id: "bottom", name: "bottom", value: 1, x: -1, y: 0, category: 1 },
    { id: "isolated", name: "isolated", value: 0, x: 0, y: 0, category: 0 },
  ];
  series.links = [
    { source: "left", target: "top", value: 0 },
    { source: "right", target: "bottom", value: 0 },
    { source: "top", target: "right", value: 1 },
    { source: "bottom", target: "left", value: 1 },
  ];
  return option;
}

function forceOptionWithNodeCount(nodeCount: number): ProjectedOption {
  const option = optionFor("force_graph");
  const series = graphSeries(option);
  series.label = { show: false };
  series.data = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    name: `node-${index}`,
    value: index % 2,
    category: index % 2,
    symbolSize: 2,
  }));
  series.links = Array.from(
    { length: Math.max(0, nodeCount - 1) },
    (_, index) => ({
      source: `node-${index}`,
      target: `node-${index + 1}`,
      value: 1,
    }),
  );
  return option;
}

function textTimingOption(): ProjectedOption {
  const option = optionFor("treemap");
  option.title = Array.from({ length: 101 }, (_, index) => ({
    text: `A deliberately long title ${index} that must truncate`,
    left: `${index % 10}%`,
    top: `${Math.floor(index / 10) * 8}%`,
    textStyle: {
      width: 12,
      overflow: "truncate",
      fontFamily: `OODS-Uncached-${index}`,
      fontSize: 8,
    },
  }));
  const series = option.series as Array<Record<string, unknown>>;
  series[0].label = {
    show: true,
    width: 12,
    overflow: "truncate",
    ellipsis: "…",
  };
  series[0].data = Array.from({ length: 101 }, (_, index) => ({
    name: `A deliberately long label ${index} that must truncate`,
    value: index + 1,
    label: {
      show: true,
      width: 12,
      overflow: "truncate",
      fontFamily: `OODS-Uncached-${index}`,
    },
  }));
  return option;
}

function withCallerGeoIdentity(
  source: ProjectedOption,
  index: number,
): ProjectedOption {
  const option = structuredClone(source);
  const callerName = `caller-map-${index}`;
  const registration = option.__registration as {
    name: string;
    geoJson: {
      features: Array<{
        geometry: { coordinates: number[][][] };
      }>;
    };
  };
  registration.name = callerName;

  const geo = option.geo as Record<string, unknown>;
  geo.map = callerName;
  const series = option.series as Array<Record<string, unknown>>;
  for (const entry of series) {
    if ("map" in entry) {
      entry.map = callerName;
    }
  }

  // Every registration carries a distinct FeatureCollection. Alternating the
  // second polygon's width also makes stale warmed geometry visible in the SVG.
  const feature = registration.geoJson.features[1];
  if (feature) {
    const ring = feature.geometry.coordinates[0];
    const delta = (index + 1) / 10_000;
    ring[1][0] -= delta;
    ring[2][0] -= index % 2 === 0 ? delta : delta * 2;
  }
  return option;
}

interface BuiltProbeResult {
  readonly hash: string;
  readonly equal?: boolean;
  readonly uncachedFontCount: number;
  readonly beforeState: {
    readonly workerCreated: boolean;
    readonly echartsLoaded: boolean;
    readonly spawnCount: number;
    readonly loadCount: number;
  };
  readonly state: {
    readonly spawnCount: number;
    readonly loadCount: number;
    readonly workerCreated: boolean;
    readonly echartsLoaded: boolean;
    readonly ambientAccesses: number;
    readonly clockGuardRestored: boolean;
  };
}

interface BuiltErrorProbeResult {
  readonly error: { readonly name: string; readonly code: string } | null;
  readonly state: {
    readonly workerCreated: boolean;
    readonly echartsLoaded: boolean;
    readonly spawnCount: number;
    readonly loadCount: number;
    readonly chartsCreated: number;
    readonly geoRegistrySize: number;
  };
}

function runBuiltProbe(
  format: "esm" | "cjs",
  option: ProjectedOption,
  env: Readonly<Record<string, string>> = {},
  renderTwice = false,
): BuiltProbeResult {
  const entry = fileURLToPath(
    new URL(
      format === "esm" ? "../dist/index.js" : "../dist/index.cjs",
      import.meta.url,
    ),
  );
  const load =
    format === "esm"
      ? `await import(${JSON.stringify(pathToFileURL(entry).href)})`
      : `require(${JSON.stringify(entry)})`;
  const script = `
    (async () => {
      const api = ${load};
      const option = JSON.parse(process.env.OODS_ECHARTS_TEST_OPTION);
      const beforeState = await api.getEChartsRenderWorkerState();
      const first = await api.renderEChartsToSvg(option);
      const second = ${renderTwice ? "await api.renderEChartsToSvg(option)" : "first"};
      const state = await api.getEChartsRenderWorkerState();
      const { createHash } = ${format === "esm" ? "await import('node:crypto')" : "require('node:crypto')"};
      const payload = JSON.stringify({
        hash: createHash('sha256').update(first).digest('hex'),
        equal: first === second,
        uncachedFontCount: new Set(first.match(/OODS-Uncached-\\d+/g) ?? []).size,
        beforeState,
        state,
      });
      process.stdout.write(payload, () => process.exit(0));
    })().catch((error) => {
      process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
    });
  `;
  const child = spawnSync(process.execPath, ["--eval", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...process.env,
      ...env,
      OODS_ECHARTS_TEST_OPTION: JSON.stringify(option),
    },
  });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as BuiltProbeResult;
}

function runBuiltErrorProbe(option: ProjectedOption): BuiltErrorProbeResult {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const script = `
    (async () => {
      const api = await import(${JSON.stringify(pathToFileURL(entry).href)});
      const option = JSON.parse(process.env.OODS_ECHARTS_TEST_OPTION);
      let error = null;
      try {
        await api.renderEChartsToSvg(option);
      } catch (caught) {
        error = { name: caught?.name, code: caught?.code };
      }
      const state = await api.getEChartsRenderWorkerState();
      process.stdout.write(JSON.stringify({ error, state }), () => process.exit(0));
    })().catch((error) => {
      process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
    });
  `;
  const child = spawnSync(process.execPath, ["--eval", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      OODS_ECHARTS_TEST_OPTION: JSON.stringify(option),
    },
  });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as BuiltErrorProbeResult;
}

describe.sequential("ECharts render worker contract", () => {
  it("stays completely lazy and publishes only the ratified input boundary", async () => {
    const state = await getEChartsRenderWorkerState();

    expect(state).toMatchObject({
      workerCreated: false,
      echartsLoaded: false,
      spawnCount: 0,
      loadCount: 0,
    });
    expect(ECHARTS_SSR_DIMENSIONS).toEqual({ width: 600, height: 400 });
    expect(ECHARTS_INPUT_LIMITS).toEqual({
      forceNodes: 250,
      forceLinks: null,
      payloadBytes: null,
    });
  });

  it("rejects the exact no-geometry bubble sibling before worker creation and never fetches a map", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error("The renderer must not fetch a map.");
    }) as typeof fetch;
    try {
      await expectTypedError(
        () => renderEChartsToSvg(noGeometryBubbleOption()),
        "ECHARTS_NO_MAP",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toBe(0);
    expect(await getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: false,
      spawnCount: 0,
      loadCount: 0,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid width %s before worker creation", async (width) => {
    await expectTypedError(
      () =>
        renderEChartsToSvg(optionFor("treemap"), {
          width,
          height: 400,
        }),
      "ECHARTS_INVALID_DIMENSIONS",
    );
    expect(await getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: false,
      spawnCount: 0,
      loadCount: 0,
    });
  });

  it("types malformed, unserializable, empty, and map-mismatched options before dispatch", async () => {
    await expectTypedError(
      () => renderEChartsToSvg(null as never),
      "ECHARTS_INVALID_OPTION",
    );

    const cyclic: ProjectedOption = { series: [{ type: "treemap" }] };
    cyclic.self = cyclic;
    await expectTypedError(
      () => renderEChartsToSvg(cyclic),
      "ECHARTS_INVALID_OPTION",
    );
    await expectTypedError(
      () => renderEChartsToSvg({ series: [] }),
      "ECHARTS_UNSUPPORTED_OPTION",
    );

    const mismatchedMap = optionFor("choropleth");
    const registration = mismatchedMap.__registration as { name: string };
    registration.name = "does-not-match-option-map";
    await expectTypedError(
      () => renderEChartsToSvg(mismatchedMap),
      "ECHARTS_INVALID_REGISTRATION",
    );

    expect(await getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: false,
      spawnCount: 0,
      loadCount: 0,
    });
  });

  it("samples worker-isolate resources on demand without eagerly loading ECharts", async () => {
    const sample = await sampleEChartsRenderWorkerResources({ forceGc: false });
    expect(sample).toMatchObject({
      forcedGc: false,
      metrics: {
        loadCount: 0,
        completedJobs: 0,
        chartsCreated: 0,
        chartsDisposed: 0,
      },
    });
    expect(sample.workerHeapUsedBytes).toBeGreaterThan(0);
    expect(sample.processRssBytes).toBeGreaterThan(0);
    expect(await getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: true,
      echartsLoaded: false,
      spawnCount: 1,
      loadCount: 0,
    });

    // Normal test runs do not expose GC. The API reports that fact instead of
    // silently representing this allocation-churn sample as post-GC evidence.
    expect(
      (await sampleEChartsRenderWorkerResources({ forceGc: true })).forcedGc,
    ).toBe(false);
  });

  it("closes the zrender timing branch under ambient poison and 101 uncached fonts", () => {
    const result = runBuiltProbe(
      "esm",
      textTimingOption(),
      {
        OODS_ECHARTS_TEST_POISON_AMBIENT: "1",
        OODS_ECHARTS_TEST_CLOCK_STEP_MS: "20",
      },
      true,
    );

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.equal).toBe(true);
    expect(result.uncachedFontCount).toBeGreaterThan(100);
    expect(result.state).toMatchObject({
      workerCreated: true,
      echartsLoaded: true,
      spawnCount: 1,
      loadCount: 1,
      ambientAccesses: 0,
      clockGuardRestored: true,
    });
  }, 60_000);

  it.each(ECHARTS_OPERAND_CASES)(
    "$chartType renders the exact s172 operand twice without mutation",
    async (operand) => {
      const option = buildProjectedOption(operand);
      const before = structuredClone(option);

      const first = await renderEChartsToSvg(option);
      const second = await renderEChartsToSvg(option);

      expect(first).toBe(second);
      expect(first.startsWith("<svg")).toBe(true);
      expect(first).toContain('ecmeta_ssr_type="chart"');
      expect(sha256(first)).toMatch(/^[a-f0-9]{64}$/);
      expect(option).toEqual(before);
    },
    30_000,
  );

  it("keeps both adversarial sibling exports outside the canonical eight-case array", async () => {
    expect(ECHARTS_OPERAND_CASES).toHaveLength(8);
    expect(
      ECHARTS_OPERAND_CASES.map(({ branchData }) => branchData),
    ).not.toContain(GEO_CHOROPLETH_UNMATCHED_BRANCH);
    expect(
      ECHARTS_OPERAND_CASES.map(({ branchData }) => branchData),
    ).not.toContain(GEO_BUBBLE_NO_GEOMETRY_BRANCH);

    const option = unmatchedChoroplethOption();
    const before = structuredClone(option);
    expect(await renderEChartsToSvg(option)).toBe(
      await renderEChartsToSvg(option),
    );
    expect(option).toEqual(before);
  });

  it("pins converged force geometry and seeds degenerate jobs despite intervening RNG consumption", async () => {
    const option = adversarialForceOption();
    const before = structuredClone(option);
    const first = await renderEChartsToSvg(option);
    const canonical = await renderEChartsToSvg(optionFor("force_graph"));
    const second = await renderEChartsToSvg(option);

    expect(sha256(canonical)).toBe(CONVERGED_CANONICAL_FORCE_HASH);
    expect(second).toBe(first);
    expect(first).toContain('ecmeta_ssr_type="chart"');
    expect(option).toEqual(before);
  }, 30_000);

  it("restores the worker RNG immediately after a force render fault", async () => {
    const forcedFault = {
      ...adversarialForceOption(),
      __oodsTestForceRenderFault: "after-chart-created",
    };

    await expectTypedError(
      () => renderEChartsToSvg(forcedFault),
      "ECHARTS_RENDER_FAULT",
    );
    const state = await getEChartsRenderWorkerState();
    expect(state.randomRestored).toBe(true);
    expect(state.activeJobs).toBe(0);
    expect(state.activeCharts).toBe(0);
    expect(state.chartsCreated).toBe(state.chartsDisposed);
  });

  it("admits exactly 250 force nodes and typed-rejects 251 without inventing other ceilings", async () => {
    const atLimit = forceOptionWithNodeCount(ECHARTS_INPUT_LIMITS.forceNodes);
    const before = structuredClone(atLimit);
    const svg = await renderEChartsToSvg(atLimit);
    expect(svg).toContain('ecmeta_ssr_type="chart"');
    expect(atLimit).toEqual(before);

    await expectTypedError(
      () =>
        renderEChartsToSvg(
          forceOptionWithNodeCount(ECHARTS_INPUT_LIMITS.forceNodes + 1),
        ),
      "ECHARTS_INPUT_LIMIT",
    );
    expect(ECHARTS_INPUT_LIMITS.forceLinks).toBeNull();
    expect(ECHARTS_INPUT_LIMITS.payloadBytes).toBeNull();
  }, 60_000);

  it("serializes concurrent force/non-force/fault jobs without touching main-realm guards", async () => {
    const mainRandom = Math.random;
    const mainDate = Date;
    const mainDocument = globalThis.document;
    const mainFetch = globalThis.fetch;
    const sentinelRandom = () => {
      throw new Error("Main-realm Math.random was touched.");
    };
    const sentinelFetch = (() => {
      throw new Error("Main-realm fetch was touched.");
    }) as typeof fetch;
    let dateCalls = 0;
    const sentinelDate = new Proxy(mainDate, {
      apply: (target, thisArg, argumentsList) => {
        dateCalls += 1;
        return Reflect.apply(target, thisArg, argumentsList);
      },
      construct: (target, argumentsList, newTarget) => {
        dateCalls += 1;
        return Reflect.construct(target, argumentsList, newTarget);
      },
      get: (target, property, receiver) =>
        property === "now"
          ? () => {
              dateCalls += 1;
              return mainDate.now();
            }
          : Reflect.get(target, property, receiver),
    }) as DateConstructor;
    Math.random = sentinelRandom;
    globalThis.Date = sentinelDate;
    globalThis.fetch = sentinelFetch;

    const forcedFault = {
      ...adversarialForceOption(),
      __oodsTestForceRenderFault: "after-chart-created",
    };
    const completionOrder: string[] = [];
    let observedRandom: typeof Math.random | undefined;
    let observedDate: DateConstructor | undefined;
    let observedDocument: typeof globalThis.document;
    let observedFetch: typeof globalThis.fetch;
    try {
      const results = await Promise.allSettled([
        renderEChartsToSvg(adversarialForceOption()).finally(() =>
          completionOrder.push("force"),
        ),
        renderEChartsToSvg(optionFor("treemap")).finally(() =>
          completionOrder.push("treemap"),
        ),
        renderEChartsToSvg(forcedFault).finally(() =>
          completionOrder.push("fault"),
        ),
        renderEChartsToSvg(optionFor("sankey")).finally(() =>
          completionOrder.push("sankey"),
        ),
      ]);
      expect(results.map(({ status }) => status)).toEqual([
        "fulfilled",
        "fulfilled",
        "rejected",
        "fulfilled",
      ]);
      expect(completionOrder).toEqual(["force", "treemap", "fault", "sankey"]);
      const failure = results[2];
      if (failure.status !== "rejected") {
        throw new Error("Expected the third queued render to fault.");
      }
      expect(failure.reason).toBeInstanceOf(EChartsRenderError);
      expect(failure.reason).toMatchObject({ code: "ECHARTS_RENDER_FAULT" });
    } finally {
      observedRandom = Math.random;
      observedDate = Date;
      observedDocument = globalThis.document;
      observedFetch = globalThis.fetch;
      Math.random = mainRandom;
      globalThis.Date = mainDate;
      globalThis.fetch = mainFetch;
    }
    expect(observedRandom).toBe(sentinelRandom);
    expect(observedDate).toBe(sentinelDate);
    expect(dateCalls).toBe(0);
    expect(observedDocument).toBe(mainDocument);
    expect(observedFetch).toBe(sentinelFetch);

    const state = await getEChartsRenderWorkerState();
    expect(state).toMatchObject({
      spawnCount: 1,
      loadCount: 1,
      activeJobs: 0,
      maxActiveJobs: 1,
      randomRestored: true,
      clockGuardRestored: true,
      ambientAccesses: 0,
    });
    expect(state.renderFaults).toBeGreaterThanOrEqual(1);
    expect(state.chartsDisposed).toBe(state.chartsCreated);
  }, 60_000);

  it("re-registers conflicting warm geometry while keeping one fixed geo alias", async () => {
    const base = optionFor("choropleth");
    const fresh = withCallerGeoIdentity(base, 1);
    const conflicting = withCallerGeoIdentity(base, 2);
    const conflictingRegistration = conflicting.__registration as {
      geoJson: { features: unknown[] };
    };
    conflictingRegistration.geoJson.features =
      conflictingRegistration.geoJson.features.slice(0, 1);

    const first = await renderEChartsToSvg(fresh);
    const second = await renderEChartsToSvg(conflicting);
    const firstAgain = await renderEChartsToSvg(fresh);

    expect(second).not.toBe(first);
    expect(firstAgain).toBe(first);
    expect(await getEChartsRenderWorkerState()).toMatchObject({
      geoRegistrySize: 1,
    });
  });

  it("registers each fresh geo family before setOption and types a skipped first registration as no-map", () => {
    for (const chartType of ["choropleth", "bubble_map", "flow_map"]) {
      const fresh = runBuiltProbe("esm", optionFor(chartType));
      expect(fresh.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(fresh.state).toMatchObject({
        workerCreated: true,
        echartsLoaded: true,
        spawnCount: 1,
        loadCount: 1,
      });

      const skipped = runBuiltErrorProbe({
        ...optionFor(chartType),
        __oodsTestSkipGeoRegistration: true,
      });
      expect(skipped.error).toEqual({
        name: "EChartsRenderError",
        code: "ECHARTS_NO_MAP",
      });
      expect(skipped.state).toMatchObject({
        workerCreated: true,
        echartsLoaded: true,
        spawnCount: 1,
        loadCount: 1,
        chartsCreated: 1,
        chartsDisposed: 1,
        activeCharts: 0,
        renderFaults: 1,
        geoRegistrySize: 0,
      });
    }
  }, 60_000);

  it("keeps the registry bounded across 1,000 unique caller IDs and FeatureCollections", async () => {
    const base = optionFor("choropleth");
    const before = await getEChartsRenderWorkerState();
    let first = "";
    let last = "";
    for (let index = 0; index < 1_000; index += 1) {
      const svg = await renderEChartsToSvg(withCallerGeoIdentity(base, index));
      if (index === 0) first = svg;
      if (index === 999) last = svg;
    }

    expect(first).not.toBe(last);
    const after = await getEChartsRenderWorkerState();
    expect(after.geoRegistrationCount - before.geoRegistrationCount).toBe(
      1_000,
    );
    expect(after.lastGeometryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(after).toMatchObject({
      workerCreated: true,
      echartsLoaded: true,
      spawnCount: 1,
      loadCount: 1,
      activeJobs: 0,
      maxActiveJobs: 1,
      geoRegistrySize: 1,
      randomRestored: true,
      clockGuardRestored: true,
      ambientAccesses: 0,
    });
  }, 120_000);

  it("reconstructs malformed registration, unsupported option, and unreadable SVG as typed faults", async () => {
    const invalidRegistration = optionFor("choropleth");
    invalidRegistration.__registration = { name: "", geoJson: null };
    await expectTypedError(
      () => renderEChartsToSvg(invalidRegistration),
      "ECHARTS_INVALID_REGISTRATION",
    );

    await expectTypedError(
      () => renderEChartsToSvg({ series: [{ type: "bar", data: [1] }] }),
      "ECHARTS_UNSUPPORTED_OPTION",
    );

    await expectTypedError(
      () =>
        renderEChartsToSvg({
          ...optionFor("treemap"),
          __oodsTestUnreadableSvg: true,
        }),
      "ECHARTS_UNREADABLE_SVG",
    );

    const state = await getEChartsRenderWorkerState();
    // Preflight rejections do not inflate worker-side render-fault counters.
    expect(state.renderFaults).toBeGreaterThanOrEqual(2);
    expect(state.chartsDisposed).toBe(state.chartsCreated);
  });

  it("resolves and renders through both built ESM and CJS public entries", () => {
    const option = optionFor("treemap");
    const esm = runBuiltProbe("esm", option);
    const cjs = runBuiltProbe("cjs", option);

    expect(esm.hash).toBe(cjs.hash);
    for (const probe of [esm, cjs]) {
      expect(probe.beforeState).toMatchObject({
        workerCreated: false,
        echartsLoaded: false,
        spawnCount: 0,
        loadCount: 0,
      });
      expect(probe.state).toMatchObject({
        workerCreated: true,
        echartsLoaded: true,
        spawnCount: 1,
        loadCount: 1,
      });
    }
  }, 60_000);

  it("keeps the built CJS Vega emitter usable without spawning the ECharts worker", async () => {
    const require = createRequire(import.meta.url);
    const entry = fileURLToPath(new URL("../dist/index.cjs", import.meta.url));
    const api = require(entry) as {
      renderVegaLiteToSvg(spec: unknown): Promise<string>;
      getEChartsRenderWorkerState(): Promise<{
        workerCreated: boolean;
        echartsLoaded: boolean;
        spawnCount: number;
        loadCount: number;
      }>;
    };

    expect(await api.getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: false,
      echartsLoaded: false,
      spawnCount: 0,
      loadCount: 0,
    });
    const svg = await api.renderVegaLiteToSvg({
      data: {
        values: [
          { category: "A", value: 2 },
          { category: "B", value: 3 },
        ],
      },
      mark: "bar",
      encoding: {
        x: { field: "category", type: "nominal" },
        y: { field: "value", type: "quantitative" },
      },
      width: 120,
      height: 80,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain('class="mark-rect');
    expect(await api.getEChartsRenderWorkerState()).toMatchObject({
      workerCreated: false,
      echartsLoaded: false,
      spawnCount: 0,
      loadCount: 0,
    });
  });

  it("keeps exactly one worker/load and disposes every chart after the complete matrix", async () => {
    const state = await getEChartsRenderWorkerState();
    expect(state).toMatchObject({
      workerCreated: true,
      echartsLoaded: true,
      spawnCount: 1,
      loadCount: 1,
      queuedJobs: 0,
      activeJobs: 0,
      maxActiveJobs: 1,
      randomRestored: true,
      clockGuardRestored: true,
      ambientAccesses: 0,
    });
    expect(state.completedJobs).toBeGreaterThan(1_000);
    expect(state.chartsCreated).toBeGreaterThan(1_000);
    expect(state.chartsDisposed).toBe(state.chartsCreated);
  });

  it("keeps the force family in the canonical eight-case matrix", () => {
    expect(
      ECHARTS_OPERAND_CASES.map(
        ({ chartType }) => chartType as CanonicalChartType,
      ),
    ).toContain("force_graph");
  });
});
