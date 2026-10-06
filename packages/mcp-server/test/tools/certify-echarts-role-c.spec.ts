import { describe, expect, it } from "vitest";
import { renderEChartsToSvg } from "@oods/viz-render";
import { extractEChartsRoleCPaints } from "../../src/tools/certify-echarts-role-c.js";
import { evaluateEChartsRenderContrast } from "../../src/tools/certify-echarts-render-contrast.js";
import { handle as vizRender } from "../../src/tools/viz.render.js";
import {
  ECHARTS_OPERAND_CASES,
  HIERARCHY_BRANCH,
  renderInputFor,
  type EChartsOperandCase,
} from "./s172-echarts-operands.js";

interface RenderCarrier {
  readonly option: Record<string, unknown>;
  readonly svg: string;
}

// s222-m02 (#2502 ruling 12): brand A's recipe palette (its first three slots) and brand A's sequential ramp (the geo
// families); the carriers and their counts did not move (sprint-222 golden ledger, epoch s222-m02).
const EXPECTED_ROLE_C: Readonly<
  Record<
    string,
    {
      readonly paints: readonly string[];
      readonly chartElements: number;
      readonly unresolved: number;
    }
  >
> = {
  treemap: {
    paints: ["#3E63DD", "#B98E00", "#800883"],
    chartElements: 8,
    unresolved: 0,
  },
  sunburst: {
    paints: ["#3E63DD", "#B98E00", "#800883"],
    chartElements: 4,
    unresolved: 0,
  },
  sankey: {
    paints: ["#3E63DD", "#B98E00", "#800883"],
    chartElements: 5,
    unresolved: 2,
  },
  chord: {
    paints: ["#3E63DD", "#B98E00", "#800883"],
    chartElements: 6,
    unresolved: 0,
  },
  force_graph: {
    paints: ["#3E63DD", "#B98E00"],
    chartElements: 5,
    unresolved: 0,
  },
  choropleth: {
    paints: ["#142989", "#E5EBFA"],
    chartElements: 2,
    unresolved: 0,
  },
  // s222-m02 follow-up: a bubble's default ramp starts at the first step that reaches 3:1 on the land (04 in light).
  bubble_map: {
    paints: ["#142989", "#5E85F1"],
    chartElements: 2,
    unresolved: 0,
  },
  flow_map: {
    paints: ["#2543B7"],
    chartElements: 2,
    unresolved: 0,
  },
};

const DEEP_SUNBURST: EChartsOperandCase = {
  ...ECHARTS_OPERAND_CASES.find(({ chartType }) => chartType === "sunburst")!,
  branchData: {
    ...HIERARCHY_BRANCH,
    data: {
      ...HIERARCHY_BRANCH.data,
      children: HIERARCHY_BRANCH.data.children.map((child) => ({
        ...child,
        children: [
          { name: `${child.name} detail 1`, value: child.value / 2 },
          { name: `${child.name} detail 2`, value: child.value / 2 },
        ],
      })),
    },
  },
};

async function servedCarrier(
  operand: EChartsOperandCase,
): Promise<RenderCarrier> {
  const rendered = await vizRender(renderInputFor(operand) as never);
  expect(rendered.status).toBe("ok");
  const option = rendered.echartsSpec as unknown as Record<string, unknown>;
  expect(option).toBeDefined();
  return { option, svg: await renderEChartsToSvg(option) };
}

/** A served chart with one datum repainted, re-rendered by ECharts itself. */
async function repaintedCarrier(
  chartType: string,
  repaint: (option: Record<string, any>) => void,
): Promise<RenderCarrier> {
  const served = await servedCarrier(
    ECHARTS_OPERAND_CASES.find((operand) => operand.chartType === chartType)!,
  );
  const option = JSON.parse(JSON.stringify(served.option));
  repaint(option);
  return { option, svg: await renderEChartsToSvg(option) };
}

