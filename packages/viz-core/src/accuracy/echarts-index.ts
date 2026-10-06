// Sprint-172 m03 — the ECharts-side accuracy engine (#818's fourth #977 pillar, widened
// from the 5 cartesian types to all 13).
//
// PUBLIC SURFACE: `ECHARTS_ACCURACY_RULES`, `echartsAccuracyRulesFor`,
// `evaluateEChartsAccuracyRules`, and the types. Everything else in this directory stays
// module-internal and reachable only by relative path, so a discriminating check can
// compose a mutant from the REAL predicates instead of transcribing them (the s170 pattern).
//
// THE SCOPE CHAIN, restated because the cartesian engine's own ratification comment says
// the four rules are "each decidable from the IR + the compiled spec alone. Adding a fifth
// is a scope decision, not a code change." That is still true OF THAT SET. s172 did not add
// a fifth cartesian rule: the ratified s172 pillar fork IS the scope decision, and it
// widened the PREMISE — from "the IR + the compiled spec" to "the IR + the per-type
// operand". These six rules are decidable from the data BRANCH, which no cartesian rule can
// see and which is the only place an ECharts-primary chart's data exists.
//
// s195 m04 widens the offered sets to every ECharts-primary type. The graph
// branch CAN carry invalid relationships: duplicate directed links are now checked.
// Geo magnitude, scale and coordinate identity rules follow the public builder's
// actual inputs. A missing precondition stays unevaluated; an empty offered set
// (including a test-injected one) never claims that invalid data is impossible.

import type { EChartsAccuracyFinding, EChartsAccuracyResult } from './echarts-types.js';
import {
  evaluateHierarchyNegativeValue,
  evaluateHierarchyNonAdditiveParent,
} from './echarts-hierarchy-rules.js';
import {
  evaluateFlowNegativeLinkValue,
  evaluateSankeyDuplicateLink,
  evaluateSankeyNodeValueOverride,
} from './echarts-flow-rules.js';
import { evaluateChoroplethJoinConflict } from './echarts-geo-rules.js';
import {
  evaluateBubbleNegativeSize,
  evaluateBubbleRadiusScaling,
  evaluateBubbleCoordinateConflict,
  evaluateFlowMapNegativeStrength,
  evaluateFlowMapDuplicateFlow,
} from './echarts-spatial-rules.js';
import { evaluateForceGraphDuplicateLink } from './echarts-graph-rules.js';
import type {
  EChartsAccuracyChartType,
  EChartsAccuracyOperand,
  EChartsAccuracyRule,
} from './echarts-types.js';

export type {
  EChartsAccuracyChartType,
  EChartsAccuracyFinding,
  EChartsAccuracyOperand,
  EChartsAccuracyResult,
  EChartsAccuracyRule,
  EChartsAccuracyRuleId,
} from './echarts-types.js';
export { ACCURACY_RELATIVE_EPSILON, differsBeyondTolerance } from './echarts-types.js';

const V154: EChartsAccuracyRule = {
  id: 'hierarchy-negative-value',
  code: 'OODS-V154',
  summary:
    'Every treemap/sunburst node value is a finite non-negative number, so area and angle can encode it. Unauthored values never fire — a renderer-computed parent has nothing to contradict.',
  evaluate: evaluateHierarchyNegativeValue,
};

const V155: EChartsAccuracyRule = {
  id: 'hierarchy-non-additive-parent',
  code: 'OODS-V155',
  summary:
    'An EXPLICIT treemap/sunburst parent value equals the sum of its children, under a relative 1e-9 tolerance. Fires only where the parent has an authored value AND every child has one — a partly-valueless set has no computable sum and is reported unevaluated, never guessed.',
  evaluate: evaluateHierarchyNonAdditiveParent,
};

const V156: EChartsAccuracyRule = {
  id: 'flow-negative-link-value',
  code: 'OODS-V156',
  summary:
    'Every sankey/chord link value is a finite non-negative number, so ribbon width can encode it. sankey rejects non-finite upstream (V126) but not negatives; chord validates neither.',
  evaluate: evaluateFlowNegativeLinkValue,
};

const V157: EChartsAccuracyRule = {
  id: 'sankey-node-value-override',
  code: 'OODS-V157',
  summary:
    "A sankey node's drawn height is the flow its ribbons carry. Two causes: an explicit node.value that disagrees with max(incoming, outgoing), and an INTERMEDIATE node (incoming>0 AND outgoing>0) whose sides disagree. Sources and sinks are endpoints and never fire; both comparisons use the relative 1e-9 tolerance.",
  evaluate: evaluateSankeyNodeValueOverride,
};

const V158: EChartsAccuracyRule = {
  id: 'sankey-duplicate-link',
  code: 'OODS-V158',
  summary:
    'A directed (source, target) pair appears at most once in a sankey. Duplicates stack into one merged ribbon whose width is their sum. A deliberate certify-side reopen of the s148 F4 sankey exclusion — render is untouched — and error-severity, unlike F4\'s warning.',
  evaluate: evaluateSankeyDuplicateLink,
};

