#!/usr/bin/env tsx
/**
 * Performance Harness CLI
 * Developer-friendly wrapper for running performance tests
 */

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

interface CliOptions {
  scenario?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  output?: string;
}

const DEFAULT_OUTPUT = 'diagnostics/perf-results.json';

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
  console.log(`  Output:   ${outputPath}\n`);

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
