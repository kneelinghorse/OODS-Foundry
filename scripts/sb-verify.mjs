#!/usr/bin/env node
/**
 * Storybook verification helper.
 *
 * Runs the curated axe smoke check and the Chromatic visual-regression dry run,
 * then aggregates diagnostics into artifacts/storybook/verify.
 */
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const verifyRoot = path.join(repoRoot, 'artifacts/storybook/verify');
const axeReportPath = path.join(repoRoot, 'tools/a11y/reports/a11y-report.json');
const chromaticRoot = path.join(repoRoot, 'chromatic-baselines');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function main() {
  console.log('🔧 Storybook verify — starting');

  await ensureDir(verifyRoot);

  await runPnpm(['run', 'build-storybook'], 'Build Storybook');
  await runPnpm(['run', 'a11y:check'], 'Curated axe check');
  const axeSummary = await buildAxeSummary();
  await writePretty(path.join(verifyRoot, 'axe.json'), axeSummary);

  const chromaticSummary = await runVisualRegression();
  await writePretty(path.join(verifyRoot, 'vr-summary.json'), chromaticSummary);

  const hasAxeViolations = axeSummary?.totals?.failures > 0;
  const hasVrIssues = chromaticSummary.brands.some((entry) => entry.status !== 'passed');

  if (hasAxeViolations || hasVrIssues) {
    console.error('Storybook verification found issues. See artifacts/storybook/verify for details.');
    process.exit(1);
  }

  console.log('✅ Storybook verification complete — no issues detected.');
}

async function runVisualRegression() {
  const hasChromaticToken = await chromaticConfigAvailable();
  const brands = [];

  if (!hasChromaticToken) {
    console.warn('⚠️  CHROMATIC_PROJECT_TOKEN missing; skipping Chromatic dry run.');
    return {
      generatedAt: new Date().toISOString(),
      mode: 'fallback',
      brands,
      notes: ['Chromatic dry run skipped — token not configured.']
    };
  }

  await runPnpm(['run', 'chromatic:dry-run'], 'Chromatic dry run');

  try {
    const entries = await readdir(chromaticRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('brand-')) {
        continue;
      }

      const brandLabel = entry.name.replace('brand-', '').toUpperCase();
      const brandDir = path.join(chromaticRoot, entry.name);
      const diagnosis = await readJsonIfExists(path.join(brandDir, 'chromatic-diagnostics.json'));
      const log = await readFileSafe(path.join(brandDir, 'chromatic.log'));

      const status = resolveChromaticStatus(diagnosis, log);
      const onlyStoryFiles = Array.isArray(diagnosis?.configuration?.onlyStoryFiles)
        ? diagnosis.configuration.onlyStoryFiles
        : [];

      brands.push({
        brand: brandLabel,
        status,
        diagnosticsFile: diagnosis ? relPath(path.join(brandDir, 'chromatic-diagnostics.json')) : null,
        logFile: log ? relPath(path.join(brandDir, 'chromatic.log')) : null,
        exitCode: typeof diagnosis?.exitCode === 'number' ? diagnosis.exitCode : null,
        exitCodeKey: diagnosis?.exitCodeKey ?? null,
        changeHints: extractChangeHints(log),
        storyCount: onlyStoryFiles.length
      });
    }
  } catch (error) {
    console.warn('⚠️  Unable to collect Chromatic diagnostics:', error);
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'chromatic',
    brands,
    notes: brands.length === 0 ? ['No Chromatic brand diagnostics located.'] : []
  };
}

function resolveChromaticStatus(diagnosis, log) {
  if (!diagnosis) {
    return 'unknown';
  }

  if (typeof diagnosis.exitCode === 'number' && diagnosis.exitCode !== 0) {
    return 'failed';
  }

  const hint = extractChangeHints(log);
  if (hint === 'changes') {
    return 'changes_detected';
  }

  if (hint === 'skipped') {
    return 'skipped';
  }

  return 'passed';
}

function extractChangeHints(log) {
  if (!log) {
    return null;
  }

  if (/Visual tests detected changes/i.test(log) || /changes? detected/i.test(log)) {
    return 'changes';
  }

  if (/Skipping build/i.test(log) || /No visual changes detected/i.test(log)) {
    return 'skipped';
  }

  return 'clean';
}

async function buildAxeSummary() {
  const raw = await readFile(axeReportPath, 'utf8');
  const report = JSON.parse(raw);

  const totals = {
    overall: Array.isArray(report.results) ? report.results.length : 0,
    passes: countPasses(report.results),
    failures: countFailures(report.results)
  };

  const sectionTotals = {};
  if (report.sections && typeof report.sections === 'object') {
    for (const [section, items] of Object.entries(report.sections)) {
      sectionTotals[section] = {
        total: Array.isArray(items) ? items.length : 0,
        passes: countPasses(items),
        failures: countFailures(items)
      };
    }
  }

  const violations = [];
  if (Array.isArray(report.results)) {
    for (const item of report.results) {
      if (item && item.pass === false) {
        violations.push({
          ruleId: item.ruleId,
          summary: item.summary,
          target: item.target,
          failureSummary: item.failureSummary ?? ''
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: report.generatedAt ?? null,
    totals,
    sectionTotals,
    violations
  };
}

function countPasses(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.filter((item) => item && item.pass !== false).length;
}

function countFailures(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.filter((item) => item && item.pass === false).length;
}

function relPath(target) {
  return path.relative(repoRoot, target);
}

async function readJsonIfExists(target) {
  try {
    const raw = await readFile(target, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn(`⚠️  Failed to read JSON from ${target}:`, error);
    }
    return null;
  }
}

async function readFileSafe(target) {
  try {
    return await readFile(target, 'utf8');
  } catch {
    return null;
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function chromaticConfigAvailable() {
  if (process.env.CHROMATIC_PROJECT_TOKEN) {
    return true;
  }

  const candidates = [
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, 'apps/explorer/.env.local')
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      // ignore missing file
    }
  }

  return false;
}

async function writePretty(target, payload) {
  await writeFile(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function runPnpm(args, label) {
  console.log(`▶︎ ${label}`);
  await new Promise((resolve, reject) => {
    const proc = spawn(pnpmCmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env
    });

    proc.on('error', reject);
    proc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`${label} failed with code ${code ?? signal ?? 'unknown'}`);
        err.exitCode = code ?? 1;
        reject(err);
      }
    });
  });
}

// Guard against unhandled rejections.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection during Storybook verification:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('Storybook verification failed:', error);
  process.exit(error?.exitCode ?? 1);
});
