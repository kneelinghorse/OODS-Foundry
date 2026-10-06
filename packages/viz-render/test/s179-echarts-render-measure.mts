import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform, release } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProjectedOption } from "../../viz-core/test/s179-echarts-render-harness.js";
import { ECHARTS_OPERAND_CASES } from "../../viz-core/test/fixtures/s172-echarts-operands.js";

type ProjectedOption = Record<string, unknown>;

interface FreshTrial {
  readonly packageImportMs: number;
  readonly firstRenderMs: number;
  readonly totalFirstUseMs: number;
}

interface WorkerState {
  readonly workerCreated: boolean;
  readonly echartsLoaded: boolean;
  readonly spawnCount: number;
  readonly loadCount: number;
  readonly queuedJobs: number;
  readonly activeJobs: number;
  readonly maxActiveJobs: number;
  readonly completedJobs: number;
  readonly chartsCreated: number;
  readonly chartsDisposed: number;
  readonly activeCharts: number;
  readonly renderFaults: number;
  readonly geoRegistrationCount: number;
  readonly geoRegistrySize: number;
  readonly randomRestored: boolean;
  readonly clockGuardRestored: boolean;
  readonly ambientAccesses: number;
}

interface WarmRun {
  readonly treemapSamplesMs: readonly number[];
  readonly force250SamplesMs: readonly number[];
  readonly rssBeforeImportBytes: number;
  readonly rssAfterMeasurementsBytes: number;
  readonly workerState: WorkerState;
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = new URL("../dist/", import.meta.url);
const esmIndexUrl = new URL("index.js", distRoot);

function canonicalOption(chartType: string): ProjectedOption {
  const operand = ECHARTS_OPERAND_CASES.find(
    (candidate) => candidate.chartType === chartType,
  );
  if (!operand) {
    throw new Error(`Missing canonical ${chartType} operand.`);
  }
  return buildProjectedOption(operand);
}

function forceOptionAtRatifiedCeiling(): ProjectedOption {
  const option = canonicalOption("force_graph");
  const series = (
    option.series as Array<Record<string, unknown>> | undefined
  )?.[0];
  if (!series) {
    throw new Error("Canonical force_graph option has no series.");
  }

  series.label = { show: false };
  series.data = Array.from({ length: 250 }, (_, index) => ({
    id: `node-${index}`,
    name: `node-${index}`,
    value: index % 2,
    category: index % 2,
    symbolSize: 2,
  }));
  series.links = Array.from({ length: 249 }, (_, index) => ({
    source: `node-${index}`,
    target: `node-${index + 1}`,
    value: 1,
  }));
  return option;
}

function childEnvironment(
  values: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...values };
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
    ["--input-type=module", "--eval", source],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: childEnvironment(environment),
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(
      `Fresh Node measurement failed (status=${String(child.status)}, signal=${String(child.signal)}): ${child.stderr}`,
    );
  }
  return JSON.parse(child.stdout) as T;
}

function sha256File(url: URL): string {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function packageVersion(packageJsonPath: string): string {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: unknown;
  };
  if (typeof parsed.version !== "string") {
    throw new Error(`Package metadata at ${packageJsonPath} has no version.`);
  }
  return parsed.version;
}

function p95(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new Error("Cannot compute p95 from an empty sample.");
  }
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

const treemapOption = canonicalOption("treemap");
const force250Option = forceOptionAtRatifiedCeiling();
const entryHref = pathToFileURL(fileURLToPath(esmIndexUrl)).href;

const freshChildSource = `
  const finish = (value) => {
    process.stdout.write(JSON.stringify(value), () => process.exit(0));
  };
  try {
    const option = JSON.parse(process.env.OODS_MEASURE_TREEMAP_OPTION);
    const startedAt = performance.now();
    const api = await import(${JSON.stringify(entryHref)});
    const importedAt = performance.now();
    const svg = await api.renderEChartsToSvg(option);
    const renderedAt = performance.now();
    if (!svg.startsWith('<svg')) throw new Error('Expected an SVG render.');
    finish({
      packageImportMs: importedAt - startedAt,
      firstRenderMs: renderedAt - importedAt,
      totalFirstUseMs: renderedAt - startedAt,
    });
  } catch (error) {
    process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
  }
`;

const freshTrials: FreshTrial[] = [];
for (let trial = 0; trial < 10; trial += 1) {
  freshTrials.push(
    runFreshNode<FreshTrial>(freshChildSource, {
      OODS_MEASURE_TREEMAP_OPTION: JSON.stringify(treemapOption),
    }),
  );
}

