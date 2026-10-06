// s179 m05 — the public stable bit is the conjunction of the independent option
// emission proof and the independent normalized-render proof. This file isolates the
// option half while leaving both real renders byte-stable.

import { describe, expect, it, vi } from "vitest";

const optionProof = vi.hoisted(() => ({ forceUnstable: true }));

vi.mock("../../src/tools/certify-echarts-emit.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/tools/certify-echarts-emit.js")
    >();
  return {
    ...actual,
    evaluateEChartsDeterminism: (
      ...args: Parameters<typeof actual.evaluateEChartsDeterminism>
    ) => {
      const outcome = actual.evaluateEChartsDeterminism(...args);
      if (!outcome.ok || !optionProof.forceUnstable) return outcome;
      return {
        ...outcome,
        stable: false,
        secondCanonical: `${outcome.secondCanonical} `,
      };
    },
  };
});

import type { NormalizedVizSpec } from "@oods/viz-core";
import { handle as certify } from "../../src/tools/artifact.certify.js";
import { HIERARCHY_BRANCH } from "./s172-echarts-operands.js";

const TREEMAP_SPEC = {
  $schema: "https://oods-foundry.com/viz-spec/v1",
  id: "viz:treemap",
  name: "Option stability discriminator",
  data: { values: [] },
  marks: [{ trait: "MarkTreemap" }],
  encoding: {},
  a11y: { description: "Treemap option stability discriminator." },
} as NormalizedVizSpec;

describe("artifact.certify — option stability remains load-bearing (s179 m05)", () => {
  it("fails the combined proof when emissions differ even though both renders agree", async () => {
    optionProof.forceUnstable = true;
    const out = await certify({
      spec: TREEMAP_SPEC,
      data: { hierarchy: HIERARCHY_BRANCH },
    });

    expect(out.determinism).toEqual({
      stable: false,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      renderHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(out.pillars?.determinism).toBe("fail");
    expect(out.pillars?.contrast).toBe("pass");
    expect(out.notes?.join(" ")).toContain(
      "independently emitted projected ECharts options differed",
    );
  });

  it("disarmed control passes through the same two-render path", async () => {
    optionProof.forceUnstable = false;
    try {
      const out = await certify({
        spec: TREEMAP_SPEC,
        data: { hierarchy: HIERARCHY_BRANCH },
      });
      expect(out.determinism?.stable).toBe(true);
      expect(out.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
      expect(out.pillars?.determinism).toBe("pass");
    } finally {
      optionProof.forceUnstable = true;
    }
  });
});
