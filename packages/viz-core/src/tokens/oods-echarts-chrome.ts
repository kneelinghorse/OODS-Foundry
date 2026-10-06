// Shared OODS ECharts chrome resolver (sprint-145 m02 — ECharts chrome parity).
//
// The ECharts mirror of resolveOodsVegaConfig (oods-vega-config.ts:136): a PURE
// resolver of the OODS-tokened "chrome" surfaces the 8 ECharts-primary adapters
// (treemap / sunburst / sankey / chord / force_graph + geo choropleth / bubble_map /
// flow_map) hardcode today — background, tile/node/arc borders, on-canvas + on-tile
// labels, breadcrumb/ring fills, geo visualMap labels, and the chart title. Same
// @oods/tokens cssVariables source, same spec.config.tokens override precedence (#84),
// same HEX normalization as the cartesian chrome + the s138 palette bake.
//
// THE ONE STRUCTURAL DIVERGENCE FROM CARTESIAN (memo §2): Vega has a single top-level
// `config` block merged once; ECharts has NO single chrome block, so this object is
// threaded by DIRECT ASSIGNMENT at the constant sites inside each adapter (mapped by
// USAGE, not const name — e.g. treemap SURFACE_COLOR is a fill, sunburst SURFACE_COLOR
// is a ring-separator border). Because it is a per-site assignment and never an
// ECharts-option merge, there is NO deep-vs-shallow clobber hazard and no risk of
// touching series `itemStyle` — #84 rides the token layer (spec.config.tokens), not a
// merge.
//
// CHROME-ONLY GUARDRAIL (memo §3): this resolver MUST NOT feed FALLBACK_PALETTE,
// itemStyle.color, lineStyle.color, or the geo visualMap sequential ranges — those are
// SERIES surfaces certify grades (s141 role-C′). A token leak there would be
// graded-invisible yet render-visible drift. The series palette stays solely in the
// adapters' buildPalette / geo range path.
//
// Resolves the requested CSS scope (light/A by default).
// Every leaf is a scalar (string | number) — no arrays — so canonicalize's deep key-sort
// keeps the render↔certify contentHash order-independent for the 8 ECharts types (memo §7).

import { resolveTokenToColor, type TokenScope } from '../adapters/echarts/token-resolver.js';
import { overrideMap, toHex } from './categorical-palette.js';

// The OODS ECharts chrome token map, locked (memo §3). Every colour resolves via
// the same chain the adapters + certify already use; the hexes are the s144-verified
// @oods/tokens values (pinned by oods-echarts-chrome.spec.ts).
const CHROME_TOKENS = {
  background: '--oods-sys-surface-canvas',
  tileBorder: '--oods-sys-border-neutral',
  emphasisBorder: '--oods-sys-text-neutral',
  labelOnCanvas: '--oods-sys-text-primary',
  surfaceFill: '--oods-sys-surface-canvas',
  visualMapLabel: '--oods-sys-text-neutral',
  title: '--oods-sys-text-primary',
} as const;

// The on-tile label halo width (memo §5). A ~2px surface-canvas text-border around a
// text-primary label keeps treemap/sunburst on-tile labels legible on ANY series hue —
// the §4 sweep proved no FIXED label colour clears WCAG on all 6 OODS categorical tiles.
const ON_TILE_HALO_WIDTH = 2;

/**
 * The OODS ECharts chrome. Every leaf is a scalar — no arrays — so canonicalize's deep
 * key-sort makes the render↔certify contentHash order-independent (memo §7). No series
 * colour keys: FALLBACK_PALETTE / itemStyle.color / lineStyle.color / visualMap ranges
 * are off-limits (chrome-only guardrail).
 */
export interface OodsEchartsChrome {
  readonly background: string;
  readonly tileBorder: string;
  readonly emphasisBorder: string;
  readonly labelOnCanvas: string;
  readonly surfaceFill: string;
  readonly visualMapLabel: string;
  readonly title: string;
  /**
   * The locked legibility mechanism for treemap/sunburst ON-TILE labels (memo §5):
   * a text-primary label wrapped in a surface-canvas halo. Spread into `label` /
   * `upperLabel` so the label reads on any tile colour — NOT a fixed token (the §4 sweep
   * proved every fixed colour fails on some hue). The tripwire asserts this is present.
   */
  readonly onTileLabelMechanism: {
    readonly color: string;
    readonly textBorderColor: string;
    readonly textBorderWidth: number;
  };
}

// The minimal spec shape the resolver reads — just the config.tokens override bag. Both
// NormalizedVizSpec (group-A adapters) and SpatialSpec (geo adapters) satisfy it, so ONE
// resolver serves all 8 types.
interface EchartsChromeSpecInput {
  readonly config?: { readonly tokens?: Record<string, string | number> };
}

