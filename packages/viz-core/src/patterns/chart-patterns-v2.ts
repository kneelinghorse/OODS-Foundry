import { chartPatterns, type ChartPattern, type ChartPatternId, type IntentGoal } from './index.js';

export type LayoutStrategy = 'single' | 'facet' | 'layer' | 'concat';

export interface LayoutRecommendationEntry {
  readonly strategy: LayoutStrategy;
  readonly score: number;
  readonly rationale: string;
  readonly bestFor: ReadonlyArray<IntentGoal>;
}

export interface PatternLayoutProfile {
  readonly primary: LayoutRecommendationEntry;
  readonly alternates: ReadonlyArray<LayoutRecommendationEntry>;
}

export type InteractionKind = 'filter' | 'zoom' | 'brush' | 'tooltip' | 'details';
export type InteractionHookId = 'useFilter' | 'useZoom' | 'useBrush' | 'useTooltip' | 'useHighlight';

export interface InteractionRecommendationEntry {
  readonly kind: InteractionKind;
  readonly score: number;
  readonly rationale: string;
  readonly bestFor: ReadonlyArray<IntentGoal>;
  readonly hooks: ReadonlyArray<InteractionHookId>;
  readonly fieldSource?: 'dimensions' | 'measures' | 'all';
}

export interface PatternInteractionProfile {
  readonly primary: ReadonlyArray<InteractionRecommendationEntry>;
  readonly optional: ReadonlyArray<InteractionRecommendationEntry>;
}

export interface ChartPatternV2 extends ChartPattern {
  readonly layoutProfile: PatternLayoutProfile;
  readonly interactionProfile: PatternInteractionProfile;
}

const layoutBaseScores: Record<LayoutStrategy, number> = {
  single: 0.68,
  facet: 0.76,
  layer: 0.8,
  concat: 0.82,
};

const layoutRationales: Record<LayoutStrategy, string> = {
  single: 'Single-scene layout keeps emphasis on the main encoding and simplifies narration.',
  facet: 'Facet grid distributes categories into repeatable panels for fast scanning.',
  layer: 'Layered view overlays aligned series to highlight deltas and thresholds.',
  concat: 'Concatenated dashboard stitches complementary slices with shared styling.',
};

export const chartPatternsV2: ReadonlyArray<ChartPatternV2> = chartPatterns.map((pattern) => ({
  ...pattern,
  layoutProfile: deriveLayoutProfile(pattern),
  interactionProfile: deriveInteractionProfile(pattern),
}));

const patternCache = new Map<string, ChartPatternV2>();
chartPatternsV2.forEach((pattern) => patternCache.set(pattern.id, pattern));

export function getPatternV2ById(id: ChartPatternId | string): ChartPatternV2 | undefined {
  return patternCache.get(id);
}

function deriveLayoutProfile(pattern: ChartPattern): PatternLayoutProfile {
  const heuristics = pattern.heuristics;
  const goals = heuristics.goal;

  const strategyOrder: LayoutRecommendationEntry[] = [];
  const baselineStrategy = heuristics.matrix || heuristics.concatPreferred
    ? 'concat'
    : heuristics.requiresGrouping || (heuristics.dimensions.max ?? heuristics.dimensions.min) > 1
      ? 'facet'
      : heuristics.multiMetrics || heuristics.stacking === 'required'
        ? 'layer'
        : 'single';

  strategyOrder.push(createLayoutEntry(baselineStrategy, goals));

  if (baselineStrategy !== 'single') {
    strategyOrder.push(createLayoutEntry('single', goals));
  }
  if (baselineStrategy !== 'facet' && !heuristics.matrix && (heuristics.dimensions.max ?? 0) >= 2) {
    strategyOrder.push(createLayoutEntry('facet', goals));
  }
  if (baselineStrategy !== 'layer' && (heuristics.multiMetrics || heuristics.stacking === 'required')) {
    strategyOrder.push(createLayoutEntry('layer', goals));
  }
  if (baselineStrategy !== 'concat' && (heuristics.matrix || heuristics.goal.includes('comparison'))) {
    strategyOrder.push(createLayoutEntry('concat', goals));
  }

  const deduped: LayoutRecommendationEntry[] = [];
  const seen = new Set<LayoutStrategy>();
  strategyOrder.forEach((entry) => {
    if (!seen.has(entry.strategy)) {
      seen.add(entry.strategy);
      deduped.push(entry);
    }
  });

  const primary = deduped[0] ?? createLayoutEntry('single', goals);
  const alternates = deduped.slice(1);

  return { primary, alternates };
}

function deriveInteractionProfile(pattern: ChartPattern): PatternInteractionProfile {
  const heuristics = pattern.heuristics;
  const goals = heuristics.goal;

  const primary: InteractionRecommendationEntry[] = [
    createInteractionEntry('tooltip', 0.72, 'Surface dense values on demand without clutter.', goals, ['useTooltip'], 'all'),
  ];

  if (heuristics.requiresGrouping || (heuristics.dimensions.max ?? 0) >= 2) {
    primary.push(
      createInteractionEntry('filter', 0.66, 'Swipe across categories to focus on a subset.', goals, ['useFilter'], 'dimensions'),
    );
  }
  if (heuristics.temporals || goals.includes('trend')) {
    primary.push(
      createInteractionEntry('zoom', 0.64, 'Zoom through temporal sequences while keeping axes synced.', goals, ['useZoom'], 'dimensions'),
    );
  }

  const optional: InteractionRecommendationEntry[] = [];

  if (heuristics.multiMetrics || heuristics.stacking === 'required') {
    optional.push(
      createInteractionEntry(
        'brush',
        0.6,
        'Drag a brush to compare overlapping bands or series.',
        goals,
        ['useBrush'],
        'dimensions',
      ),
    );
  }

  if (pattern.chartType === 'scatter' || goals.includes('relationship')) {
    optional.push(
      createInteractionEntry(
        'details',
        0.58,
        'Highlight neighbors to expose outliers or clusters.',
        goals,
        ['useHighlight'],
        'all',
      ),
    );
  }

  return {
    primary: dedupeInteractions(primary),
    optional: dedupeInteractions(optional),
  };
}

function createLayoutEntry(strategy: LayoutStrategy, goals: ReadonlyArray<IntentGoal>): LayoutRecommendationEntry {
  const rationale = layoutRationales[strategy];
  return {
    strategy,
    rationale,
    bestFor: goals,
    score: layoutBaseScores[strategy],
  };
}

function createInteractionEntry(
  kind: InteractionKind,
  score: number,
  rationale: string,
  goals: ReadonlyArray<IntentGoal>,
  hooks: ReadonlyArray<InteractionHookId>,
  fieldSource?: InteractionRecommendationEntry['fieldSource'],
): InteractionRecommendationEntry {
  return {
    kind,
    score,
    rationale,
    bestFor: goals,
    hooks,
    fieldSource,
  };
}

function dedupeInteractions(entries: ReadonlyArray<InteractionRecommendationEntry>): InteractionRecommendationEntry[] {
  const seen = new Set<InteractionKind>();
  const ordered: InteractionRecommendationEntry[] = [];
  entries.forEach((entry) => {
    if (seen.has(entry.kind)) {
      return;
    }
    seen.add(entry.kind);
    ordered.push(entry);
  });
  return ordered;
}
