import { describe, expect, it } from 'vitest';
import { scoreLayoutForPattern } from '@/viz/patterns/layout-scorer.js';
import { recommendInteractions } from '@/viz/patterns/interaction-scorer.js';
import type { SchemaIntent } from '@/viz/patterns/suggest-chart.js';

describe('layout scorers', () => {
  it('prefers facet layout for multi-dimensional grouped schemas', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'comparison',
      requiresGrouping: true,
    };
    const layout = scoreLayoutForPattern('grouped-bar', schema);
    expect(layout.primary.strategy).toBe('facet');
    expect(layout.primary.score).toBeGreaterThan(layout.alternates[0]?.score ?? 0);
  });
});

describe('interaction scorers', () => {
  it('surfaced zoom + tooltip bundle for temporal multi-metric schema', () => {
    const schema: SchemaIntent = {
      measures: 2,
      dimensions: 1,
      temporals: 1,
      goal: 'trend',
      multiMetrics: true,
    };
    const bundle = recommendInteractions('target-band-line', schema);
    expect(bundle.primary.some((entry) => entry.kind === 'zoom')).toBe(true);
    const tooltip = bundle.primary.find((entry) => entry.kind === 'tooltip');
    expect(tooltip?.fields.length).toBeGreaterThan(0);
  });
});
