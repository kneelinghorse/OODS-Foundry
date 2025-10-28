#!/usr/bin/env node
/**
 * check-regressions.mjs
 *
 * Compares current performance run against baseline and detects regressions.
 *
 * Regression criteria (all three must be met):
 *   1. Statistical: newValue > (baseline.median + 3 * baseline.stdDev)
 *   2. Absolute:    (newValue - baseline.median) > 50ms
 *   3. Relative:    ((newValue - baseline.median) / baseline.median) > 0.15 (15%)
 *
 * Usage:
 *   node scripts/perf/check-regressions.mjs --current diagnostics/perf-results.json --baseline diagnostics/perf-baseline.json
 *
 * Exit codes:
 *   0 - No regressions detected
 *   1 - Regressions detected
 *   2 - Error (missing files, invalid JSON, etc.)
 *
 * Sprint 18 (B18.8): Performance CI integration
 */

import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const currentPath = args[args.indexOf('--current') + 1] || 'diagnostics/perf-results.json';
const baselinePath = args[args.indexOf('--baseline') + 1] || 'diagnostics/perf-baseline.json';
const outputPath = args[args.indexOf('--output') + 1] || 'diagnostics/perf-regressions.json';

// Thresholds
const ABSOLUTE_THRESHOLD_MS = 50;
const RELATIVE_THRESHOLD_PCT = 0.15; // 15%
const SIGMA_MULTIPLIER = 3;

/**
 * Load JSON file with error handling
 */