/**
 * Resolve an OODS chrome colour: an agent config.tokens override (hex) wins; a malformed
 * override falls back to the OODS default (same posture as the palette + cartesian-chrome
 * resolvers). The seven chrome tokens are static and always resolve, so a total miss is a
 * token-bundle breakage — surfaced loud rather than baked as junk.
 */
function resolveChromeColor(token: string, overrides: Map<string, string>, scope: TokenScope): string {
  const override = overrides.get(token);
  const resolved =
    (override !== undefined ? toHex(override) : undefined) ??
    (scope.theme === 'hc' ? resolveTokenToColor(token, scope) : toHex(resolveTokenToColor(token, scope) ?? ''));
  if (resolved === undefined) {
    throw new Error(`OODS ECharts chrome colour token did not resolve: ${token}`);
  }
  return resolved;
}

/**
 * Resolve the OODS ECharts chrome for a spec. Pure function of the IR: reads
 * spec.config.tokens for overrides (same precedence as the palette + cartesian-chrome
 * bakes) and otherwise the OODS defaults from @oods/tokens. Threaded per-adapter by
 * direct assignment at the constant sites — see each ECharts adapter.
 */
export function resolveOodsEchartsChrome(spec: EchartsChromeSpecInput, scope: TokenScope = {}): OodsEchartsChrome {
  const overrides = overrideMap(spec.config?.tokens);

  const background = resolveChromeColor(CHROME_TOKENS.background, overrides, scope);
  const tileBorder = resolveChromeColor(CHROME_TOKENS.tileBorder, overrides, scope);
  const emphasisBorder = resolveChromeColor(CHROME_TOKENS.emphasisBorder, overrides, scope);
  const labelOnCanvas = resolveChromeColor(CHROME_TOKENS.labelOnCanvas, overrides, scope);
  const surfaceFill = resolveChromeColor(CHROME_TOKENS.surfaceFill, overrides, scope);
  const visualMapLabel = resolveChromeColor(CHROME_TOKENS.visualMapLabel, overrides, scope);
  const title = resolveChromeColor(CHROME_TOKENS.title, overrides, scope);

  return {
    background,
    tileBorder,
    emphasisBorder,
    labelOnCanvas,
    surfaceFill,
    visualMapLabel,
    title,
    onTileLabelMechanism: {
      color: labelOnCanvas,
      textBorderColor: surfaceFill,
      textBorderWidth: ON_TILE_HALO_WIDTH,
    },
  };
}

/** HC-only text/box defaults. This never edits series paints; other themes retain exact bytes. */
export function applyHcEchartsChrome<T extends object>(option: T, chrome: OodsEchartsChrome, scope: TokenScope): T {
  if (scope.theme !== 'hc') return option;
  const source = option as Record<string, any>;
  const text = { color: chrome.labelOnCanvas, backgroundColor: 'transparent', borderColor: 'transparent', textBorderColor: 'transparent' };
  const box = { backgroundColor: 'transparent', borderColor: chrome.tileBorder };
  const map = (value: any, decorate: (entry: Record<string, any>) => object): any =>
    Array.isArray(value) ? value.map(decorate) : decorate(value);
  return {
    ...option,
    ...(source.title ? { title: map(source.title, entry => ({ ...entry, ...box,
      textStyle: { ...entry.textStyle, ...text }, subtextStyle: { ...entry.subtextStyle, ...text },
    })) } : {}),
    ...(source.legend ? { legend: map(source.legend, entry => ({ ...entry, ...box,
      textStyle: { ...entry.textStyle, ...text }, pageTextStyle: text,
      inactiveColor: chrome.labelOnCanvas, inactiveBorderColor: chrome.tileBorder,
      pageIconColor: chrome.labelOnCanvas, pageIconInactiveColor: chrome.labelOnCanvas,
    })) } : {}),
    ...(source.visualMap ? { visualMap: map(source.visualMap, entry => entry.show === false ? entry : ({ ...entry, ...box,
      textStyle: { ...entry.textStyle, ...text }, borderColor: chrome.tileBorder,
      selectedMode: false,
      hoverLink: false,
      contentColor: chrome.background,
      inactiveColor: chrome.background,
      // Per-piece literals own the color; empty fallback ranges avoid native interpolation.
      inRange: { ...entry.inRange, color: [] },
      outOfRange: { ...entry.outOfRange, color: [] },
      handleStyle: { color: chrome.labelOnCanvas, borderColor: chrome.tileBorder },
      indicatorStyle: { color: chrome.labelOnCanvas, borderColor: chrome.tileBorder },
      controller: { inRange: { color: [] }, outOfRange: { color: [] } },
    })) } : {}),
  };
}
