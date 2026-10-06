import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getEChartsRenderWorkerState,
  renderEChartsToSvg,
} from "@oods/viz-render";
import type { NormalizedVizSpec } from "@oods/viz-core";
import {
  handle as certify,
  type ArtifactCertifyInput,
  type ArtifactCertifyOutput,
} from "../../src/tools/artifact.certify.js";
import {
  emitRawEChartsOption,
  projectEChartsOption,
} from "../../src/tools/certify-echarts-emit.js";
import {
  ECHARTS_OPERAND_CASES,
  GEO_CHOROPLETH_BRANCH,
  type EChartsOperandCase,
} from "../tools/s172-echarts-operands.js";

type ProjectedOption = Record<string, unknown>;

const MIB = 1024 * 1024;
const WARMUP_RENDERS = 100;
const MEASURED_RENDERS = 2_000;
const WINDOW_SIZE = 100;
const PLATEAU_SAMPLE_START = 13;
const RESOURCE_SAMPLE_ATTEMPTS = 3;

// Ratified from the unmutated local baseline. Latency ceilings retain enough
// headroom for the Linux release runner while remaining below the 15-minute CI
// job timeout. The slope limits are hard outlier ceilings. The one-sided
// confidence bound is retained as a diagnostic, not a pass/fail assertion.
// The first 1,200 unique-geometry renders
// are excluded as cache/JIT settling; eight fitted samples then cover windows
// 1,300..2,000. The separate 12 MiB heap ceiling remains independently binding.
const BUDGETS = Object.freeze({
  packageImportP95Ms: 100,
  workerStartupP95Ms: 250,
  incrementalFirstUseP95Ms: 900,
  startupPlusFirstUseP95Ms: 1_000,
  warmTreemapP95Ms: 15,
  force100P95Ms: 500,
  force250P95Ms: 1_500,
  workerHeapAbsoluteDeltaBytes: 12 * MIB,
  workerHeapSlopeBytesPerWindow: 256 * 1024,
  processRssSlopeBytesPerWindow: 2 * MIB,
  repeatedWindowGrowthBytes: 4 * MIB,
});

interface FreshTrial {
  readonly packageImportMs: number;
  readonly workerStartupMs: number;
  readonly incrementalFirstUseMs: number;
  readonly startupPlusFirstUseMs: number;
  readonly startupLoadCount: number;
  readonly startupForcedGc: boolean;
}

interface LatencyRun {
  readonly warmTreemapMs: readonly number[];
  readonly force100Ms: readonly number[];
  readonly force250Ms: readonly number[];
}

interface PlateauResult {
  readonly method: "least-squares-slope" | "repeated-length-doubling";
  readonly slopeBytesPerWindow?: number;
  readonly slopeStandardErrorBytesPerWindow?: number;
  readonly positiveTrendLower99BytesPerWindow?: number;
  readonly repeatedGrowthBytes?: readonly number[];
}

interface LinearTrend {
  readonly slope: number;
  readonly slopeStandardError: number;
  readonly positiveTrendLower99: number;
}

interface SoakSample {
  readonly renderCount: number;
  readonly workerHeapUsedBytes: number;
  readonly processRssBytes: number;
}

