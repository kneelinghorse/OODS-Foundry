import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ECHARTS_OPERAND_CASES } from "./fixtures/s172-echarts-operands.js";
import {
  SSR_HEIGHT,
  SSR_WIDTH,
  STABLE_CHART_TYPES,
  buildProjectionProofOptions,
  buildProjectedOption,
  captureSequentialRenders,
  chartDataElements,
  renderProjectedOption,
  svgAttribute,
  type CanonicalChartType,
  type SequentialRenderCapture,
} from "./s179-echarts-render-harness.js";

type StableChartType = (typeof STABLE_CHART_TYPES)[number];

// s222-m02 (#2502 ruling 12, with m01's chrome from #2505): every family's normalized SVG moved once. The categorical
// and sequential scales are brand A's recipe (the indigo accent's step 9, then hues spread from it), the chrome reads m01's
// canvas, text, border and font tokens, the geo land takes the neutral's step 3 and a titled map paints its title in the
// text colour. With paints and font families masked the six other renders are byte-equal to the pinned ones; the chord
// also moved its ring below the title band (artifacts/product-reality/sprint-222/m02/charts/geometry/; epoch s222-m02).
const EXPECTED_NORMALIZED_HASHES: Readonly<Record<StableChartType, string>> = {
  treemap: "fa2343b907887fe58b9a0d9d00d1a5ce52697db604b446e4e64de4023d15d0af",
  sunburst: "12ecbe5ce9c9384291cffb9198531848f32394ea882a42aa897e9d19a65e67d0",
  // s201-m06: the sankey title band insets the flow below its title, so the named operand's normalized SVG moved once (sprint-201/golden-ledger.json, m06/certified-matrix).
  sankey: "c2c13a22443691ddf1977e8a13de38c0776dc933d10599a34f45801e4dec58ec",
  // s222-m02 follow-up: a titled chord takes the sankey's title band, so its ring is laid out below the title.
  chord: "1d2579cf985639ee6b50e59bcc905dcf69fd349476b7bf12e244460de412c056",
  // s211-m03: ECharts/ZRender 6.1.0 (GHSA-fgmj-fm8m-jvvx fixed) closes the visual-map handle's path with an explicit
  // `Z`, a one-byte change to a filled shape that draws the same pixels; these two map families' hashes moved once
  // (artifacts/product-reality/sprint-211/m03/echarts-6.1.0/ holds both renders), and the other five did not move.
  // s213-m01: a titled map reserves a title band (geo top 40, bottom 16), as the sankey and graph adapters do, so the
  // eleven-panel HC dashboard's "State sales" no longer draws its regions under its title; the three map families moved
  // once and the other four did not (artifacts/product-reality/sprint-213/m01/geo-title-band/ holds both renders).
  choropleth: "f04582c3707c8fe4c8d14136cf98c8e036df4e6f27732daa510a5185c6ca19e3",
  // s222-m02 follow-up: a bubble's default colours start at the first step that reaches 3:1 on the land (04 in light).
  bubble_map: "a6cc2f2a5c450176f145b055be2164404a69791958fbb6be3f328495eb1d9e1f",
  flow_map: "b4ebd9bc49604ca3aa7f333826895bc6b66131b85c1ea15ad9c5a83fd7aa03a3",
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..");
const harnessUrl = new URL("./s179-echarts-render-harness.ts", import.meta.url)
  .href;
const FRESH_PROCESS_TIMEOUT_MS = 180_000;

interface SubprocessCapture {
  readonly pid: number;
  readonly hashes: Record<StableChartType, string>;
}

function packageVersion(packageJsonPath: string): string {
  return (
    JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }
  ).version;
}

