import { describe, expect, it } from 'vitest';
import { listPatterns } from '@/viz/patterns/index.js';
import { scorePattern, suggestPatterns, type SchemaIntent } from '@/viz/patterns/suggest-chart.js';

const patterns = listPatterns();

function findPattern(id: string) {
  const match = patterns.find((pattern) => pattern.id === id);
  if (!match) {
    throw new Error(`Pattern ${id} not found`);
  }
  return match;
}

describe('viz pattern suggestion', () => {
  it('ranks grouped bar highest for comparison schema', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'comparison',
      requiresGrouping: true,
    };
    const [top] = suggestPatterns(schema, { limit: 1 });
    expect(top.pattern.id).toBe('grouped-bar');
    expect(top.score).toBeGreaterThan(0);
  });

  it('prefers stacked variants for part-to-whole goals', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'part-to-whole',
      stacking: 'required',
      partToWhole: true,
    };
    const results = suggestPatterns(schema, { limit: 2 });
    const ids = results.map((entry) => entry.pattern.id);
    expect(ids).toEqual(expect.arrayContaining(['stacked-bar', 'stacked-100-bar']));
  });

  it('scores trend band pattern for multi-metric temporal schema', () => {
    const schema: SchemaIntent = {
      measures: 3,
      dimensions: 1,
      temporals: 1,
      goal: 'trend',
      multiMetrics: true,
    };
    const [top] = suggestPatterns(schema, { limit: 1 });
    expect(top.pattern.id).toBe('target-band-line');
  });

  it('returns readable signals', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 1,
      temporals: 1,
      goal: 'trend',
    };
    const pattern = findPattern('running-total-area');
    const { signals, score } = scorePattern(pattern, schema);
    expect(score).toBeGreaterThan(0);
    expect(signals).toEqual(expect.arrayContaining(['Match: measure count 1']));
  });
});
