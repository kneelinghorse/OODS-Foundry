// s179 m04 — combine visible Role-C carrier paints with semantic Role-A
// assignments. The two inputs are intentionally different: hierarchy tints must
// reach Role C, while repeated descendants/edges must not manufacture Role-A n.

import { describe, expect, it } from "vitest";
import type { NormalizedVizSpec } from "@oods/viz-core";
import { renderEChartsToSvg } from "@oods/viz-render";
import {
  emitRawEChartsOption,
  evaluateEChartsDeterminism,
  projectEChartsOption,
} from "../../src/tools/certify-echarts-emit.js";
import { evaluateEChartsRenderContrast } from "../../src/tools/certify-echarts-render-contrast.js";
import type { EChartsPrimaryType } from "../../src/tools/echarts-primary.js";
import {
  ECHARTS_OPERAND_CASES,
  HIERARCHY_BRANCH,
} from "./s172-echarts-operands.js";

const MARK_BY_TYPE: Readonly<Record<EChartsPrimaryType, string>> = {
  treemap: "MarkTreemap",
  sunburst: "MarkSunburst",
  sankey: "MarkSankey",
  chord: "MarkChord",
  force_graph: "MarkGraph",
  choropleth: "MarkChoropleth",
  bubble_map: "MarkBubble",
  flow_map: "MarkFlow",
};

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

// s222-m02 (#2502 ruling 12): brand A's recipe palette and sequential ramp; the verdicts did not move.
const EXPECTED_STANDARD = {
  treemap: {
    roleCPaints: ["#3E63DD", "#B98E00", "#800883"],
    roleAAssignment: ["#3E63DD", "#B98E00", "#800883"],
    contrast: "pass",
  },
  sunburst: {
    roleCPaints: ["#3E63DD", "#B98E00", "#800883"],
    roleAAssignment: ["#3E63DD", "#B98E00", "#800883"],
    contrast: "pass",
  },
  sankey: {
    roleCPaints: ["#3E63DD", "#B98E00", "#800883"],
    roleAAssignment: ["#3E63DD", "#B98E00", "#800883"],
    contrast: "pass",
  },
  chord: {
    roleCPaints: ["#3E63DD", "#B98E00", "#800883"],
    roleAAssignment: ["#3E63DD", "#B98E00", "#800883"],
    contrast: "pass",
  },
  force_graph: {
    roleCPaints: ["#3E63DD", "#B98E00"],
    roleAAssignment: ["#3E63DD", "#B98E00"],
    contrast: "pass",
  },
  choropleth: {
    roleCPaints: ["#142989", "#E5EBFA"],
    roleAAssignment: [],
    contrast: "exempt",
  },
  // s222-m02 follow-up: a bubble's default ramp starts at the first step that reaches 3:1 on the land (04 in light).
  bubble_map: {
    roleCPaints: ["#142989", "#5E85F1"],
    roleAAssignment: [],
    contrast: "exempt",
  },
  flow_map: {
    roleCPaints: ["#2543B7"],
    roleAAssignment: [],
    contrast: "exempt",
  },
} as const;

function specFor(chartType: EChartsPrimaryType): NormalizedVizSpec {
  return {
    $schema: "https://oods-foundry.com/viz-spec/v1",
    id: `viz:${chartType}`,
    name: `${chartType} rendered contrast fixture`,
    data: { values: [] },
    marks: [{ trait: MARK_BY_TYPE[chartType] }],
    encoding: {},
    a11y: { description: `${chartType} rendered contrast fixture.` },
  } as NormalizedVizSpec;
}

function retainedProjection(
  chartType: EChartsPrimaryType,
  branchData: unknown,
): Record<string, unknown> {
  const outcome = evaluateEChartsDeterminism(
    specFor(chartType),
    chartType,
    branchData,
  );
  if (!outcome.ok) {
    throw new Error(`${outcome.code}: ${outcome.message}`);
  }
  return outcome.firstProjected;
}

async function grade(
  chartType: EChartsPrimaryType,
  projectedOption: Record<string, unknown>,
) {
  const normalizedSvg = await renderEChartsToSvg(projectedOption);
  return evaluateEChartsRenderContrast({
    chartType,
    normalizedSvg,
    projectedOption,
  });
}

function firstHierarchyChild(option: Record<string, unknown>) {
  const series = (option.series as Array<Record<string, unknown>>)[0];
  const root = (series.data as Array<Record<string, unknown>>)[0];
  return (root.children as Array<Record<string, unknown>>)[0];
}

