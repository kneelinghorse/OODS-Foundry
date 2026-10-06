// s179 m05 — artifact.certify must grade and hash the normalized SVG rendered from
// the retained projected ECharts option. The second render must consume the second
// independent projection, so neither render nondeterminism nor option-emission drift
// can hide behind the option hash.

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderProbe = vi.hoisted(() => ({
  calls: [] as Readonly<Record<string, unknown>>[],
  mode: "pass" as "pass" | "first-fault" | "second-fault" | "second-diff",
}));

vi.mock("@oods/viz-render", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@oods/viz-render")>();
  return {
    ...actual,
    renderEChartsToSvg: async (
      projectedOption: Readonly<Record<string, unknown>>,
    ): Promise<string> => {
      renderProbe.calls.push(projectedOption);
      const call = renderProbe.calls.length;
      if (renderProbe.mode === "first-fault" && call === 1) {
        throw new actual.EChartsRenderError(
          "ECHARTS_RENDER_FAULT",
          "synthetic first-render fault",
        );
      }
      if (renderProbe.mode === "second-fault" && call === 2) {
        throw new actual.EChartsRenderError(
          "ECHARTS_RENDER_FAULT",
          "synthetic second-render fault",
        );
      }
      const svg = await actual.renderEChartsToSvg(projectedOption);
      return renderProbe.mode === "second-diff" && call === 2
        ? `${svg}\n<!-- synthetic second-render difference -->`
        : svg;
    },
  };
});

import type { NormalizedVizSpec } from "@oods/viz-core";
import { getAjv } from "../../src/lib/ajv.js";
import { handle as certify } from "../../src/tools/artifact.certify.js";
import { handle as vizRender } from "../../src/tools/viz.render.js";
import {
  ECHARTS_OPERAND_CASES,
  GEO_BUBBLE_NO_GEOMETRY_BRANCH,
  renderInputFor,
  type EChartsOperandCase,
} from "./s172-echarts-operands.js";

