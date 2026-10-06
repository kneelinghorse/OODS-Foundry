import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  EChartsRenderError,
  prepareEChartsRenderInput,
  type EChartsRenderWorkerState,
  type EChartsSsrDimensions,
  type EChartsWorkerMetrics,
  type EChartsWorkerResourceSample,
  type EChartsWorkerRequest,
  type EChartsWorkerResponse,
  type EChartsWorkerTestHooks,
} from "./echarts-worker-protocol.js";

interface PendingWorkerRequest {
  readonly resolve: (svg: string) => void;
  readonly reject: (error: Error) => void;
}

interface PendingStateRequest {
  readonly resolve: (sample: EChartsWorkerResourceSample) => void;
  readonly reject: (error: Error) => void;
}

const initialMetrics: EChartsWorkerMetrics = {
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

let worker: Worker | undefined;
let workerFailure: EChartsRenderError | undefined;
let spawnCount = 0;
let requestSequence = 0;
let queuedJobs = 0;
let activeDispatches = 0;
let latestMetrics = initialMetrics;
let renderQueue: Promise<void> = Promise.resolve();
const pendingRequests = new Map<number, PendingWorkerRequest>();
const pendingStateRequests = new Map<number, PendingStateRequest>();

/** MCP startup pays the cold import/render cost before accepting tool requests.
 * Cold filesystem reads on supported Docker bind mounts can exceed ten seconds;
 * allow one bounded minute without delaying an actual worker fault.
 */
export async function warmEChartsRenderWorker(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      renderEChartsToSvg({ animation: false, series: [{ type: 'treemap', data: [] }] }, { width: 1, height: 1 }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new EChartsRenderError('ECHARTS_WORKER_FAULT', 'ECharts worker warm-up exceeded 60 seconds.')), 60_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/**
 * Render one JSON-projected ECharts option through the process-wide worker.
 *
 * Validation happens before worker creation. Jobs are serialized because ECharts
 * map registration, generated-token counters, text caches, and the temporary
 * force RNG hook are all worker-realm global state.
 */
export async function renderEChartsToSvg(
  projectedOption: Readonly<Record<string, unknown>>,
  dimensions?: EChartsSsrDimensions,
): Promise<string> {
  const { option, testHooks } = extractTestHooks(projectedOption);
  const prepared = prepareEChartsRenderInput(option, dimensions);
  queuedJobs += 1;

  const result = renderQueue.then(async () => {
    activeDispatches = 1;
    try {
      return await dispatchRender({
        kind: "render",
        requestId: ++requestSequence,
        projectedOption: prepared.projectedOption,
        dimensions: prepared.dimensions,
        ...(testHooks ? { testHooks } : {}),
      });
    } finally {
      activeDispatches = 0;
      queuedJobs -= 1;
    }
  });
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Return the last worker-originated counters without creating or messaging a
 * worker. Awaitability keeps the probe API stable if a future version needs an
 * out-of-band state sample; v1 remains a zero-cost snapshot.
 */
export async function getEChartsRenderWorkerState(): Promise<
  Readonly<EChartsRenderWorkerState>
> {
  return {
    ...latestMetrics,
    activeJobs: Math.max(latestMetrics.activeJobs, activeDispatches),
    maxActiveJobs: Math.max(latestMetrics.maxActiveJobs, activeDispatches),
    workerCreated: spawnCount > 0,
    echartsLoaded: latestMetrics.loadCount > 0,
    spawnCount,
    queuedJobs,
  };
}

/**
 * Ask the real worker for a resource sample. Unlike the cached startup probe,
 * this explicit API may create the worker; it does not import ECharts and is
 * serialized with render jobs so a sample never races a chart lifecycle.
 */
export async function sampleEChartsRenderWorkerResources(options?: {
  readonly forceGc?: boolean;
}): Promise<Readonly<EChartsWorkerResourceSample>> {
  const result = renderQueue.then(() =>
    dispatchState({
      kind: "state",
      requestId: ++requestSequence,
      forceGc: options?.forceGc === true,
    }),
  );
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function dispatchRender(
  request: Extract<EChartsWorkerRequest, { readonly kind: "render" }>,
): Promise<string> {
  const renderWorker = getOrCreateWorker();
  renderWorker.ref();

  return new Promise<string>((resolve, reject) => {
    pendingRequests.set(request.requestId, {
      resolve: (svg) => {
        renderWorker.unref();
        resolve(svg);
      },
      reject: (error) => {
        renderWorker.unref();
        reject(error);
      },
    });
    try {
      renderWorker.postMessage(request);
    } catch (error) {
      pendingRequests.delete(request.requestId);
      renderWorker.unref();
      reject(asWorkerFault("Failed to send an ECharts render job.", error));
    }
  });
}

function dispatchState(
  request: Extract<EChartsWorkerRequest, { readonly kind: "state" }>,
): Promise<EChartsWorkerResourceSample> {
  const renderWorker = getOrCreateWorker();
  renderWorker.ref();
  return new Promise<EChartsWorkerResourceSample>((resolve, reject) => {
    pendingStateRequests.set(request.requestId, {
      resolve: (sample) => {
        renderWorker.unref();
        resolve(sample);
      },
      reject: (error) => {
        renderWorker.unref();
        reject(error);
      },
    });
    try {
      renderWorker.postMessage(request);
    } catch (error) {
      pendingStateRequests.delete(request.requestId);
      renderWorker.unref();
      reject(
        asWorkerFault("Failed to request ECharts worker resources.", error),
      );
    }
  });
}

function getOrCreateWorker(): Worker {
  if (workerFailure) {
    throw workerFailure;
  }
  if (worker) {
    return worker;
  }

  const filteredExecArgv = process.execArgv.filter(
    (argument) => !argument.startsWith("--input-type"),
  );
  // `--input-type` is valid only for eval/stdin entry points. Inheriting it
  // would make a file-backed worker fail before this package evaluates. When
  // no filtering is needed, let Node inherit flags itself: explicitly passing
  // `--expose-gc` in WorkerOptions is rejected even though Node can safely
  // inherit it from a file/eval parent, which the opt-in resource probe uses.
  const created = new Worker(
    resolveWorkerUrl(),
    filteredExecArgv.length === process.execArgv.length
      ? undefined
      : {
          execArgv: filteredExecArgv.filter(
            (argument) => argument !== "--expose-gc",
          ),
        },
  );
  worker = created;
  spawnCount += 1;
  created.unref();
  created.on("message", handleWorkerMessage);
  created.on("error", (error) => {
    failWorker("The ECharts render worker raised an error.", error);
  });
  created.on("exit", (code) => {
    if (
      code !== 0 ||
      pendingRequests.size > 0 ||
      pendingStateRequests.size > 0
    ) {
      failWorker(
        `The ECharts render worker exited before completing its work (code ${code}).`,
      );
    }
  });
  return created;
}

function handleWorkerMessage(response: EChartsWorkerResponse): void {
  latestMetrics = response.metrics;
  if (response.kind === "state-result") {
    const pendingState = pendingStateRequests.get(response.requestId);
    if (!pendingState) return;
    pendingStateRequests.delete(response.requestId);
    pendingState.resolve({ ...response.resources, metrics: response.metrics });
    return;
  }
  const pending = pendingRequests.get(response.requestId);
  if (!pending) {
    return;
  }
  pendingRequests.delete(response.requestId);
  if (response.kind === "render-result") {
    pending.resolve(response.svg);
  } else {
    pending.reject(
      new EChartsRenderError(response.error.code, response.error.message),
    );
  }
}

function failWorker(message: string, cause?: unknown): void {
  const error = asWorkerFault(message, cause);
  workerFailure = error;
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
  for (const pending of pendingStateRequests.values()) {
    pending.reject(error);
  }
  pendingStateRequests.clear();
}

function asWorkerFault(message: string, cause?: unknown): EChartsRenderError {
  return new EChartsRenderError("ECHARTS_WORKER_FAULT", message, { cause });
}

function resolveWorkerUrl(): URL {
  const isCommonJs =
    typeof __filename === "string" && __filename.endsWith(".cjs");
  const extension = isCommonJs ? "cjs" : "js";
  const moduleUrl = isCommonJs
    ? pathToFileURL(__filename)
    : new URL(import.meta.url);
  const fromSource = moduleUrl.pathname.endsWith("/src/echarts-renderer.ts");
  return new URL(
    fromSource
      ? `../dist/echarts-render.worker.${extension}`
      : `./echarts-render.worker.${extension}`,
    moduleUrl,
  );
}

function extractTestHooks(projectedOption: Readonly<Record<string, unknown>>): {
  readonly option: Readonly<Record<string, unknown>>;
  readonly testHooks?: EChartsWorkerTestHooks;
} {
  const runtimeValue: unknown = projectedOption;
  if (
    process.env.NODE_ENV !== "test" ||
    runtimeValue === null ||
    typeof runtimeValue !== "object" ||
    Array.isArray(runtimeValue)
  ) {
    return { option: projectedOption };
  }

  const forceRenderFault =
    projectedOption.__oodsTestForceRenderFault === "after-chart-created";
  const forceUnreadableSvg = projectedOption.__oodsTestUnreadableSvg === true;
  const skipGeoRegistration =
    projectedOption.__oodsTestSkipGeoRegistration === true;
  if (!forceRenderFault && !forceUnreadableSvg && !skipGeoRegistration) {
    return { option: projectedOption };
  }

  const option = { ...projectedOption };
  delete option.__oodsTestForceRenderFault;
  delete option.__oodsTestUnreadableSvg;
  delete option.__oodsTestSkipGeoRegistration;
  return {
    option,
    testHooks: {
      ...(forceRenderFault
        ? { forceRenderFault: "after-chart-created" as const }
        : {}),
      ...(forceUnreadableSvg ? { forceUnreadableSvg: true as const } : {}),
      ...(skipGeoRegistration ? { skipGeoRegistration: true as const } : {}),
    },
  };
}
