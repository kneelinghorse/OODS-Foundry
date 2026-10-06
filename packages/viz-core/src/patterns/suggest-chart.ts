import { chartPatterns, type ChartPattern, type DensityPreference, type IntentGoal, type PatternHeuristics } from './index.js';

const RANGE_MATCH_WEIGHT = 4;
const RANGE_NEAR_MATCH_WEIGHT = 2;
const RANGE_MISMATCH_WEIGHT = -4;
const GOAL_MATCH_WEIGHT = 5;
const GOAL_PARTIAL_WEIGHT = 2;
const GOAL_MISMATCH_WEIGHT = -3;
const ATTRIBUTE_MATCH_WEIGHT = 2;
const ATTRIBUTE_MISMATCH_WEIGHT = -2;

// --- data-aware thresholds (sprint-110; literature-defensible, documented) ----
// Shared by the rows-path intent derivation (builder/spec-builder.toSchemaIntent)
// and — from m03 — the data-aware scorer terms. Named constants, NOT magic
// numbers; grounded in the Cleveland–McGill / DSV perceptual corpus.
//
// Row-count splits for the density preference. Below SPARSE → 'sparse', at/above
// DENSE → 'dense', in between → left undefined (no density signal).
export const DENSITY_SPARSE_ROW_COUNT = 30;
export const DENSITY_DENSE_ROW_COUNT = 200;
// |Pearson r| at/above which a two-measure pair reads as a genuine relationship
// (below it the pair is better shown as a comparison than a correlation-scatter).
export const CORRELATION_RELATIONSHIP_GATE = 0.5;
// A nominal/ordinal dimension at/above this cardinality is "high-cardinality":
// bars become illegible and a line / aggregate is preferable (scored in m03).
export const HIGH_CARDINALITY_DIMENSION = 12;
// Upper bound on a summable series' cardinality for a part-to-whole reading.
export const PART_TO_WHOLE_MAX_CARDINALITY = 6;

// --- data-aware scorer term weights (sprint-110 m03) --------------------------
// These are the Draco-style weighted soft-constraint terms that read the profile
// (cardinality / correlation / negativity) the way the existing weights read the
// count shape. Float magnitudes are intentional — the m02 pattern.id tie-break
// keeps the ranking deterministic under them.
//
// A capped pattern asked to render more categories than it can legibly show:
// large penalty (bars/legends become unreadable past their cap).
const CARDINALITY_OVERFLOW_PENALTY = -8;
// A strongly-correlated measure pair belongs in a correlation view.
const CORRELATION_BONUS = 5;
const STRONG_CORRELATION = 0.7;
// A diverging pattern shown all-positive data — no directionality to diverge
// around (the diverging-bar "avoid when data only >0" caution, made scoreable).
const DIVERGING_ON_POSITIVE_PENALTY = -3;
// Sub-integer canonical nudge: bonus = (BASE - perceptualRank) * WEIGHT. Max
// magnitude < 1, so it only resolves near-ties between score-identical twins and
// can never overturn a count-shape or goal decision.
const PERCEPTUAL_RANK_BASE = 5;
const PERCEPTUAL_RANK_WEIGHT = 0.1;

export interface SchemaIntent {
  readonly measures: number;
  readonly dimensions: number;
  readonly temporals?: number;
  readonly goal: IntentGoal | ReadonlyArray<IntentGoal>;
  readonly stacking?: 'required' | 'preferred' | 'avoid';
  readonly matrix?: boolean;
  readonly partToWhole?: boolean;
  readonly multiMetrics?: boolean;
  readonly requiresGrouping?: boolean;
  readonly allowNegative?: boolean;
  readonly density?: DensityPreference;
  // --- sprint-110 data-aware carriers (additive, optional) -------------------
  // Populated from the field profile on the rows path. m02 derives them; the
  // weighted scorer terms that READ maxNominalCardinality / hasHighCardinalityDim
  // / correlationStrength land in m03 (so they are inert carriers until then).
  /** Largest nominal/ordinal dimension cardinality observed in the data. */
  readonly maxNominalCardinality?: number;
  /** True when a nominal/ordinal dimension is high-cardinality (bar-illegible). */
  readonly hasHighCardinalityDim?: boolean;
  /** |Pearson r| of the primary two-measure pair, when measurable. */
  readonly correlationStrength?: number;
}

export interface SuggestionOptions {
  readonly limit?: number;
  readonly minScore?: number;
}

export interface PatternSuggestion {
  readonly pattern: ChartPattern;
  readonly score: number;
  readonly signals: ReadonlyArray<string>;
}

