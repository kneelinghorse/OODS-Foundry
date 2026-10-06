// s179 m01 — operand-backed artifact.certify baseline capture.
//
// Unlike the s172 {spec}-only fixture, this capture supplies the SAME canonical data
// branch to viz.render and artifact.certify for all eight ECharts-primary families. It
// therefore sees the operand-backed determinism object and can pin the pre-s179 absence
// of determinism.renderHash — a property the {spec}-only response cannot observe because
// that path carries no determinism object at all.
//
// The committed fixture was captured at pristine
// `1be93f8e16fee2607682361bbd56e521fda3bcdb` before any s179 product edit. Future
// intended movement is declared in artifact.certify.echarts-s179-baseline.spec.ts; the
// baseline fixture itself remains the named pre-movement evidence.

import { writeFileSync } from "node:fs";
import type { NormalizedVizSpec } from "@oods/viz-core";
import { handle as certify } from "../../src/tools/artifact.certify.js";
import { handle as vizRender } from "../../src/tools/viz.render.js";
import {
  ECHARTS_OPERAND_CASES,
  renderInputFor,
} from "./s172-echarts-operands.js";

const out: Record<string, unknown> = {};

for (const operand of ECHARTS_OPERAND_CASES) {
  const rendered = await vizRender(renderInputFor(operand) as never);
  if (
    rendered.status !== "ok" ||
    !rendered.normalizedSpec ||
    !rendered.contentHash
  ) {
    throw new Error(`viz.render failed while capturing ${operand.chartType}`);
  }
  const certified = await certify({
    spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
    data: { [operand.branch]: operand.branchData } as never,
  });
  out[operand.chartType] = {
    renderedContentHash: rendered.contentHash,
    certified,
  };
}

const target = new URL(
  "./__fixtures__/s179-certify-operand-baseline.json",
  import.meta.url,
);
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(
  `wrote ${Object.keys(out).length} operand-backed responses to ${target.pathname}`,
);
