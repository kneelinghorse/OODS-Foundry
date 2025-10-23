#!/usr/bin/env node

import { spawn } from 'node:child_process';
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
const DEFAULT_REPORT_PATH = 'artifacts/gov/triage-report.md';
const DEFAULT_REVERTS_PATH = 'artifacts/gov/reverts.diff';
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

  if (reports.length === 0) {
    console.warn('⚠︎ No governance reports found; nothing to triage.');
    await writeReport(options.reportPath, {
      baseRef: null,
      headRef: null,
      highRiskTotal: 0,
      kept: [],
      reverted: [],
      observed: [],
      unmatched: [],
      brands: [],
      needsLabel: [],
      policy,
      tokensSummary
    });
    return;
  }

  const classification = classifyReports(reports, policy);
  classification.policy = policy;
  classification.tokensSummary = tokensSummary;

  if (options.apply) {
    const resolvedBaseRef = await resolveBaseRef(classification.baseRef ?? 'main');
    const changedFiles = await gatherChangedFiles(resolvedBaseRef);
    const revertPlan = planReverts(classification.reverted, changedFiles);
    classification.revertPlan = revertPlan;
    classification.baseRefResolved = resolvedBaseRef;

    if (revertPlan.files.length > 0) {
      await applyReverts(revertPlan.files, resolvedBaseRef);
      const diff = await collectDiff(revertPlan.files);
      await writeDiff(options.revertsPath, diff);
    } else {
      await writeDiff(options.revertsPath, '');
    }
  } else {
    classification.revertPlan = planReverts(classification.reverted, new Set());
    await writeDiff(options.revertsPath, '');
  }

  await writeReport(options.reportPath, classification);

  const keptCount = classification.kept.length;
  const revertedCount = classification.reverted.length;
  const observedCount = classification.observed.length;
  console.log(
    `Triage complete → kept:${keptCount} · revert:${revertedCount} · observe:${observedCount}`
  );

  if (classification.revertPlan?.unmatched?.length) {
    console.warn(
      `⚠︎ Unable to map ${classification.revertPlan.unmatched.length} high-risk tokens to workspace files. See report for details.`
    );
  }
}

function parseArgs(argv) {
  const options = {
    governanceDir: DEFAULT_GOVERNANCE_DIR,
    tokensPath: DEFAULT_TOKENS_PATH,
    policyPath: DEFAULT_POLICY_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    revertsPath: DEFAULT_REVERTS_PATH,
    apply: false,
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
      case '--report':
        options.reportPath = expectValue(argv, ++i, '--report');
        break;
      case '--reverts':
        options.revertsPath = expectValue(argv, ++i, '--reverts');
        break;
      case '--apply':
        options.apply = true;
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

  options.reportPath = resolvePath(options.reportPath);
  options.revertsPath = resolvePath(options.revertsPath);

  return options;
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
      'Usage: node scripts/gov/triage.mjs [options]',
      '',
      'Options:',
      `  --governanceDir <dir>   Directory containing brand governance JSON (default: ${DEFAULT_GOVERNANCE_DIR})`,
      `  --tokens <file>         Path to tokens summary JSON (default: ${DEFAULT_TOKENS_PATH})`,
      `  --policy <file>         Namespace policy (default: ${DEFAULT_POLICY_PATH})`,
      `  --report <file>         Markdown report output (default: ${DEFAULT_REPORT_PATH})`,
      `  --reverts <file>        Diff output for generated reverts (default: ${DEFAULT_REVERTS_PATH})`,
      '  --apply                 Apply reverts and emit diff',
      '  --help, -h              Show this message'
    ].join('\n')
  );
}

async function loadPolicy(policyPath) {
  const absolute = resolvePath(policyPath);
  const raw = await fs.readFile(absolute, 'utf8');
  const json = JSON.parse(raw);
  return {
    allowPrefixes: toArray(json?.allow?.prefixes),
    aliasTargets: toArray(json?.allow?.aliasTargets),
    protectedNamespaces: toArray(json?.protected?.namespaces)
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
      reports.push({
        file,
        brand: json.brand ?? json?.brandId ?? entry.name,
        data: json
      });
    } catch (error) {
      throw new Error(`Failed to parse ${file}: ${(error && error.message) || error}`);
    }
  }

  return reports;
}

