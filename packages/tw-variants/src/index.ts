import { readFileSync } from 'node:fs';
import path from 'node:path';
import plugin from 'tailwindcss/plugin';
import type { CSSRuleObject, PluginAPI } from 'tailwindcss/types/config';
import {
  CONTEXT_MATRIX,
  type ContextMatrix,
  type ContextId,
  type RegionId,
  type RegionTokenSpec,
} from './context-matrix.js';

type RegionProperty = keyof RegionTokenSpec;

interface FlatTokenMeta {
  cssVariable: string;
  tokenKey: string;
}

interface TokensIndex {
  prefix: string;
  entries: Map<string, FlatTokenMeta>;
}

type VariantSelectorModifier = (context: { className: string }) => string;

interface VariantCallbackArgs {
  modifySelectors: (modifier: VariantSelectorModifier) => void;
  separator: string;
}

export interface ContextVariantOptions {
  tokensPath: string;
  /**
   * Prefix applied to the CSS class that activates a context.
   * `.context-list { ... }` by default.
   */
  contextClassPrefix?: string;
  /**
   * Attribute used to identify canonical regions. `data-region` by default.
   */
  regionAttribute?: string;
}

const DEFAULT_OPTIONS = {
  contextClassPrefix: 'context',
  regionAttribute: 'data-region',
} satisfies Required<Omit<ContextVariantOptions, 'tokensPath'>>;

const REGION_PROPERTIES: RegionProperty[] = [
  'spacing',
  'typography',
  'surface',
  'focus',
  'status',
];

const PROPERTY_PREFIXES: Record<RegionProperty, string[]> = {
  spacing: ['spacing'],
  typography: ['text', 'type', 'font'],
  surface: ['surface'],
  focus: ['focus'],
  status: ['status'],
};

const sanitize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

const normalizeTokenExpression = (expression: string): string =>
  expression
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9*-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

const resolveTokensPath = (tokensPath: string): string => {
  if (path.isAbsolute(tokensPath)) {
    return tokensPath;
  }

  return path.resolve(process.cwd(), tokensPath);
};

const contextClassName = (contextId: ContextId, prefix: string): string =>
  `${prefix}-${sanitize(contextId)}`;

const regionSelector = (regionId: RegionId, attribute: string): string =>
  `[${attribute}="${regionId}"]`;

