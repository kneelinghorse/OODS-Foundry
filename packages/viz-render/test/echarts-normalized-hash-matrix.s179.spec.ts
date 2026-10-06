import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { renderEChartsToSvg } from "@oods/viz-render";
import {
  ECHARTS_OPERAND_CASES,
  type EChartsOperandCase,
} from "../../viz-core/test/fixtures/s172-echarts-operands.js";
import { buildProjectedOption } from "../../viz-core/test/s179-echarts-render-harness.js";

const MATRIX_FAMILIES = [
  "treemap",
  "sunburst",
  "sankey",
  "chord",
  "force_graph",
  "choropleth",
  "bubble_map",
  "flow_map",
] as const;

type MatrixFamily = (typeof MATRIX_FAMILIES)[number];

const EXPECTED_NORMALIZED_HASHES = (
  JSON.parse(
    readFileSync(new URL("../certified-matrix.json", import.meta.url), "utf8"),
  ) as { readonly normalizedSvgHashes: Readonly<Record<MatrixFamily, string>> }
).normalizedSvgHashes;

const TEXT_CARRIERS = {
  ascii: "ASCII label",
  cjk: "漢字標籤",
  combining: "Cafe\u0301 combining",
  emoji: "Emoji 🧭📊",
  long: "A deliberately long label that must be truncated by the fixed snapshot policy",
} as const;

interface MatrixCapture {
  readonly first: string;
  readonly second: string;
}

const captures = new Map<MatrixFamily, MatrixCapture>();

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

function canonicalOperand(family: MatrixFamily): EChartsOperandCase {
  const operand = ECHARTS_OPERAND_CASES.find(
    ({ chartType }) => chartType === family,
  );
  if (!operand) {
    throw new Error(`Missing canonical ${family} operand.`);
  }
  return operand;
}

function matrixOption(family: MatrixFamily): Record<string, unknown> {
  const option = buildProjectedOption(canonicalOperand(family));
  option.title = [
    { text: TEXT_CARRIERS.ascii, left: 8, top: 4 },
    { text: TEXT_CARRIERS.cjk, left: 110, top: 4 },
    { text: TEXT_CARRIERS.combining, left: 190, top: 4 },
    { text: TEXT_CARRIERS.emoji, left: 330, top: 4 },
    {
      text: TEXT_CARRIERS.long,
      left: 430,
      top: 4,
      textStyle: {
        width: 120,
        overflow: "truncate",
        ellipsis: "…",
      },
    },
  ];

  if (family === "sunburst") {
    const series = (option.series as Array<Record<string, unknown>>)[0];
    series.itemStyle = {
      ...(series.itemStyle as Record<string, unknown> | undefined),
      color: {
        type: "linear",
        x: 0,
        y: 0,
        x2: 1,
        y2: 1,
        colorStops: [
          { offset: 0, color: "#416CD9" },
          { offset: 1, color: "#D94F70" },
        ],
      },
      shadowBlur: 7,
      shadowColor: "rgba(17,24,39,0.6)",
      decal: {
        symbol: "rect",
        symbolSize: 0.7,
        dashArrayX: [4, 2],
        dashArrayY: [3, 2],
        color: "rgba(255,255,255,0.35)",
      },
    };
  }

  return option;
}

describe.sequential("s179 ECharts normalized-SVG hash matrix", () => {
  beforeAll(async () => {
    for (const family of MATRIX_FAMILIES) {
      const option = matrixOption(family);
      const before = structuredClone(option);
      const first = await renderEChartsToSvg(option);
      const second = await renderEChartsToSvg(option);
      expect(option).toEqual(before);
      captures.set(family, { first, second });
    }
  }, 90_000);

  it("covers exactly the shared eight canonical operand families", () => {
    expect(ECHARTS_OPERAND_CASES.map(({ chartType }) => chartType)).toEqual(
      MATRIX_FAMILIES,
    );
    expect([...captures.keys()]).toEqual(MATRIX_FAMILIES);
    expect(Object.keys(EXPECTED_NORMALIZED_HASHES)).toEqual(MATRIX_FAMILIES);
  });

  it.each(MATRIX_FAMILIES)(
    "%s pins a byte-stable normalized SVG hash",
    (family) => {
      const capture = captures.get(family);
      expect(capture).toBeDefined();
      expect(capture?.second).toBe(capture?.first);
      expect(sha256(capture?.first ?? "")).toBe(
        EXPECTED_NORMALIZED_HASHES[family],
      );
    },
  );

  it("preserves the ASCII, CJK, combining-mark, emoji, and truncation carriers", () => {
    const svg = captures.get("treemap")?.first ?? "";

    expect(svg).toContain(TEXT_CARRIERS.ascii);
    expect(svg).toContain(TEXT_CARRIERS.cjk);
    expect(svg).toContain(TEXT_CARRIERS.combining);
    expect(svg).toContain(TEXT_CARRIERS.emoji);
    expect(svg).not.toContain(TEXT_CARRIERS.long);
    expect(svg).toContain("…");
  });

  it("normalizes actual shadow, gradient, pattern, and clip structural carriers", () => {
    const rich = captures.get("sunburst")?.first ?? "";
    const clipped = captures.get("choropleth")?.first ?? "";
    const combined = `${rich}\n${clipped}`;

    expect(rich).toContain("<filter");
    expect(rich).toContain("<feDropShadow");
    expect(rich).toContain("<linearGradient");
    expect(rich).toContain("<pattern");
    expect(clipped).toContain("<clipPath");
    expect(combined).toMatch(/\boods-zr-\d+\b/);
    expect(combined).not.toMatch(/\bzr\d+-(?:cls-\d+|ani-\d+|[sgpc]\d+)\b/);
  });
});
