// s179 m03 — the direct ECharts proof consumes the exact JSON-safe option that
// artifact.certify hashes. The raw adapter object is not a renderer input: tooltip
// closures and any other raw-only mutations cannot leak around the wire projection.

import { describe, expect, it } from "vitest";
import { canonicalize } from "@oods/artifacts";
import type { NormalizedVizSpec } from "@oods/viz-core";
import {
  emitRawEChartsOption,
  evaluateEChartsDeterminism,
  projectEChartsOption,
} from "../../src/tools/certify-echarts-emit.js";
import { GEO_CHOROPLETH_BRANCH } from "./s172-echarts-operands.js";
import {
  chartDataElements,
  normalizeBaselineGeneratedTokens,
  renderProjectedOption,
  svgAttribute,
} from "../../../viz-core/test/s179-echarts-render-harness.js";

const SPEC = {
  $schema: "https://oods-foundry.com/viz-spec/v1",
  id: "viz:choropleth",
  name: "State sales",
  data: { values: [] },
  marks: [{ trait: "MarkChoropleth" }],
  encoding: {},
  a11y: { description: "Choropleth map of State sales." },
} as NormalizedVizSpec;

function normalizedRender(projected: Record<string, unknown>): string {
  return normalizeBaselineGeneratedTokens(renderProjectedOption(projected));
}

function replaceRamp(option: Record<string, unknown>): void {
  const visualMap = option.visualMap as Record<string, unknown>;
  const inRange = visualMap.inRange as Record<string, unknown>;
  inRange.color = ["#ff00ff", "#00ffff", "#ffff00"];
}

describe("certify ECharts served-option render carrier (s179 m03)", () => {
  it("retains two independent exact projections and renders the joined choropleth from the first", () => {
    const outcome = evaluateEChartsDeterminism(
      SPEC,
      "choropleth",
      GEO_CHOROPLETH_BRANCH,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error(`${outcome.code}: ${outcome.message}`);
    }

    const independentlyProjected = projectEChartsOption(
      emitRawEChartsOption(SPEC, "choropleth", GEO_CHOROPLETH_BRANCH),
    );
    expect(outcome.firstProjected).toEqual(independentlyProjected);
    expect(outcome.secondProjected).toEqual(independentlyProjected);
    expect(outcome.firstProjected).not.toBe(outcome.secondProjected);
    expect(outcome.firstCanonical).toBe(canonicalize(outcome.firstProjected));
    expect(outcome.secondCanonical).toBe(canonicalize(outcome.secondProjected));
    expect(outcome.firstCanonical).toBe(outcome.secondCanonical);

    expect(Object.hasOwn(outcome.firstProjected, "__registration")).toBe(true);
    expect(Object.hasOwn(outcome.firstProjected, "__joinDiagnostics")).toBe(
      false,
    );
    const svg = normalizedRender(outcome.firstProjected);
    // renderProjectedOption clones before extracting __registration; the hashed carrier
    // remains intact for the independent second render.
    expect(Object.hasOwn(outcome.firstProjected, "__registration")).toBe(true);

    const marks = chartDataElements(svg);
    // s222-m02: the ramp's ends are brand A's sequential scale (the accent's hue on the s197 tone curve).
    expect(marks.map((mark) => svgAttribute(mark, "fill"))).toEqual([
      "rgb(20,41,137)",
      "rgb(229,235,250)",
    ]);
    expect(
      marks.map((mark) => svgAttribute(mark, "ecmeta_data_index")),
    ).toEqual(["0", "1"]);
  });

  it("ignores a raw-only paint mutation but moves when the retained projected paint moves", () => {
    const outcome = evaluateEChartsDeterminism(
      SPEC,
      "choropleth",
      GEO_CHOROPLETH_BRANCH,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error(`${outcome.code}: ${outcome.message}`);
    }

    const baselineSvg = normalizedRender(outcome.firstProjected);
    const rawOnly = emitRawEChartsOption(
      SPEC,
      "choropleth",
      GEO_CHOROPLETH_BRANCH,
    ) as Record<string, unknown>;
    replaceRamp(rawOnly);

    // The retained proof object was already projected from its own independent emit.
    // A later mutation of some raw adapter object cannot move that proof.
    expect(normalizedRender(outcome.firstProjected)).toBe(baselineSvg);

    // The mutation is genuinely paint-affecting once it crosses the projection seam.
    const projectedFromMutatedRaw = projectEChartsOption(rawOnly as never);
    expect(normalizedRender(projectedFromMutatedRaw)).not.toBe(baselineSvg);

    const projectedMutation = structuredClone(outcome.firstProjected);
    replaceRamp(projectedMutation);
    expect(normalizedRender(projectedMutation)).not.toBe(baselineSvg);
  });
});
