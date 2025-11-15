import { describe, expect, it } from 'vitest';
import budgets from '../../tools/perf/viz-budget.json' assert { type: 'json' };

process.env.VIZ_BENCHMARK_MODE = 'deterministic';
const suiteModulePromise = import('../../src/viz/perf/viz-benchmarks.js');

interface BudgetEntry {
  readonly chartType: string;
  readonly renderer: string;
  readonly dataPoints: number;
  readonly targets: Record<string, number>;
}

function buildBudgetMap(records: readonly BudgetEntry[]): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const record of records) {
    map.set(`${record.chartType}::${record.renderer}::${record.dataPoints}`, record.targets);
  }
  return map;
}

describe('Viz benchmark budgets', () => {
  it('stays within published performance thresholds for the default matrix', async () => {
    const { runVizBenchmarks, defaultVizBenchmarkPlan } = await suiteModulePromise;
    const suite = runVizBenchmarks(defaultVizBenchmarkPlan);
    const budgetMap = buildBudgetMap(budgets.budgets as BudgetEntry[]);

    expect(suite.results).not.toHaveLength(0);

    for (const result of suite.results) {
      const key = `${result.chartType}::${result.renderer}::${result.dataPoints}`;
      const targets = budgetMap.get(key);
      expect(targets).toBeDefined();
      if (!targets) {
        continue;
      }

      for (const [metric, value] of Object.entries(result.metrics)) {
        const numericValue = typeof value === 'number' ? value : Number(value);
        const allowed = targets[metric];
        expect(
          numericValue,
          `${key} ${metric} exceeds budget (${numericValue.toFixed(6)} > ${allowed ?? 'n/a'})`
        ).toBeLessThanOrEqual((allowed ?? Number.POSITIVE_INFINITY) + 1e-6);
      }
    }
  });
});
