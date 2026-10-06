// Shared categorical-palette resolver (sprint-138 m02 — brand-fidelity).
//
// ONE pure resolver of the OODS categorical viz-scale palette, used by BOTH the
// Vega-Lite adapter (to BAKE the palette into the compiled cartesian spec) and
// certify-contrast (to GRADE that same palette). Because both call this single
// function, "certified == baked" holds BY CONSTRUCTION — there is no independent
// re-resolution that could drift (memo §4 F3).
//
// It reuses the exact chain the ECharts adapters + certify already use:
//   getVizScaleTokens('categorical', {count:6})  -> the six fixed slot tokens
//   resolveTokenToColor                          -> the OODS default (oklch -> rgb)
//   spec.config.tokens                           -> the agent override precedence
// and normalises every result to canonical uppercase HEX (`#RRGGBB`) before
// returning, because resolveTokenToColor emits `rgb(...)` but the compiled spec's
// scale.range / mark.color must carry hex (memo §4 "Color form").

import { resolveTokenToColor, type TokenScope } from '../adapters/echarts/token-resolver.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { getVizScaleTokens } from './scale-token-mapper.js';

/**
 * config.tokens overrides, keyed by the `--`-prefixed token name (matching the form
 * agents supply, e.g. `--oods-viz-scale-categorical-01`). Numeric overrides are not
 * colors and are ignored. Pure lookup table — never iterated into the palette array,
 * so it introduces no insertion-order nondeterminism.
 */
export function overrideMap(tokens?: Record<string, string | number>): Map<string, string> {
  const out = new Map<string, string>();
  if (!tokens) return out;
  for (const [k, v] of Object.entries(tokens)) {
    if (typeof v !== 'string') continue;
    out.set(k.startsWith('--') ? k : `--${k}`, v);
  }
  return out;
}

/**
 * `--viz-scale-*` -> its `--oods-`-canonical alias. getVizScaleTokens returns the
 * un-prefixed `--viz-scale-categorical-NN`, but the @oods/tokens bundle keys — and
 * the override keys agents supply — use `--oods-viz-scale-categorical-NN`. Canonicalise
 * so the override lookup matches regardless of which form the token list uses.
 */
function oodsCanonical(token: string): string {
  return token.startsWith('--oods-') ? token : `--oods-${token.slice(2)}`;
}

/**
 * rgb(r, g, b) / #rgb / #rrggbb -> canonical uppercase `#RRGGBB`; undefined if the
 * value is not a hex or rgb() color. This is the minimal normalisation the bake needs:
 * resolveTokenToColor always emits `rgb(...)` for the OODS oklch tokens, and agent
 * config.tokens overrides are supplied as hex. Output matches @oods/a11y-tools
 * normaliseColor for these inputs (uppercase 6-digit), so the graded hex certify
 * computes for the canvas comparison lines up with the baked hex.
 */
export function toHex(color: string): string | undefined {
  const trimmed = color.trim();

  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const h = hexMatch[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return `#${full.toUpperCase()}`;
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (rgbMatch) {
    const channels = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number);
    if (channels.some((n) => !Number.isFinite(n))) return undefined;
    const hex = channels
      .map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex.toUpperCase()}`;
  }

  return undefined;
}

/**
 * Resolve the OODS categorical viz-scale palette for a spec to a deterministic,
 * HEX-normalised array of the (up to) six fixed slots, honouring any config.tokens
 * override. The array is built by iterating the FIXED getVizScaleTokens order (never
 * a Map/Set), so it is order-stable for a given input — pinned by the colocated
 * adapters/vega-lite-adapter.spec.ts bake assertions and certify's consistency-lock
 * (mcp-server artifact.certify.spec.ts). (NOT `test:scale` — that is the map.apply
 * reconciliation-determinism suite, unrelated to this palette; s143 m03 correction.)
 *
 * A slot whose override is a non-color (or which cannot resolve) is skipped rather
 * than baked as junk; in the default (no-override) path all six OODS tokens resolve,
 * so the palette is the full fixed 6-slot range. Pure function of the IR.
 */
export function resolveCategoricalPalette(spec: NormalizedVizSpec, scope: TokenScope = {}): string[] {
  const overrides = overrideMap(spec.config?.tokens);
  const tokens = getVizScaleTokens('categorical', { count: 6 });

  const palette: string[] = [];
  for (const token of tokens) {
    const canonical = oodsCanonical(token);
    const override = overrides.get(canonical) ?? overrides.get(token);
    // A malformed (non-color) override is IGNORED — the slot falls back to its OODS
    // default so the palette stays a clean, index-aligned, fixed-length array (a bad
    // override never shifts the next slot's color onto the wrong series). The six OODS
    // tokens always resolve, so the no-override path yields the full 6-slot range.
    const hex = (override ? toHex(override) : undefined) ??
      (scope.theme === 'hc' ? resolveTokenToColor(token, scope) : toHex(resolveTokenToColor(token, scope) ?? ''));
    if (hex) palette.push(hex);
  }
  return palette;
}

/** Single-series semantics are independent of category slot ordering. Both bake and certify use this resolver. */
export const SINGLE_SERIES_TOKEN = '--oods-viz-mark-single';
export function resolveSingleSeriesColor(spec: NormalizedVizSpec, scope: TokenScope = {}): string | undefined {
  const overrides = overrideMap(spec.config?.tokens);
  // Keep valid legacy slot-one overrides: callers already use them to author single-series paint.
  for (const token of [SINGLE_SERIES_TOKEN, '--viz-mark-single', '--oods-viz-scale-categorical-01', '--viz-scale-categorical-01']) {
    const value = overrides.get(token);
    const hex = value ? toHex(value) : undefined;
    if (hex) return hex;
  }
  const value = resolveTokenToColor(SINGLE_SERIES_TOKEN, scope);
  return scope.theme === 'hc' ? value : toHex(value ?? '');
}