function classifyReports(reports, policy) {
  const allEntries = [];
  const brands = [];
  const needsLabel = [];
  let baseRef = null;
  let headRef = null;
  let totalHighRisk = 0;

  for (const report of reports) {
    const data = report.data;
    const brandId = data.brand ?? report.brand;
    brands.push({
      id: brandId,
      summary: data.summary,
      requiresBreakingLabel: Boolean(data.requiresBreakingLabel),
      hasBreakingLabel: Boolean(data.hasBreakingLabel),
      file: report.file
    });

    if (data.requiresBreakingLabel && !data.hasBreakingLabel) {
      needsLabel.push(brandId);
    }

    baseRef = baseRef ?? data.baseRef ?? null;
    headRef = headRef ?? data.headRef ?? null;

    if (data.summary?.highRisk) {
      totalHighRisk += Number(data.summary.highRisk) || 0;
    }

    const changes = flattenChanges(report, data);
    for (const entry of changes) {
      const classification = classifyChange(entry.change, policy);
      allEntries.push({
        brand: brandId,
        ...entry,
        decision: classification.decision,
        reason: classification.reason,
        allowMatch: classification.allowMatch
      });
    }
  }

  const kept = allEntries.filter((entry) => entry.decision === 'keep');
  const reverted = allEntries.filter((entry) => entry.decision === 'revert');
  const observed = allEntries.filter((entry) => entry.decision === 'observe');

  return {
    baseRef,
    headRef,
    highRiskTotal: totalHighRisk,
    kept,
    reverted,
    observed,
    unmatched: [],
    brands,
    needsLabel
  };
}

function flattenChanges(report, data) {
  const results = [];
  const sections = [['added', data.changes?.added], ['removed', data.changes?.removed], ['modified', data.changes?.modified]];
  for (const [kind, list] of sections) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const change of list) {
      results.push({
        brandFile: report.file,
        kind,
        change
      });
    }
  }
  return results;
}

function classifyChange(change, policy) {
  const pathValue = change.path ?? '';
  const risk = String(change.risk ?? '').toLowerCase();

  const prefixMatch = policy.allowPrefixes.find((prefix) =>
    typeof pathValue === 'string' && pathValue.startsWith(prefix)
  );
  if (prefixMatch) {
    return {
      decision: 'keep',
      reason: `Allowed namespace prefix "${prefixMatch}"`,
      allowMatch: prefixMatch
    };
  }

  const aliasMatch = detectAliasTarget(change, policy.aliasTargets);
  if (aliasMatch) {
    return {
      decision: 'keep',
      reason: `Alias targets allowed prefix "${aliasMatch}"`,
      allowMatch: aliasMatch
    };
  }

  if (risk === 'high') {
    return {
      decision: 'revert',
      reason: 'High-risk change outside allowlist',
      allowMatch: null
    };
  }

  return {
    decision: 'observe',
    reason: `Non-high-risk change (risk=${risk || 'unknown'})`,
    allowMatch: null
  };
}

function detectAliasTarget(change, aliasTargets) {
  if (!aliasTargets.length || change.namespace !== 'alias') {
    return null;
  }

  const candidates = [];
  if (change.valueAfter !== undefined) {
    candidates.push(change.valueAfter);
  }
  if (change.valueBefore !== undefined) {
    candidates.push(change.valueBefore);
  }

  for (const value of candidates) {
    const valueString = normaliseValue(value);
    if (!valueString) {
      continue;
    }
    for (const prefix of aliasTargets) {
      const normalisedPrefix = prefix.toLowerCase();
      if (valueString.includes(normalisedPrefix)) {
        return prefix;
      }
    }
  }

  return null;
}

function normaliseValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.replace(/[{}"]/g, '').toLowerCase();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return '';
  }
}

