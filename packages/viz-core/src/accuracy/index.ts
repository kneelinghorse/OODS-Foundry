// Sprint-170 m01 — the accuracy rules engine (#818, the fourth #977 pillar).
//
// PUBLIC SURFACE: `ACCURACY_RULES` + `evaluateAccuracyRules` + the types. Everything else in
// this directory is module-internal and reachable only by relative path (the proof specs do
// exactly that, so a discriminating check can compose a mutant from the REAL predicates
// instead of transcribing them).
//
// The engine is a pure reader: it never rebuilds, re-renders or re-recommends, and it never
// writes to `spec` or `compiled` (#110). `artifact.certify` therefore keeps hashing the same
// untouched compiled object before and after evaluation.

import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { evaluateAggregationHiding } from './aggregation-rule.js';
import { evaluateDualAxis } from './dual-axis-rule.js';
import { evaluateAreaEncodesLinear, evaluateNonZeroBarBaseline } from './scale-rules.js';
import type { AccuracyFinding, AccuracyResult, AccuracyRule } from './types.js';

export type {
  AccuracyFinding,
  AccuracyResult,
  AccuracyRule,
  AccuracyRuleId,
  AccuracyRuleOutcome,
} from './types.js';

// The ECharts-side engine (s172 m03) — a SECOND rule type over a per-type data operand,
// deliberately not a widening of the cartesian one. See ./echarts-index.ts's header.
export * from './echarts-index.js';

/**
 * The FOUR CARTESIAN rules, in evaluation order. The scope is closed and was ratified
 * verbatim from #818/#1071 through #1112 to the s170 lock: four structural distortions a
 * reader can be misled by, each decidable from the IR + the compiled Vega-Lite spec alone.
 * Adding a fifth to THIS set is a scope decision, not a code change.
 *
 * THE SCOPE CHAIN CONTINUES (s172). The ratified s172 pillar fork WAS that scope
 * decision, and what it changed was the premise rather than the count: the accuracy pillar
 * now also covers the 8 ECharts-primary types, whose IR is metadata-only and whose data
 * lives in a per-type operand this interface cannot reach. The initial six rules (OODS-V154..V159)
 * live in ./echarts-index.ts behind their OWN rule type and their own evaluator. This set,
 * this interface and evaluate(spec, compiled) are UNCHANGED — every s170 pin still holds,
 * and a cartesian rule still sees exactly the IR and the compiled spec.
 *
 * Each `summary` states what the rule claims INCLUDING what it deliberately excludes — it is
 * the claim a reader of `accuracy:'pass'` is entitled to, and §4's ceiling is written from it.
 */
export const ACCURACY_RULES: readonly AccuracyRule[] = [
  {
    id: 'non-zero-bar-baseline',
    code: 'OODS-V150',
    summary:
      "A bar's value axis is a linear zero-anchored scale, so bar length is proportional to value. Fires on scale.zero:false (baseline moved), log (no zero exists) and sqrt (zero-anchored but not proportional), each reported by its own cause.",
    evaluate: evaluateNonZeroBarBaseline,
  },
  {
    id: 'dual-axis',
    code: 'OODS-V151',
    summary:
      "Layered marks sharing one plot frame do not resolve a positional scale independently. LAYER scope only — facet-scope and concat-scope independence are separate panels and never fire, and a non-positional (color/size/shape/detail) independence never fires.",
    evaluate: evaluateDualAxis,
  },
  {
    id: 'area-encodes-linear',
    code: 'OODS-V152',
    summary:
      "An area's value axis is a linear zero-anchored scale, so filled extent is proportional to value. Ranged (x2/y2) areas are EXCLUDED: a band encodes two edge positions, not an extent from a baseline.",
    evaluate: evaluateAreaEncodesLinear,
  },
  {
    id: 'aggregation-hiding',
    code: 'OODS-V153',
    summary:
      'A declared aggregation that actually merges rows is disclosed by the accessible description, the chart title, or the aggregated axis title. Identity aggregations (one row per group) never fire; the disclosure check is lexical over exactly those three surfaces.',
    evaluate: evaluateAggregationHiding,
  },
];

/**
 * Evaluate the accuracy rules over an IR and the Vega-Lite spec compiled from it.
 *
 * `rulesEvaluated` counts the rules that RESOLVED THEIR OPERAND and ran — not the rules
 * offered. A rule whose operand is unreadable (no compiled spec) or unevaluable (rows behind
 * a data url, an aggregate op outside the IR vocabulary) reports itself unevaluated and
 * contributes a note, so a caller can never read silence as coverage (standing rule 1).
 *
 * `rules` is injectable so a mutation gate can swap ONE rule out and prove that exactly its
 * own RED stops firing — the guard ships its own bite proof. Production callers pass nothing.
 */
export function evaluateAccuracyRules(
  spec: NormalizedVizSpec,
  compiled: unknown,
  rules: readonly AccuracyRule[] = ACCURACY_RULES,
): AccuracyResult {
  const findings: AccuracyFinding[] = [];
  const notes: string[] = [];
  let rulesEvaluated = 0;

  for (const rule of rules) {
    const outcome = rule.evaluate(spec, compiled);
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