const outputSchema = JSON.parse(
  readFileSync(
    new URL("../../src/schemas/artifact.certify.output.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

const NESTED_SUNBURST = {
  type: "nested" as const,
  data: {
    name: "Org",
    value: 100,
    children: [
      {
        name: "Engineering",
        value: 60,
        children: [
          { name: "Frontend", value: 25 },
          { name: "Backend", value: 35 },
        ],
      },
      {
        name: "Sales",
        value: 40,
        children: [
          { name: "AMER", value: 24 },
          { name: "EMEA", value: 16 },
        ],
      },
    ],
  },
};

interface CertifyCapture {
  readonly renderedContentHash: string;
  readonly normalizedSpec: NormalizedVizSpec;
  readonly certified: Awaited<ReturnType<typeof certify>>;
}

async function normalizedSpecFor(
  operand: EChartsOperandCase,
): Promise<{ readonly contentHash: string; readonly spec: NormalizedVizSpec }> {
  const rendered = await vizRender(renderInputFor(operand) as never);
  if (
    rendered.status !== "ok" ||
    typeof rendered.contentHash !== "string" ||
    rendered.normalizedSpec === undefined
  ) {
    throw new Error(
      `viz.render did not produce the ${operand.chartType} fixture.`,
    );
  }
  return {
    contentHash: rendered.contentHash,
    spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
  };
}

async function certifyOperand(
  operand: EChartsOperandCase,
  branchData: unknown = operand.branchData,
): Promise<CertifyCapture> {
  const renderedOperand =
    branchData === operand.branchData ? operand : { ...operand, branchData };
  const normalized = await normalizedSpecFor(renderedOperand);
  return {
    renderedContentHash: normalized.contentHash,
    normalizedSpec: normalized.spec,
    certified: await certify({
      spec: normalized.spec,
      data: { [operand.branch]: branchData } as never,
    }),
  };
}

function operandFor(chartType: string): EChartsOperandCase {
  const operand = ECHARTS_OPERAND_CASES.find(
    (candidate) => candidate.chartType === chartType,
  );
  if (!operand) throw new Error(`Missing canonical ${chartType} operand.`);
  return operand;
}

beforeEach(() => {
  renderProbe.calls = [];
  renderProbe.mode = "pass";
});

describe("artifact.certify — operand-backed ECharts render grading (s179 m05)", () => {
  it.each(ECHARTS_OPERAND_CASES)(
    "$chartType: keeps option identity and adds a stable first-render hash",
    async (operand) => {
      const capture = await certifyOperand(operand);
      const out = capture.certified;

      expect(out.status).toBe("ok");
      expect(out.coverage).toBe("certified");
      expect(out.conformant).toBe(true);
      expect(out.determinism).toEqual({
        stable: true,
        contentHash: capture.renderedContentHash,
        renderHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      expect(out.pillars?.determinism).toBe("pass");
      expect(out.pillars?.contrast).toBe(
        operand.branch === "geo" ? "exempt" : "pass",
      );
      expect(out.contrastNote).toContain("normalized SVG rendered");
      expect(out.contrastNote).toContain("Scope: light/A.");
      expect(out.contrastNote).not.toMatch(/reconstruct|baked into/i);
      if (operand.branch === "geo") {
        expect(out.contrastNote).toContain(
          "Geo categorical contrast remains exempt",
        );
        expect(out.contrastNote).toContain(
          "no canvas ratio is graded",
        );
        expect(out.contrastNote).not.toContain("grades actual carrier paints");
      } else {
        expect(out.contrastNote).toContain("grades actual carrier paints");
        expect(out.contrastNote).toContain("requested CSS scope canvas");
      }
      expect(out.notes?.join(" ")).toContain(
        "packages/viz-render/certified-matrix.json",
      );
      expect(renderProbe.calls).toHaveLength(2);
      expect(renderProbe.calls[0]).toEqual(renderProbe.calls[1]);
      expect(renderProbe.calls[0]).not.toBe(renderProbe.calls[1]);
    },
    30_000,
  );

  it("certifies the same nested-sunburst operand's contrast (its descendants in their branch colour since s222-m02)", async () => {
    const capture = await certifyOperand(
      operandFor("sunburst"),
      NESTED_SUNBURST,
    );

    expect(capture.certified.pillars?.contrast).toBe("pass");
    // The descendant remains graded; s197's palette improved its minimum to 3.84:1, and since s222-m02 a descendant takes
    // its branch's colour, so the minimum is the recipe's 3:1 floor (the gold slot, 3.03:1).
    expect(capture.certified.contrastNote).not.toContain("failing");
    expect(capture.certified.contrastNote).toContain("actual rendered ECharts");
    expect(capture.certified.determinism?.renderHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps bubble-without-geometry option-only because the server never resolves a map", async () => {
    const capture = await certifyOperand(
      operandFor("bubble_map"),
      GEO_BUBBLE_NO_GEOMETRY_BRANCH,
    );

    expect(capture.certified.determinism).toEqual({
      stable: true,
      contentHash: capture.renderedContentHash,
    });
    expect(capture.certified.pillars?.contrast).toBe("exempt");
    expect(capture.certified.notes?.join(" ")).toMatch(
      /no inline geometry.*server never fetches or resolves a map/i,
    );
    expect(capture.certified.contrastNote).toContain(
      "No normalized SVG carrier evidence",
    );
    expect(renderProbe.calls).toHaveLength(0);
    expect(validateOutput(capture.certified)).toBe(true);
  });

  it("keeps option/a11y/accuracy evidence but fails determinism and contrast on a typed first-render fault", async () => {
    const operand = operandFor("treemap");
    const passing = await certifyOperand(operand);

    renderProbe.calls = [];
    renderProbe.mode = "first-fault";
    const faulted = await certifyOperand(operand);

    expect(faulted.certified).toMatchObject({
      status: "ok",
      coverage: "certified",
      conformant: false,
      determinism: {
        stable: false,
        contentHash: passing.certified.determinism?.contentHash,
      },
      pillars: {
        a11yEquivalence: passing.certified.pillars?.a11yEquivalence,
        determinism: "fail",
        contrast: "ungradeable",
        accuracy: passing.certified.pillars?.accuracy,
      },
      findings: passing.certified.findings,
      a11yNotApplicable: passing.certified.a11yNotApplicable,
      accuracySummary: passing.certified.accuracySummary,
    });
    expect(faulted.certified.determinism?.renderHash).toBeUndefined();
    expect(faulted.certified.contrastNote).toContain("ECHARTS_RENDER_FAULT");
    expect(faulted.certified.notes?.join(" ")).toContain(
      "synthetic first-render fault",
    );
    expect(renderProbe.calls).toHaveLength(1);
    expect(validateOutput(faulted.certified)).toBe(true);
  });

  it.each([
    ["second-diff", "differed from the first"],
    ["second-fault", "synthetic second-render fault"],
  ] as const)(
    "%s retains the first hash but makes the combined proof unstable",
    async (mode, expectedNote) => {
      renderProbe.mode = mode;
      const capture = await certifyOperand(operandFor("treemap"));

      expect(capture.certified.determinism).toEqual({
        stable: false,
        contentHash: capture.renderedContentHash,
        renderHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      expect(capture.certified.pillars?.determinism).toBe("fail");
      expect(capture.certified.pillars?.contrast).toBe("pass");
      expect(capture.certified.notes?.join(" ")).toContain(expectedNote);
      expect(renderProbe.calls).toHaveLength(2);
      expect(validateOutput(capture.certified)).toBe(true);
    },
  );
});