async function resolveBaseRef(ref) {
  const candidates = [];
  if (ref) {
    candidates.push(ref);
  }
  if (ref && !ref.startsWith('origin/')) {
    candidates.push(`origin/${ref}`);
  }
  candidates.push('origin/main');

  for (const candidate of dedupe(candidates)) {
    const result = await runGit(['rev-parse', '--verify', `${candidate}^{commit}`], {
      rejectOnError: false
    });
    if (result.code === 0) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve base ref from "${ref}"`);
}

async function gatherChangedFiles(baseRef) {
  const fileSets = [];

  const againstBase = await listGitFiles(['diff', '--name-only', `${baseRef}...HEAD`]);
  fileSets.push(againstBase);

  const workingTree = await listGitFiles(['diff', '--name-only']);
  fileSets.push(workingTree);

  const untracked = await listGitFiles(['ls-files', '--others', '--exclude-standard']);
  fileSets.push(untracked);

  return new Set(fileSets.flat());
}

async function listGitFiles(args) {
  const result = await runGit(args, { rejectOnError: false });
  if (result.code !== 0) {
    return [];
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function planReverts(revertedEntries, changedFiles) {
  const files = new Set();
  const unmatched = [];

  for (const entry of revertedEntries) {
    const candidates = mapChangeToFiles(entry.change, changedFiles);
    if (candidates.length === 0) {
      unmatched.push(entry);
      continue;
    }
    for (const candidate of candidates) {
      files.add(candidate);
    }
  }

  return {
    files: [...files],
    unmatched
  };
}

function mapChangeToFiles(change, changedFiles) {
  const results = new Set();
  const hint = typeof change.sourceHint === 'string' ? change.sourceHint : '';
  const normalisedHint = normalisePath(hint);

  if (normalisedHint && changedFiles.has(normalisedHint)) {
    results.add(normalisedHint);
  }

  if (normalisedHint) {
    for (const file of changedFiles) {
      if (file.startsWith(normalisedHint.endsWith('/') ? normalisedHint : `${normalisedHint}/`)) {
        results.add(file);
      }
    }
  }

  if (!results.size) {
    const guesses = guessCandidatePaths(change);
    for (const guess of guesses) {
      for (const file of changedFiles) {
        if (file.startsWith(guess)) {
          results.add(file);
        }
      }
    }
  }

  return [...results];
}

function guessCandidatePaths(change) {
  const namespace = change.namespace ?? '';
  const pathValue = change.path ?? '';
  const guesses = new Set();

  if (typeof change.sourceHint === 'string' && change.sourceHint.includes('.')) {
    guesses.add(normalisePath(change.sourceHint));
  }

  if (namespace === 'alias') {
    guesses.add('packages/tokens/src/tokens/aliases');
    const brandMatch = pathValue.match(/^brand\.([A-Za-z]+)/);
    if (brandMatch) {
      guesses.add(`packages/tokens/src/tokens/aliases/brand-${brandMatch[1]}.json`);
    }
  }

  if (namespace === 'brand') {
    guesses.add('packages/tokens/src/tokens/brands');
  }

  if (namespace === 'base' || namespace === 'system' || namespace === 'focus' || namespace === 'a11y') {
    guesses.add('packages/tokens/src/tokens/base');
    guesses.add('packages/tokens/src/tokens/base/system');
  }

  if (namespace === 'system') {
    const segment = pathValue.split('.')[0];
    if (segment) {
      guesses.add(`packages/tokens/src/tokens/base/system/${segment}.json`);
    }
  }

  if (namespace === 'focus') {
    guesses.add('packages/tokens/src/tokens/base/system/focus.json');
  }

  return [...guesses].map((guess) =>
    guess.endsWith('.json') ? guess : guess.replace(/\/+$/, '')
  );
}

async function applyReverts(files, baseRef) {
  for (const file of files) {
    const absolute = resolvePath(file);
    const showResult = await runGit(['show', `${baseRef}:${file}`], {
      rejectOnError: false,
      trim: false
    });

    if (showResult.code === 0) {
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, showResult.stdout, 'utf8');
      continue;
    }

    // File was added in head; remove locally.
    const stat = await safeStat(absolute);
    if (stat?.isFile()) {
      await fs.unlink(absolute);
    } else if (stat?.isDirectory()) {
      await fs.rm(absolute, { recursive: true, force: true });
    }
  }
}

async function collectDiff(files) {
  if (!files.length) {
    return '';
  }
  const diffResult = await runGit(['diff', '--color=never', '--', ...files], {
    rejectOnError: false,
    trim: false
  });
  return diffResult.stdout;
}

async function writeDiff(targetPath, diff) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, diff, 'utf8');
}

async function writeReport(reportPath, summary) {
  await fs.mkdir(path.dirname(resolvePath(reportPath)), { recursive: true });

  const lines = [];
  lines.push('# Token Governance Triage');
  lines.push('');

  lines.push(`- Base ref: \`${summary.baseRefResolved ?? summary.baseRef ?? 'n/a'}\``);
  lines.push(`- Head ref: \`${summary.headRef ?? 'HEAD'}\``);

  if (summary.tokensSummary?.status) {
    lines.push(`- Assessor status: ${summary.tokensSummary.status}`);
  }

  if (typeof summary.highRiskTotal === 'number') {
    lines.push(`- High-risk tokens detected: ${summary.highRiskTotal}`);
  }
  lines.push(`- Accepted (allowlist) tokens: ${summary.kept?.length ?? 0}`);
  lines.push(`- Reverted (auto): ${summary.reverted?.length ?? 0}`);
  lines.push(`- Observed (manual review): ${summary.observed?.length ?? 0}`);

  if (Array.isArray(summary.needsLabel) && summary.needsLabel.length > 0) {
    lines.push(
      `- ❗ Add label \`${BREAKING_LABEL}\` for brands: ${summary.needsLabel.join(', ')}`
    );
  } else {
    lines.push(`- PR label \`${BREAKING_LABEL}\`: present or not required`);
  }

  const cssLiteralCount = Array.isArray(summary.tokensSummary?.purityViolations)
    ? summary.tokensSummary.purityViolations.length
    : null;
  if (cssLiteralCount !== null) {
    lines.push(`- CSS literal violations: ${cssLiteralCount}`);
  }

  if (summary.revertPlan?.files?.length) {
    lines.push(`- Files reverted: ${summary.revertPlan.files.length}`);
  } else {
    lines.push('- Files reverted: 0');
  }

  lines.push('');
  lines.push('## Revert Distribution');
  if (summary.reverted?.length) {
    const byNamespace = tallyBy(summary.reverted, (entry) => entry.change.namespace ?? 'unknown');
    for (const [namespace, count] of byNamespace) {
      lines.push(`- ${namespace}: ${count}`);
    }
  } else {
    lines.push('- _(none)_');
  }

  lines.push('');
  lines.push('## Accepted Tokens');
  if (summary.kept?.length) {
    const slice = summary.kept.slice(0, 15);
    for (const entry of slice) {
      lines.push(
        `- Brand ${entry.brand} · ${entry.change.path} (${entry.kind}) — ${entry.reason}`
      );
    }
    if (summary.kept.length > slice.length) {
      lines.push(`- … ${summary.kept.length - slice.length} additional allowlisted tokens`);
    }
  } else {
    lines.push('- _(none)_');
  }

  lines.push('');
  lines.push('## Auto-Reverted Tokens');
  if (summary.reverted?.length) {
    const slice = summary.reverted.slice(0, 25);
    for (const entry of slice) {
      lines.push(
        `- Brand ${entry.brand} · ${entry.change.path} (${entry.kind}) — ${entry.reason}`
      );
    }
    if (summary.reverted.length > slice.length) {
      lines.push(`- … ${summary.reverted.length - slice.length} additional tokens scheduled for revert`);
    }
  } else {
    lines.push('- _(none)_');
  }

  if (summary.revertPlan?.unmatched?.length) {
    lines.push('');
    lines.push('## Unmatched Tokens');
    lines.push(
      `- ⚠︎ ${summary.revertPlan.unmatched.length} tokens could not be mapped to workspace files. Manual review required.`
    );
    const slice = summary.revertPlan.unmatched.slice(0, 15);
    for (const entry of slice) {
      lines.push(`  - Brand ${entry.brand} · ${entry.change.path} (${entry.kind})`);
    }
  }

  lines.push('');
  lines.push('## Notes');
  lines.push(
    `- Policy allowlist prefixes: ${summary.policy?.allowPrefixes?.join(', ') || '—'}`
  );
  lines.push(
    `- Protected namespaces: ${summary.policy?.protectedNamespaces?.join(', ') || '—'}`
  );

  if (Array.isArray(summary.tokensSummary?.purityViolations) && summary.tokensSummary.purityViolations.length > 0) {
    lines.push('- CSS literal violations need remediation to satisfy purity gate.');
  }

  const report = `${lines.join('\n')}\n`;
  await fs.writeFile(resolvePath(reportPath), report, 'utf8');
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

async function loadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
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

function normalisePath(targetPath) {
  return targetPath ? targetPath.replace(/\\/g, '/').replace(/^\.\/+/, '') : '';
}

async function runGit(args, { rejectOnError = true, trim = true } = {}) {
  return runCommand('git', args, {
    cwd: repoRoot,
    rejectOnError,
    trim
  });
}

async function runCommand(command, args, { cwd = repoRoot, rejectOnError = true, trim = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', (error) => {
      if (rejectOnError) {
        reject(error);
      } else {
        resolve({ code: 1, stdout: '', stderr: error?.message ?? String(error) });
      }
    });

    child.on('close', (code) => {
      const output = trim ? stdout.trimEnd() : stdout;
      if (code !== 0 && rejectOnError) {
        const message = stderr || output;
        reject(new Error(message));
        return;
      }
      resolve({ code, stdout: output, stderr: trim ? stderr.trimEnd() : stderr });
    });
  });
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

function tallyBy(list, selector) {
  const map = new Map();
  for (const item of list) {
    const key = selector(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(`triage failed: ${(error && error.message) || error}`);
  process.exitCode = 1;
});
