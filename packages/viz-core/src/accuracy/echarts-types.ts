// Sprint-172 m03 — the ECHARTS-SIDE accuracy rule vocabulary.
//
// THE SEAM, and why it exists. The four cartesian rules (types.ts) evaluate
// `(spec, compiled)`: the IR plus the Vega-Lite spec certify compiled from it. An
// ECharts-primary IR is METADATA-ONLY by ratified design — data:{values:[]}, encoding:{} —
// so neither operand carries the chart's data, and the cartesian interface literally
// cannot reach it. The chart's nodes/links/rows live in the tool-input data BRANCH.
//
// So this is a SECOND rule type with its own operand, not a widening of the first. The
// cartesian AccuracyRule interface, ACCURACY_RULES and evaluate(spec, compiled) are
// UNTOUCHED — every s170 pin still holds. `AccuracyRuleOutcome` is deliberately SHARED:
// the tri-state (ran-and-clean / ran-and-detected / could-not-resolve) is the same
// honesty contract on both sides, and rulesEvaluated means the same thing in both.
//
// POSITIVE-PRECONDITION (standing rule 1, #1228) applies identically: a rule fires only on
// POSITIVE detection. An operand it cannot resolve is `evaluated:false` with a note —
// never a pass, never a finding.
//
// WHY MOST RULES READ THE BRANCH: for several of these the
// distortion's PROVENANCE is erased by emission. A sankey node with an explicit `value`
// and one whose value was computed from its links are indistinguishable in the option —
// both are just `{name, value}`. Only the branch says which it was.

import type { AccuracyRuleOutcome } from './types.js';

/** Stable rule ids key the registered OODS-V154..V159 and V168..V173 codes. */
export type EChartsAccuracyRuleId =
  | 'hierarchy-negative-value'
  | 'hierarchy-non-additive-parent'
  | 'flow-negative-link-value'
  | 'sankey-node-value-override'
  | 'sankey-duplicate-link'
  | 'choropleth-join-conflict'
  | 'bubble-negative-size'
  | 'bubble-radius-scaling'
  | 'bubble-coordinate-conflict'
  | 'flow-map-negative-strength'
  | 'flow-map-duplicate-flow'
  | 'force-graph-duplicate-link';

/** The 8 ECharts-primary chart types, as the accuracy engine names them. */
export type EChartsAccuracyChartType =
  | 'treemap'
  | 'sunburst'
  | 'sankey'
  | 'chord'
  | 'force_graph'
  | 'choropleth'
  | 'bubble_map'
  | 'flow_map';

/**
 * The operand: which chart type, and the tool-input data branch for it. The optional built
 * option allows size rules to measure actual drawing operands. No render step, no rebuild
 * (#110 holds on this side too).
 */
export interface EChartsAccuracyOperand {
  readonly chartType: EChartsAccuracyChartType;
  readonly branchData: unknown;
  /** Already-built, projected drawing operand; rules never rebuild it. */
  readonly option?: unknown;
}

export interface EChartsAccuracyRule {
  readonly id: EChartsAccuracyRuleId;
  /** Registered error code emitted when this rule fires (packages/mcp-server errors/registry). */
  readonly code: string;
  /** One-line statement of what the rule claims — INCLUDING what it deliberately excludes. */
  readonly summary: string;
  /** Pure. Reads the operand, mutates nothing, returns no reference into it. */
  readonly evaluate: (operand: EChartsAccuracyOperand) => AccuracyRuleOutcome;
}

/**
 * One positively-detected distortion. Structurally identical to the cartesian
 * AccuracyFinding apart from the id union — deliberately a SEPARATE type rather than a
 * widening of it, so the cartesian side keeps the exact shape s170 pinned. certify reads
 * `code` and `message` from either and needs no new output field: the registered code is
 * the discriminator.
 */
export interface EChartsAccuracyFinding {
  readonly ruleId: EChartsAccuracyRuleId;
  readonly code: string;
  readonly message: string;
}

export interface EChartsAccuracyResult {
  readonly findings: readonly EChartsAccuracyFinding[];
  readonly rulesEvaluated: number;
  readonly notes: readonly string[];
}

/**
 * The chartered tolerance for every float comparison in these rules: a RELATIVE epsilon.
 *
 * An ABSOLUTE epsilon would be wrong in both directions — 1e-9 is enormous next to values
 * of 1e-12 and invisible next to values of 1e12. And exact equality would be worse: a
 * parent authored as 0.3 over children 0.1 and 0.2 is legitimate decimal data, but
 * 0.1 + 0.2 === 0.30000000000000004 in IEEE-754, so exact equality would report a
 * distortion that does not exist. Both directions are pinned by tolerance-boundary
 * RED/GREEN pairs in the proof spec.
 */
export const ACCURACY_RELATIVE_EPSILON = 1e-9;

/** |a - b| exceeds the relative tolerance. Both-zero is never a difference. */
export function differsBeyondTolerance(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) > ACCURACY_RELATIVE_EPSILON * scale;
}
