import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ECHARTS_OPERAND_CASES,
  GEO_BUBBLE_NO_GEOMETRY_BRANCH,
  GEO_CHOROPLETH_UNMATCHED_BRANCH,
} from "./fixtures/s172-echarts-operands.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..");
const sourcePath = path.join(
  repoRoot,
  "packages/mcp-server/test/tools/s172-echarts-operands.ts",
);
const mirrorPath = path.join(
  repoRoot,
  "packages/viz-core/test/fixtures/s172-echarts-operands.ts",
);
const EXPECTED_SHA256 =
  "3d6387c956302e7420ead2b6ffe1e8f82491dd8d26ed75435319af2c3c8020ce";

const sha256 = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

describe("s179 m01 — ECharts operand mirror parity", () => {
  it("the viz-core fixture is a byte-for-byte mirror of the mcp-server source", () => {
    const source = readFileSync(sourcePath);
    const mirror = readFileSync(mirrorPath);

    expect(mirror.equals(source)).toBe(true);
  });

  it("both source and mirror carry the pinned s179 baseline bytes", () => {
    expect(sha256(readFileSync(sourcePath))).toBe(EXPECTED_SHA256);
    expect(sha256(readFileSync(mirrorPath))).toBe(EXPECTED_SHA256);
  });

  it("exports exactly the eight standard ECharts operand cases", () => {
    expect(ECHARTS_OPERAND_CASES).toHaveLength(8);
    expect(ECHARTS_OPERAND_CASES.map((operand) => operand.chartType)).toEqual([
      "treemap",
      "sunburst",
      "sankey",
      "chord",
      "force_graph",
      "choropleth",
      "bubble_map",
      "flow_map",
    ]);
  });

  it("exports both adversarial siblings without adding either to the standard cases", () => {
    expect(GEO_CHOROPLETH_UNMATCHED_BRANCH).toBeDefined();
    expect(GEO_BUBBLE_NO_GEOMETRY_BRANCH).toBeDefined();

    const standardOperands = ECHARTS_OPERAND_CASES.map(
      (operand) => operand.branchData,
    );
    expect(standardOperands).not.toContain(GEO_CHOROPLETH_UNMATCHED_BRANCH);
    expect(standardOperands).not.toContain(GEO_BUBBLE_NO_GEOMETRY_BRANCH);
  });
});
