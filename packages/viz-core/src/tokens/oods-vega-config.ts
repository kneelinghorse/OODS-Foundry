// Shared OODS Vega-Lite chrome-config resolver (sprint-144 m02 — cartesian chrome theme).
//
// A PURE resolver of the OODS-tokened Vega-Lite `config` "chrome" theme —
// background, axes, gridlines, typography, legend, and the view box — baked into
// the compiled cartesian spec by toVegaLiteSpec. It is the chrome counterpart to
// resolveCategoricalPalette: same @oods/tokens cssVariables source, same
// spec.config.tokens override precedence, same HEX normalization — but it themes
// CHROME, never series color (see the guardrail below).
//
// CHROME-ONLY GUARDRAIL (memo §3): this resolver MUST NOT emit config.mark.fill/color
// or config.range.category. Those are series-color surfaces; certify reads
// encoding/mark-level color, not config, so a config-level series color would be
// graded-invisible yet render-visible — a render/certify drift hole. The series
// palette stays solely in the s138 scale.range / mark.color bake.
//
// Resolves the requested CSS scope (light/A by default). Emits a stable, literal-ordered, ARRAY-FREE scalar object so canonicalize's
// key-sort keeps the render↔certify contentHash deterministic (memo §6).

import { resolveTokenToColor, resolveTokenValue, type TokenScope } from '../adapters/echarts/token-resolver.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { overrideMap, toHex } from './categorical-palette.js';

// The OODS chrome token map, verified live vs @oods/tokens (memo §3, locked §9).
const CHROME_TOKENS = {
  // colors
  background: '--oods-sys-surface-canvas',
  textPrimary: '--oods-sys-text-primary',
  textNeutral: '--oods-sys-text-neutral',
  gridSubtle: '--oods-sys-border-subtle',
  borderNeutral: '--oods-sys-border-neutral',
  // type. s222-m02 (#2502 ruling 12): the brand's own sans (radius and font became brand-scoped in m01), so a chart
  // reads in the brand's type; brand A's is the family this token read before.
  fontFamily: '--oods-sys-font-sans',
  titleSize: '--oods-sys-text-scale-heading-lg-font-size',
  titleWeight: '--oods-sys-text-scale-heading-lg-font-weight',
} as const;

/**
 * The OODS Vega-Lite chrome config. Every leaf is a scalar (string | number | null)
 * — no arrays — so `canonicalize`'s deep key-sort makes the render↔certify
 * contentHash order-independent (memo §6). No `mark`/`range` keys: series color is
 * off-limits here (chrome-only guardrail).
 */
export interface OodsVegaConfig {
  readonly background: string;
  readonly font: string;
  readonly title: {
    readonly color: string;
    readonly font: string;
    readonly fontSize: number;
    readonly fontWeight: number;
    readonly anchor: 'start';
  };
  readonly axis: {
    readonly titleColor: string;
    readonly titleFont: string;
    readonly labelColor: string;
    readonly labelFont: string;
    readonly gridColor: string;
    readonly domainColor: string;
    readonly tickColor: string;
  };
  // Gridlines are horizontal-only (lock §9): Y grid draws the horizontal
  // lines, X grid off kills the vertical ones — regardless of chart orientation.
  // Exception (s149 F6c): a rect-only spec (MarkRect heatmap over a band y-scale)
  // suppresses the Y grid too, so the subtle rules don't stripe through the cells.
  readonly axisX: { readonly grid: false };
  readonly axisY: { readonly grid: boolean };
  readonly legend: {
    readonly titleColor: string;
    readonly titleFont: string;
    readonly labelColor: string;
    readonly labelFont: string;
    // s221-m03: a size legend's symbols have no colour encoding; with filled points they were Vega's default black,
    // invisible on a dark background. A chart that encodes size draws them in the neutral text colour.
    readonly symbolFillColor?: string;
    readonly symbolStrokeColor?: string;
  };
  // Kills the default grey plot-frame box.
  readonly view: { readonly stroke: null };
  // s221-m03: a faceted chart's headings (the facet title and each panel's label) take the text tokens, as the axes
  // and legend do; Vega-Lite's default black all but vanished on a dark background. Only a faceted chart carries it,
  // so an unfaceted chart's chrome, and its content hash, are unchanged.
  readonly header?: {
    readonly titleColor: string;
    readonly titleFont: string;
    readonly labelColor: string;
    readonly labelFont: string;
  };
}

/**
 * Resolve an OODS chrome color: an agent config.tokens override (hex) wins; a
 * malformed override falls back to the OODS default (same posture as the palette
 * resolver). The five chrome tokens are static and always resolve, so a total
 * miss is a token-bundle breakage — surfaced loud rather than baked as junk.
 */
function resolveChromeColor(token: string, overrides: Map<string, string>, scope: TokenScope): string {
  const override = overrides.get(token);
  const resolved =
    (override !== undefined ? toHex(override) : undefined) ??
    (scope.theme === 'hc' ? resolveTokenToColor(token, scope) : toHex(resolveTokenToColor(token, scope) ?? ''));
  if (resolved === undefined) {
    throw new Error(`OODS chrome color token did not resolve: ${token}`);
  }
  return resolved;
}