export function suggestPatterns(schema: SchemaIntent, options?: SuggestionOptions): PatternSuggestion[] {
  const limit = options?.limit ?? 3;
  const minScore = options?.minScore ?? 0;
  const results = chartPatterns.map((pattern) => scorePattern(pattern, schema));
  const filtered = results
    .filter((result) => result.score >= minScore)
    // TOTAL-ORDER tie-break (sprint-110 m02): score DESC, then pattern.id ASC.
    // Without it, equal-score patterns kept their registry/V8-sort order — fine
    // until m03's float-weighted terms make ties common; pinning the secondary
    // key to the stable, registry-order-independent pattern.id makes the top
    // pick (and the whole ranking) deterministic regardless of engine sort.
    .sort((a, b) => b.score - a.score || a.pattern.id.localeCompare(b.pattern.id))
    .slice(0, limit);
  return filtered;
}

export function scorePattern(pattern: ChartPattern, schema: SchemaIntent): PatternSuggestion {
  let score = 0;
  const signals: string[] = [];
  score += evaluateRange('measure', pattern.heuristics.measures, schema.measures, signals);
  score += evaluateRange('dimension', pattern.heuristics.dimensions, schema.dimensions, signals);
  if (pattern.heuristics.temporals) {
    const temporalScore = schema.temporals == null
      ? RANGE_MISMATCH_WEIGHT
      : evaluateRange('temporal', pattern.heuristics.temporals, schema.temporals, signals);
    score += temporalScore;
  }

  score += evaluateGoal(pattern.heuristics.goal, schema.goal, signals);
  score += evaluateAttribute('stacking', pattern.heuristics.stacking, schema.stacking, signals);
  score += evaluateBoolean('matrix-ready', pattern.heuristics.matrix ?? false, schema.matrix ?? false, signals);
  score += evaluateBoolean('part-to-whole', pattern.heuristics.partToWhole ?? false, schema.partToWhole ?? false, signals);
  score += evaluateBoolean('multi-metric', pattern.heuristics.multiMetrics ?? false, schema.multiMetrics ?? false, signals);
  score += evaluateBoolean('requires grouping', pattern.heuristics.requiresGrouping ?? false, schema.requiresGrouping ?? false, signals);
  score += evaluateBoolean('supports negative values', pattern.heuristics.allowNegative ?? false, schema.allowNegative ?? false, signals);
  score += evaluateDensity(pattern.heuristics.density, schema.density, signals);

  // --- sprint-110 m03 data-aware soft constraints ----------------------------
  score += evaluateCardinality(pattern, schema, signals);
  score += evaluateCorrelation(pattern, schema, signals);
  score += evaluateDivergingFit(pattern, schema, signals);
  score += evaluatePerceptualRank(pattern);

  return { pattern, score, signals };
}

/**
 * Penalise a capped pattern when the data's largest nominal dimension exceeds the
 * count it can legibly render (bars/legends overflow). Promotes the prose
 * "avoid more than N series" cautions to a scoreable, data-aware constraint.
 */
function evaluateCardinality(pattern: ChartPattern, schema: SchemaIntent, signals: string[]): number {
  const cap = pattern.heuristics.maxSeriesCardinality;
  const cardinality = schema.maxNominalCardinality;
  if (cap == null || cardinality == null || cardinality <= cap) {
    return 0;
  }
  // s153 F4 corrective: the overflow cap on diverging-bar (the ONLY allowNegative pattern) was
  // meant to demote it on ALL-POSITIVE >12-cat floods only — where evaluateDivergingFit already
  // flags the "positive AND negative" contradiction. On genuinely SIGNED data the cap must not
  // bite: a signed >12-cat DENSE comparison would otherwise flip confidently to the capless
  // layered-line-area, breaking the "signed still elects diverging-bar" guarantee. Symmetric with
  // evaluateDivergingFit's allowNegative gate; scoped to diverging-bar alone (sole allowNegative
  // pattern), so zero blast radius beyond it.
  if (pattern.heuristics.allowNegative && schema.allowNegative === true) {
    return 0;
  }
  signals.push(
    `High-cardinality dimension (${cardinality}) exceeds ${pattern.name}'s legible cap (${cap}) — prefer an aggregate/line view`,
  );
  return CARDINALITY_OVERFLOW_PENALTY;
}

/** Bonus for a correlation-home pattern when the measure pair is strongly correlated. */
function evaluateCorrelation(pattern: ChartPattern, schema: SchemaIntent, signals: string[]): number {
  if (!pattern.heuristics.prefersCorrelation) {
    return 0;
  }
  const r = schema.correlationStrength;
  if (r == null || r < STRONG_CORRELATION) {
    return 0;
  }
  signals.push(`Strong correlation (|r|=${r.toFixed(2)}) — a correlation scatter reads the relationship directly`);
  return CORRELATION_BONUS;
}

