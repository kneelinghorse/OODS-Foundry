import { normaliseColor } from '@oods/a11y-tools';
import type { FlatTokenEntry, FlatTokenMap } from '@oods/a11y-tools';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** DTCG token layers from the oods-tokens structured data artifact. */
export interface DTCGTokenData {
  layers: {
    reference: Record<string, unknown>;
    theme: Record<string, unknown>;
    system: Record<string, unknown>;
    component: Record<string, unknown>;
    view: Record<string, unknown>;
    [layer: string]: Record<string, unknown>;
  };
}

/** Result of a token resolution that includes the alias chain for debugging. */
export interface TokenColorResolution {
  hex: string;
  chain: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ALIAS_RE = /^\{(.+)\}$/;
const MAX_DEPTH = 10;

function isAlias(value: string): string | null {
  const m = ALIAS_RE.exec(value.trim());
  return m ? m[1] : null;
}

function isTokenLeaf(
  node: unknown,
): node is { $value: unknown; $type?: string; $description?: string } {
  return node !== null && typeof node === 'object' && '$value' in (node as Record<string, unknown>);
}

/** Recursively flatten a DTCG token tree into dotPath → rawValue pairs. */
function flattenTree(
  node: Record<string, unknown>,
  prefix: string,
  out: Map<string, string>,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if (isTokenLeaf(value)) {
      out.set(path, String((value as { $value: unknown }).$value));
    } else if (value !== null && typeof value === 'object') {
      flattenTree(value as Record<string, unknown>, path, out);
    }
  }
}

/** Walk an alias chain until we reach a concrete value. */
function resolveAlias(
  tokenPath: string,
  flatMap: Map<string, string>,
  depth = 0,
  chain: string[] = [],
): { value: string; chain: string[] } {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `Token alias chain exceeded maximum depth (${MAX_DEPTH}). Chain: ${chain.join(' → ')}`,
    );
  }

  const raw = flatMap.get(tokenPath);
  if (raw === undefined) {
    throw new Error(
      `Token "${tokenPath}" not found in token data.${
        chain.length ? ` Resolution chain: ${chain.join(' → ')}` : ''
      }`,
    );
  }

  chain.push(tokenPath);

  const target = isAlias(raw);
  if (target) {
    return resolveAlias(target, flatMap, depth + 1, chain);
  }

  return { value: raw, chain };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten all DTCG layers into a single map of dotPath → raw $value.
 *
 * Useful for inspecting the full token inventory or passing to
 * {@link toFlatTokenMap} for compatibility with `@oods/a11y-tools`.
 */
export function flattenDTCGLayers(tokenData: DTCGTokenData): Map<string, string> {
  const flat = new Map<string, string>();
  for (const layer of Object.values(tokenData.layers)) {
    if (layer && typeof layer === 'object') {
      flattenTree(layer as Record<string, unknown>, '', flat);
    }
  }
  return flat;
}

/**
 * Resolve a design token to a hex colour value.
 *
 * Walks the DTCG alias chain (semantic → theme → reference → raw colour)
 * and normalises the result to an uppercase hex string.
 *
 * @param tokenName  Dot-notation token path, e.g. `"sys.text.primary"`.
 * @param tokenData  The DTCG layers object from the oods-tokens structured data artifact.
 * @returns Uppercase hex colour, e.g. `"#3B3D44"`.
 * @throws If the token is missing, the alias chain is circular, or the value cannot be converted.
 */
export function tokenColorResolver(tokenName: string, tokenData: DTCGTokenData): string {
  const flatMap = flattenDTCGLayers(tokenData);
  const { value } = resolveAlias(tokenName, flatMap);
  return normaliseColor(value, tokenName);
}

/**
 * Create a reusable resolver that flattens layers once for efficient batch lookups.
 *
 * Prefer this over calling {@link tokenColorResolver} in a loop.
 */
export function createTokenResolver(tokenData: DTCGTokenData) {
  const flatMap = flattenDTCGLayers(tokenData);

  return {
    /** Resolve a token to its hex colour value. */
    resolve(tokenName: string): string {
      const { value } = resolveAlias(tokenName, flatMap);
      return normaliseColor(value, tokenName);
    },

    /** Resolve a token and return the full alias chain for diagnostics. */
    resolveWithChain(tokenName: string): TokenColorResolution {
      const { value, chain } = resolveAlias(tokenName, flatMap);
      return { hex: normaliseColor(value, tokenName), chain };
    },

    /** The underlying flat map for advanced consumers. */
    flatMap,
  };
}

/**
 * Resolve all alias values in a flat map to their concrete (non-alias) values.
 *
 * Skips entries whose alias chains are broken (missing target) — those are
 * omitted from the result rather than throwing.
 */
export function resolveFlatMap(flatMap: Map<string, string>): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const [key] of flatMap) {
    try {
      const { value } = resolveAlias(key, flatMap);
      resolved.set(key, value);
    } catch {
      // Skip tokens with broken alias chains (e.g. missing dark theme targets)
    }
  }
  return resolved;
}

/**
 * Convert a DTCG flat map into the `FlatTokenMap` format consumed by
 * `@oods/a11y-tools` (e.g. `evaluateContrastRules`).
 *
 * By default, resolves alias chains so values are concrete colour strings
 * (required for `evaluateContrastRules`). Pass `resolveAliases: false` to
 * preserve raw alias references.
 */
export function toFlatTokenMap(
  flatMap: Map<string, string>,
  prefix = 'oods',
): FlatTokenMap {
  const resolved = resolveFlatMap(flatMap);
  const result: FlatTokenMap = {};
  for (const [dotPath, rawValue] of resolved) {
    const key = dotPath.replace(/\./g, '-');
    const entry: FlatTokenEntry = {
      value: rawValue,
      cssVariable: `--${prefix}-${key}`,
    };
    result[key] = entry;
  }
  return result;
}