describe.sequential("ECharts Role-C structural paint extraction", () => {
  it.each(ECHARTS_OPERAND_CASES)(
    "$chartType: extracts only visible chart carriers from the exact served option",
    async (operand) => {
      const { option, svg } = await servedCarrier(operand);
      const expected = EXPECTED_ROLE_C[operand.chartType];

      expect(extractEChartsRoleCPaints(svg, option)).toEqual({
        status: "ok",
        roleCPaints: expected.paints,
        chartElementCount: expected.chartElements,
        unresolvedPaintCount: expected.unresolved,
      });
    },
    30_000,
  );

  it("keeps the sunburst's descendants in Role C, in their branch colour", async () => {
    const { option, svg } = await servedCarrier(DEEP_SUNBURST);
    const extracted = extractEChartsRoleCPaints(svg, option);

    // s222-m02: a descendant takes its branch's colour (the ECharts depth tint, #8F5B65 from slot 1 for every branch,
    // is gone); all ten carriers are still graded, and their paints are exactly the three branch slots.
    expect(extracted.status).toBe("ok");
    expect(extracted.chartElementCount).toBe(10);
    expect(extracted.roleCPaints).toEqual([
      "#3E63DD",
      "#B98E00",
      "#800883",
    ]);
  });

  it("does not collapse node and edge carriers that reuse ecmeta_data_index", () => {
    const svg =
      "<svg>" +
      '<path ecmeta_ssr_type="chart" ecmeta_data_index="0" fill="none" stroke="#416cd9"></path>' +
      '<path ecmeta_ssr_type="chart" ecmeta_data_index="0" fill="rgb(62, 68, 190)"></path>' +
      "</svg>";

    expect(extractEChartsRoleCPaints(svg, {})).toMatchObject({
      status: "ok",
      roleCPaints: ["#416CD9", "#3E44BE"],
      chartElementCount: 2,
    });
  });

  it("uses structural metadata, not authored text or legend metadata, and canonicalizes colors", () => {
    const svg =
      "<svg>" +
      '<!-- <path ecmeta_ssr_type="chart" fill="#ff00ff"></path> -->' +
      '<text>&lt;path ecmeta_ssr_type="chart" fill="#00ffff"&gt;</text>' +
      '<path ecmeta_ssr_type="legend" fill="#ffff00"></path>' +
      '<path ecmeta_ssr_type="chart" fill="#abc" stroke="RGB(1, 2, 3)"></path>' +
      "</svg>";

    expect(extractEChartsRoleCPaints(svg, {})).toEqual({
      status: "ok",
      roleCPaints: ["#AABBCC", "#010203"],
      chartElementCount: 1,
      unresolvedPaintCount: 0,
    });
  });

  // s223-m02 (#2527 ruling 13 d): chrome is decided by element. The test this replaces removed any carrier whose
  // value equalled a canvas, area or border colour found anywhere in the option, which is how a data shape painted
  // exactly a chrome colour went ungraded.
  it("keeps a treemap node's background tile and a filled shape's own border out of Role C", () => {
    const option = {
      backgroundColor: "#fcfcfd",
      geo: {
        itemStyle: { areaColor: "#f2f2f2", borderColor: "rgb(233, 236, 239)" },
      },
      series: [
        { type: "treemap", itemStyle: { borderColor: "#d5dae4" } },
        { type: "map", geoIndex: 0 },
        {
          type: "sunburst",
          levels: [{}, { itemStyle: { borderColor: "#c1c7d0" } }],
        },
      ],
    };
    const svg =
      "<svg>" +
      // A treemap node: its background tile (its border, drawn as a fill), then its content.
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="0" ecmeta_data_index="0" fill="#D5DAE4"></path>' +
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="0" ecmeta_data_index="0" fill="rgb(65,108,217)"></path>' +
      // A map region outlined with its geo component's border, and a sector outlined with its level's border.
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="1" ecmeta_data_index="0" fill="#142989" stroke="rgb(233,236,239)"></path>' +
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="2" ecmeta_data_index="1" fill="#B98E00" stroke="#C1C7D0"></path>' +
      "</svg>";

    expect(extractEChartsRoleCPaints(svg, option)).toEqual({
      status: "ok",
      roleCPaints: ["#416CD9", "#142989", "#B98E00"],
      chartElementCount: 4,
      unresolvedPaintCount: 0,
    });
  });

  it("grades a carrier painted exactly the canvas, a border or the land colour", () => {
    const option = {
      backgroundColor: "#fcfcfd",
      geo: {
        itemStyle: { areaColor: "#f2f2f2", borderColor: "rgb(233, 236, 239)" },
      },
      series: [
        { type: "treemap", itemStyle: { borderColor: "#d5dae4" } },
        { type: "map", geoIndex: 0 },
        { type: "graph", itemStyle: { borderColor: "#c1c7d0" } },
      ],
    };
    const svg =
      "<svg>" +
      // A treemap leaf painted exactly its border colour: the tile is chrome, the content is data.
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="0" ecmeta_data_index="2" fill="#D5DAE4"></path>' +
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="0" ecmeta_data_index="2" fill="#D5DAE4"></path>' +
      // A region painted exactly the land colour; its outline is still the geo border.
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="1" ecmeta_data_index="0" fill="#F2F2F2" stroke="rgb(233,236,239)"></path>' +
      // A node painted exactly the canvas, and an edge (an unfilled line) painted exactly the nodes' border colour.
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="2" ecmeta_data_index="0" fill="#FCFCFD"></path>' +
      '<path ecmeta_ssr_type="chart" ecmeta_series_index="2" ecmeta_data_index="0" fill="none" stroke="#C1C7D0"></path>' +
      "</svg>";

    expect(extractEChartsRoleCPaints(svg, option)).toEqual({
      status: "ok",
      roleCPaints: ["#D5DAE4", "#F2F2F2", "#FCFCFD", "#C1C7D0"],
      chartElementCount: 5,
      unresolvedPaintCount: 0,
    });
  });

  it("grades a served treemap leaf painted exactly the border colour, and it fails 3:1 on the canvas", async () => {
    const { option, svg } = await repaintedCarrier("treemap", (served) => {
      served.series[0].data[0].children[0].itemStyle.color =
        served.series[0].itemStyle.borderColor;
    });

    expect(extractEChartsRoleCPaints(svg, option)).toEqual({
      status: "ok",
      roleCPaints: ["#D4D4D4", "#B98E00", "#800883"],
      chartElementCount: 8,
      unresolvedPaintCount: 0,
    });
    const graded = evaluateEChartsRenderContrast({
      chartType: "treemap",
      normalizedSvg: svg,
      projectedOption: option,
    });
    expect(graded.contrast).toBe("fail");
    expect(graded.roleC).toMatchObject({
      verdict: "fail",
      failingPaints: ["#D4D4D4"],
    });
  });

  it("grades served graph nodes painted exactly the canvas colour, and they fail 3:1", async () => {
    const { option, svg } = await repaintedCarrier("force_graph", (served) => {
      served.series[0].categories[0].itemStyle.color = served.backgroundColor;
    });

    const graded = evaluateEChartsRenderContrast({
      chartType: "force_graph",
      normalizedSvg: svg,
      projectedOption: option,
    });
    expect(graded.roleCPaints).toEqual(["#FFFFFF", "#B98E00"]);
    expect(graded.contrast).toBe("fail");
    expect(graded.roleC).toMatchObject({
      verdict: "fail",
      failingPaints: ["#FFFFFF"],
    });
  });

  it("keeps a solid carrier beside an unresolved pattern and reports the ignored pattern", () => {
    const svg =
      '<svg><path ecmeta_ssr_type="chart" fill="url(#pattern)" stroke="#416cd9"></path></svg>';

    expect(extractEChartsRoleCPaints(svg, {})).toEqual({
      status: "ok",
      roleCPaints: ["#416CD9"],
      chartElementCount: 1,
      unresolvedPaintCount: 1,
    });
  });

  it("uses opacity only as a visibility gate and does not claim alpha compositing", () => {
    const svg =
      "<svg>" +
      '<path ecmeta_ssr_type="chart" fill="#416cd9" fill-opacity="0.5"></path>' +
      '<path ecmeta_ssr_type="chart" fill="#ff00ff" fill-opacity="0"></path>' +
      '<path ecmeta_ssr_type="chart" fill="none" stroke="#00ffff" stroke-opacity="0"></path>' +
      '<path ecmeta_ssr_type="chart" fill="#ffff00" display="none"></path>' +
      "</svg>";

    expect(extractEChartsRoleCPaints(svg, {})).toEqual({
      status: "ok",
      roleCPaints: ["#416CD9"],
      chartElementCount: 4,
      unresolvedPaintCount: 0,
    });
  });

  it("reports pattern-only and invalid/transparent-only carriers as ungradeable", () => {
    expect(
      extractEChartsRoleCPaints(
        '<svg><path ecmeta_ssr_type="chart" fill="url(#pattern)" stroke="none"></path></svg>',
        {},
      ),
    ).toEqual({
      status: "ungradeable",
      roleCPaints: [],
      chartElementCount: 1,
      unresolvedPaintCount: 1,
      reason: "NO_SOLID_CARRIER_PAINTS",
    });

    expect(
      extractEChartsRoleCPaints(
        "<svg>" +
          '<path ecmeta_ssr_type="chart" fill="transparent"></path>' +
          '<path ecmeta_ssr_type="chart" fill="banana" stroke="#ffffff" stroke-width="0"></path>' +
          "</svg>",
        {},
      ),
    ).toEqual({
      status: "ungradeable",
      roleCPaints: [],
      chartElementCount: 2,
      unresolvedPaintCount: 0,
      reason: "NO_SOLID_CARRIER_PAINTS",
    });
  });

  it("reports missing or malformed chart metadata as ungradeable", () => {
    expect(
      extractEChartsRoleCPaints('<svg><path fill="#416cd9"></path></svg>', {}),
    ).toEqual({
      status: "ungradeable",
      roleCPaints: [],
      chartElementCount: 0,
      unresolvedPaintCount: 0,
      reason: "NO_CHART_ELEMENTS",
    });

    expect(
      extractEChartsRoleCPaints(
        '<svg><path ecmeta_ssr_type="chart" fill="#416cd9></path></svg>',
        {},
      ),
    ).toEqual({
      status: "ungradeable",
      roleCPaints: [],
      chartElementCount: 0,
      unresolvedPaintCount: 0,
      reason: "MALFORMED_SVG",
    });
  });
});
