// Geo colour resolution (sprint-112 m01).
//
// The src/ geo adapters emit `var(--token, #hex)` colour strings that rely on the
// browser CSS cascade. The headless ECharts canvas cannot use the cascade, so —
// exactly as the s111 network/hierarchy adapters do — geo colours must be RESOLVED
// to concrete rgb/hex before they enter the option.
//
// This is the single chokepoint that routes every geo colour through the SHARED
// token-resolver (no duplicated oklch→rgb block lives here — resolveTokenToColor
// owns that). The inline hex inside each `var(...)` expression is preserved as the
// per-colour fallback, mirroring the s111 FALLBACK_PALETTE convention.

import { resolveTokenToColor, type TokenScope } from '../echarts/token-resolver.js';

const VAR_EXPR = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/;

/**
 * Resolve a colour to a concrete (rgb/hex) value for the headless canvas. Accepts
 * a `var(--token, #fallback)` expression, a bare `--token`, or an already-concrete
 * colour (returned unchanged — the function is idempotent, so it is safe to apply
 * more than once). Returns the inline fallback (or the original string) when the
 * token is absent from @oods/tokens.
 */
export function resolveColor(value: string, scope: TokenScope = {}): string {
  const varMatch = value.match(VAR_EXPR);
  if (varMatch) {
    const [, token, fallback] = varMatch;
    return resolveTokenToColor(token, scope) ?? fallback?.trim() ?? value;
  }
  if (value.startsWith('--')) {
    return resolveTokenToColor(value, scope) ?? value;
  }
  return value;
}

/** sRGB channels (0-255) of a resolved #rgb, #rrggbb or rgb()/rgba() colour; undefined for a system colour (hc). */
function channels(color: string): [number, number, number] | undefined {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(value);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : undefined;
}

function luminance([r, g, b]: readonly [number, number, number]): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2 relative luminance of a resolved sRGB colour; undefined for a system colour. */
export function luminanceOf(color: string): number | undefined {
  const drawn = channels(color);
  return drawn ? luminance(drawn) : undefined;
}

/**
 * WCAG 2 contrast of a mark on the ground it is drawn on, the mark at `opacity` composited over the ground per sRGB
 * channel as an SVG paint is. Undefined when either colour is a system colour, which only the user's agent resolves.
 */
export function contrastOnGround(mark: string, ground: string, opacity = 1): number | undefined {
  const [drawn, under] = [channels(mark), channels(ground)];
  if (!drawn || !under) return undefined;
  const composite = drawn.map((channel, index) => opacity * channel + (1 - opacity) * under[index]!) as [number, number, number];
  const [a, b] = [luminance(composite), luminance(under)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG 1.4.11: a mark drawn on the map's land needs 3:1 against it. */
export const LAND_CONTRAST = 3;

/**
 * s222-m02 (#2502 ruling 12): the index of the first sequential step, counting from 01, that reaches 3:1 on the land at
 * `opacity`; the steps after it reach it too, since each theme's ladder moves away from its land toward 09. -1 when none
 * does, or when the land or a step is a system colour (hc).
 */
export function firstLandReadableStep(steps: readonly string[], land: string, scope: TokenScope, opacity = 1): number {
  return steps.findIndex((step) => (contrastOnGround(resolveColor(step, scope), land, opacity) ?? 0) >= LAND_CONTRAST);
}
