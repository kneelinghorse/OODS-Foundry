// s179 m04 — Role A is a semantic category assignment, not an SVG path multiset.
// These carriers deliberately add repeated descendants/nodes/edges/ribbons so a
// path-count or ecmeta_data_index implementation invents collisions and fails.

import { describe, expect, it } from "vitest";
import type { NormalizedVizSpec } from "@oods/viz-core";
import {
  deriveEChartsRoleAAssignment,
  type EChartsRoleAAssignmentResult,
} from "../../src/tools/echarts-role-a-assignment.js";
import { evaluateCategoricalRoleA } from "../../src/tools/certify-contrast.js";
import {
  emitRawEChartsOption,
  projectEChartsOption,
} from "../../src/tools/certify-echarts-emit.js";
import type { EChartsPrimaryType } from "../../src/tools/echarts-primary.js";
import { ECHARTS_OPERAND_CASES } from "./s172-echarts-operands.js";

// Explicit light/A pixels: s222-m02's categorical colours from brand A's recipe (#2509), which replaced the s197-m05
// generated palette. Keep this independent expectation: eight semantic categories must still cycle six slots.
const PALETTE = [
  "#3E63DD",
  "#B98E00",
  "#800883",
  "#0C7B2D",
  "#7B0008",
  "#00A3B3",
] as const;
const EXPECTED_EIGHT = [...PALETTE, PALETTE[0], PALETTE[1]] as const;

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

function specFor(chartType: EChartsPrimaryType): NormalizedVizSpec {
  return {
    $schema: "https://oods-foundry.com/viz-spec/v1",
    id: `viz:${chartType}`,
    name: `${chartType} Role-A fixture`,
    data: { values: [] },
    marks: [{ trait: MARK_BY_TYPE[chartType] }],
    encoding: {},
    a11y: { description: `${chartType} Role-A fixture.` },
  } as NormalizedVizSpec;
}

function projected(
  chartType: EChartsPrimaryType,
  branchData: unknown,
): Record<string, unknown> {
  return projectEChartsOption(
    emitRawEChartsOption(specFor(chartType), chartType, branchData),
  );
}

const HIERARCHY_EIGHT = {
  type: "nested" as const,
  data: {
    name: "Total",
    value: 108,
    children: Array.from({ length: 8 }, (_, index) => ({
      name: `Group ${index}`,
      value: 10 + index,
      // Descendants inherit/generated-tint the first-visible category. They are
      // Role-C carriers, not extra Role-A categories.
      children: [
        { name: `Group ${index} / A`, value: 4 },
        { name: `Group ${index} / B`, value: 6 + index },
      ],
    })),
  },
};

const FLOW_EIGHT = {
  nodes: Array.from({ length: 8 }, (_, index) => ({ name: `Node ${index}` })),
  // Two ribbons/edges leave every node. Link multiplicity must not increase n.
  links: Array.from({ length: 16 }, (_, index) => ({
    source: `Node ${index % 8}`,
    target: `Node ${(index + 1) % 8}`,
    value: index + 1,
  })),
};

const FORCE_GROUPS = Array.from({ length: 8 }, (_, index) => `Group ${index}`);
const FORCE_EIGHT = {
  // Reverse category encounter order and repeat every group. The adapter's semantic
  // contract is sorted distinct non-empty groups, not node or edge count.
  nodes: [...FORCE_GROUPS]
    .reverse()
    .flatMap((group, index) => [
      { id: `${index}-a`, group },
      { id: `${index}-b`, group },
    ])
    .concat([{ id: "empty-group", group: "" }]),
  links: Array.from({ length: 16 }, (_, index) => ({
    source: `${index % 8}-a`,
    target: `${index % 8}-b`,
    value: index + 1,
  })),
};

const WIDE_CASES = [
  {
    chartType: "treemap",
    branchData: HIERARCHY_EIGHT,
    categoryKeys: Array.from({ length: 8 }, (_, index) => `Group ${index}`),
  },
  {
    chartType: "sunburst",
    branchData: HIERARCHY_EIGHT,
    categoryKeys: Array.from({ length: 8 }, (_, index) => `Group ${index}`),
  },
  {
    chartType: "sankey",
    branchData: FLOW_EIGHT,
    categoryKeys: Array.from({ length: 8 }, (_, index) => `Node ${index}`),
  },
  {
    chartType: "chord",
    branchData: FLOW_EIGHT,
    categoryKeys: Array.from({ length: 8 }, (_, index) => `Node ${index}`),
  },
  {
    chartType: "force_graph",
    branchData: FORCE_EIGHT,
    categoryKeys: FORCE_GROUPS,
  },
] as const;

function assign(
  chartType: EChartsPrimaryType,
  option: Record<string, unknown>,
  realizedPaints: readonly string[] = PALETTE,
): EChartsRoleAAssignmentResult {
  return deriveEChartsRoleAAssignment({
    chartType,
    projectedOption: option,
    realizedPaints,
  });
}

