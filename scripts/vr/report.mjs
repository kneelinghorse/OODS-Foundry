#!/usr/bin/env node

/**
 * Chromatic visual regression summary reporter.
 *
 * Consumes per-brand Chromatic CLI JSON output (chromatic-brand-*.json)
 * and produces a normalized VR signal under artifacts/state/vr.json.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const stateDir = path.join(repoRoot, 'artifacts', 'state');

async function main() {
  try {
    const report = await buildReport();
    await mkdir(stateDir, { recursive: true });

    const vrPath = path.join(stateDir, 'vr.json');
    await writeFile(vrPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

    const chromaticSummaryPath = path.join(stateDir, 'chromatic.json');
    await writeFile(
      chromaticSummaryPath,
      JSON.stringify(buildChromaticSummary(report), null, 2) + '\n',
      'utf8'
    );

    console.log(
      `[vr:report] wrote ${path.relative(repoRoot, vrPath)} (${Object.keys(report.byBrand).join(', ')})`
    );
  } catch (error) {
    console.error('[vr:report] failed:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

async function buildReport() {
  const candidateFiles = await discoverChromaticFiles();
  if (candidateFiles.length === 0) {
    throw new Error('No Chromatic JSON output found in artifacts/state');
  }

  const brandSummaries = [];

  for (const filePath of candidateFiles) {
    const brandKey = deriveBrandKey(filePath);
    const raw = await readJson(filePath);
    const summary = summariseChromaticPayload(raw);
    const relativePath = path.relative(repoRoot, filePath);

    brandSummaries.push({
      brandKey,
      relativePath,
      summary
    });
  }

  const totals = rollupTotals(brandSummaries);
  const suspectedGroupingOnly =
    totals.totalDiffs > 0 &&
    totals.totalAdded === 0 &&
    totals.totalRemoved === 0 &&
    brandSummaries
      .filter((entry) => entry.summary.diffCount > 0)
      .every((entry) => entry.summary.groupingOnly === true);

  const byBrand = {};
  const sources = {};

  for (const entry of brandSummaries) {
    byBrand[entry.brandKey] = {
      totalSnapshots: entry.summary.totalSnapshots,
      changed: entry.summary.changed,
      added: entry.summary.added,
      removed: entry.summary.removed,
      unchanged: entry.summary.unchanged,
      diffCount: entry.summary.diffCount,
      greenRate: entry.summary.greenRate,
      status: entry.summary.status,
      groupingOnly: entry.summary.groupingOnly
    };
    sources[entry.brandKey] = entry.relativePath;
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'chromatic',
    totals,
    totalDiffs: totals.totalDiffs,
    suspectedGroupingOnly,
    byBrand,
    sources
  };
}

async function discoverChromaticFiles() {
  const entries = await readdir(stateDir, { withFileTypes: true }).catch((error) => {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const brandFiles = entries
    .filter((entry) => entry.isFile() && /^chromatic-brand-.*\.json$/i.test(entry.name))
    .map((entry) => path.join(stateDir, entry.name));

  if (brandFiles.length > 0) {
    return brandFiles.sort();
  }

  const fallback = entries.find(
    (entry) => entry.isFile() && entry.name.toLowerCase() === 'chromatic.json'
  );
  if (fallback) {
    return [path.join(stateDir, fallback.name)];
  }

  return [];
}

function deriveBrandKey(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const match = base.match(/^chromatic-(brand-[a-z0-9-]+)$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  if (base.toLowerCase() === 'chromatic') {
    return 'all';
  }
  return base.toLowerCase();
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
}

function summariseChromaticPayload(payload) {
  const snapshots = coalesce(
    payload?.snapshots,
    payload?.summary?.snapshots,
    payload?.build?.snapshots,
    payload?.output?.snapshots,
    payload?.result?.snapshots
  );
  const changeSummary = coalesce(
    payload?.changeSummary,
    payload?.build?.changeSummary,
    payload?.summary?.changeSummary,
    payload?.result?.changeSummary
  );

  const added = toFiniteNumber([
    snapshots?.added,
    changeSummary?.added,
    changeSummary?.additions,
    payload?.added,
    payload?.stats?.added,
    payload?.specs?.added,
    payload?.specs?.additionCount
  ]);
  const removed = toFiniteNumber([
    snapshots?.removed,
    changeSummary?.removed,
    changeSummary?.removals,
    payload?.removed,
    payload?.stats?.removed,
    payload?.specs?.removed,
    payload?.specs?.removalCount
  ]);
  const changed = toFiniteNumber([
    snapshots?.changed,
    changeSummary?.changed,
    changeSummary?.changes,
    payload?.changed,
    payload?.stats?.changed,
    payload?.specs?.changed,
    payload?.specs?.changeCount,
    payload?.tests?.diffCount,
    payload?.diffCount
  ]);
  const unchangedFromPayload = toFiniteNumber([
    snapshots?.unchanged,
    changeSummary?.unchanged,
    payload?.unchanged,
    payload?.stats?.unchanged,
    payload?.specs?.unchanged
  ]);
  const passedFromPayload = toFiniteNumber([
    snapshots?.passed,
    payload?.passed,
    payload?.build?.passed,
    payload?.result?.passed,
    payload?.tests?.passed
  ]);
  let totalSnapshots = toFiniteNumber([
    snapshots?.total,
    changeSummary?.total,
    payload?.total,
    payload?.stats?.total,
    payload?.specs?.total,
    payload?.tests?.total
  ]);

  const addedSafe = added ?? 0;
  const removedSafe = removed ?? 0;
  const changedSafe = changed ?? 0;

  let unchanged = toFiniteNumber([unchangedFromPayload, passedFromPayload], null);
  let diffCount = addedSafe + removedSafe + changedSafe;

  if (totalSnapshots == null) {
    const candidate = diffCount + (unchanged ?? 0);
    if (candidate > 0) {
      totalSnapshots = candidate;
    }
  }

  if (totalSnapshots == null && snapshots?.totalCount != null) {
    totalSnapshots = Number(snapshots.totalCount);
  }

  if (totalSnapshots == null) {
    totalSnapshots = diffCount;
  }

  if (unchanged == null) {
    unchanged = Math.max(totalSnapshots - diffCount, 0);
  }

  if (!Number.isFinite(unchanged)) {
    unchanged = 0;
  }

  if (!Number.isFinite(totalSnapshots)) {
    totalSnapshots = diffCount;
  }

  const passCount = Math.max(toFiniteNumber(unchanged, 0), 0);
  const totalSafe = Math.max(toFiniteNumber(totalSnapshots, 0), 0);

  const greenRate =
    totalSafe > 0 ? clamp(passCount / totalSafe, 0, 1) : 1;

  const status = normaliseStatus(
    coalesce(
      payload?.status,
      payload?.code,
      payload?.result,
      payload?.outcome,
      payload?.build?.status,
      payload?.build?.result
    )
  );

  const groupingOnly = inferGroupingOnly(payload);

  return {
    totalSnapshots: totalSafe,
    changed: changedSafe,
    added: addedSafe,
    removed: removedSafe,
    unchanged: passCount,
    diffCount,
    greenRate,
    status,
    groupingOnly
  };
}

function rollupTotals(brandSummaries) {
  const totals = {
    totalSnapshots: 0,
    totalChanged: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalPassed: 0
  };

  for (const entry of brandSummaries) {
    totals.totalSnapshots += entry.summary.totalSnapshots;
    totals.totalChanged += entry.summary.changed;
    totals.totalAdded += entry.summary.added;
    totals.totalRemoved += entry.summary.removed;
    totals.totalPassed += entry.summary.unchanged;
  }

  totals.totalDiffs = totals.totalChanged + totals.totalAdded + totals.totalRemoved;
  totals.greenRate =
    totals.totalSnapshots > 0 ? clamp(totals.totalPassed / totals.totalSnapshots, 0, 1) : 1;

  return totals;
}

function buildChromaticSummary(report) {
  return {
    generatedAt: report.generatedAt,
    totals: report.totals,
    byBrand: report.byBrand,
    sources: report.sources,
    suspectedGroupingOnly: report.suspectedGroupingOnly
  };
}

function coalesce(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function toFiniteNumber(values, defaultValue = null) {
  const items = Array.isArray(values) ? values : [values];
  for (const value of items) {
    if (value === undefined || value === null) {
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return defaultValue;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normaliseStatus(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toUpperCase() : null;
  }
  return null;
}

function inferGroupingOnly(payload) {
  const hints = [
    payload?.groupingOnly,
    payload?.componentGroupingOnly,
    payload?.changeSummary?.groupingOnly,
    payload?.changeSummary?.componentGroupingOnly,
    payload?.summary?.groupingOnly,
    payload?.summary?.componentGroupingOnly,
    payload?.build?.changeSummary?.groupingOnly,
    payload?.build?.changeSummary?.componentGroupingOnly,
    payload?.tests?.groupingOnly,
    payload?.tests?.componentGroupingOnly
  ];
  return hints.some((hint) => hint === true);
}

await main();
