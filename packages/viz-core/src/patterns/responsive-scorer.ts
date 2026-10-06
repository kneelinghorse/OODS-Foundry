import tokensBundle from '@oods/tokens';
import { getPatternV2ById, type ChartPatternV2, type LayoutStrategy } from './chart-patterns-v2.js';
import type { SchemaIntent } from './suggest-chart.js';

export type ResponsiveBreakpoint = 'mobile' | 'tablet' | 'desktop';

function breakpointPx(key: 'sm' | 'md' | 'lg' | 'xl' | '2xl'): number {
  const flat = (tokensBundle?.flatTokens ?? {}) as Record<string, { value?: unknown }>;
  const value = flat[`sys-breakpoint-${key}`]?.value;
  if (typeof value !== 'number') {
    throw new Error(
      `sys.breakpoint.${key} is missing from the @oods/tokens bundle — run \`pnpm build:tokens\`.`,
    );
  }
  return value;
}

/**
 * s173 m02 — what the three labels MEAN in pixels, taken from `sys.breakpoint.*`.
 *
 * The scorer is a pure trichotomy: until now 'mobile' / 'tablet' / 'desktop' were words with
 * no width behind them anywhere in the repo, so a recipe could not be checked against the
 * layout that would actually be rendered at that size. These are the band LOWER BOUNDS, read
 * from the tokens rather than typed here, so the scorer's vocabulary and the CSS/Tailwind
 * breakpoints cannot drift apart silently.
 *
 * TWO THINGS THIS IS NOT, stated so no one infers them later: `mobile: 0` is not a token —
 * there is no breakpoint below `sm` and 0 is not pretending to be one; and NOTHING consumes
 * this at runtime today. The scorer's consumers are one test and one story. It is a binding,
 * not a behaviour change, and the recipes are byte-identical with or without it.
 */
export const RESPONSIVE_BREAKPOINT_MIN_PX: Record<ResponsiveBreakpoint, number> = {
  mobile: 0,
  tablet: breakpointPx('md'),
  desktop: breakpointPx('xl'),
};

export type ResponsiveAction =
  | 'collapseLegend'
  | 'stackPanels'
  | 'toggleSeries'
  | 'simplifyInteractions'
  | 'enableBrush'
  | 'expandGrid'
  | 'preserveDetail';

export interface ResponsiveAdjustment {
  readonly action: ResponsiveAction;
  readonly description: string;
}

export interface ResponsiveBreakpointRecommendation {
  readonly breakpoint: ResponsiveBreakpoint;
  readonly layout: LayoutStrategy;
  readonly score: number;
  readonly adjustments: ReadonlyArray<ResponsiveAdjustment>;
}

export interface ResponsiveRecommendationBundle {
  readonly patternId: string;
  readonly recipes: ReadonlyArray<ResponsiveBreakpointRecommendation>;
}

const BASELINE_SCORE: Record<ResponsiveBreakpoint, number> = {
  mobile: 0.6,
  tablet: 0.72,
  desktop: 0.88,
};

const BREAKPOINT_ORDER: ResponsiveBreakpoint[] = ['mobile', 'tablet', 'desktop'];

export function scoreResponsiveStrategies(patternId: string, schema: SchemaIntent): ResponsiveRecommendationBundle {
  const pattern = getRequiredPattern(patternId);
  const recipes = BREAKPOINT_ORDER.map((breakpoint) => buildRecipe(breakpoint, pattern, schema));
  return { patternId, recipes };
}

function buildRecipe(
  breakpoint: ResponsiveBreakpoint,
  pattern: ChartPatternV2,
  schema: SchemaIntent,
): ResponsiveBreakpointRecommendation {
  const adjustments: ResponsiveAdjustment[] = [];
  let score = BASELINE_SCORE[breakpoint];
  let layout = deriveLayout(pattern, schema, breakpoint);

  if (breakpoint === 'mobile') {
    adjustments.push({
      action: 'collapseLegend',
      description: 'Collapse legends into inline toggles and move filters behind a drawer.',
    });
    layout = 'single';
    if (schema.dimensions > 1 || schema.requiresGrouping || pattern.heuristics.requiresGrouping) {
      adjustments.push({
        action: 'stackPanels',
        description: 'Stack facets vertically and reuse the y-axis to avoid horizontal scroll.',
      });
      score += 0.06;
    }
    if (schema.multiMetrics || pattern.heuristics.multiMetrics) {
      adjustments.push({
        action: 'toggleSeries',
        description: 'Allow tap-to-isolate series so high-density patterns remain legible.',
      });
      score += 0.05;
    }
    if (pattern.chartType === 'scatter' || pattern.heuristics.density === 'dense') {
      adjustments.push({
        action: 'simplifyInteractions',
        description: 'Swap brushing for single tap highlight to keep interactions one-handed.',
      });
      score -= 0.03;
    }
  } else if (breakpoint === 'tablet') {
    if (layout === 'single' && (schema.dimensions >= 2 || schema.requiresGrouping)) {
      layout = 'facet';
    }
    adjustments.push({
      action: 'stackPanels',
      description: 'Use two-column grids with shared scales so comparisons survive medium breakpoints.',
    });
    score += 0.04;
    if (schema.temporals && schema.temporals > 0) {
      adjustments.push({
        action: 'enableBrush',
        description: 'Expose pinch/brush zoom for temporal lanes when horizontal space allows.',
      });
      score += 0.03;
    }
  } else {
    // Desktop
    if (layout === 'single' && pattern.layoutProfile.alternates[0]) {
      layout = pattern.layoutProfile.alternates[0].strategy;
    }
    adjustments.push({
      action: 'expandGrid',
      description: 'Enable full facet/concat layout plus high-density tooltips.',
    });
    if (pattern.layoutProfile.primary.strategy === 'concat') {
      adjustments.push({
        action: 'preserveDetail',
        description: 'Keep linked panels visible simultaneously and sync hover events.',
      });
      score += 0.03;
    }
  }

  const boundedScore = clamp(score, 0.48, 0.98);
  return {
    breakpoint,
    layout,
    score: boundedScore,
    adjustments,
  };
}

function deriveLayout(pattern: ChartPatternV2, schema: SchemaIntent, breakpoint: ResponsiveBreakpoint): LayoutStrategy {
  const defaultLayout = pattern.layoutProfile.primary.strategy;
  if (breakpoint === 'mobile') {
    return 'single';
  }
  if (breakpoint === 'tablet') {
    if (defaultLayout === 'concat') {
      return schema.dimensions >= 2 ? 'facet' : 'layer';
    }
    if (defaultLayout === 'layer' && schema.dimensions >= 2) {
      return 'facet';
    }
    return defaultLayout;
  }
  return defaultLayout;
}

function getRequiredPattern(id: string): ChartPatternV2 {
  const pattern = getPatternV2ById(id);
  if (!pattern) {
    throw new Error(`Pattern ${id} is not registered`);
  }
  return pattern;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
