#!/usr/bin/env node
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TARGET = 'packages/tokens/src';
const CONFIG_NAME = 'dtcg-guardrails.config.yaml';
const BASELINE_NAME = 'baseline.json';

// Stable identity for a baselined issue: ruleId + file + token-path. Deliberately
// NOT line-based (token JSON has no lines here) so the entry survives reordering;
// an UNKNOWN error (new ruleId/file/path) is never matched and still flips exit 1.
function baselineKey(ruleId, file, location) {
  return `${ruleId}\u0000${file}\u0000${location}`;
}

// Per-rule justification stamped onto generated baseline entries (each suppression
// carries a reason — entry-granular allowlist, not a global rule-relax).
const BASELINE_REASONS = {
  'dtcg/alias-is-full-value':
    'Multi-brand A/B alias pack uses a structured/partial alias value; pre-existing brand-pack debt baselined in sprint-125 m04. New alias-is-full-value violations still fail.',
  'dtcg/token-name-kebab-case':
    'Multi-brand A/B namespace key or camelCase semantic slot; pre-existing brand-pack naming baselined in sprint-125 m04. New kebab-case violations still fail.'
};

function reasonFor(ruleId) {
  return (
    BASELINE_REASONS[ruleId] ??
    `Pre-existing ${ruleId} violation baselined in sprint-125 m04. New violations of this rule still fail.`
  );
}

async function loadBaseline() {
  const baselinePath = path.resolve(__dirname, BASELINE_NAME);
  try {
    const raw = await readFile(baselinePath, 'utf8');
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return new Set(entries.map((e) => baselineKey(e.ruleId, e.file, e.location)));
  } catch {
    // A missing/unreadable baseline suppresses nothing — the gate stays strict.
    return new Set();
  }
}

/**
 * Load and normalise the guardrail configuration.
 */
async function loadConfig() {
  const configPath = path.resolve(__dirname, CONFIG_NAME);
  const raw = await readFile(configPath, 'utf8');
  const parsed = yaml.load(raw);
  const rules = new Map();

  if (!parsed || typeof parsed !== 'object' || !parsed.rules) {
    throw new Error('Unable to load DTCG guardrail rules from config.');
  }

  for (const [ruleId, ruleConfig] of Object.entries(parsed.rules)) {
    rules.set(ruleId, {
      enabled: ruleConfig.enabled !== false,
      level: ruleConfig.level ?? 'error',
      description: ruleConfig.description ?? '',
      ...ruleConfig
    });
  }

  return { configPath, rules };
}

/**
 * Collect JSON file paths recursively from provided directories.
 */
