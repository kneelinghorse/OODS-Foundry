import { parentPort } from "node:worker_threads";
import {
  getWorkerMetrics,
  renderEChartsInWorker,
  sampleWorkerResources,
} from "./echarts-worker-runtime.js";
import {
  serializeEChartsRenderError,
  type EChartsWorkerRequest,
  type EChartsWorkerResponse,
} from "./echarts-worker-protocol.js";

if (!parentPort) {
  throw new Error(
    "The ECharts renderer entry must run inside a worker thread.",
  );
}

const workerPort = parentPort;
let queue: Promise<void> = Promise.resolve();

workerPort.on("message", (request: EChartsWorkerRequest) => {
  queue = queue.then(() => handleRequest(request));
});

async function handleRequest(request: EChartsWorkerRequest): Promise<void> {
  if (request.kind === "state") {
    post({
      kind: "state-result",
      requestId: request.requestId,
      metrics: getWorkerMetrics(),
      resources: sampleWorkerResources(request.forceGc),
    });
    return;
  }

  try {
    const svg = await renderEChartsInWorker(request);
    post({
      kind: "render-result",
      requestId: request.requestId,
      svg,
      metrics: getWorkerMetrics(),
    });
  } catch (error) {
    post({
      kind: "render-error",
      requestId: request.requestId,
      error: serializeEChartsRenderError(error),
      metrics: getWorkerMetrics(),
    });
  }
}

function post(response: EChartsWorkerResponse): void {
  workerPort.postMessage(response);
}
