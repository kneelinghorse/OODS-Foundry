#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TARGET = 'packages/tokens/src';
const CONFIG_NAME = 'dtcg-guardrails.config.yaml';

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
  constructor(rules) {
    this.rules = rules;
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
    this.issues.push({
      ruleId,
      level: rule.level ?? 'error',
      file: ctx.file,
      location,
      message,
      description: rule.description ?? ''
    });
  }

  hasErrors() {
    return this.issues.some((issue) => issue.level === 'error');
  }

  format() {
    return this.issues
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

async function lintTargets(targets, config) {
  const collector = new IssueCollector(config.rules);
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
  const targets = args.length ? args : [DEFAULT_TARGET];
  const config = await loadConfig();
  const collector = await lintTargets(targets, config);

  if (collector.issues.length > 0) {
    console.log(collector.format());
  } else {
    console.log('✔ Design tokens lint passed.');
  }

  process.exitCode = collector.hasErrors() ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