/**
 * Type-token normalizer: font-size `"24px"` → number `24`. Vega wants a numeric
 * fontSize; the token carries the `px` unit. Deterministic (same string → same
 * number); a non-numeric value is a token-bundle breakage, surfaced loud.
 */
function resolveFontSize(token: string, overrides: Map<string, string>, scope: TokenScope): number {
  const raw = overrides.get(token) ?? resolveTokenValue(token, scope);
  const n = Number(String(raw ?? '').replace(/px$/i, '').trim());
  if (!Number.isFinite(n)) {
    throw new Error(`OODS chrome font-size token did not resolve to a number: ${token}`);
  }
  return n;
}

/**
 * Type-token normalizer: font-weight `"600"` → number `600`.
 */
function resolveFontWeight(token: string, overrides: Map<string, string>, scope: TokenScope): number {
  const raw = overrides.get(token) ?? resolveTokenValue(token, scope);
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) {
    throw new Error(`OODS chrome font-weight token did not resolve to a number: ${token}`);
  }
  return n;
}

/**
 * Type-token normalizer: the OODS sans stack carries a nested-quote artifact from
 * the token pipeline — `'"Helvetica Neue"'` (a double-quoted name wrapped in single
 * quotes). Collapse each `'"…"'` to a single-quoted `'…'` so the baked font string
 * is clean, valid CSS, and stable. Deterministic string→string transform.
 */
function resolveFontFamily(token: string, overrides: Map<string, string>, scope: TokenScope): string {
  const raw = overrides.get(token) ?? resolveTokenValue(token, scope) ?? '';
  return raw.replace(/'"([^"]*)"'/g, "'$1'").trim();
}

/**
 * Resolve the OODS Vega-Lite chrome config for a spec. Pure function of the IR:
 * reads spec.config.tokens for overrides (same precedence as the palette bake) and
 * otherwise the OODS defaults from @oods/tokens. Merged (not overwritten) into the
 * compiled spec's top-level `config` at the toVegaLiteSpec seam — see the adapter.
 */
export function resolveOodsVegaConfig(spec: NormalizedVizSpec, scope: TokenScope = {}): OodsVegaConfig {
  const overrides = overrideMap(spec.config?.tokens);

  // s149 F6c: horizontal gridlines stripe through the cells of a MarkRect heatmap
  // (its y-scale is a band, not a measure), so drop them when EVERY mark is a
  // MarkRect. `.every` (not `.some`) keeps mixed/cartesian specs — and the bar
  // tripwire — on the default Y grid. resolveOodsVegaConfig already gets the full
  // spec, so the predicate needs no new plumbing. (Array-guarded so a minimal
  // marks-less spec — the a11y-of-chrome unit fixture — is trivially not rect-only
  // and keeps the default grid rather than throwing.)
  const rectOnly =
    Array.isArray(spec.marks) && spec.marks.length > 0 && spec.marks.every((m) => m.trait === 'MarkRect');
  const faceted = (spec as { layout?: { trait?: string } }).layout?.trait === 'LayoutFacet';
  const sized = Boolean((spec as { encoding?: { size?: unknown } }).encoding?.size) ||
    (Array.isArray(spec.marks) && spec.marks.some((m) => Boolean((m as { encodings?: { size?: unknown } }).encodings?.size)));

  const background = resolveChromeColor(CHROME_TOKENS.background, overrides, scope);
  const textPrimary = resolveChromeColor(CHROME_TOKENS.textPrimary, overrides, scope);
  const textNeutral = resolveChromeColor(CHROME_TOKENS.textNeutral, overrides, scope);
  const gridSubtle = resolveChromeColor(CHROME_TOKENS.gridSubtle, overrides, scope);
  const borderNeutral = resolveChromeColor(CHROME_TOKENS.borderNeutral, overrides, scope);
  const font = resolveFontFamily(CHROME_TOKENS.fontFamily, overrides, scope);
  const titleSize = resolveFontSize(CHROME_TOKENS.titleSize, overrides, scope);
  const titleWeight = resolveFontWeight(CHROME_TOKENS.titleWeight, overrides, scope);

  return {
    background,
    font,
    title: {
      color: textPrimary,
      font,
      fontSize: titleSize,
      fontWeight: titleWeight,
      anchor: 'start',
    },
    axis: {
      titleColor: textPrimary,
      titleFont: font,
      labelColor: textNeutral,
      labelFont: font,
      gridColor: gridSubtle,
      domainColor: borderNeutral,
      tickColor: borderNeutral,
    },
    axisX: { grid: false },
    axisY: { grid: rectOnly ? false : true },
    legend: {
      titleColor: textPrimary,
      titleFont: font,
      labelColor: textNeutral,
      labelFont: font,
      ...(sized ? { symbolFillColor: textNeutral, symbolStrokeColor: textNeutral } : {}),
    },
    view: { stroke: null },
    ...(faceted ? { header: { titleColor: textPrimary, titleFont: font, labelColor: textNeutral, labelFont: font } } : {}),
  };
}