function captureInFreshProcess(): Promise<SubprocessCapture> {
  const marker = "__S179_CAPTURE__";
  const source = [
    `import { captureStableNormalizedHashes } from ${JSON.stringify(harnessUrl)};`,
    `const result = ${JSON.stringify(marker)} + JSON.stringify({ pid: process.pid, hashes: captureStableNormalizedHashes() });`,
    `process.stdout.write(result, () => process.exit(0));`,
  ].join("\n");

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", source],
      {
        cwd: repoRoot,
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
        encoding: "utf8",
        killSignal: "SIGTERM",
        maxBuffer: 1_048_576,
        timeout: FRESH_PROCESS_TIMEOUT_MS,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Fresh ECharts capture failed (${error.message}). stderr:\n${stderr}`,
              { cause: error },
            ),
          );
          return;
        }
        const markerIndex = stdout.lastIndexOf(marker);
        if (markerIndex < 0) {
          reject(
            new Error(
              `Fresh ECharts capture omitted its result marker. stdout:\n${stdout}`,
            ),
          );
          return;
        }
        resolve(
          JSON.parse(
            stdout.slice(markerIndex + marker.length),
          ) as SubprocessCapture,
        );
      },
    );
  });
}

describe("s179 m01 — ECharts 6 SSR normalization baseline", () => {
  let sequential: Record<CanonicalChartType, SequentialRenderCapture>;

  beforeAll(() => {
    sequential = captureSequentialRenders();
  }, 90_000);

  it("pins the exact ECharts/ZRender renderer pair and 600x400 viewport", () => {
    const require = createRequire(import.meta.url);
    const echartsPackagePath = require.resolve("echarts/package.json");
    const zrenderPackagePath = createRequire(echartsPackagePath).resolve(
      "zrender/package.json",
    );

    expect(packageVersion(echartsPackagePath)).toBe("6.1.0");
    expect(packageVersion(zrenderPackagePath)).toBe("6.1.0");
    expect({ width: SSR_WIDTH, height: SSR_HEIGHT }).toEqual({
      width: 600,
      height: 400,
    });
  });

  it("removes allocator noise for seven families but preserves force-layout entropy", () => {
    const rawInequality: Record<string, boolean> = {};
    const stableFirstHashes: Partial<Record<StableChartType, string>> = {};

    for (const operand of ECHARTS_OPERAND_CASES) {
      const chartType = operand.chartType as CanonicalChartType;
      const capture = sequential[chartType];
      rawInequality[chartType] = capture.first.rawSvg !== capture.second.rawSvg;
    }
    expect(rawInequality).toEqual({
      treemap: true,
      sunburst: true,
      sankey: true,
      chord: true,
      force_graph: true,
      choropleth: true,
      bubble_map: true,
      flow_map: true,
    });

    for (const chartType of STABLE_CHART_TYPES) {
      const capture = sequential[chartType];
      // These seven renders differ only in ZRender allocator tokens, so the
      // baseline remap must recover byte identity without touching geometry.
      expect(capture.first.normalizedSvg).toBe(capture.second.normalizedSvg);
      expect(capture.second.normalizedHash).toBe(
        EXPECTED_NORMALIZED_HASHES[chartType],
      );
      stableFirstHashes[chartType] = capture.first.normalizedHash;
    }
    expect(stableFirstHashes).toEqual(EXPECTED_NORMALIZED_HASHES);

    // Force layout consumes runtime randomness; treating it as allocator noise
    // would hide a substantive geometry difference.
    expect(sequential.force_graph.first.normalizedSvg).not.toBe(
      sequential.force_graph.second.normalizedSvg,
    );
    expect(sequential.force_graph.first.normalizedHash).not.toBe(
      sequential.force_graph.second.normalizedHash,
    );
  });

  it(
    "reproduces every stable hash in two actual fresh Node processes",
    async () => {
      // Run the independent captures serially so a saturated full-suite worker
      // pool cannot make two renderer processes compete for the same CPU budget.
      const first = await captureInFreshProcess();
      const second = await captureInFreshProcess();

      expect(first.pid).not.toBe(process.pid);
      expect(second.pid).not.toBe(process.pid);
      expect(first.pid).not.toBe(second.pid);
      expect(first.hashes).toEqual(EXPECTED_NORMALIZED_HASHES);
      expect(second.hashes).toEqual(EXPECTED_NORMALIZED_HASHES);
    },
    FRESH_PROCESS_TIMEOUT_MS * 2 + 30_000,
  );

  it("renders the projected joined choropleth through geo.nameProperty with ramp paints and row indexes", () => {
    const operand = ECHARTS_OPERAND_CASES.find(
      (candidate) => candidate.chartType === "choropleth",
    );
    if (!operand) {
      throw new Error("Missing canonical choropleth operand.");
    }
    const option = buildProjectedOption(operand);
    const geo = option.geo as Record<string, unknown>;
    const series = (option.series as Array<Record<string, unknown>>)[0];

    // The canonical features deliberately have `region`/`state_name` but no
    // default `name`. This assertion distinguishes the served, JSON-safe option
    // from a raw-adapter-only fix: the join property must survive projection.
    expect(geo.nameProperty).toBe("region");
    expect(Object.hasOwn(series, "nameProperty")).toBe(false);

    const chartElements = chartDataElements(renderProjectedOption(option));
    expect(chartElements).toHaveLength(2);
    // s222-m02: the ramp's ends are brand A's sequential scale (the accent's hue on the s197 tone curve).
    expect(
      chartElements.map((element) => svgAttribute(element, "fill")),
    ).toEqual(["rgb(20,41,137)", "rgb(229,235,250)"]);
    expect(
      chartElements.map((element) =>
        svgAttribute(element, "ecmeta_data_index"),
      ),
    ).toEqual(["0", "1"]);
  });

  it("distinguishes raw-only paint changes from changes to the projected render operand", () => {
    const operand = ECHARTS_OPERAND_CASES.find(
      (candidate) => candidate.chartType === "choropleth",
    );
    if (!operand) {
      throw new Error("Missing canonical choropleth operand.");
    }

    const { rawOption, projectedOption } = buildProjectionProofOptions(operand);
    const renderedPaints = (option: Record<string, unknown>): string[] =>
      chartDataElements(renderProjectedOption(option)).map(
        (element) => svgAttribute(element, "fill") ?? "",
      );
    const mutateRamp = (option: Record<string, unknown>): void => {
      const visualMap = option.visualMap as {
        inRange?: { color?: string[] };
      };
      if (!visualMap.inRange) {
        throw new Error("Canonical choropleth is missing visualMap.inRange.");
      }
      visualMap.inRange.color = ["#ff0000", "#00ff00"];
    };

    const baselinePaints = renderedPaints(projectedOption);
    mutateRamp(rawOption as unknown as Record<string, unknown>);
    expect(renderedPaints(projectedOption)).toEqual(baselinePaints);

    mutateRamp(projectedOption);
    expect(renderedPaints(projectedOption)).toEqual([
      "rgb(0,255,0)",
      "rgb(255,0,0)",
    ]);
    expect(renderedPaints(projectedOption)).not.toEqual(baselinePaints);
  });
});
