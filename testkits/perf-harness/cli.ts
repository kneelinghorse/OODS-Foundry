#!/usr/bin/env tsx
/**
 * Performance Harness CLI
 * Developer-friendly wrapper for running performance tests
 */

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';

import type { PerformanceSnapshot } from './utils/schema';

interface CliOptions {
  scenario?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  output?: string;
  baseline?: string;
}

const DEFAULT_OUTPUT = 'diagnostics/perf-results.json';
const DEFAULT_BASELINE = 'diagnostics/perf-baseline.json';

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scenario' && args[i + 1]) {
      options.scenario = args[i + 1];
      i++;
    } else if (arg === '--browser' && args[i + 1]) {
      options.browser = args[i + 1] as CliOptions['browser'];
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (arg === '--baseline' && args[i + 1]) {
      options.baseline = args[i + 1];
      i++;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Performance Harness CLI

Usage:
  pnpm perf:harness [options]

Options:
  --scenario <name>   Run specific scenario (compositor|list|token-transform|usage-aggregation|all)
  --browser <name>    Browser to use (chromium|firefox|webkit) [default: chromium]
  --output <path>     Output path for results [default: ${DEFAULT_OUTPUT}]
  --baseline <path>   Baseline file to diff against [default: ${DEFAULT_BASELINE}]

Examples:
  pnpm perf:harness --scenario compositor
  pnpm perf:harness --scenario list --browser firefox
  pnpm perf:harness --scenario all --output ./results/perf.json

Scenarios:
  compositor        - Measure React component update performance
  list              - Measure list/table rendering performance
  token-transform   - Measure token transformation operations
  usage-aggregation - Measure data aggregation performance
  all               - Run all performance scenarios
  `);
}

async function runTests(options: CliOptions) {
  console.log('🚀 Starting Performance Harness...\n');

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(currentDir, 'playwright.config.ts');
  const outputPath = options.output ?? DEFAULT_OUTPUT;
  const baselinePath =
    options.baseline ?? process.env.PERF_HARNESS_BASELINE ?? DEFAULT_BASELINE;

  const playwrightArgs = [
    'playwright',
    'test',
    '--config',
    configPath,
  ];

  // Add scenario filter
  if (options.scenario && options.scenario !== 'all') {
    playwrightArgs.push(`--grep`, options.scenario);
  }

  // Add browser project
  if (options.browser) {
    playwrightArgs.push('--project', options.browser);
  }

  console.log('Configuration:');
  console.log(`  Scenario: ${options.scenario || 'all'}`);
  console.log(`  Browser:  ${options.browser || 'chromium'}`);
  console.log(`  Output:   ${outputPath}`);
  console.log(`  Baseline: ${baselinePath}\n`);

  return new Promise<number>((resolve) => {
    const proc = spawn('pnpm', playwrightArgs, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        PERF_HARNESS_OUTPUT: outputPath,
        PERF_HARNESS_SCENARIO: options.scenario ?? 'all',
      },
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        console.log('\n✅ Performance tests completed successfully');
        try {
          const { readResults } = await import('./utils/schema');
          const results = await readResults(outputPath);
          const snapshots = results.performanceHarness.snapshots;
          console.log(`📊 Captured ${snapshots.length} snapshots (saved to ${outputPath})`);
          const summary = snapshots
            .map(
              (snapshot) =>
                `    • ${snapshot.scenarioId} → ${snapshot.metricName}: ${snapshot.value.toFixed(2)} ${snapshot.unit}`,
            )
            .join('\n');
          if (summary) {
            console.log(summary);
          }
          console.log('');
          await printBaselineDiff(snapshots, baselinePath);
        } catch (error) {
          console.warn('[perf-harness] Unable to read results for summary output.', error);
        }
      } else {
        console.log('\n❌ Performance tests failed');
      }
      resolve(code || 0);
    });

    proc.on('error', (err) => {
      console.error('Failed to start performance tests:', err);
      resolve(1);
    });
  });
}

async function main() {
  const options = parseArgs();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const exitCode = await runTests(options);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

type BaselineEntry = {
  scenarioId: string;
  metricName: string;
  browser: string;
  unit: string;
  median: number;
  stdDev: number;
  sampleCount: number;
  min: number;
  max: number;
};

type BaselineFile = {
  version: string;
  computedAt: string;
  historyCount: number;
  baselines: BaselineEntry[];
};

function buildKey(entry: { scenarioId: string; metricName: string; browser: string }): string {
  return `${entry.scenarioId}::${entry.metricName}::${entry.browser}`;
}

async function loadBaseline(baselinePath: string): Promise<BaselineFile | null> {
  try {
    const raw = await readFile(baselinePath, 'utf-8');
    return JSON.parse(raw) as BaselineFile;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      console.log(`ℹ️  No baseline file found at ${baselinePath}. Skipping baseline diff.\n`);
      return null;
    }
    console.warn(`[perf-harness] Failed to load baseline from ${baselinePath}: ${err.message}`);
    return null;
  }
}

function formatDelta(value: number, unit: string): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} ${unit}`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

async function printBaselineDiff(
  snapshots: PerformanceSnapshot[],
  baselinePath: string,
): Promise<void> {
  if (snapshots.length === 0) {
    return;
  }

  const baseline = await loadBaseline(baselinePath);
  if (!baseline || !Array.isArray(baseline.baselines) || baseline.baselines.length === 0) {
    return;
  }

  const baselineMap = new Map(
    baseline.baselines.map((entry) => [buildKey(entry), entry] as const),
  );

  const comparisons = snapshots
    .map((snapshot) => {
      const entry = baselineMap.get(buildKey(snapshot));
      if (!entry) {
        return null;
      }

      const delta = snapshot.value - entry.median;
      const relative =
        entry.median === 0
          ? null
          : ((snapshot.value - entry.median) / entry.median) * 100;

      return {
        snapshot,
        baseline: entry,
        delta,
        relative,
      };
    })
    .filter((value): value is {
      snapshot: PerformanceSnapshot;
      baseline: BaselineEntry;
      delta: number;
      relative: number | null;
    } => value !== null);

  if (comparisons.length === 0) {
    console.log('ℹ️  No overlapping baselines found for captured snapshots.\n');
    return;
  }

  comparisons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log('📉 Baseline comparison');
  console.log(
    `    Source: ${baselinePath} (computed ${baseline.computedAt}, last ${baseline.historyCount} runs)`,
  );

  const topComparisons = comparisons.slice(0, 10);
  for (const { snapshot, baseline: entry, delta, relative } of topComparisons) {
    console.log(`    • ${snapshot.scenarioId} → ${snapshot.metricName} (${snapshot.browser})`);
    console.log(
      `      ${snapshot.value.toFixed(2)} ${snapshot.unit} vs baseline ${entry.median.toFixed(
        2,
      )} ${entry.unit} (Δ ${formatDelta(delta, snapshot.unit)}, ${formatPercent(relative)})`,
    );
  }

  const missing = snapshots.filter(
    (snapshot) => !baselineMap.has(buildKey(snapshot)),
  );
  if (missing.length > 0) {
    console.log('');
    console.log(
      `    Missing baseline for ${missing.length} metric${missing.length === 1 ? '' : 's'}:`,
    );
    missing.slice(0, 5).forEach((snapshot) => {
      console.log(`    • ${snapshot.scenarioId} → ${snapshot.metricName} (${snapshot.browser})`);
    });
    if (missing.length > 5) {
      console.log(`    • ...${missing.length - 5} more`);
    }
  }

  console.log('');
}