const V159: EChartsAccuracyRule = {
  id: 'choropleth-join-conflict',
  code: 'OODS-V159',
  summary:
    'Where a choropleth join matches several rows to one region, the rows that CARRY the value field agree on it. Benign multiplicity (agreeing rows, duplicate rows, or sparse rows that omit the field entirely — the merge spreads records, so an absent key cannot change the shade) NEVER fires — one-to-many is supported; only CONFLICTING carried values fire, because then the shade is last-record-wins arbitrary.',
  evaluate: evaluateChoroplethJoinConflict,
};

const V168: EChartsAccuracyRule = {
  id: 'bubble-negative-size',
  code: 'OODS-V168',
  summary: 'Encoded bubble sizes must resolve to finite non-negative magnitudes. Renderer-accepted numeric strings are checked after the same coercion; unresolved cells are not passes.',
  evaluate: evaluateBubbleNegativeSize,
};

const V169: EChartsAccuracyRule = {
  id: 'bubble-radius-scaling',
  code: 'OODS-V169',
  summary: 'Drawn bubble diameter ratios squared must equal non-negative magnitude ratios, anchored at zero. Reads the built option independently; missing rows or sizes are unresolved.',
  evaluate: evaluateBubbleRadiusScaling,
};

const V170: EChartsAccuracyRule = {
  id: 'bubble-coordinate-conflict',
  code: 'OODS-V170',
  summary: 'Bubble rows at the same emitted longitude/latitude must agree on encoded size and colour. Unused geo.join metadata is not point identity; agreeing duplicates do not fire.',
  evaluate: evaluateBubbleCoordinateConflict,
};

const V171: EChartsAccuracyRule = {
  id: 'flow-map-negative-strength',
  code: 'OODS-V171',
  summary: 'An encoded flow-map strength must be finite and non-negative because it drives line width. Missing field or values remain unevaluated.',
  evaluate: evaluateFlowMapNegativeStrength,
};

const V172: EChartsAccuracyRule = {
  id: 'flow-map-duplicate-flow',
  code: 'OODS-V172',
  summary: 'A flow-map ordered pair of geographic endpoints occurs at most once. Repeated directed routes overdraw; reciprocal routes remain distinct.',
  evaluate: evaluateFlowMapDuplicateFlow,
};

const V173: EChartsAccuracyRule = {
  id: 'force-graph-duplicate-link',
  code: 'OODS-V173',
  summary: 'A public force-graph directed endpoint pair occurs at most once. Reciprocal edges and single self-loops are valid; no claim is made about force-layout physics or unencoded weights.',
  evaluate: evaluateForceGraphDuplicateLink,
};

/** Stable registered codes, in code order. */
export const ECHARTS_ACCURACY_RULES: readonly EChartsAccuracyRule[] = [V154, V155, V156, V157, V158, V159, V168, V169, V170, V171, V172, V173];

/**
 * The rules OFFERED for a chart type. Explicit and exhaustive: an empty set is a stated
 * position (see the header), not a fall-through.
 */
const OFFERED: Readonly<Record<EChartsAccuracyChartType, readonly EChartsAccuracyRule[]>> = {
  treemap: [V154, V155],
  sunburst: [V154, V155],
  sankey: [V156, V157, V158],
  chord: [V156],
  force_graph: [V173],
  choropleth: [V159],
  bubble_map: [V168, V169, V170],
  flow_map: [V171, V172],
};

export function echartsAccuracyRulesFor(chartType: EChartsAccuracyChartType): readonly EChartsAccuracyRule[] {
  return OFFERED[chartType] ?? [];
}

/**
 * The note that ships when a type offers no rule at all. Names the empty set explicitly so
 * `rulesEvaluated: 0` reads as "nothing was offered" rather than "nothing resolved".
 */
export function emptyOfferedSetNote(chartType: EChartsAccuracyChartType): string {
  return `No accuracy rule is offered for ${chartType} in this evaluation. rulesEvaluated is 0 because the offered set is empty, not because a rule failed to resolve its operand. This is a coverage limit, not a claim that its data cannot be invalid.`;
}

/**
 * Evaluate the ECharts-side accuracy rules for one (spec, data) operand.
 *
 * `rulesEvaluated` counts the rules from THIS TYPE'S offered set that resolved their operand
 * and ran — the same meaning it carries on the cartesian side. A rule that could not resolve
 * reports itself unevaluated and contributes a note, so silence can never be read as
 * coverage (standing rule 1).
 *
 * `rules` is injectable so a mutation gate can swap ONE rule out and prove exactly its own
 * RED stops firing — the guard ships its own bite proof. Production callers pass nothing.
 */
export function evaluateEChartsAccuracyRules(
  operand: EChartsAccuracyOperand,
  rules: readonly EChartsAccuracyRule[] = echartsAccuracyRulesFor(operand.chartType),
): EChartsAccuracyResult {
  const findings: EChartsAccuracyFinding[] = [];
  const notes: string[] = [];
  let rulesEvaluated = 0;

  if (rules.length === 0) {
    return { findings, rulesEvaluated: 0, notes: [emptyOfferedSetNote(operand.chartType)] };
  }

  for (const rule of rules) {
    const outcome = rule.evaluate(operand);
    if (outcome.evaluated) {
      rulesEvaluated += 1;
    }
    if (outcome.message) {
      findings.push({ ruleId: rule.id, code: rule.code, message: outcome.message });
    }
    if (outcome.note && !notes.includes(outcome.note)) {
      notes.push(outcome.note);
    }
  }

  return { findings, rulesEvaluated, notes };
}