const loadTokensIndex = (tokensPath: string): TokensIndex => {
  const resolvedPath = resolveTokensPath(tokensPath);

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown file system error';
    throw new Error(
      `[tw-variants] Failed to read tokens file at "${resolvedPath}": ${message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `[tw-variants] Invalid JSON in tokens file "${resolvedPath}": ${message}`,
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !('flat' in parsed)
  ) {
    throw new Error(
      `[tw-variants] tokens.json must export a "flat" token map. File "${resolvedPath}" is missing that shape.`,
    );
  }

  const parsedRecord = parsed as Record<string, unknown>;
  const prefixCandidate = parsedRecord.prefix;
  const prefix =
    typeof prefixCandidate === 'string' && prefixCandidate.trim().length > 0
      ? prefixCandidate
      : 'oods';

  const rawFlat = (parsed as { flat: Record<string, unknown> }).flat;
  const entries = new Map<string, FlatTokenMeta>();

  for (const [tokenKey, definition] of Object.entries(rawFlat)) {
    if (!definition || typeof definition !== 'object') {
      continue;
    }

    const cssVariable =
      typeof (definition as { cssVariable?: unknown }).cssVariable === 'string'
        ? ((definition as { cssVariable: string }).cssVariable.trim() ||
            `--${prefix}-${tokenKey}`)
        : `--${prefix}-${tokenKey}`;

    entries.set(tokenKey, {
      cssVariable,
      tokenKey,
    });
  }

  return { prefix, entries };
};

interface TokenReference {
  property: RegionProperty;
  tokenKey: string;
  cssVariable: string;
  source: string;
}

const expandTokenExpression = (
  expression: string,
  property: RegionProperty,
  tokens: TokensIndex,
): TokenReference[] => {
  const trimmed = expression.trim();

  if (!trimmed || trimmed.toLowerCase() === 'n/a') {
    return [];
  }

  const hyphenated = normalizeTokenExpression(trimmed);

  const collect = (tokenKey: string, cssVariable: string): TokenReference => ({
    property,
    tokenKey,
    cssVariable,
    source: trimmed,
  });

  if (hyphenated.includes('*')) {
    const regex = new RegExp(
      `^${hyphenated.replace(/\*/g, '([a-z0-9-]+)')}$`,
      'i',
    );
    const matches: TokenReference[] = [];

    for (const [tokenKey, meta] of tokens.entries.entries()) {
      if (regex.test(tokenKey)) {
        matches.push(collect(tokenKey, meta.cssVariable));
      }
    }

    if (matches.length > 0) {
      return matches;
    }

    const fallbackKey = sanitize(hyphenated.replace(/\*/g, 'all'));
    return [collect(fallbackKey, `--${tokens.prefix}-${fallbackKey}`)];
  }

  const direct = tokens.entries.get(hyphenated);

  if (direct) {
    return [collect(hyphenated, direct.cssVariable)];
  }

  const prefixedMatches: TokenReference[] = [];
  const prefix = `${hyphenated}-`;

  for (const [tokenKey, meta] of tokens.entries.entries()) {
    if (tokenKey === hyphenated || tokenKey.startsWith(prefix)) {
      prefixedMatches.push(collect(tokenKey, meta.cssVariable));
    }
  }

  if (prefixedMatches.length > 0) {
    prefixedMatches.sort((a, b) => a.tokenKey.localeCompare(b.tokenKey));
    return prefixedMatches;
  }

  const fallbackKey = sanitize(hyphenated);
  return [collect(fallbackKey, `--${tokens.prefix}-${fallbackKey}`)];
};

const getRegionSelectors = (
  matrix: ContextMatrix,
  contextClassPrefix: string,
  regionAttribute: string,
): Record<string, RegionTokenSpec> => {
  const selectors: Record<string, RegionTokenSpec> = {};

  (Object.keys(matrix) as ContextId[]).forEach((contextId) => {
    const regions = matrix[contextId];
    const contextSelector = `.${contextClassName(
      contextId,
      contextClassPrefix,
    )}`;

    (Object.keys(regions) as RegionId[]).forEach((regionId) => {
      const selector = `${contextSelector} ${regionSelector(
        regionId,
        regionAttribute,
      )}`;

      selectors[selector] = regions[regionId];
    });
  });

  return selectors;
};

const toContextVariableName = (
  property: RegionProperty,
  tokenKey: string,
): string => {
  const segments = tokenKey.split('-').filter(Boolean);
  const prefixes = PROPERTY_PREFIXES[property] ?? [];

  if (segments.length > 0 && prefixes.includes(segments[0])) {
    segments.shift();
  }

  const suffix = segments.length > 0 ? segments.join('-') : 'value';
  return `--context-${property}-${suffix}`;
};

const buildContextComponents = (
  matrix: ContextMatrix,
  tokens: TokensIndex,
  contextClassPrefix: string,
  regionAttribute: string,
): CSSRuleObject => {
  const rules: CSSRuleObject = {};
  const selectors = getRegionSelectors(
    matrix,
    contextClassPrefix,
    regionAttribute,
  );

  for (const [selector, spec] of Object.entries(selectors)) {
    const declarations: Record<string, string> = {};

    REGION_PROPERTIES.forEach((property) => {
      const expressions = spec[property];
      expressions.forEach((expression) => {
        const references = expandTokenExpression(
          expression,
          property,
          tokens,
        );

        references.forEach((reference) => {
          const variableName = toContextVariableName(
            property,
            reference.tokenKey,
          );
          declarations[variableName] = `var(${reference.cssVariable})`;
        });
      });
    });

    if (Object.keys(declarations).length > 0) {
      rules[selector] = declarations;
    }
  }

  if (Object.keys(rules).length === 0) {
    throw new Error('[tw-variants] Failed to generate any context rules.');
  }
  return rules;
};

const addContextVariants = (
  api: PluginAPI,
  matrix: ContextMatrix,
  contextClassPrefix: string,
  regionAttribute: string,
) => {
  const { addVariant, e } = api;
  const addVariantWithFns = addVariant as unknown as (
    name: string,
    generator: (args: VariantCallbackArgs) => void,
  ) => void;
  const contexts = new Set<ContextId>();
  const regions = new Set<RegionId>();

  (Object.keys(matrix) as ContextId[]).forEach((contextId) => {
    contexts.add(contextId);
    (Object.keys(matrix[contextId]) as RegionId[]).forEach((regionId) => {
      regions.add(regionId);
    });
  });

  contexts.forEach((contextId) => {
    addVariantWithFns(contextId, ({ modifySelectors, separator }) => {
      modifySelectors(({ className }: { className: string }) => {
        const escaped = e(`${contextId}${separator}${className}`);
        return `.${contextClassName(contextId, contextClassPrefix)} .${escaped}`;
      });
    });
  });

  regions.forEach((regionId) => {
    addVariantWithFns(regionId, ({ modifySelectors, separator }) => {
      modifySelectors(({ className }: { className: string }) => {
        const escaped = e(`${regionId}${separator}${className}`);
        return `${regionSelector(regionId, regionAttribute)} .${escaped}`;
      });
    });
  });
};

const contextVariants = (options: ContextVariantOptions) => {
  if (!options || typeof options.tokensPath !== 'string') {
    throw new Error(
      '[tw-variants] Plugin requires a tokensPath option (string) pointing to tokens.json',
    );
  }

  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const tokensIndex = loadTokensIndex(resolvedOptions.tokensPath);

  return plugin(
    (api) => {
      addContextVariants(
        api,
        CONTEXT_MATRIX,
        resolvedOptions.contextClassPrefix,
        resolvedOptions.regionAttribute,
      );

      const components = buildContextComponents(
        CONTEXT_MATRIX,
        tokensIndex,
        resolvedOptions.contextClassPrefix,
        resolvedOptions.regionAttribute,
      );

      api.addBase(components);
    },
    {
      name: 'oods-context-variants',
    },
  );
};

export default contextVariants;
