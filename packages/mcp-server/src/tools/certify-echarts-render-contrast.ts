import type { TokenScope } from '@oods/viz-core';
import type { ContrastVerdict } from "./certify-contrast.js";
import {
  evaluateCategoricalRoleA,
  evaluateCategoricalRoleC,
  type CategoricalRoleAGrade,
  type CategoricalRoleCGrade,
} from "./certify-contrast.js";
import { extractEChartsRoleCPaints } from "./certify-echarts-role-c.js";
import { deriveEChartsRoleAAssignment } from "./echarts-role-a-assignment.js";
import type { EChartsPrimaryType } from "./echarts-primary.js";

const GEO_TYPES = new Set<EChartsPrimaryType>([
  "choropleth",
  "bubble_map",
  "flow_map",
]);

export interface EChartsRenderedRoleC
  extends Omit<CategoricalRoleCGrade, "verdict"> {
  readonly verdict: CategoricalRoleCGrade["verdict"] | "exempt";
}

export interface EChartsRenderedRoleA
  extends Omit<CategoricalRoleAGrade, "verdict"> {
  readonly verdict: CategoricalRoleAGrade["verdict"] | "not-applicable";
}

export interface EChartsRenderContrastResult {
  readonly contrast: ContrastVerdict;
  readonly contrastNote: string;
  readonly roleCPaints: readonly string[];
  readonly roleAAssignment: readonly string[];
  readonly roleC: EChartsRenderedRoleC;
  readonly roleA: EChartsRenderedRoleA;
}

export interface EChartsRenderContrastInput {
  readonly scope?: TokenScope;
  readonly chartType: EChartsPrimaryType;
  /** Normalized SVG rendered from this exact projected option. */
  readonly normalizedSvg: string;
  /** The retained JSON-safe object returned by projectEChartsOption. */
  readonly projectedOption: Readonly<Record<string, unknown>>;
}

/**
 * Grade actual ECharts carrier paints and semantic category assignments as separate
 * roles. The API accepts no raw option: render evidence and semantics must both come
 * from the same retained projected object.
 */
export function evaluateEChartsRenderContrast(
  input: EChartsRenderContrastInput,
): EChartsRenderContrastResult {
  const extraction = extractEChartsRoleCPaints(
    input.normalizedSvg,
    input.projectedOption,
  );
  if (extraction.status === "ungradeable") {
    return {
      contrast: "ungradeable",
      contrastNote:
        `The rendered ECharts SVG could not supply readable chart carrier paints ` +
        `(${extraction.reason ?? "unknown extraction failure"}); contrast is ungradeable.`,
      roleCPaints: [],
      roleAAssignment: [],
      roleC: { verdict: "ungradeable", failingPaints: [] },
      roleA: { verdict: "ungradeable", lowChromaPaints: [] },
    };
  }

  if (GEO_TYPES.has(input.chartType)) {
    return {
      contrast: "exempt",
      contrastNote:
        "Geo carrier paints were read from the rendered ECharts SVG, but geo color remains " +
        "exempt from categorical contrast grading under the standing gradient-essential ruling.",
      roleCPaints: extraction.roleCPaints,
      roleAAssignment: [],
      roleC: { verdict: "exempt", failingPaints: [] },
      roleA: { verdict: "not-applicable", lowChromaPaints: [] },
    };
  }

  const assignment = deriveEChartsRoleAAssignment({
    chartType: input.chartType,
    projectedOption: input.projectedOption,
    realizedPaints: extraction.roleCPaints,
  });
  if (assignment.status !== "assigned") {
    return {
      contrast: "ungradeable",
      contrastNote:
        `The rendered ECharts chart did not expose a complete semantic category-to-paint ` +
        `assignment (${assignment.reason}); contrast is ungradeable.`,
      roleCPaints: extraction.roleCPaints,
      roleAAssignment: [],
      roleC: evaluateCategoricalRoleC(extraction.roleCPaints, input.scope, typeof input.projectedOption.backgroundColor === "string" ? input.projectedOption.backgroundColor : undefined),
      roleA: { verdict: "ungradeable", lowChromaPaints: [] },
    };
  }

  const roleC = evaluateCategoricalRoleC(extraction.roleCPaints, input.scope, typeof input.projectedOption.backgroundColor === "string" ? input.projectedOption.backgroundColor : undefined);
  const roleA = evaluateCategoricalRoleA(assignment.roleAAssignment);
  const contrast = worstCategoricalVerdict(roleC.verdict, roleA.verdict);
  return {
    contrast,
    contrastNote: categoricalContrastNote(roleC, roleA),
    roleCPaints: extraction.roleCPaints,
    roleAAssignment: assignment.roleAAssignment,
    roleC,
    roleA,
  };
}

function worstCategoricalVerdict(
  roleC: CategoricalRoleCGrade["verdict"],
  roleA: CategoricalRoleAGrade["verdict"],
): Extract<ContrastVerdict, "pass" | "fail" | "ungradeable"> {
  if (roleC === "fail" || roleA === "fail") return "fail";
  if (roleC === "ungradeable" || roleA === "ungradeable") return "ungradeable";
  return "pass";
}

function categoricalContrastNote(
  roleC: CategoricalRoleCGrade,
  roleA: CategoricalRoleAGrade,
): string {
  if (roleC.verdict === "fail") {
    return (
      `Role-C (WCAG 1.4.11) fail: ${roleC.failingPaints.join(", ")} below 3:1 ` +
      "vs the canvas, measured from actual rendered ECharts carrier geometry."
    );
  }
  if (roleA.lowChromaPaints.length > 0) {
    return (
      `Role-A chroma-floor fail: ${roleA.lowChromaPaints.join(", ")} below 0.03 OKLCH ` +
      "chroma — reads as gray, not a distinguishable categorical hue."
    );
  }
  if (roleA.verdict === "fail") {
    return (
      "Role-A fail: min-pairwise CIEDE2000 (min over normal + deuteran/protan/tritan " +
      `CVD) = ${roleA.minimumDeltaE?.toFixed(2) ?? "unavailable"} < 2 — categorical ` +
      "series are not distinguishable."
    );
  }
  if (roleA.minimumDeltaE !== undefined && roleA.minimumDeltaE < 10) {
    return (
      `Distinguishability caution: min-pairwise CIEDE2000 (min-over-CVD) = ` +
      `${roleA.minimumDeltaE.toFixed(2)} (below the 10 best-practice target but >= 2, ` +
      "so not a failure)."
    );
  }
  return "Contrast was graded from the actual rendered ECharts carrier geometry and semantic assignment.";
}
