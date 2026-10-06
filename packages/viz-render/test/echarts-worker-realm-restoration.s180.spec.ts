import { describe, expect, it } from "vitest";
import {
  getWorkerMetrics,
  renderEChartsInWorker,
} from "../src/echarts-worker-runtime.js";

describe("s180 ECharts worker realm restoration", () => {
  it("restores the exact RNG and clock references after an in-process force job", async () => {
    const ambientRandom = Math.random;
    const ambientDate = globalThis.Date;
    let observedRandom: typeof Math.random | undefined;
    let observedDate: DateConstructor | undefined;

    try {
      const svg = await renderEChartsInWorker({
        kind: "render",
        requestId: 1,
        dimensions: { width: 600, height: 400 },
        projectedOption: {
          series: [
            {
              type: "graph",
              layout: "force",
              data: [
                { id: "left", name: "Left", value: 1 },
                { id: "right", name: "Right", value: 2 },
              ],
              links: [{ source: "left", target: "right", value: 1 }],
            },
          ],
        },
      });

      expect(svg).toContain('ecmeta_ssr_type="chart"');
    } finally {
      observedRandom = Math.random;
      observedDate = globalThis.Date;
      Math.random = ambientRandom;
      globalThis.Date = ambientDate;
    }

    expect(getWorkerMetrics()).toMatchObject({
      randomRestored: true,
      clockGuardRestored: true,
    });
    expect.soft(observedRandom).toBe(ambientRandom);
    expect.soft(observedDate).toBe(ambientDate);
  });
});
