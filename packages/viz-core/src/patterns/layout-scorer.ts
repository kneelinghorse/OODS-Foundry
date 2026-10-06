import { getPatternV2ById, type ChartPatternV2, type LayoutRecommendationEntry, type LayoutStrategy } from './chart-patterns-v2.js';
import type { SchemaIntent } from './suggest-chart.js';

export interface LayoutScoreEntry {
  readonly strategy: LayoutStrategy;
  readonly score: number;
  readonly rationale: string;
  readonly hints: ReadonlyArray<string>;
}

export interface LayoutRecommendationBundle {
  readonly patternId: string;
  readonly primary: LayoutScoreEntry;
  readonly alternates: ReadonlyArray<LayoutScoreEntry>;
}

export function scoreLayoutForPattern(patternId: string, schema: SchemaIntent): LayoutRecommendationBundle {
  const pattern = getRequiredPattern(patternId);
  const candidates = [pattern.layoutProfile.primary, ...pattern.layoutProfile.alternates];
  const scored = candidates.map((entry) => evaluateLayoutEntry(entry, pattern, schema));
  const [primary, ...alternates] = scored.sort((a, b) => b.score - a.score);
  return {
    patternId,
    primary,
    alternates,
  };
}

function evaluateLayoutEntry(entry: LayoutRecommendationEntry, pattern: ChartPatternV2, schema: SchemaIntent): LayoutScoreEntry {
  const hints: string[] = [entry.rationale];
  let score = entry.score;
  const dimensionCount = schema.dimensions;
  const measureCount = schema.measures;
  const hasTemporal = (schema.temporals ?? 0) > 0;

  switch (entry.strategy) {
    case 'facet': {
      if (dimensionCount >= 2 || schema.requiresGrouping) {
        score += 0.16;
        hints.push('Schema includes ≥2 dimensions; facets keep groups legible.');
      } else {
        score -= 0.1;
        hints.push('Faceting benefits from an additional grouping dimension.');
      }
      if (schema.matrix) {
        score += 0.05;
        hints.push('Matrix intent maps cleanly to facet grids.');
      }
      break;
    }
    case 'layer': {
      if (schema.multiMetrics || schema.stacking === 'required') {
        score += 0.14;
        hints.push('Layering highlights stacked or overlapping series.');
      } else if (measureCount > 1) {
        score += 0.08;
        hints.push('Multiple measures stay synchronized when layered.');
      } else {
        score -= 0.04;
        hints.push('Layering is optional for single-measure scenarios.');
      }
      break;
    }
    case 'concat': {
      if (schema.matrix || dimensionCount >= 3) {
        score += 0.15;
        hints.push('Dashboard concat splits high-cardinality views into purposeful sections.');
      } else if (hasTemporal) {
        score += 0.04;
        hints.push('Temporal breakdowns benefit from overview + detail sections.');
      } else {
        score -= 0.05;
        hints.push('Concatenation may be excessive for lean schemas.');
      }
      break;
    }
    case 'single': {
      if (dimensionCount <= 2 && measureCount <= 2) {
        score += 0.1;
        hints.push('Single scene keeps two encodings approachable.');
      }
      if (schema.requiresGrouping && !pattern.heuristics.requiresGrouping) {
        score -= 0.06;
        hints.push('Grouping pressure suggests adding facets instead.');
      }
      break;
    }
    default:
      break;
  }

  const bounded = clamp(score, 0.35, 0.99);
  return {
    strategy: entry.strategy,
    score: bounded,
    rationale: entry.rationale,
    hints,
  };
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