describe("ECharts rendered categorical contrast (s179 m04)", () => {
  it.each(ECHARTS_OPERAND_CASES)(
    "$chartType: composes actual carriers with the family semantic assignment",
    async (operand) => {
      const result = await grade(
        operand.chartType,
        retainedProjection(operand.chartType, operand.branchData),
      );
      expect(result).toMatchObject(EXPECTED_STANDARD[operand.chartType]);
    },
    30_000,
  );

  it("grades a nested sunburst's descendants in Role C, in their branch colour", async () => {
    const result = await grade(
      "sunburst",
      retainedProjection("sunburst", NESTED_SUNBURST),
    );

    // s222-m02: the s197 palette kept ECharts' depth tint (#8F5B65) at 3.84:1; the recipe palette holds each slot to 3:1,
    // so a descendant takes its branch's colour instead, and the minimum is the gold slot's 3.03:1 on the light canvas.
    expect(result.roleCPaints).toEqual(["#3E63DD", "#B98E00"]);
    expect(result.roleAAssignment).toEqual(["#3E63DD", "#B98E00"]);
    expect(result.roleC.verdict).toBe("pass");
    expect(result.roleC.minimumRatio).toBeCloseTo(3.0294034121220346, 12);
    expect(result.roleC.failingPaints).toEqual([]);
    expect(result.roleA.verdict).toBe("pass");
    expect(result.contrast).toBe("pass");
  });

  it("grades the retained projection: raw-only paint movement is inert, projected movement bites", async () => {
    const spec = specFor("treemap");
    const outcome = evaluateEChartsDeterminism(
      spec,
      "treemap",
      HIERARCHY_BRANCH,
    );
    if (!outcome.ok) {
      throw new Error(`${outcome.code}: ${outcome.message}`);
    }

    const baseline = await grade("treemap", outcome.firstProjected);
    expect(baseline.contrast).toBe("pass");

    const unrelatedRaw = emitRawEChartsOption(
      spec,
      "treemap",
      HIERARCHY_BRANCH,
    ) as unknown as Record<string, unknown>;
    // s222-m02: a near-white tile, not white itself. Since m01 the light/A canvas is #FFFFFF, and a carrier paint equal to
    // a chrome paint of the option (the canvas and the tile borders are white) is set aside as chrome, not graded.
    firstHierarchyChild(unrelatedRaw).itemStyle = { color: "#FEFEFE" };

    // The retained object and its grade do not read a later, unrelated raw emit.
    expect(await grade("treemap", outcome.firstProjected)).toEqual(baseline);

    // Once the same mutation crosses the projection boundary, the actual render fails Role C.
    const projectedMutation = projectEChartsOption(unrelatedRaw as never);
    const moved = await grade("treemap", projectedMutation);
    expect(moved.roleCPaints).toContain("#FEFEFE");
    expect(moved.roleC.verdict).toBe("fail");
    expect(moved.contrast).toBe("fail");
  });

  it.each([
    [
      "pattern-only",
      '<svg><path fill="url(#pattern)" ecmeta_ssr_type="chart"/></svg>',
    ],
    ["malformed", '<svg><path fill="#416CD9" ecmeta_ssr_type="chart"'],
  ])(
    "%s rendered evidence is ungradeable, never unchecked or pass",
    (_label, svg) => {
      const result = evaluateEChartsRenderContrast({
        chartType: "treemap",
        normalizedSvg: svg,
        projectedOption: retainedProjection("treemap", HIERARCHY_BRANCH),
      });
      expect(result.contrast).toBe("ungradeable");
      expect(result.roleC.verdict).toBe("ungradeable");
    },
  );

  it("keeps geo contrast exempt while retaining its actual carrier paints", async () => {
    const operand = ECHARTS_OPERAND_CASES.find(
      (candidate) => candidate.chartType === "choropleth",
    );
    if (!operand) {
      throw new Error("Missing canonical choropleth operand.");
    }
    const result = await grade(
      "choropleth",
      retainedProjection("choropleth", operand.branchData),
    );
    expect(result.roleCPaints).toEqual(["#142989", "#E5EBFA"]);
    expect(result.roleAAssignment).toEqual([]);
    expect(result.roleC.verdict).toBe("exempt");
    expect(result.roleA.verdict).toBe("not-applicable");
    expect(result.contrast).toBe("exempt");
  });
});
