#!/usr/bin/env node

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative, extname } from 'path';
import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

import StyleDictionary from 'style-dictionary';
import { register as registerSdTransforms, expandTypesMap } from '@tokens-studio/sd-transforms';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');

// Ensure all relative paths inside Style Dictionary resolve from the tokens package root
process.chdir(packageRoot);

const STABLE_TIMESTAMP =
  process.env.OODS_PACKAGES_BUILD_STAMP ?? '1970-01-01T00:00:00.000Z';

const rawConfig = require('../style-dictionary.config.cjs');
const config = {
  ...rawConfig,
  expand: {
    ...(rawConfig.expand || {}),
    typesMap: expandTypesMap,
  },
};

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const verbose = args.includes('--verbose');

const prefix = config.prefix ?? 'tokens';

registerSdTransforms(StyleDictionary);
registerCustomFormats(prefix);
registerCustomTransforms(prefix);

if (verbose) {
  config.log = {
    ...(config.log || {}),
    verbosity: 'verbose',
  };
}

const sd = new StyleDictionary(config);

const log = {
  info: (...messages) => {
    if (!checkMode || verbose) {
      console.log(...messages);
    }
  },
  success: (...messages) => console.log(...messages),
  warn: (...messages) => console.warn(...messages),
  error: (...messages) => console.error(...messages),
};

async function run() {
  try {
    await sd.hasInitialized;

    if (checkMode) {
      await runCheck();
    } else {
      await runBuild();
    }
  } catch (error) {
    log.error('❌ tokens pipeline failed');
    log.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

async function runBuild() {
  const start = performance.now();
  log.info('Building design tokens with Style Dictionary…');

  await sd.cleanAllPlatforms({ cache: false });
  await sd.buildAllPlatforms({ cache: false });

  const issues = await collectValidationIssues();
  reportValidationIssues(issues);

  if (issues.length === 0) {
    const duration = ((performance.now() - start) / 1000).toFixed(2);
    log.success(`✔︎ tokens built successfully in ${duration}s`);
    log.success('   css:      dist/css/tokens.css');
    log.success('   types:    dist/ts/tokens.ts');
    log.success('   tailwind: dist/tailwind/tokens.json');
  } else {
    process.exitCode = 1;
  }
}

async function runCheck() {
  const outputs = await sd.formatAllPlatforms({ cache: false });
  const diffs = await compareWithExistingOutputs(outputs);
  const issues = await collectValidationIssues();

  if (diffs.length > 0) {
    log.warn('⚠︎ Generated output would differ from disk:');
    diffs.forEach((diff) => {
      const { file, state } = diff;
      if (state === 'missing') {
        log.warn(`   • ${file} (missing – run yarn build:tokens)`);
      } else if (state === 'stale') {
        log.warn(`   • ${file} (stale – run yarn build:tokens)`);
      }
    });
  }

  reportValidationIssues(issues);

  if (issues.length === 0 && diffs.length === 0) {
    log.success('✔︎ token outputs are up-to-date and pass validation');
  } else {
    process.exitCode = 1;
  }
}

function reportValidationIssues(issues) {
  if (issues.length > 0) {
    log.warn('⚠︎ token validation issues detected:');
    issues.forEach((message) => log.warn(`   • ${message}`));
  }
}

async function compareWithExistingOutputs(outputsByPlatform) {
  const diffs = [];

  for (const platformOutputs of Object.values(outputsByPlatform)) {
    for (const { destination, output } of platformOutputs) {
      if (!destination || typeof output !== 'string') {
        continue;
      }

      const absolute = resolve(packageRoot, destination);
      const relativePath = relative(process.cwd(), absolute);

      try {
        const existing = await fs.readFile(absolute, 'utf8');
        const normalizedExisting = normalizeContent(absolute, existing);
        const normalizedExpected = normalizeContent(absolute, output);
        if (normalizedExisting !== normalizedExpected) {
          diffs.push({ file: relativePath, state: 'stale' });
        }
      } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') {
          diffs.push({ file: relativePath, state: 'missing' });
        } else {
          throw error;
        }
      }
    }
  }

  return diffs;
}

async function collectValidationIssues() {
  const issues = [];
  const dictionary = await sd.getPlatformTokens('css', { cache: false });
  const seenNames = new Map();
  const seenVariables = new Map();

  for (const token of dictionary.allTokens) {
    const path = token.path.join('.');
    const cssVariable = token.name.startsWith(`${prefix}-`)
      ? `--${token.name}`
      : `--${prefix}-${token.name}`;
    const resolvedValue = getTokenValue(token);

    if (seenNames.has(token.name)) {
      const existing = seenNames.get(token.name);
      issues.push(
        `Duplicate token name "${token.name}" (${path}) collides with ${existing.path.join('.')}`,
      );
    } else {
      seenNames.set(token.name, token);
    }

    if (seenVariables.has(cssVariable)) {
      const existing = seenVariables.get(cssVariable);
      issues.push(
        `Duplicate CSS variable "${cssVariable}" (${path}) collides with ${existing.path.join('.')}`,
      );
    } else {
      seenVariables.set(cssVariable, token);
    }

    if (resolvedValue === undefined || resolvedValue === null) {
      issues.push(`Token "${path}" produced an undefined value`);
    }
  }

  return issues;
}