async function collectJsonFiles(targetDir) {
  if ((await stat(targetDir)).isFile()) return targetDir.endsWith('.json') ? [targetDir] : [];
  const entries = await readdir(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      // Ignore hidden/system directories by convention.
      if (entry.name.startsWith('.')) continue;
      files.push(...(await collectJsonFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }

  return files;
}

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALIAS_PATTERN = /^\{([a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*)\}$/;

/**
 * Utility for building error objects.
 */
class IssueCollector {
  constructor(rules, baseline = new Set()) {
    this.rules = rules;
    this.baseline = baseline;
    this.issues = [];
  }

  push(ruleId, ctx, messageBuilder) {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return;

    const location = ctx.path.length ? `${ctx.path.join('.')}` : '<root>';
    const message = messageBuilder(rule);
    if (!message) {
      return;
    }
    let level = rule.level ?? 'error';
    // sprint-125 m04: demote a KNOWN, baselined error to level 'baseline' so
    // hasErrors() ignores it while any NEW error still flips exit 1. Only
    // error-level issues are baselineable — WARN are never suppressed.
    if (level === 'error' && this.baseline.has(baselineKey(ruleId, ctx.file, location))) {
      level = 'baseline';
    }
    this.issues.push({
      ruleId,
      level,
      file: ctx.file,
      location,
      message,
      description: rule.description ?? ''
    });
  }

  hasErrors() {
    return this.issues.some((issue) => issue.level === 'error');
  }

  baselineCount() {
    return this.issues.filter((issue) => issue.level === 'baseline').length;
  }

  // Current error-level issues as committable baseline entries (deterministic order).
  toBaselineEntries() {
    return this.issues
      .filter((issue) => issue.level === 'error')
      .map((issue) => ({
        ruleId: issue.ruleId,
        file: issue.file,
        location: issue.location,
        reason: reasonFor(issue.ruleId)
      }))
      .sort(
        (a, b) =>
          a.ruleId.localeCompare(b.ruleId) ||
          a.file.localeCompare(b.file) ||
          a.location.localeCompare(b.location)
      );
  }

  format() {
    return this.issues
      .filter((issue) => issue.level !== 'baseline')
      .sort((a, b) => {
        if (a.level === b.level) {
          return a.file.localeCompare(b.file) || a.location.localeCompare(b.location);
        }
        return a.level === 'error' ? -1 : 1;
      })
      .map((issue) => {
        const location = issue.location === '<root>' ? '' : ` (${issue.location})`;
        const description = issue.description ? `\n    ↳ ${issue.description}` : '';
        return `[${issue.level.toUpperCase()}] ${issue.file}${location}\n    ${issue.message}${description}`;
      })
      .join('\n');
  }
}

/**
 * Recursively walk token JSON and collect token metadata.
 */
function walkTokens(node, ctx, acc, collector, config) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  const isToken = '$value' in node || '$type' in node;
  if (isToken) {
    validateToken(node, ctx, acc, collector, config);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }

    const childCtx = {
      file: ctx.file,
      path: [...ctx.path, key]
    };

    validateGroupKey(key, childCtx, collector);
    walkTokens(value, childCtx, acc, collector, config);
  }
}

function validateGroupKey(key, ctx, collector) {
  collector.push('dtcg/token-name-no-dollar-prefix', ctx, () => {
    if (key.startsWith('$')) {
      return `Group or token name "${key}" must not start with '$'.`;
    }
    return null;
  });

  collector.push('dtcg/token-name-no-illegal-chars', ctx, () => {
    if (key.includes('.') || key.includes('{') || key.includes('}')) {
      return `Group or token name "${key}" must not include '.', '{', or '}'.`;
    }
    return null;
  });

  collector.push('dtcg/token-name-kebab-case', ctx, () => {
    if (!NAME_PATTERN.test(key)) {
      return `Group or token name "${key}" must be lowercase kebab-case (a-z, 0-9, hyphen).`;
    }
    return null;
  });
}

function validateToken(node, ctx, acc, collector, config) {
  const tokenPath = ctx.path.join('.');

  collector.push('dtcg/token-must-have-value', ctx, () => {
    if (!('$value' in node)) {
      return `Token "${tokenPath}" is missing a "$value".`;
    }
    return null;
  });

  collector.push('dtcg/token-must-have-type', ctx, () => {
    if (!('$type' in node)) {
      return `Token "${tokenPath}" is missing a "$type".`;
    }
    return null;
  });

  const tokenType = node.$type;
  collector.push('dtcg/token-type-is-official', ctx, (rule) => {
    if (!('$type' in node)) return null;
    const allowed = new Set(rule.allowedTypes || []);
    if (allowed.size > 0 && !allowed.has(tokenType)) {
      return `Token "${tokenPath}" uses non-approved type "${tokenType}".`;
    }
    return null;
  });

  const value = node.$value;
  const aliasMatch = typeof value === 'string' ? value.match(ALIAS_PATTERN) : null;

  collector.push('dtcg/alias-is-full-value', ctx, () => {
    if (typeof value === 'string' && !aliasMatch && value.includes('{')) {
      return `Token "${tokenPath}" must use aliases as full values (e.g. "{namespace.token}").`;
    }
    return null;
  });

  collector.push('dtcg/alias-no-string-interpolation', ctx, () => {
    if (typeof value === 'string' && !aliasMatch && value.includes('{')) {
      return `Token "${tokenPath}" may not interpolate aliases inside strings.`;
    }
    return null;
  });

  collector.push('dtcg/alias-no-in-array', ctx, () => {
    if (Array.isArray(value)) {
      const aliasInArray = value.some((item) => typeof item === 'string' && ALIAS_PATTERN.test(item));
      if (aliasInArray) {
        return `Token "${tokenPath}" may not include aliases inside array values.`;
      }
    }
    return null;
  });

  collector.push('dtcg/alias-no-fallbacks', ctx, () => {
    if (Array.isArray(value)) {
      const hasAlias = value.some((item) => typeof item === 'string' && ALIAS_PATTERN.test(item));
      const hasNonAlias = value.some((item) => typeof item !== 'string' || !ALIAS_PATTERN.test(item));
      if (hasAlias && hasNonAlias) {
        return `Token "${tokenPath}" may not provide alias fallbacks.`;
      }
    }
    return null;
  });

  // Store token metadata for cross-token analysis.
  acc.tokens.set(tokenPath, {
    file: ctx.file,
    node,
    alias: aliasMatch ? aliasMatch[1] : null
  });
}

function buildAliasGraph(tokens) {
  const graph = new Map();
  for (const [tokenPath, meta] of tokens.entries()) {
    if (meta.alias) {
      graph.set(tokenPath, meta.alias);
    }
  }
  return graph;
}

function validateAliasGraph(tokens, collector) {
  const graph = buildAliasGraph(tokens);

  const visiting = new Set();
  const visited = new Set();

  function dfs(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      recordCycle([...visiting, node]);
      return;
    }
    visiting.add(node);
    const next = graph.get(node);
    if (next) {
      dfs(next);
    }
    visiting.delete(node);
    visited.add(node);
  }

  function recordCycle(pathStack) {
    const cycleStart = pathStack.indexOf(pathStack[pathStack.length - 1]);
    const cycle = pathStack.slice(cycleStart);
    const first = tokens.get(cycle[0]);
    const ctx = {
      file: first?.file ?? '<unknown>',
      path: cycle[0].split('.')
    };
    collector.push('dtcg/alias-no-circular-references', ctx, () => {
      return `Circular alias detected: ${cycle.join(' -> ')}`;
    });
  }

  for (const token of graph.keys()) {
    dfs(token);
  }

  // Validate that aliases point to real tokens.
  for (const [tokenPath, meta] of tokens.entries()) {
    if (!meta.alias) continue;
    if (!tokens.has(meta.alias)) {
      const ctx = {
        file: meta.file,
        path: tokenPath.split('.')
      };
      collector.push('dtcg/alias-must-resolve', ctx, () => {
        return `Alias target "${meta.alias}" referenced by "${tokenPath}" does not exist.`;
      });
    }
  }
}

