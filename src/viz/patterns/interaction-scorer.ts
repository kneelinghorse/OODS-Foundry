import {
  getPatternV2ById,
  type ChartPatternV2,
  type InteractionHookId,
  type InteractionKind,
  type InteractionRecommendationEntry,
} from './chart-patterns-v2.js';
import { extractFieldBlueprint } from './pattern-field-helpers.js';
import type { IntentGoal } from './index.js';
import type { SchemaIntent } from './suggest-chart.js';

export interface InteractionScoreEntry {
  readonly kind: InteractionKind;
  readonly hooks: ReadonlyArray<InteractionHookId>;
  readonly score: number;
  readonly rationale: string;
  readonly hints: ReadonlyArray<string>;
  readonly fields: ReadonlyArray<string>;
}

export interface InteractionBundle {
  readonly patternId: string;
  readonly primary: ReadonlyArray<InteractionScoreEntry>;
  readonly optional: ReadonlyArray<InteractionScoreEntry>;
}

export function recommendInteractions(patternId: string, schema: SchemaIntent): InteractionBundle {
  const pattern = getRequiredPattern(patternId);
  const blueprint = extractFieldBlueprint(pattern);
  const goals = normalizeGoal(schema.goal);

  const primary = pattern.interactionProfile.primary.map((entry) =>
    evaluateInteraction(entry, pattern, blueprint, schema, goals),
  );
  const optional = pattern.interactionProfile.optional.map((entry) =>
    evaluateInteraction(entry, pattern, blueprint, schema, goals),
  );

  return {
    patternId,
    primary: sortInteractions(primary),
    optional: sortInteractions(optional),
  };
}

function evaluateInteraction(
  entry: InteractionRecommendationEntry,
  pattern: ChartPatternV2,
  blueprint: ReturnType<typeof extractFieldBlueprint>,
  schema: SchemaIntent,
  goals: ReadonlyArray<IntentGoal>,
): InteractionScoreEntry {
  const hints: string[] = [entry.rationale];
  let score = entry.score;
  const dimensions = schema.dimensions;
  const temporals = schema.temporals ?? 0;
  const goalSet = new Set(goals);

  switch (entry.kind) {
    case 'filter':
      if (schema.requiresGrouping || dimensions >= 2) {
        score += 0.15;
        hints.push('Filtering keeps grouped comparisons targeted.');
      } else {
        score -= 0.05;
        hints.push('Single-dimension schema can treat filters as optional.');
      }
      break;
    case 'zoom':
      if (temporals > 0 || goalSet.has('trend')) {
        score += 0.15;
        hints.push('Temporal axes pair naturally with zoom interactions.');
      } else {
        score -= 0.03;
        hints.push('Zoom is optional outside temporal/continuous axes.');
      }
      break;
    case 'brush':
      if (pattern.chartType === 'scatter' || goalSet.has('relationship')) {
        score += 0.12;
        hints.push('Brushing accelerates cluster exploration.');
      } else if (schema.multiMetrics) {
        score += 0.08;
        hints.push('Multiple metrics benefit from brushed comparisons.');
      }
      break;
    case 'details':
      if (dimensions >= 2 || schema.partToWhole) {
        score += 0.09;
        hints.push('Detail-on-demand highlights contextual fields.');
      }
      break;
    default:
      break;
  }

  const fields = resolveFields(entry.fieldSource, blueprint);
  return {
    kind: entry.kind,
    hooks: entry.hooks,
    score: clamp(score, 0.4, 0.99),
    rationale: entry.rationale,
    hints,
    fields,
  };
}

function resolveFields(
  source: InteractionRecommendationEntry['fieldSource'],
  blueprint: ReturnType<typeof extractFieldBlueprint>,
): ReadonlyArray<string> {
  if (source === 'dimensions') {
    return blueprint.dimensions.map((field) => field.id);
  }
  if (source === 'measures') {
    return blueprint.measures.map((field) => field.id);
  }
  if (source === 'all') {
    return [...blueprint.dimensions, ...blueprint.measures].map((field) => field.id);
  }
  return [];
}

function sortInteractions(entries: ReadonlyArray<InteractionScoreEntry>): InteractionScoreEntry[] {
  return [...entries].sort((a, b) => b.score - a.score);
}

function normalizeGoal(goal: SchemaIntent['goal']): ReadonlyArray<IntentGoal> {
  return Array.isArray(goal) ? goal : [goal];
}

function getRequiredPattern(id: string): ChartPatternV2 {
  const pattern = getPatternV2ById(id);
  if (!pattern) {
    throw new Error(`Pattern ${id} is not registered.`);
  }
  return pattern;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
