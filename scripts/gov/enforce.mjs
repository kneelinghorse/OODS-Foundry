#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_GOVERNANCE_DIR = 'artifacts/state/governance';
const DEFAULT_TOKENS_PATH = 'artifacts/state/tokens.json';
const DEFAULT_POLICY_PATH = 'configs/policies/token-namespaces.json';
const BREAKING_LABEL = 'token-change:breaking';
const DIST_TOKEN_PATH = path.join(repoRoot, 'packages', 'tokens', 'dist', 'tailwind', 'tokens.json');

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  await removeDistTokenPayload();

  const policy = await loadPolicy(options.policyPath);
  const tokensSummary = await loadJson(resolvePath(options.tokensPath));
  const reports = await loadGovernanceReports(resolvePath(options.governanceDir));

  const errors = [];
  const warnings = [];

  const labels = resolveLabels(options.labels);

  for (const report of reports) {
    const brand = report.brand ?? report.data?.brand ?? report.file;
    const summary = report.data?.summary ?? {};
    const highRisk = Number(summary.highRisk ?? 0);
    const requiresBreaking = Boolean(report.data?.requiresBreakingLabel);

    if (highRisk > 0 && requiresBreaking && !labels.includes(BREAKING_LABEL)) {
      errors.push(
        `Brand ${brand} has ${highRisk} high-risk token changes but PR lacks label "${BREAKING_LABEL}".`
      );
    }

    const protectedIssues = evaluateProtectedCoverage(report.data, policy.protectedNamespaces);
    errors.push(...protectedIssues.errors.map((message) => `Brand ${brand}: ${message}`));
    warnings.push(...protectedIssues.warnings.map((message) => `Brand ${brand}: ${message}`));
  }

  const literalViolations = Array.isArray(tokensSummary?.purityViolations)
    ? tokensSummary.purityViolations.length
    : 0;
  if (literalViolations > 0) {
    errors.push(`Detected ${literalViolations} CSS color literals; replace with semantic tokens before merging.`);
  }

  if (errors.length > 0) {
    console.error('Token governance enforcement failed:');
    for (const message of errors) {
      console.error(`  • ${message}`);
    }
    if (warnings.length > 0) {
      console.warn('\nWarnings:');
      for (const message of warnings) {
        console.warn(`  • ${message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log('Token governance enforcement passed.');
  if (warnings.length > 0) {
    console.warn('Warnings:');
    for (const message of warnings) {
      console.warn(`  • ${message}`);
    }
  }
}

function parseArgs(argv) {
  const options = {
    governanceDir: DEFAULT_GOVERNANCE_DIR,
    tokensPath: DEFAULT_TOKENS_PATH,
    policyPath: DEFAULT_POLICY_PATH,
    labels: [],
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--governanceDir':
        options.governanceDir = expectValue(argv, ++i, '--governanceDir');
        break;
      case '--tokens':
        options.tokensPath = expectValue(argv, ++i, '--tokens');
        break;
      case '--policy':
        options.policyPath = expectValue(argv, ++i, '--policy');
        break;
      case '--labels':
        options.labels = expectValue(argv, ++i, '--labels')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  return options;
}

function resolveLabels(explicitLabels) {
  let labels = explicitLabels;
  if (!labels.length && typeof process.env.PR_LABELS === 'string') {
    labels = process.env.PR_LABELS.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return labels.map((label) => label.toLowerCase());
}

function expectValue(argv, index, flag) {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/gov/enforce.mjs [options]',
      '',
      'Options:',
      `  --governanceDir <dir>   Governance report directory (default: ${DEFAULT_GOVERNANCE_DIR})`,
      `  --tokens <file>         Tokens summary JSON (default: ${DEFAULT_TOKENS_PATH})`,
      `  --policy <file>         Namespace policy (default: ${DEFAULT_POLICY_PATH})`,
      '  --labels <list>         Comma-separated PR labels',
      '  --help, -h              Show this message'
    ].join('\n')
  );
}

async function loadPolicy(policyPath) {
  const absolute = resolvePath(policyPath);
  const raw = await fs.readFile(absolute, 'utf8');
  const json = JSON.parse(raw);
  return {
    protectedNamespaces: toLowerCaseArray(json?.protected?.namespaces)
  };
}

async function loadGovernanceReports(directory) {
  const reports = [];
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const file = path.join(directory, entry.name);
    const raw = await fs.readFile(file, 'utf8');
    try {
      const json = JSON.parse(raw);
      reports.push({ file, brand: json.brand ?? entry.name, data: json });
    } catch (error) {
      throw new Error(`Failed to parse ${file}: ${(error && error.message) || error}`);
    }
  }

  return reports;
}

function evaluateProtectedCoverage(report, protectedNamespaces) {
  const errors = [];
  const warnings = [];

  if (!report) {
    return { errors, warnings };
  }

  const protectedSet = new Set(protectedNamespaces);
  if (protectedSet.size === 0) {
    return { errors, warnings };
  }

  const allChanges = collectChanges(report.changes);
  const codeowners = Array.isArray(report.codeowners) ? report.codeowners : [];

  for (const change of allChanges) {
    const namespace = String(change.namespace ?? '').toLowerCase();
    if (!protectedSet.has(namespace)) {
      continue;
    }
    const matchingEntry = codeowners.find(
      (entry) =>
        entry.path === change.path &&
        (!change.sourceHint || entry.sourceHint === change.sourceHint)
    );
    if (!matchingEntry) {
      errors.push(
        `Protected namespace change "${change.path}" lacks CODEOWNERS coverage.`
      );
      continue;
    }
    if (!matchingEntry.covered) {
      errors.push(
        `Protected namespace change "${change.path}" is not covered by CODEOWNERS (pattern ${matchingEntry.matchingOwner ?? 'n/a'}).`
      );
    }
  }

  return { errors, warnings };
}

function collectChanges(changes) {
  if (!changes) {
    return [];
  }
  const lists = [];
  if (Array.isArray(changes.added)) {
    lists.push(...changes.added);
  }
  if (Array.isArray(changes.removed)) {
    lists.push(...changes.removed);
  }
  if (Array.isArray(changes.modified)) {
    lists.push(...changes.modified);
  }
  return lists;
}

async function loadJson(filePath) {
  try {
    const raw = await fs.readFile(resolvePath(filePath), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function resolvePath(targetPath) {
  if (!targetPath) {
    return repoRoot;
  }
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.join(repoRoot, targetPath);
}

function toLowerCaseArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => String(value ?? '').toLowerCase())
    .filter(Boolean);
}

async function removeDistTokenPayload() {
  try {
    await fs.unlink(DIST_TOKEN_PATH);
    console.warn(
      `Removed built token artifact at ${path.relative(repoRoot, DIST_TOKEN_PATH)} to ensure governance diff uses source tokens.`
    );
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(`enforce failed: ${(error && error.message) || error}`);
  process.exitCode = 1;
});