async function lintTargets(targets, config, baseline = new Set()) {
  const collector = new IssueCollector(config.rules, baseline);
  const acc = { tokens: new Map() };

  for (const target of targets) {
    const absoluteTarget = path.resolve(process.cwd(), target);
    let files;
    try {
      files = await collectJsonFiles(absoluteTarget);
    } catch (error) {
      throw new Error(`Unable to read tokens from ${absoluteTarget}: ${error.message}`);
    }

    for (const file of files) {
      const relFile = path.relative(process.cwd(), file);
      let json;
      try {
        const raw = await readFile(file, 'utf8');
        json = JSON.parse(raw);
      } catch (error) {
        collector.push('dtcg/json-parse-error', { file: relFile, path: [] }, () => {
          return `Failed to parse JSON: ${error.message}`;
        });
        continue;
      }

      walkTokens(json, { file: relFile, path: [] }, acc, collector, config);
    }
  }

  validateAliasGraph(acc.tokens, collector);
  return collector;
}

async function main() {
  const args = process.argv.slice(2);
  const writeBaseline = args.includes('--write-baseline');
  const targets = args.filter((arg) => !arg.startsWith('--'));
  const finalTargets = targets.length ? targets : [DEFAULT_TARGET];
  const config = await loadConfig();

  // --write-baseline regenerates the committed baseline from ACTUAL output, so it
  // runs with NO suppression to capture the full current error set; normal runs
  // load the committed baseline to suppress known debt.
  const baseline = writeBaseline ? new Set() : await loadBaseline();
  const collector = await lintTargets(finalTargets, config, baseline);

  if (writeBaseline) {
    const entries = collector.toBaselineEntries();
    const baselinePath = path.resolve(__dirname, BASELINE_NAME);
    const payload = {
      note:
        'Entry-granular baseline of KNOWN-pre-existing token-lint errors (sprint-125 m04). Keyed on ruleId+file+token-path (stable, line-independent). A new error not listed here still fails the gate. Regenerate with: node tools/token-lint/index.mjs --write-baseline packages/tokens/src',
      entries
    };
    await writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`✔ Wrote ${entries.length} baseline entr${entries.length === 1 ? 'y' : 'ies'} to ${path.relative(process.cwd(), baselinePath)}.`);
    process.exitCode = 0;
    return;
  }

  const formatted = collector.format();
  if (formatted) {
    console.log(formatted);
  }

  const suppressed = collector.baselineCount();
  if (suppressed > 0) {
    console.log(`\nℹ ${suppressed} pre-existing issue(s) suppressed by ${BASELINE_NAME} (refresh with --write-baseline).`);
  }

  if (!formatted) {
    console.log('✔ Design tokens lint passed.');
  }

  process.exitCode = collector.hasErrors() ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
