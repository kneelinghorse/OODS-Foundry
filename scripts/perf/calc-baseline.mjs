#!/usr/bin/env node
/**
 * calc-baseline.mjs
 *
 * Computes rolling baseline statistics (median, stdDev) from the last N performance runs.
 *
 * Usage:
 *   node scripts/perf/calc-baseline.mjs --history 10 --input diagnostics/perf-history/ --output diagnostics/perf-baseline.json
 *
 * Sprint 18 (B18.8): Performance CI integration
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const historyCount = parseInt(args[args.indexOf('--history') + 1] || '10', 10);
const inputDir = args[args.indexOf('--input') + 1] || 'diagnostics/perf-history';
const outputPath = args[args.indexOf('--output') + 1] || 'diagnostics/perf-baseline.json';

/**
 * Calculate median from sorted array
 */
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate standard deviation
 */
function stdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Load most recent N perf result files
 */
function loadRecentResults(dir, count) {
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: join(dir, f),
        mtime: statSync(join(dir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, count);

    return files.map(f => {
      const content = readFileSync(f.path, 'utf-8');
      return JSON.parse(content);
    });
  } catch (error) {
    console.error(`⚠️  Could not load history from ${dir}: ${error.message}`);
    return [];
  }
}

/**
 * Group snapshots by scenarioId + metricName + browser
 */
function groupSnapshots(runs) {
  const groups = {};

  for (const run of runs) {
    const snapshots = run.performanceHarness?.snapshots || [];
    for (const snap of snapshots) {
      const key = `${snap.scenarioId}::${snap.metricName}::${snap.browser}`;
      if (!groups[key]) {
        groups[key] = {
          scenarioId: snap.scenarioId,
          metricName: snap.metricName,
          browser: snap.browser,
          unit: snap.unit,
          values: []
        };
      }
      groups[key].values.push(snap.value);
    }
  }

  return groups;
}

/**
 * Compute baseline statistics for each metric
 */
function computeBaselines(groups) {
  const baselines = [];

  for (const [key, group] of Object.entries(groups)) {
    const medianValue = median(group.values);
    const stdDevValue = stdDev(group.values);

    baselines.push({
      scenarioId: group.scenarioId,
      metricName: group.metricName,
      browser: group.browser,
      unit: group.unit,
      median: medianValue,
      stdDev: stdDevValue,
      sampleCount: group.values.length,
      min: Math.min(...group.values),
      max: Math.max(...group.values)
    });
  }

  return baselines;
}

/**
 * Main execution
 */
function main() {
  console.log(`📊 Calculating performance baselines...`);
  console.log(`   History: last ${historyCount} runs`);
  console.log(`   Input:   ${inputDir}`);
  console.log(`   Output:  ${outputPath}`);
  console.log('');

  const runs = loadRecentResults(inputDir, historyCount);

  if (runs.length === 0) {
    console.error('❌ No historical runs found. Cannot compute baseline.');
    process.exit(1);
  }

  console.log(`✅ Loaded ${runs.length} historical runs`);

  const groups = groupSnapshots(runs);
  const baselines = computeBaselines(groups);

  console.log(`📈 Computed ${baselines.length} baseline metrics`);

  const output = {
    version: '1.0.0',
    computedAt: new Date().toISOString(),
    historyCount: runs.length,
    baselines
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`✅ Baseline saved to ${outputPath}`);

  // Print summary
  console.log('');
  console.log('Top 5 slowest scenarios (by median):');
  const sorted = [...baselines].sort((a, b) => b.median - a.median).slice(0, 5);
  for (const bl of sorted) {
    console.log(`  • ${bl.scenarioId} → ${bl.metricName}: ${bl.median.toFixed(2)} ${bl.unit} (±${bl.stdDev.toFixed(2)})`);
  }
}

main();