describe("ECharts Role-A semantic assignment (s179 m04)", () => {
  it.each(WIDE_CASES)(
    "$chartType: n=8 is exactly slots 1..6,1,2 despite repeated geometry/category carriers",
    ({ chartType, branchData, categoryKeys }) => {
      const result = assign(chartType, projected(chartType, branchData));
      expect(result).toEqual({
        status: "assigned",
        categoryKeys,
        roleAAssignment: EXPECTED_EIGHT,
      });
      if (result.status !== "assigned") {
        throw new Error(`${chartType} did not yield a semantic assignment.`);
      }
      expect(evaluateCategoricalRoleA(result.roleAAssignment)).toMatchObject({
        verdict: "fail",
        minimumDeltaE: 0,
      });
    },
  );

  it("the five standard projected operands use their semantic sources, never total path-like cardinality", () => {
    const observed = Object.fromEntries(
      ECHARTS_OPERAND_CASES.filter((operand) =>
        ["treemap", "sunburst", "sankey", "chord", "force_graph"].includes(
          operand.chartType,
        ),
      ).map((operand) => {
        const chartType = operand.chartType as EChartsPrimaryType;
        return [
          chartType,
          assign(chartType, projected(chartType, operand.branchData)),
        ];
      }),
    );

    expect(observed).toEqual({
      treemap: {
        status: "assigned",
        categoryKeys: ["Alpha", "Beta", "Gamma"],
        roleAAssignment: PALETTE.slice(0, 3),
      },
      sunburst: {
        status: "assigned",
        categoryKeys: ["Alpha", "Beta", "Gamma"],
        roleAAssignment: PALETTE.slice(0, 3),
      },
      sankey: {
        status: "assigned",
        categoryKeys: ["Source", "Middle", "Sink"],
        roleAAssignment: PALETTE.slice(0, 3),
      },
      chord: {
        status: "assigned",
        categoryKeys: ["North", "South", "East"],
        roleAAssignment: PALETTE.slice(0, 3),
      },
      force_graph: {
        status: "assigned",
        categoryKeys: ["core", "edge"],
        roleAAssignment: PALETTE.slice(0, 2),
      },
    });
  });

  it.each(["choropleth", "bubble_map", "flow_map"] as const)(
    "%s: geo is explicitly not applicable under the ratified exemption",
    (chartType) => {
      const operand = ECHARTS_OPERAND_CASES.find(
        (candidate) => candidate.chartType === chartType,
      );
      if (!operand) {
        throw new Error(`Missing canonical ${chartType} operand.`);
      }
      expect(
        assign(chartType, projected(chartType, operand.branchData), []),
      ).toEqual({
        status: "not-applicable",
        reason: "geo-contrast-exempt",
        categoryKeys: [],
        roleAAssignment: [],
      });
    },
  );

  it("is ungradeable when one semantic paint did not occur in the realized chart paints", () => {
    const option = projected("chord", FLOW_EIGHT);
    expect(assign("chord", option, PALETTE.slice(0, 5))).toEqual({
      status: "ungradeable",
      reason: "semantic-paint-not-rendered",
      categoryKeys: Array.from({ length: 8 }, (_, index) => `Node ${index}`),
      roleAAssignment: [],
    });
  });

  it.each([
    ["URL-only", "url(#oods-pattern)"],
    ["transparent", "transparent"],
    ["literal source", "source"],
  ] as const)(
    "%s semantic paint is ungradeable, never silently omitted or passed",
    (_label, paint) => {
      const option = projected("chord", FLOW_EIGHT);
      const series = (option.series as Array<Record<string, unknown>>)[0];
      const nodes = series.nodes as Array<Record<string, unknown>>;
      for (const node of nodes) {
        node.itemStyle = { color: paint };
      }
      expect(assign("chord", option, [paint])).toEqual({
        status: "ungradeable",
        reason: "unreadable-semantic-paint",
        categoryKeys: Array.from({ length: 8 }, (_, index) => `Node ${index}`),
        roleAAssignment: [],
      });
    },
  );

  it("decal-only and missing semantic metadata are ungradeable, not geo-like not-applicable", () => {
    const decalOnly = projected("chord", FLOW_EIGHT);
    const series = (decalOnly.series as Array<Record<string, unknown>>)[0];
    const nodes = series.nodes as Array<Record<string, unknown>>;
    for (const node of nodes) {
      node.itemStyle = { decal: { symbol: "rect" } };
    }
    expect(assign("chord", decalOnly, PALETTE)).toEqual({
      status: "ungradeable",
      reason: "unreadable-semantic-paint",
      categoryKeys: Array.from({ length: 8 }, (_, index) => `Node ${index}`),
      roleAAssignment: [],
    });

    const missing = projected("sankey", FLOW_EIGHT);
    delete (missing.series as Array<Record<string, unknown>>)[0].data;
    expect(assign("sankey", missing)).toEqual({
      status: "ungradeable",
      reason: "missing-semantic-metadata",
      categoryKeys: [],
      roleAAssignment: [],
    });
  });
});
