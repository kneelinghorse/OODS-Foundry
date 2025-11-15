#!/usr/bin/env node
import { register } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const tsconfigPath = path.resolve('tsconfig.json');
const unregister = await register({ tsconfig: tsconfigPath });

try {
  const modulePath = fileURLToPath(new URL('../../src/viz/perf/viz-benchmarks.ts', import.meta.url));
  const { runVizBenchmarks, defaultVizBenchmarkPlan, CHART_TYPES } = await import(modulePath);
  const budgetsPath = path.resolve('tools/perf/viz-budget.json');
  const budgets = JSON.parse(await fs.readFile(budgetsPath, 'utf-8'));

  const filters = resolveFilters(args, CHART_TYPES());
  const selectedPlan = applyFilters(defaultVizBenchmarkPlan, filters);

  if (selectedPlan.length === 0) {
    console.error('⚠️  No scenarios matched the provided filters. Nothing to benchmark.');
    process.exit(1);
  }

  const suite = runVizBenchmarks(selectedPlan);
  const mappedBudgets = new Map(
    (budgets.budgets ?? []).map((entry) => [budgetKey(entry), entry.targets])
  );
  const results = suite.results.map((result) => enrichResult(result, mappedBudgets));
  const violationCount = results.filter((entry) => entry.checks.some((check) => check.status === 'fail')).length;

  const summary = buildSummary(results, violationCount);
  const outputPath = path.resolve(resolveFlagValue('--output') ?? 'artifacts/performance/viz-benchmark-results.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const artifact = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    filters,
    budgets: {
      path: path.relative(process.cwd(), budgetsPath),
      version: budgets.version,
      generatedAt: budgets.generatedAt,
    },
    summary,
    recommendations: suite.recommendations,
    results,
  };

  await fs.writeFile(outputPath, JSON.stringify(artifact, null, 2));
  logSummary(summary, outputPath);

  const strict = !args.includes('--no-strict');
  if (violationCount > 0 && strict) {
    process.exit(2);
  }
} finally {
  await unregister();
}

function resolveFilters(argv, supportedCharts) {
  const chartList = parseListFlag('--charts');
  const rendererList = parseListFlag('--renderers');
  const dataPoints = parseNumberList('--dataPoints');

  if (chartList) {
    const invalid = chartList.filter((chart) => !supportedCharts.includes(chart));
    if (invalid.length > 0) {
      console.error(`❌ Unknown chart types: ${invalid.join(', ')}`);
      process.exit(1);
    }
  }

  return {
    charts: chartList ?? null,
    renderers: rendererList ?? null,
    dataPoints: dataPoints ?? null,
  };
}

function applyFilters(plan, filters) {
  return plan.filter((scenario) => {
    if (filters.charts && !filters.charts.includes(scenario.chartType)) {
      return false;
    }
    if (filters.renderers && !filters.renderers.includes(scenario.renderer)) {
      return false;
    }
    if (filters.dataPoints && !filters.dataPoints.includes(scenario.dataPoints)) {
      return false;
    }
    return true;
  });
}

function enrichResult(result, mappedBudgets) {
  const key = budgetKey(result);
  const limit = mappedBudgets.get(key);
  const metrics = result.metrics;
  const checks = Object.entries(metrics).map(([metric, value]) => {
    const target = limit?.[metric];
    const numericValue = typeof value === 'number' ? value : Number(value);
    const displayValue = Number(numericValue.toFixed(6));
    const pass = typeof target === 'number' ? numericValue <= target : true;
    return {
      metric,
      value: displayValue,
      target: typeof target === 'number' ? target : null,
      status: pass ? 'pass' : 'fail',
    };
  });

  return {
    ...result,
    checks,
  };
}

function buildSummary(results, violationCount) {
  const metricNames = ['renderTimeMs', 'updateTimeMs', 'interactionLatencyMs', 'memoryBytes', 'bundleImpactBytes'];
  const extremes = Object.fromEntries(
    metricNames.map((metric) => [metric, findExtreme(results, metric)])
  );

  return {
    totalScenarios: results.length,
    violations: violationCount,
    extremes,
  };
}

function findExtreme(results, metric) {
  const sorted = [...results].sort((a, b) => b.metrics[metric] - a.metrics[metric]);
  const [worst] = sorted;
  if (!worst) {
    return null;
  }
  return {
    chartType: worst.chartType,
    renderer: worst.renderer,
    dataPoints: worst.dataPoints,
    value: Number(worst.metrics[metric].toFixed(6)),
  };
}

function logSummary(summary, outputPath) {
  console.log('📊 Visualization benchmark summary');
  console.log(`   Scenarios: ${summary.totalScenarios}`);
  console.log(`   Violations: ${summary.violations}`);
  console.log(`   Output: ${path.relative(process.cwd(), outputPath)}`);

  if (summary.violations > 0) {
    console.error('❌ One or more scenarios exceeded their budgets. See artifact for details.');
  } else {
    console.log('✅ All scenarios are within budgets.');
  }
}

function budgetKey(entry) {
  return `${entry.chartType}::${entry.renderer}::${entry.dataPoints}`;
}

function parseListFlag(flag) {
  const value = resolveFlagValue(flag);
  if (!value) {
    return null;
  }
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseNumberList(flag) {
  const list = parseListFlag(flag);
  if (!list) {
    return null;
  }
  const numbers = list.map((entry) => Number(entry)).filter((value) => Number.isFinite(value));
  return numbers.length > 0 ? numbers : null;
}

function resolveFlagValue(flag) {
  const direct = args.find((entry) => entry.startsWith(`${flag}=`));
  if (direct) {
    return direct.split('=')[1];
  }
  const index = args.indexOf(flag);
  if (index !== -1) {
    return args[index + 1];
  }
  return null;
}
