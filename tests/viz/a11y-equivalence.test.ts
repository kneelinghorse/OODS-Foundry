import { describe, expect, it } from 'vitest';
import { generateAccessibleTable } from '../../src/viz/a11y/table-generator.js';
import { generateNarrativeSummary } from '../../src/viz/a11y/narrative-generator.js';
import { validateVizEquivalenceRules } from '../../src/viz/a11y/equivalence-rules.js';
import { createBarChartSpec } from '../components/viz/__fixtures__/barChartSpec.js';
import { createLineChartSpec } from '../components/viz/__fixtures__/lineChartSpec.js';

describe('Viz accessibility suite', () => {
  it('generates an accessible table descriptor for inline data', () => {
    const spec = createBarChartSpec();
    const table = generateAccessibleTable(spec);

    expect(table.status).toBe('ready');
    expect(table.columns.map((column) => column.label)).toEqual(['Region', 'Revenue (USD)']);
    expect(table.rows[0]?.cells[0]?.text).toBe('North');
    expect(table.caption).toContain('Regional revenue');
  });

  it('creates narrative summaries even when specs omit manual text', () => {
    const base = createLineChartSpec();
    const spec = createLineChartSpec({
      a11y: {
        ...base.a11y,
        narrative: undefined,
      },
    });

    const narrative = generateNarrativeSummary(spec);
    expect(narrative.status).toBe('ready');
    expect(narrative.summary).toMatch(/rises|declines|flat/i);
    expect(narrative.keyFindings.length).toBeGreaterThan(0);
  });

  it('passes all 15 equivalence rules for the reference spec', () => {
    const results = validateVizEquivalenceRules(createBarChartSpec());
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('flags rule A11Y-R-03 when the table fallback is disabled', () => {
    const base = createBarChartSpec();
    const spec = createBarChartSpec({
      a11y: {
        ...base.a11y,
        tableFallback: {
          ...base.a11y.tableFallback,
          enabled: false,
        },
      },
    });

    const results = validateVizEquivalenceRules(spec);
    const rule = results.find((entry) => entry.id === 'A11Y-R-03');
    expect(rule?.passed).toBe(false);
    expect(rule?.message).toMatch(/table fallback/i);
  });
});