interface SoakWorkerMetrics {
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

interface ResourceSoakRun {
  readonly samples: readonly SoakSample[];
  readonly finalGeometryHash: string;
  readonly faultCode: string | null;
  readonly beforeFault: SoakWorkerMetrics;
  readonly afterFault: SoakWorkerMetrics;
}

function operandFor(chartType: string): EChartsOperandCase {
  const operand = ECHARTS_OPERAND_CASES.find(
    (candidate) => candidate.chartType === chartType,
  );
  if (!operand) throw new Error(`Missing canonical ${chartType} operand.`);
  return operand;
}

function specFor(
  operand: EChartsOperandCase,
  id = `viz:${operand.chartType}`,
): NormalizedVizSpec {
  return {
    $schema: "https://oods-foundry.com/viz-spec/v1",
    id,
    name: operand.name,
    data: { values: [] },
    marks: [{ trait: operand.trait }],
    encoding: {},
    a11y: { description: `${operand.name} soak fixture.` },
  } as NormalizedVizSpec;
}

function certifyInput(
  operand: EChartsOperandCase,
  id?: string,
): ArtifactCertifyInput {
  return {
    spec: specFor(operand, id),
    data: { [operand.branch]: operand.branchData } as never,
  };
}

function projectedOption(operand: EChartsOperandCase): ProjectedOption {
  const raw = emitRawEChartsOption(
    specFor(operand),
    operand.chartType as never,
    operand.branchData,
  );
  return projectEChartsOption(raw);
}

function forceOptionWithNodeCount(nodeCount: number): ProjectedOption {
  const option = projectedOption(operandFor("force_graph"));
  const series = (option.series as Array<Record<string, unknown>>)[0];
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

function geoBranchAt(index: number): typeof GEO_CHOROPLETH_BRANCH {
  const branch = structuredClone(GEO_CHOROPLETH_BRANCH);
  const feature = branch.geojson.features[1];
  const ring = feature.geometry.coordinates[0];
  const delta = (index + 1) / 10_000;
  ring[1][0] -= delta;
  ring[2][0] -= index % 2 === 0 ? delta : delta * 2;
  return branch;
}

function geoOperandAt(index: number): EChartsOperandCase {
  return {
    ...operandFor("choropleth"),
    branchData: geoBranchAt(index),
  };
}

function hashes(output: ArtifactCertifyOutput): {
  readonly contentHash: string;
  readonly renderHash: string;
} {
  expect(output.status).toBe("ok");
  expect(output.determinism?.stable).toBe(true);
  expect(output.determinism?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(output.determinism?.renderHash).toMatch(/^[a-f0-9]{64}$/);
  return {
    contentHash: output.determinism?.contentHash ?? "",
    renderHash: output.determinism?.renderHash ?? "",
  };
}

function p95(samples: readonly number[]): number {
  if (samples.length === 0)
    throw new Error("Cannot compute p95 of no samples.");
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

function childEnvironment(
  additions: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...additions };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_V8_COVERAGE;
  delete environment.VITEST;
  return environment;
}

function runFreshNode<T>(
  source: string,
  environment: Readonly<Record<string, string>>,
): T {
  const child = spawnSync(
    process.execPath,
    ["--expose-gc", "--eval", `(async () => {${source}})()`],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      encoding: "utf8",
      env: childEnvironment(environment),
      maxBuffer: 4 * MIB,
      timeout: 120_000,
    },
  );
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as T;
}

function leastSquaresTrend(values: readonly number[]): LinearTrend {
  const xMean = (values.length - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += (index - xMean) * (values[index] - yMean);
    denominator += (index - xMean) ** 2;
  }
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  const residualSumSquares = values.reduce((sum, value, index) => {
    const residual = value - (intercept + slope * index);
    return sum + residual ** 2;
  }, 0);
  const slopeStandardError = Math.sqrt(
    residualSumSquares / (values.length - 2) / denominator,
  );
  // One-sided 99% Student-t critical value for the ratified eight samples
  // (six residual degrees of freedom). A positive lower bound means retained
  // growth is statistically distinguishable from zero; it remains diagnostic.
  const positiveTrendLower99 = slope - 3.143 * slopeStandardError;
  return { slope, slopeStandardError, positiveTrendLower99 };
}

function plateauEvidence(
  values: readonly number[],
  slopeBudget: number,
): PlateauResult {
  expect(values).toHaveLength(8);
  const distinct = new Set(values).size;
  const trend = leastSquaresTrend(values);
  if (
    Number.isFinite(trend.slope) &&
    Number.isFinite(trend.slopeStandardError) &&
    distinct >= 3
  ) {
    expect(trend.slope).toBeLessThanOrEqual(slopeBudget);
    // s199: retain this diagnostic; only the hard resource ceilings are pass/fail.
    return {
      method: "least-squares-slope",
      slopeBytesPerWindow: trend.slope,
      slopeStandardErrorBytesPerWindow: trend.slopeStandardError,
      positiveTrendLower99BytesPerWindow: trend.positiveTrendLower99,
    };
  }

  // Statistically degenerate fit fallback: compare repeated adjacent windows
  // at lengths 1, 2, and 4. This is deliberately not a two-window-only gate.
  const repeatedGrowthBytes = [1, 2, 4].map((length) => {
    const recent = values.slice(-length);
    const prior = values.slice(-2 * length, -length);
    expect(recent).toHaveLength(length);
    expect(prior).toHaveLength(length);
    const mean = (sample: readonly number[]) =>
      sample.reduce((sum, value) => sum + value, 0) / sample.length;
    return mean(recent) - mean(prior);
  });
  for (const growth of repeatedGrowthBytes) {
    expect(growth).toBeLessThanOrEqual(BUDGETS.repeatedWindowGrowthBytes);
  }
  return { method: "repeated-length-doubling", repeatedGrowthBytes };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function emitEvidence(label: string, evidence: unknown): void {
  process.stdout.write(
    `\nECHARTS_SOAK_EVIDENCE ${label} ${JSON.stringify(evidence)}\n`,
  );
}

describe.sequential(
  "ECharts artifact.certify concurrency and resource release gate",
  () => {
    it("runs four artifact.certify calls at the server cap with conflicting geo data and mixed families", async () => {
      const policy = JSON.parse(
        readFileSync(
          new URL("../../src/security/policy.json", import.meta.url),
          "utf8",
        ),
      ) as { rules: Array<{ tool: string; concurrency?: number }> };
      const cap = policy.rules.find(
        (rule) => rule.tool === "artifact.certify",
      )?.concurrency;
      expect(cap).toBe(4);

      const geoA = geoOperandAt(101);
      const geoB = geoOperandAt(707);
      const inputs = [
        certifyInput(geoA, "viz:concurrent-map-a"),
        certifyInput(geoB, "viz:concurrent-map-b"),
        certifyInput(operandFor("force_graph")),
        certifyInput(operandFor("treemap")),
      ];
      expect(inputs).toHaveLength(cap);

      const mainRandom = Math.random;
      const mainDate = globalThis.Date;
      const mainDocument = globalThis.document;
      const mainFetch = globalThis.fetch;
      const startedAt = performance.now();
      const outputs = await withTimeout(
        Promise.all(inputs.map((input) => certify(input))),
        120_000,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(Math.random).toBe(mainRandom);
      expect(globalThis.Date).toBe(mainDate);
      expect(globalThis.document).toBe(mainDocument);
      expect(globalThis.fetch).toBe(mainFetch);

      const concurrentHashes = outputs.map(hashes);
      expect(concurrentHashes[0].contentHash).not.toBe(
        concurrentHashes[1].contentHash,
      );
      expect(concurrentHashes[0].renderHash).not.toBe(
        concurrentHashes[1].renderHash,
      );

      const repeatedA = hashes(await certify(inputs[0]));
      const repeatedB = hashes(await certify(inputs[1]));
      expect(repeatedA).toEqual(concurrentHashes[0]);
      expect(repeatedB).toEqual(concurrentHashes[1]);

      const state = await getEChartsRenderWorkerState();
      expect(state).toMatchObject({
        workerCreated: true,
        echartsLoaded: true,
        spawnCount: 1,
        loadCount: 1,
        queuedJobs: 0,
        activeJobs: 0,
        maxActiveJobs: 1,
        geoRegistrySize: 1,
        randomRestored: true,
        clockGuardRestored: true,
        ambientAccesses: 0,
      });
      expect(state.chartsCreated).toBe(state.chartsDisposed);
      emitEvidence("concurrency", {
        serverCap: cap,
        callCount: inputs.length,
        elapsedMs,
        geoContentHashes: concurrentHashes
          .slice(0, 2)
          .map((item) => item.contentHash),
        geoRenderHashes: concurrentHashes
          .slice(0, 2)
          .map((item) => item.renderHash),
        state,
      });
    });

    it("pins fresh startup/first-use, warm treemap, and force-size p95 budgets", () => {
      const entryHref = pathToFileURL(
        fileURLToPath(
          new URL("../../../viz-render/dist/index.js", import.meta.url),
        ),
      ).href;
      const treemap = projectedOption(operandFor("treemap"));
      const force100 = forceOptionWithNodeCount(100);
      const force250 = forceOptionWithNodeCount(250);
      const freshSource = `
      const finish = (value) => process.stdout.write(JSON.stringify(value), () => process.exit(0));
      try {
        const option = JSON.parse(process.env.OODS_SOAK_TREEMAP_OPTION);
        const importStarted = performance.now();
        const api = await import(${JSON.stringify(entryHref)});
        const importedAt = performance.now();
        const startup = await api.sampleEChartsRenderWorkerResources({ forceGc: true });
        const workerStartedAt = performance.now();
        const svg = await api.renderEChartsToSvg(option);
        const firstRenderedAt = performance.now();
        if (!svg.startsWith('<svg')) throw new Error('Expected first-use SVG.');
        finish({
          packageImportMs: importedAt - importStarted,
          workerStartupMs: workerStartedAt - importedAt,
          incrementalFirstUseMs: firstRenderedAt - workerStartedAt,
          startupPlusFirstUseMs: firstRenderedAt - importedAt,
          startupLoadCount: startup.metrics.loadCount,
          startupForcedGc: startup.forcedGc,
        });
      } catch (error) {
        process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
      }
    `;
      const freshTrials = Array.from({ length: 10 }, () =>
        runFreshNode<FreshTrial>(freshSource, {
          OODS_SOAK_TREEMAP_OPTION: JSON.stringify(treemap),
        }),
      );
      expect(freshTrials.every((trial) => trial.startupLoadCount === 0)).toBe(
        true,
      );
      expect(freshTrials.every((trial) => trial.startupForcedGc)).toBe(true);

      const latencySource = `
      const finish = (value) => process.stdout.write(JSON.stringify(value), () => process.exit(0));
      const sample = async (api, option, count) => {
        const samples = [];
        for (let index = 0; index < count; index += 1) {
          const startedAt = performance.now();
          await api.renderEChartsToSvg(option);
          samples.push(performance.now() - startedAt);
        }
        return samples;
      };
      try {
        const api = await import(${JSON.stringify(entryHref)});
        const treemap = JSON.parse(process.env.OODS_SOAK_TREEMAP_OPTION);
        const force100 = JSON.parse(process.env.OODS_SOAK_FORCE100_OPTION);
        const force250 = JSON.parse(process.env.OODS_SOAK_FORCE250_OPTION);
        await api.renderEChartsToSvg(treemap);
        const warmTreemapMs = await sample(api, treemap, 50);
        const force100Ms = await sample(api, force100, 8);
        const force250Ms = await sample(api, force250, 5);
        finish({ warmTreemapMs, force100Ms, force250Ms });
      } catch (error) {
        process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
      }
    `;
      const latency = runFreshNode<LatencyRun>(latencySource, {
        OODS_SOAK_TREEMAP_OPTION: JSON.stringify(treemap),
        OODS_SOAK_FORCE100_OPTION: JSON.stringify(force100),
        OODS_SOAK_FORCE250_OPTION: JSON.stringify(force250),
      });

      const measured = {
        packageImportP95Ms: p95(
          freshTrials.map((trial) => trial.packageImportMs),
        ),
        workerStartupP95Ms: p95(
          freshTrials.map((trial) => trial.workerStartupMs),
        ),
        incrementalFirstUseP95Ms: p95(
          freshTrials.map((trial) => trial.incrementalFirstUseMs),
        ),
        startupPlusFirstUseP95Ms: p95(
          freshTrials.map((trial) => trial.startupPlusFirstUseMs),
        ),
        warmTreemapP95Ms: p95(latency.warmTreemapMs),
        force100P95Ms: p95(latency.force100Ms),
        force250P95Ms: p95(latency.force250Ms),
      };
      for (const [metric, value] of Object.entries(measured)) {
        expect(value, metric).toBeLessThanOrEqual(
          BUDGETS[metric as keyof typeof BUDGETS],
        );
      }
      emitEvidence("latency", {
        percentileMethod: "nearest-rank sorted[ceil(0.95*n)-1]",
        freshTrialCount: freshTrials.length,
        warmTreemapSamples: latency.warmTreemapMs.length,
        force100Samples: latency.force100Ms.length,
        force250Samples: latency.force250Ms.length,
        measured,
        budgets: BUDGETS,
        freshTrials,
      });
    });

    it("plateaus after 100 warmups plus 2,000 unique-geo renders and disposes faulted charts", async () => {
      const base = projectedOption(operandFor("choropleth"));
      const entryHref = pathToFileURL(
        fileURLToPath(
          new URL("../../../viz-render/dist/index.js", import.meta.url),
        ),
      ).href;
      const soakSource = `
      const finish = (value) => process.stdout.write(JSON.stringify(value), () => process.exit(0));
      try {
        const { createHash } = await import('node:crypto');
        const api = await import(${JSON.stringify(entryHref)});
        const base = JSON.parse(process.env.OODS_SOAK_GEO_OPTION);
        const settledResourceSample = async () => {
          let metrics = null;
          let workerHeapUsedBytes = Number.POSITIVE_INFINITY;
          let processRssBytes = Number.POSITIVE_INFINITY;
          for (let attempt = 0; attempt < ${RESOURCE_SAMPLE_ATTEMPTS}; attempt += 1) {
            globalThis.gc?.();
            await new Promise((resolve) => setImmediate(resolve));
            const sample = await api.sampleEChartsRenderWorkerResources({ forceGc: true });
            if (!sample.forcedGc) throw new Error('Worker forced GC is unavailable.');
            metrics = sample.metrics;
            workerHeapUsedBytes = Math.min(workerHeapUsedBytes, sample.workerHeapUsedBytes);
            processRssBytes = Math.min(processRssBytes, sample.processRssBytes);
          }
          return { metrics, workerHeapUsedBytes, processRssBytes };
        };
        const withIdentity = (source, index) => {
          const option = structuredClone(source);
          const name = 'soak-caller-map-' + index;
          const registration = option.__registration;
          registration.name = name;
          const feature = registration.geoJson.features[1];
          const ring = feature.geometry.coordinates[0];
          const delta = (index + 1) / 10000;
          ring[1][0] -= delta;
          ring[2][0] -= index % 2 === 0 ? delta : delta * 2;
          option.geo.map = name;
          for (const series of option.series) {
            if ('map' in series) series.map = name;
          }
          return option;
        };
        for (let index = 0; index < ${WARMUP_RENDERS}; index += 1) {
          await api.renderEChartsToSvg(base);
        }
        const baseline = await settledResourceSample();
        const samples = [{
          renderCount: 0,
          workerHeapUsedBytes: baseline.workerHeapUsedBytes,
          processRssBytes: baseline.processRssBytes,
        }];
        let finalGeometryHash = '';
        for (let window = 0; window < ${MEASURED_RENDERS / WINDOW_SIZE}; window += 1) {
          for (let offset = 0; offset < ${WINDOW_SIZE}; offset += 1) {
            const index = window * ${WINDOW_SIZE} + offset;
            const option = withIdentity(base, index);
            finalGeometryHash = createHash('sha256')
              .update(JSON.stringify(option.__registration.geoJson))
              .digest('hex');
            await api.renderEChartsToSvg(option);
          }
          const sample = await settledResourceSample();
          if (sample.metrics.lastGeometryHash !== finalGeometryHash) {
            throw new Error('Worker geometry hash does not match the most recent FeatureCollection.');
          }
          if (sample.metrics.geoRegistrySize !== 1) {
            throw new Error('Worker geo registry did not remain bounded at one alias.');
          }
          if (sample.metrics.chartsCreated !== sample.metrics.chartsDisposed) {
            throw new Error('A chart was not disposed inside a completed soak window.');
          }
          samples.push({
            renderCount: (window + 1) * ${WINDOW_SIZE},
            workerHeapUsedBytes: sample.workerHeapUsedBytes,
            processRssBytes: sample.processRssBytes,
          });
        }
        const beforeFault = (await api.getEChartsRenderWorkerState());
        let faultCode = null;
        try {
          await api.renderEChartsToSvg({
            ...base,
            __oodsTestForceRenderFault: 'after-chart-created',
          });
        } catch (error) {
          faultCode = error?.code ?? null;
        }
        const afterFault = (await settledResourceSample()).metrics;
        finish({ samples, finalGeometryHash, faultCode, beforeFault, afterFault });
      } catch (error) {
        process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
      }
    `;
      const run = runFreshNode<ResourceSoakRun>(soakSource, {
        NODE_ENV: "test",
        OODS_SOAK_GEO_OPTION: JSON.stringify(base),
      });
      const { samples, finalGeometryHash, beforeFault, afterFault } = run;
      expect(samples).toHaveLength(MEASURED_RENDERS / WINDOW_SIZE + 1);
      expect(finalGeometryHash).toMatch(/^[a-f0-9]{64}$/);
      expect(run.faultCode).toBe("ECHARTS_RENDER_FAULT");

      const workerHeapDeltaBytes =
        samples.at(-1)!.workerHeapUsedBytes - samples[0].workerHeapUsedBytes;
      // Retain the measurements even when a later release assertion fails (#1442).
      // Emitting evidence does not change any sampling window or threshold.
      emitEvidence("resources-observed", {
        warmupRenders: WARMUP_RENDERS,
        measuredRenders: MEASURED_RENDERS,
        plateauWindowRange: "1300..2000",
        workerHeapDeltaBytes,
        heapTrend: leastSquaresTrend(samples.slice(PLATEAU_SAMPLE_START).map(sample => sample.workerHeapUsedBytes)),
        rssTrend: leastSquaresTrend(samples.slice(PLATEAU_SAMPLE_START).map(sample => sample.processRssBytes)),
        samples,
        beforeFault,
        afterFault,
        budgets: BUDGETS,
      });
      expect(workerHeapDeltaBytes).toBeLessThanOrEqual(
        BUDGETS.workerHeapAbsoluteDeltaBytes,
      );
      const plateauSamples = samples.slice(PLATEAU_SAMPLE_START);
      const heapPlateau = plateauEvidence(
        plateauSamples.map((sample) => sample.workerHeapUsedBytes),
        BUDGETS.workerHeapSlopeBytesPerWindow,
      );
      const rssPlateau = plateauEvidence(
        plateauSamples.map((sample) => sample.processRssBytes),
        BUDGETS.processRssSlopeBytesPerWindow,
      );

      expect(afterFault.renderFaults).toBe(beforeFault.renderFaults + 1);
      expect(afterFault.chartsCreated).toBe(beforeFault.chartsCreated + 1);
      expect(afterFault.chartsDisposed).toBe(beforeFault.chartsDisposed + 1);
      expect(afterFault.chartsCreated).toBe(afterFault.chartsDisposed);
      expect(afterFault.activeCharts).toBe(0);
      expect(afterFault).toMatchObject({
        geoRegistrationCount: WARMUP_RENDERS + MEASURED_RENDERS,
        geoRegistrySize: 1,
        lastGeometryHash: finalGeometryHash,
        randomRestored: true,
        clockGuardRestored: true,
        ambientAccesses: 0,
      });

      emitEvidence("resources", {
        warmupRenders: WARMUP_RENDERS,
        measuredRenders: MEASURED_RENDERS,
        uniqueCallerGeoIds: MEASURED_RENDERS,
        sampleWindowRenders: WINDOW_SIZE,
        resourceSampleAttempts: RESOURCE_SAMPLE_ATTEMPTS,
        plateauWindowRange: "1300..2000",
        slopeThresholdMeaning:
          "hard outlier ceilings determine pass/fail; the one-sided 99% confidence bound is diagnostic and does not establish retention certification",
        workerHeapDeltaBytes,
        heapPlateau,
        rssPlateau,
        samples,
        finalState: afterFault,
        budgets: BUDGETS,
      });
    });
  },
);
