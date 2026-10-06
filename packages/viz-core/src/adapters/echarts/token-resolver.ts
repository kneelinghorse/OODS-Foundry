// Shared ECharts token resolution (sprint-111 m01).
//
// ECharts' canvas renderer cannot use the CSS cascade, so it needs RESOLVED
// colours (rgb/hex), not `var(--token)` references. This module resolves an OODS
// design token to a concrete colour string, converting oklch() token values to
// sRGB. It is the SINGLE home for the ~70-LOC token-resolution block that was
// byte-identical across all four network/hierarchy ECharts adapters
// (treemap/sankey/sunburst/graph) — extracted here so the ported adapters import
// one implementation instead of re-duplicating it.
//
// Scope note: only the token→colour RESOLUTION is shared. Each adapter keeps its
// own FALLBACK_PALETTE + buildPalette (they differ — treemap uses an 8-colour
// fallback, the flow/network adapters a 9-colour one — and pick a per-type
// `count`), so the palette is intentionally NOT centralised here.

import tokensBundle from '@oods/tokens';

/**
 * Scope is explicit so concurrent renders never share mutable theme state. A brand is any brand the token build
 * produced (s213-m04: the brand registry in @oods/tokens); brand A is the default scope.
 */
export interface TokenScope {
  readonly brand?: string;
  readonly theme?: 'light' | 'dark' | 'hc';
}

const DEFAULT_BRAND = 'A';
const DEFAULT_SCOPE = { brand: DEFAULT_BRAND, theme: 'light' } as const;

export function resolveTokenToColor(token: string, scope: TokenScope = DEFAULT_SCOPE): string | undefined {
  const normalized = normalizeTokenName(token);
  const value = lookupTokenValue(normalized, scope);
  if (value) {
    return scope.theme === 'hc' ? value.trim() : formatColorValue(value);
  }
  // Try with --oods- prefix fallback
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  if (!prefixed) {
    return undefined;
  }
  const fallback = lookupTokenValue(prefixed, scope);
  return fallback ? (scope.theme === 'hc' ? fallback.trim() : formatColorValue(fallback)) : undefined;
}

/**
 * Raw token value from the SAME cssVariablesByScope source resolveTokenToColor reads
 * (sprint-144 m02 — cartesian chrome theme). Returns the UNRESOLVED token string
 * (an oklch color, a `"24px"` size, or a font-family stack) with the same
 * `--oods-` prefix fallback. The chrome-config resolver uses this for the
 * non-color type tokens (font family/size/weight) so they come from one source
 * without a second copy of the bundle; colors keep going through
 * resolveTokenToColor. Omitted scope resolves the CSS light/A theme.
 */
export function resolveTokenValue(token: string, scope: TokenScope = DEFAULT_SCOPE): string | undefined {
  const normalized = normalizeTokenName(token);
  const value = lookupTokenValue(normalized, scope);
  if (value !== undefined) {
    return value;
  }
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  if (!prefixed) {
    return undefined;
  }
  return lookupTokenValue(prefixed, scope);
}

function normalizeTokenName(name: string): string {
  return name.startsWith('--') ? name : `--${name}`;
}

function lookupTokenValue(name: string, scope: TokenScope): string | undefined {
  const brand = scope.brand ?? DEFAULT_BRAND;
  const values = tokensBundle.cssVariablesByScope[brand];
  // An unknown brand is an error, never a silent fallback to another brand's colours.
  if (!values) throw new Error(`Unknown brand ${JSON.stringify(brand)}; the token build has ${Object.keys(tokensBundle.cssVariablesByScope).join(', ')}.`);
  return values[scope.theme ?? 'light'][name];
}

function formatColorValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(trimmed) ?? trimmed;
  }
  return trimmed;
}

/** The OKLCH triple of an `oklch(l c h)` value (l as 0-1 or a percentage); undefined for anything else. */
function parseOklch(input: string): { l: number; c: number; h: number } | undefined {
  const match = input
    .replace(/deg/gi, '')
    .replace(/\s+/g, ' ')
    .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);

  if (!match) return undefined;

  const [, lRaw, cRaw, hRaw] = match;
  const l = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const c = parseFloat(cRaw);
  const h = parseFloat(hRaw);

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
    return undefined;
  }
  return { l, c, h };
}

/** OKLCH to linear sRGB channels, unclamped (a channel outside 0-1 is out of gamut). */
function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;

  const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
  const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
  const s1 = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l1 ** 3;
  const m3 = m1 ** 3;
  const s3 = s1 ** 3;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function formatLinearRgb([rLinear, gLinear, bLinear]: readonly [number, number, number]): string {
  const linearToSrgb = (v: number): number => {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const clamp = (ch: number): number => Math.round(Math.min(255, Math.max(0, ch * 255)));

  return `rgb(${clamp(linearToSrgb(rLinear))}, ${clamp(linearToSrgb(gLinear))}, ${clamp(linearToSrgb(bLinear))})`;
}

function convertOklchToRgb(input: string): string | undefined {
  const color = parseOklch(input);
  return color ? formatLinearRgb(oklchToLinearSrgb(color.l, color.c, color.h)) : undefined;
}

/**
 * s222-m02 follow-up (#2502 ruling 12): a token's colour moved along its own hue to lightness `l`, its chroma reduced (hue
 * kept) only as far as sRGB requires, as the recipe's gamut() moves a colour. Undefined when the token is not an
 * oklch() value (a system colour in hc).
 */
export function tokenColorAtLightness(token: string, l: number, scope: TokenScope = DEFAULT_SCOPE): string | undefined {
  const raw = resolveTokenValue(token, scope);
  const color = raw === undefined ? undefined : parseOklch(raw);
  if (!color) return undefined;
  const inside = (chroma: number) => oklchToLinearSrgb(l, chroma, color.h).every((channel) => channel >= -1e-7 && channel <= 1 + 1e-7);
  let low = 0;
  let high = color.c;
  if (inside(high)) low = high;
  else for (let step = 0; step < 32; step += 1) { const mid = (low + high) / 2; if (inside(mid)) low = mid; else high = mid; }
  return formatLinearRgb(oklchToLinearSrgb(l, low, color.h));
}

/** The OKLCH lightness of a token's colour; undefined when it is not an oklch() value. */
export function tokenLightness(token: string, scope: TokenScope = DEFAULT_SCOPE): number | undefined {
  const raw = resolveTokenValue(token, scope);
  return raw === undefined ? undefined : parseOklch(raw)?.l;
}
