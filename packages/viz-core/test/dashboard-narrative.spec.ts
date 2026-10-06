import { describe, expect, it } from 'vitest';
import {
  deriveDashboardNarrative,
  resolveDashboardNarrative,
  type DashboardKpiSummary,
} from '@oods/viz-core';

const REVENUE: DashboardKpiSummary = {
  label: 'Total Revenue',
  formatted: '390',
  trendDirection: 'increasing',
  delta: 90,
  thresholdBreached: true,
};

const ORDERS: DashboardKpiSummary = {
  label: 'Orders',
  formatted: '42',
  trendDirection: 'decreasing',
  delta: -8,
  anomaly: true,
};

describe('deriveDashboardNarrative', () => {
  it('returns an empty narrative when there are no KPIs', () => {
    expect(deriveDashboardNarrative([])).toEqual({ summary: undefined, keyFindings: [] });
  });

  it('summarizes the metric count and how many breached threshold / flagged anomalous', () => {
    const { summary, keyFindings } = deriveDashboardNarrative([REVENUE, ORDERS]);
    expect(summary).toBe('2 key metrics tracked. 1 metric breached threshold. 1 flagged anomalous.');
    // each KPI yields a finding restating value/trend/delta + its flags.
    expect(keyFindings).toEqual([
      'Total Revenue: 390 (increasing, delta 90) — threshold breached',
      'Orders: 42 (decreasing, delta -8) — anomaly',
    ]);
  });

  it('omits the delta phrase when delta is null', () => {
    const { keyFindings } = deriveDashboardNarrative([{ label: 'Active Users', formatted: '1200', trendDirection: 'flat', delta: null }]);
    expect(keyFindings).toEqual(['Active Users: 1200 (flat)']);
  });

  it('caps key findings at 5', () => {
    const many: DashboardKpiSummary[] = Array.from({ length: 8 }, (_, i) => ({
      label: `M${i}`,
      formatted: String(i),
      trendDirection: 'flat',
      delta: 0,
    }));
    expect(deriveDashboardNarrative(many).keyFindings).toHaveLength(5);
  });
});

describe('resolveDashboardNarrative (author override)', () => {
  it('computes from KPIs when no author narrative is supplied', () => {
    const result = resolveDashboardNarrative(undefined, [REVENUE], 'Fallback description.');
    expect(result.summary).toBe('1 key metric tracked. 1 metric breached threshold.');
    expect(result.keyFindings).toEqual(['Total Revenue: 390 (increasing, delta 90) — threshold breached']);
  });

  it('lets an author summary AND findings win byte-identically', () => {
    const author = { summary: 'Hand-written.', keyFindings: ['A', 'B'] };
    const result = resolveDashboardNarrative(author, [REVENUE], 'Fallback description.');
    expect(result.summary).toBe('Hand-written.');
    expect(result.keyFindings).toEqual(['A', 'B']);
  });

  it('falls back to the dashboard description when there are no KPIs and no author summary', () => {
    const result = resolveDashboardNarrative(undefined, [], 'Fallback description.');
    expect(result.summary).toBe('Fallback description.');
    expect(result.keyFindings).toEqual([]);
  });

  it('keeps the author summary but uses derived findings when the author omits findings', () => {
    const result = resolveDashboardNarrative({ summary: 'Only a summary.' }, [REVENUE], 'Fallback.');
    expect(result.summary).toBe('Only a summary.');
    expect(result.keyFindings).toEqual(['Total Revenue: 390 (increasing, delta 90) — threshold breached']);
  });
});

describe('deriveDashboardNarrative — measure context (sprint-129 m02)', () => {
  it('annotates the value with the governed unit and the breach flag with the governed threshold value', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Total Revenue', formatted: '390', trendDirection: 'increasing', delta: 90,
      thresholdBreached: true, measureContext: { unit: 'USD', thresholdValue: 350 },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual([
      'Total Revenue: 390 USD (increasing, delta 90) — threshold 350 breached',
    ]);
  });

  it('appends the unit even when the threshold is not breached (the governed value is not surfaced)', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Exports', formatted: '300', trendDirection: 'flat', delta: null,
      measureContext: { unit: '1000 USD', thresholdValue: 999 },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual(['Exports: 300 1000 USD (flat)']);
  });

  it('a breach with a unit but no threshold value keeps the plain breach flag (unit still on the value)', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Exports', formatted: '300', trendDirection: 'increasing', delta: 5,
      thresholdBreached: true, measureContext: { unit: '1000 USD' },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual([
      'Exports: 300 1000 USD (increasing, delta 5) — threshold breached',
    ]);
  });

  it('an absent measureContext is byte-identical to s116 (plain breach flag, no unit)', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Total Revenue', formatted: '390', trendDirection: 'increasing', delta: 90, thresholdBreached: true,
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual([
      'Total Revenue: 390 (increasing, delta 90) — threshold breached',
    ]);
  });
});

describe('deriveDashboardNarrative — comparison-basis "vs target" (sprint-130 m02)', () => {
  it('appends "vs target N" after the delta when the resolved basis is target (the IDENTICAL single-chart literal)', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Total Revenue', formatted: '390', trendDirection: 'increasing', delta: 90,
      thresholdBreached: true, measureContext: { thresholdValue: 350, comparisonBasis: 'target', comparisonValue: 300 },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual([
      'Total Revenue: 390 (increasing, delta 90 vs target 300) — threshold 350 breached',
    ]);
  });

  it('does NOT append a clause for a non-target basis (prior_period is series-derived, no static value)', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Total Revenue', formatted: '390', trendDirection: 'increasing', delta: 90,
      measureContext: { comparisonBasis: 'prior_period' },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual(['Total Revenue: 390 (increasing, delta 90)']);
  });

  it('a measureContext WITHOUT comparison fields is byte-identical (no clause) — the s129 fixtures are unaffected', () => {
    const kpi: DashboardKpiSummary = {
      label: 'Total Revenue', formatted: '390', trendDirection: 'increasing', delta: 90,
      thresholdBreached: true, measureContext: { unit: 'USD', thresholdValue: 350 },
    };
    expect(deriveDashboardNarrative([kpi]).keyFindings).toEqual([
      'Total Revenue: 390 USD (increasing, delta 90) — threshold 350 breached',
    ]);
  });
});
