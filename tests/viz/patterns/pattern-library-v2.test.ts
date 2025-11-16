import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chartPatterns } from '@/viz/patterns/index.js';
import { scoreResponsiveStrategies } from '@/viz/patterns/responsive-scorer.js';
import type { SchemaIntent } from '@/viz/patterns/suggest-chart.js';

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
