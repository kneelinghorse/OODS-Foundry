// Sprint-170 m01 — the ACCURACY rule vocabulary (#818's fourth #977 pillar).
//
// Four deterministic, READER-ONLY structural rules over the NormalizedVizSpec IR + the
// compiled Vega-Lite spec artifact.certify already produces. No scorer, no corpus, no
// render step, no recommender term (#110): a rule may read the IR and the compiled spec
// and NOTHING else, and it may never rewrite either.
//
// POSITIVE-PRECONDITION (standing rule 1, #1228): a rule fires only on POSITIVE detection
// of its distortion. An operand it cannot resolve is reported as `evaluated:false` — never
// as a pass and never as a finding — so `rulesEvaluated` tells a reader how many of the
// four actually ran rather than letting silence masquerade as coverage.

import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

/** The four rule ids. Stable — they key the registered OODS-V15x codes. */
export type AccuracyRuleId =
  | 'non-zero-bar-baseline'
  | 'dual-axis'
  | 'area-encodes-linear'
  | 'aggregation-hiding';

/** One positively-detected distortion. `code` is the registered OODS error code. */
export interface AccuracyFinding {
  readonly ruleId: AccuracyRuleId;
  readonly code: string;
  readonly message: string;
}

/**
 * What one rule concluded.
 *  - `evaluated:true`  + no message → the rule ran and positively detected nothing.
 *  - `evaluated:true`  + message    → the rule ran and positively detected its distortion.
 *  - `evaluated:true`  + note       → the rule ran, detected nothing, AND the note says
 *    the pass had no subject (s176 m03b: a spec with no declared aggregation passes the
 *    aggregation-hiding rule vacuously — the note makes the vacuity legible without
 *    moving the verdict or the rulesEvaluated count).
 *  - `evaluated:false` + note       → the rule could NOT resolve its operand (unreadable
 *    compiled spec, rows absent behind a data url, an aggregate op outside the IR's
 *    vocabulary). Silent by design; the note is surfaced so the silence is legible.
 */
export interface AccuracyRuleOutcome {
  readonly evaluated: boolean;
  readonly message?: string;
  readonly note?: string;
}

export interface AccuracyRule {
  readonly id: AccuracyRuleId;
  /** Registered error code emitted when this rule fires (packages/mcp-server errors/registry). */
  readonly code: string;
  /** One-line statement of what the rule claims — including what it deliberately excludes. */
  readonly summary: string;
  /**
   * Pure. Reads `spec` (the IR) and `compiled` (the Vega-Lite spec certify compiled from
   * it); mutates neither and returns no reference into either.
   */
  readonly evaluate: (spec: NormalizedVizSpec, compiled: unknown) => AccuracyRuleOutcome;
}

export interface AccuracyResult {
  /** One finding per FIRING rule, in ACCURACY_RULES order. Never more than one per rule. */
  readonly findings: readonly AccuracyFinding[];
  /** How many rules actually resolved their operand and ran (0..rules.length). */
  readonly rulesEvaluated: number;
  /** Why a rule stayed silent, when it could not evaluate. Empty when all four ran. */
  readonly notes: readonly string[];
}