/**
 * Demote a diverging pattern shown all-positive data. Only fires when negativity
 * is KNOWN absent (schema.allowNegative === false), so explicit/CLI intents that
 * leave it undefined are unaffected.
 */
function evaluateDivergingFit(pattern: ChartPattern, schema: SchemaIntent, signals: string[]): number {
  if (!pattern.heuristics.allowNegative || schema.allowNegative !== false) {
    return 0;
  }
  signals.push(`${pattern.name} needs positive AND negative values, but the data is all-positive`);
  return DIVERGING_ON_POSITIVE_PENALTY;
}

/**
 * Tiny canonical-preference nudge so the most canonical pattern in a niche edges
 * out its score-identical twins before the alphabetical tie-break. Bounded below
 * 1 so it never overrides a real (count-shape/goal) difference. No signal string —
 * it is a curation tiebreaker, not a data justification.
 */
function evaluatePerceptualRank(pattern: ChartPattern): number {
  const rank = pattern.heuristics.perceptualRank;
  if (rank == null) {
    return 0;
  }
  return (PERCEPTUAL_RANK_BASE - rank) * PERCEPTUAL_RANK_WEIGHT;
}

function evaluateRange(label: string, constraint: PatternHeuristics['measures'], actual: number, signals: string[]): number {
  if (actual < constraint.min) {
    signals.push(`Needs ≥${constraint.min} ${label}s`);
    return RANGE_MISMATCH_WEIGHT;
  }
  if (constraint.max != null && actual > constraint.max) {
    signals.push(`Prefers ≤${constraint.max} ${label}s`);
    return RANGE_MISMATCH_WEIGHT;
  }
  if (constraint.max != null && actual === constraint.max) {
    signals.push(`Match: ${label} count ${actual}`);
    return RANGE_MATCH_WEIGHT;
  }
  if (actual === constraint.min) {
    signals.push(`Match: ${label} count ${actual}`);
    return RANGE_MATCH_WEIGHT;
  }
  signals.push(`Flexible ${label} count`);
  return RANGE_NEAR_MATCH_WEIGHT;
}

function evaluateGoal(patternGoals: ReadonlyArray<IntentGoal>, goalInput: IntentGoal | ReadonlyArray<IntentGoal>, signals: string[]): number {
  const goals = Array.isArray(goalInput) ? goalInput : [goalInput];
  const matched = goals.filter((goal) => patternGoals.includes(goal));
  if (matched.length === goals.length) {
    signals.push(`Goal match: ${matched.join(', ')}`);
    return GOAL_MATCH_WEIGHT;
  }
  if (matched.length > 0) {
    signals.push(`Partial goal alignment via ${matched.join(', ')}`);
    return GOAL_PARTIAL_WEIGHT;
  }
  signals.push('Goal not aligned');
  return GOAL_MISMATCH_WEIGHT;
}

function evaluateAttribute(
  label: string,
  expected: PatternHeuristics['stacking'],
  actual: SchemaIntent['stacking'],
  signals: string[],
): number {
  if (!expected || !actual) {
    return 0;
  }
  if (expected === actual) {
    signals.push(`${label} preference satisfied (${actual})`);
    return ATTRIBUTE_MATCH_WEIGHT;
  }
  if (expected === 'preferred' && actual === 'required') {
    signals.push(`${label} stronger than expected`);
    return ATTRIBUTE_MATCH_WEIGHT;
  }
  signals.push(`${label} preference mismatch (expects ${expected}, received ${actual})`);
  return ATTRIBUTE_MISMATCH_WEIGHT;
}

function evaluateBoolean(label: string, expected: boolean, actual: boolean, signals: string[]): number {
  if (!expected && !actual) {
    return 0;
  }
  if (expected === actual) {
    signals.push(`${label} requirement satisfied`);
    return ATTRIBUTE_MATCH_WEIGHT;
  }
  if (expected && !actual) {
    signals.push(`${label} missing`);
    return ATTRIBUTE_MISMATCH_WEIGHT;
  }
  signals.push(`${label} optional`);
  return ATTRIBUTE_MATCH_WEIGHT / 2;
}

function evaluateDensity(
  expected: DensityPreference | undefined,
  actual: DensityPreference | undefined,
  signals: string[],
): number {
  if (!expected || expected === 'flex' || !actual) {
    return 0;
  }
  if (expected === actual) {
    signals.push(`Density preference ${expected}`);
    return ATTRIBUTE_MATCH_WEIGHT;
  }
  signals.push(`Prefers ${expected} datasets`);
  return -1;
}
