import { chartPatterns, type ChartPattern, type DensityPreference, type IntentGoal, type PatternHeuristics } from './index.js';

const RANGE_MATCH_WEIGHT = 4;
const RANGE_NEAR_MATCH_WEIGHT = 2;
const RANGE_MISMATCH_WEIGHT = -4;
const GOAL_MATCH_WEIGHT = 5;
const GOAL_PARTIAL_WEIGHT = 2;
const GOAL_MISMATCH_WEIGHT = -3;
const ATTRIBUTE_MATCH_WEIGHT = 2;
const ATTRIBUTE_MISMATCH_WEIGHT = -2;

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
    .sort((a, b) => b.score - a.score)
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

  return { pattern, score, signals };
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