function registerCustomFormats(defaultPrefix) {
  if (!StyleDictionary.hooks?.formats?.['typescript/tokens']) {
    StyleDictionary.registerFormat({
      name: 'typescript/tokens',
      format: ({ dictionary, options }) => {
        const bannerEnabled = options?.banner !== false;
        const tsPrefix = options?.prefix || defaultPrefix;
        const banner = `/**\n * -------------------------------------------------------------------\n * ⚠️  AUTO-GENERATED FILE — DO NOT EDIT BY HAND\n * -------------------------------------------------------------------\n * Generated by Style Dictionary. Update tokens via src/tokens/*\n * -------------------------------------------------------------------\n */`;

        const nestedTokens = JSON.stringify(dictionary.tokens, null, 2);
        const flatTokens = buildFlatTokenMap(dictionary.allTokens, tsPrefix);

        const lines = [];
        if (bannerEnabled) {
          lines.push(banner);
          lines.push('');
        }

        lines.push('export const tokens = ' + nestedTokens + ' as const;');
        lines.push('');
        lines.push('export type Tokens = typeof tokens;');
        lines.push('');
        lines.push('export const flatTokens = ' + JSON.stringify(flatTokens, null, 2) + ' as const;');
        lines.push('');
        lines.push('export type FlatTokenName = keyof typeof flatTokens;');
        lines.push('export type FlatToken = typeof flatTokens[FlatTokenName];');
        lines.push('');
        lines.push('export const tokenNames = Object.keys(flatTokens) as FlatTokenName[];');
        lines.push('');
        lines.push('export function token<TName extends FlatTokenName>(pathOrName: TName) {');
        lines.push('  return flatTokens[pathOrName];');
        lines.push('}');
        lines.push('');
        lines.push('export default tokens;');

        return lines.join('\n');
      },
    });
  }

  if (!StyleDictionary.hooks?.formats?.['tailwind/tokens']) {
    StyleDictionary.registerFormat({
      name: 'tailwind/tokens',
      format: ({ dictionary, options, platform }) => {
        const twPrefix = options?.prefix || defaultPrefix;
        const indent = options?.indent ?? 2;
        const meta = {
          generatedAt: STABLE_TIMESTAMP,
          tool: 'style-dictionary',
          version: StyleDictionary.VERSION,
          platform: platform?.name ?? 'tailwind',
        };

        const payload = {
          $schema: 'https://open-oods.dev/schemas/tailwind-tokens.v1.json',
          meta,
          prefix: twPrefix,
          tokens: dictionary.tokens,
          flat: buildFlatTokenMap(dictionary.allTokens, twPrefix),
          cssVariables: buildCssVariableMap(dictionary.allTokens, twPrefix),
        };

        return JSON.stringify(payload, null, indent) + '\n';
      },
    });
  }
}

function buildFlatTokenMap(tokens, prefixForVariable) {
  const entries = tokens.map((token) => {
    const key = token.name;
    const cssVariable = `--${prefixForVariable}-${token.name}`;
    const resolvedValue = getTokenValue(token);
    return [
      key,
      {
        name: token.name,
        value: resolvedValue,
        type: token.type,
        path: token.path,
        cssVariable,
        originalValue: token.original?.value ?? token.original?.$value ?? null,
        description: token.description ?? token.original?.description ?? '',
      },
    ];
  });

  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function buildCssVariableMap(tokens, prefixForVariable) {
  const entries = tokens.map((token) => {
    const name = `--${prefixForVariable}-${token.name}`;
    return [name, getTokenValue(token)];
  });

  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function registerCustomTransforms(prefixForCss) {
  if (!StyleDictionary.hooks?.transforms?.['name/css-prefix']) {
    StyleDictionary.registerTransform({
      name: 'name/css-prefix',
      type: 'name',
      transform: (token) => {
        const preserveNamespaces = new Set(['ref', 'theme', 'sys', 'cmp']);
        const kebabName = token.name;
        const namespace = Array.isArray(token.path) ? token.path[0] : undefined;

        if (typeof namespace === 'string' && preserveNamespaces.has(namespace)) {
          return kebabName;
        }

        const inferredNamespace = typeof kebabName === 'string' ? kebabName.split('-')[0] : undefined;
        if (typeof inferredNamespace === 'string' && preserveNamespaces.has(inferredNamespace)) {
          return kebabName;
        }

        if (!prefixForCss || prefixForCss.length === 0) {
          return kebabName;
        }

        return `${prefixForCss}-${kebabName}`;
      },
    });
  }
}

function getTokenValue(token) {
  if (token.value !== undefined) {
    return token.value;
  }
  if (token.$value !== undefined) {
    return token.$value;
  }
  if (token.original?.value !== undefined) {
    return token.original.value;
  }
  if (token.original?.$value !== undefined) {
    return token.original.$value;
  }
  return null;
}

function normalizeContent(filePath, content) {
  if (extname(filePath) === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.meta?.generatedAt) {
        parsed.meta.generatedAt = '__normalized__';
      }
      return JSON.stringify(parsed, null, 2) + '\n';
    } catch {
      return content;
    }
  }

  return content;
}

await run();