const warmChildSource = `
  const finish = (value) => {
    process.stdout.write(JSON.stringify(value), () => process.exit(0));
  };
  try {
    const treemap = JSON.parse(process.env.OODS_MEASURE_TREEMAP_OPTION);
    const force250 = JSON.parse(process.env.OODS_MEASURE_FORCE_OPTION);
    const rssBeforeImportBytes = process.memoryUsage().rss;
    const api = await import(${JSON.stringify(entryHref)});

    await api.renderEChartsToSvg(treemap);
    const treemapSamplesMs = [];
    for (let index = 0; index < 50; index += 1) {
      const startedAt = performance.now();
      await api.renderEChartsToSvg(treemap);
      treemapSamplesMs.push(performance.now() - startedAt);
    }

    const force250SamplesMs = [];
    for (let index = 0; index < 5; index += 1) {
      const startedAt = performance.now();
      await api.renderEChartsToSvg(force250);
      force250SamplesMs.push(performance.now() - startedAt);
    }

    const workerState = await api.getEChartsRenderWorkerState();
    const rssAfterMeasurementsBytes = process.memoryUsage().rss;
    finish({
      treemapSamplesMs,
      force250SamplesMs,
      rssBeforeImportBytes,
      rssAfterMeasurementsBytes,
      workerState,
    });
  } catch (error) {
    process.stderr.write(String(error?.stack ?? error), () => process.exit(1));
  }
`;

const warmRun = runFreshNode<WarmRun>(warmChildSource, {
  OODS_MEASURE_TREEMAP_OPTION: JSON.stringify(treemapOption),
  OODS_MEASURE_FORCE_OPTION: JSON.stringify(force250Option),
});

function validateFinalWorkerCounters(state: WorkerState): void {
  const violations: string[] = [];
  if (!state.workerCreated || state.spawnCount !== 1) {
    violations.push(
      `expected one created worker, observed spawnCount=${state.spawnCount}`,
    );
  }
  if (!state.echartsLoaded || state.loadCount !== 1) {
    violations.push(
      `expected one ECharts load, observed loadCount=${state.loadCount}`,
    );
  }
  if (state.maxActiveJobs !== 1) {
    violations.push(
      `expected serialized maxActiveJobs=1, observed ${state.maxActiveJobs}`,
    );
  }
  if (
    state.queuedJobs !== 0 ||
    state.activeJobs !== 0 ||
    state.activeCharts !== 0
  ) {
    violations.push(
      `expected idle final state, observed queued=${state.queuedJobs}, activeJobs=${state.activeJobs}, activeCharts=${state.activeCharts}`,
    );
  }
  if (state.chartsCreated !== state.chartsDisposed) {
    violations.push(
      `expected balanced charts, observed created=${state.chartsCreated}, disposed=${state.chartsDisposed}`,
    );
  }
  if (state.completedJobs !== 56) {
    violations.push(
      `expected 56 completed jobs, observed ${state.completedJobs}`,
    );
  }
  if (violations.length > 0) {
    throw new Error(
      `Worker measurement contract failed: ${violations.join("; ")}`,
    );
  }
}

validateFinalWorkerCounters(warmRun.workerState);

const requireFromVizRender = createRequire(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const echartsPackageJson = requireFromVizRender.resolve("echarts/package.json");
const requireFromECharts = createRequire(echartsPackageJson);
const zrenderPackageJson = requireFromECharts.resolve("zrender/package.json");

const report = {
  schema: "oods.s179.echarts-render-measure.v1",
  measuredAt: new Date().toISOString(),
  runtime: {
    node: process.version,
    v8: process.versions.v8,
    platform: platform(),
    osRelease: release(),
    arch: arch(),
  },
  resolvedDependencies: {
    echarts: packageVersion(echartsPackageJson),
    zrender: packageVersion(zrenderPackageJson),
  },
  builtArtifactSha256: {
    esmIndex: sha256File(new URL("index.js", distRoot)),
    esmWorker: sha256File(new URL("echarts-render.worker.js", distRoot)),
    cjsIndex: sha256File(new URL("index.cjs", distRoot)),
    cjsWorker: sha256File(new URL("echarts-render.worker.cjs", distRoot)),
  },
  percentileMethod: "nearest-rank: sorted[ceil(0.95 * n) - 1]",
  freshFirstUse: {
    trialCount: freshTrials.length,
    samplesMs: freshTrials,
    p95Ms: {
      packageImport: p95(freshTrials.map((trial) => trial.packageImportMs)),
      firstRender: p95(freshTrials.map((trial) => trial.firstRenderMs)),
      totalFirstUse: p95(freshTrials.map((trial) => trial.totalFirstUseMs)),
    },
  },
  warmedWorker: {
    warmupTreemapRenders: 1,
    treemap: {
      sampleCount: warmRun.treemapSamplesMs.length,
      samplesMs: warmRun.treemapSamplesMs,
      p95Ms: p95(warmRun.treemapSamplesMs),
    },
    forceAtRatifiedCeiling: {
      nodeCount: 250,
      sampleCount: warmRun.force250SamplesMs.length,
      samplesMs: warmRun.force250SamplesMs,
      p95Ms: p95(warmRun.force250SamplesMs),
    },
    rssObservation: {
      scope:
        "process-wide RSS sampled from the client process; this is not worker-side heap evidence and not a plateau measurement",
      beforeImportBytes: warmRun.rssBeforeImportBytes,
      afterMeasurementsBytes: warmRun.rssAfterMeasurementsBytes,
      deltaBytes:
        warmRun.rssAfterMeasurementsBytes - warmRun.rssBeforeImportBytes,
    },
    finalWorkerCounters: warmRun.workerState,
  },
  interpretation:
    "Observations only. This script makes no budget assertion and does not establish a memory plateau or certified runtime matrix.",
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () =>
  process.exit(0),
);
