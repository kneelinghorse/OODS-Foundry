import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import tokensBundle from '@oods/tokens';
import { chartPatterns } from '@oods/viz-core';
import {
  RESPONSIVE_BREAKPOINT_MIN_PX,
  scoreResponsiveStrategies,
} from '@oods/viz-core';
import type { SchemaIntent } from '@oods/viz-core';

const repoRoot = process.cwd();

describe('pattern catalog v2', () => {
  it('contains at least twenty registered patterns', () => {
    expect(chartPatterns.length).toBeGreaterThanOrEqual(20);
  });

  it('ships a spec file for every pattern', () => {
    chartPatterns.forEach((pattern) => {
      const specPath = path.resolve(repoRoot, pattern.specPath);
      expect(existsSync(specPath)).toBe(true);
    });
  });
});

describe('responsive scorer heuristics', () => {
  it('stacks grouped facets on mobile for small-multiples line', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      temporals: 1,
      goal: ['comparison', 'trend'],
      requiresGrouping: true,
    };
    const bundle = scoreResponsiveStrategies('facet-small-multiples-line', schema);
    const mobile = bundle.recipes.find((entry) => entry.breakpoint === 'mobile');
    expect(mobile?.layout).toBe('single');
    expect(mobile?.adjustments.some((item) => item.action === 'stackPanels')).toBe(true);
  });

  it('the three labels resolve to sys.breakpoint values, not to numbers typed here (s173 m02)', () => {
    // The scorer's vocabulary used to be three bare words. This asserts the binding is to the
    // TOKENS — the same numbers Tailwind's screens and the container queries use — by reading
    // the bundle independently rather than by restating 768/1280.
    const flat = (tokensBundle?.flatTokens ?? {}) as Record<string, { value?: number }>;
    expect(RESPONSIVE_BREAKPOINT_MIN_PX.tablet).toBe(flat['sys-breakpoint-md']?.value);
    expect(RESPONSIVE_BREAKPOINT_MIN_PX.desktop).toBe(flat['sys-breakpoint-xl']?.value);
    // mobile is the open lower band: 0 is deliberately NOT sourced from a token, because
    // there is no breakpoint below sm and inventing one would be the false part.
    expect(RESPONSIVE_BREAKPOINT_MIN_PX.mobile).toBe(0);
    expect(Object.values(RESPONSIVE_BREAKPOINT_MIN_PX)).toEqual(
      [...Object.values(RESPONSIVE_BREAKPOINT_MIN_PX)].sort((a, b) => a - b),
    );
  });

  it('the px binding changes NO recipe — it names widths, it does not score with them', () => {
    const schema: SchemaIntent = { measures: 1, dimensions: 2, temporals: 1, goal: 'comparison', requiresGrouping: true };
    const bundle = scoreResponsiveStrategies('facet-small-multiples-line', schema);
    expect(bundle.recipes.map((recipe) => recipe.breakpoint)).toEqual(['mobile', 'tablet', 'desktop']);
    // Recipes carry layout/score/adjustments and no width — the binding is metadata for the
    // reader, and this pins that it stayed that way.
    for (const recipe of bundle.recipes) {
      expect(Object.keys(recipe).sort()).toEqual(['adjustments', 'breakpoint', 'layout', 'score']);
    }
  });

  it('keeps concat layout on desktop for detail-overview patterns', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'comparison',
      requiresGrouping: true,
    };
    const bundle = scoreResponsiveStrategies('detail-overview-bar', schema);
    const desktop = bundle.recipes.find((entry) => entry.breakpoint === 'desktop');
    expect(desktop?.layout).toBe('concat');
    expect(desktop?.adjustments.some((item) => item.action === 'expandGrid')).toBe(true);
  });
});