function loadJSON(path, label) {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Could not load ${label} from ${path}: ${error.message}`);
    process.exit(2);
  }
}

/**
 * Find baseline for a given snapshot
 */
function findBaseline(snapshot, baselines) {
  return baselines.find(
    bl =>
      bl.scenarioId === snapshot.scenarioId &&
      bl.metricName === snapshot.metricName &&
      bl.browser === snapshot.browser
  );
}

/**
 * Check if a snapshot is a regression
 */
function isRegression(snapshot, baseline) {
  const newValue = snapshot.value;
  const baselineMedian = baseline.median;
  const baselineStdDev = baseline.stdDev;

  // 1. Statistical significance: 3-sigma
  const statisticalThreshold = baselineMedian + (SIGMA_MULTIPLIER * baselineStdDev);
  const isStatisticallySignificant = newValue > statisticalThreshold;

  // 2. Absolute significance: > 50ms
  const absoluteDiff = newValue - baselineMedian;
  const isAbsolutelySignificant = absoluteDiff > ABSOLUTE_THRESHOLD_MS;

  // 3. Relative significance: > 15%
  const relativeDiff = (absoluteDiff / baselineMedian);
  const isRelativelySignificant = relativeDiff > RELATIVE_THRESHOLD_PCT;

  // All three conditions must be met
  const isReg = isStatisticallySignificant && isAbsolutelySignificant && isRelativelySignificant;

  return {
    isRegression: isReg,
    newValue,
    baselineMedian,
    baselineStdDev,
    absoluteDiff,
    relativeDiff: relativeDiff * 100, // convert to percentage
    statisticalThreshold,
    checks: {
      statistical: isStatisticallySignificant,
      absolute: isAbsolutelySignificant,
      relative: isRelativelySignificant
    }
  };
}

/**
 * Main execution
 */
function main() {
  console.log(`🔍 Checking for performance regressions...`);
  console.log(`   Current:  ${currentPath}`);
  console.log(`   Baseline: ${baselinePath}`);
  console.log('');

  const current = loadJSON(currentPath, 'current results');
  const baseline = loadJSON(baselinePath, 'baseline');

  const snapshots = current.performanceHarness?.snapshots || [];
  const baselines = baseline.baselines || [];

  if (snapshots.length === 0) {
    console.warn('⚠️  No snapshots found in current results. Nothing to check.');
    process.exit(0);
  }

  if (baselines.length === 0) {
    console.warn('⚠️  No baselines available. Cannot detect regressions.');
    process.exit(0);
  }

  console.log(`📊 Analyzing ${snapshots.length} snapshots against ${baselines.length} baselines`);
  console.log('');

  const regressions = [];
  const improvements = [];
  const stable = [];

  for (const snap of snapshots) {
    const bl = findBaseline(snap, baselines);

    if (!bl) {
      console.log(`⚠️  No baseline for ${snap.scenarioId} → ${snap.metricName} (${snap.browser})`);
      continue;
    }

    const result = isRegression(snap, bl);

    if (result.isRegression) {
      regressions.push({
        snapshot: snap,
        baseline: bl,
        ...result
      });
    } else if (result.absoluteDiff < -ABSOLUTE_THRESHOLD_MS && result.relativeDiff < -RELATIVE_THRESHOLD_PCT * 100) {
      improvements.push({
        snapshot: snap,
        baseline: bl,
        ...result
      });
    } else {
      stable.push({
        snapshot: snap,
        baseline: bl,
        ...result
      });
    }
  }

  // Print results
  console.log(`✅ Stable:       ${stable.length}`);
  console.log(`🚀 Improvements: ${improvements.length}`);
  console.log(`⚠️  Regressions:  ${regressions.length}`);
  console.log('');

  if (improvements.length > 0) {
    console.log('🚀 Performance Improvements:');
    for (const item of improvements) {
      const { snapshot, baseline, absoluteDiff, relativeDiff } = item;
      console.log(`  • ${snapshot.scenarioId} → ${snapshot.metricName}`);
      console.log(`    ${baseline.median.toFixed(2)} → ${snapshot.value.toFixed(2)} ${snapshot.unit}`);
      console.log(`    Δ ${absoluteDiff.toFixed(2)} ${snapshot.unit} (${relativeDiff.toFixed(1)}%)`);
      console.log('');
    }
  }

  if (regressions.length > 0) {
    console.error('⚠️  Performance Regressions Detected:');
    console.error('');
    for (const item of regressions) {
      const { snapshot, baseline, absoluteDiff, relativeDiff, checks } = item;
      console.error(`  ❌ ${snapshot.scenarioId} → ${snapshot.metricName} (${snapshot.browser})`);
      console.error(`     Baseline: ${baseline.median.toFixed(2)} ${snapshot.unit} (±${baseline.stdDev.toFixed(2)})`);
      console.error(`     Current:  ${snapshot.value.toFixed(2)} ${snapshot.unit}`);
      console.error(`     Δ ${absoluteDiff.toFixed(2)} ${snapshot.unit} (+${relativeDiff.toFixed(1)}%)`);
      console.error(`     Checks: statistical=${checks.statistical}, absolute=${checks.absolute}, relative=${checks.relative}`);
      console.error('');
    }
  }

  // Write output
  const output = {
    version: '1.0.0',
    checkedAt: new Date().toISOString(),
    commitSha: current.performanceHarness?.commitSha,
    baselineComputedAt: baseline.computedAt,
    summary: {
      total: snapshots.length,
      stable: stable.length,
      improvements: improvements.length,
      regressions: regressions.length
    },
    regressions: regressions.map(r => ({
      scenarioId: r.snapshot.scenarioId,
      metricName: r.snapshot.metricName,
      browser: r.snapshot.browser,
      newValue: r.newValue,
      baselineMedian: r.baselineMedian,
      absoluteDiff: r.absoluteDiff,
      relativeDiff: r.relativeDiff,
      unit: r.snapshot.unit
    })),
    improvements: improvements.map(i => ({
      scenarioId: i.snapshot.scenarioId,
      metricName: i.snapshot.metricName,
      browser: i.snapshot.browser,
      newValue: i.newValue,
      baselineMedian: i.baselineMedian,
      absoluteDiff: i.absoluteDiff,
      relativeDiff: i.relativeDiff,
      unit: i.snapshot.unit
    }))
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`📄 Regression report saved to ${outputPath}`);

  // Exit with appropriate code
  if (regressions.length > 0) {
    console.error('');
    console.error('❌ CI gate FAILED: Performance regressions detected.');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ CI gate PASSED: No regressions detected.');
    process.exit(0);
  }
}

main();
