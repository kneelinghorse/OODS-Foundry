import Color from 'colorjs.io';
import type { DtcgToken } from '../../src/tooling/tokens/dtcg.js';

import { PALETTE_CHECK_TYPES } from '../../tools/a11y/guardrails/read.mjs';
export { PALETTE_CHECK_TYPES };
export type PaletteCheckType = (typeof PALETTE_CHECK_TYPES)[number];

export interface PaletteCheck {
  type: PaletteCheckType;
  scope: string;
  ok: boolean;
  detail: string;
}

const TOLERANCE = 0.0005;
const HUE_TOLERANCE = 1;
const NEUTRAL_CHROMA_CEILING = 0.03;

export function resolveColorValue(token: DtcgToken, tokens: readonly DtcgToken[]): string {
  const byPath = new Map(tokens.map((entry) => [entry.path.join('.'), entry]));
  const visited = new Set<string>();
  let current = token;
  while (true) {
    const key = current.path.join('.');
    if (visited.has(key)) throw new Error(`Circular color reference at ${key}`);
    visited.add(key);
    if (typeof current.value !== 'string') throw new Error(`Non-color value at ${key}`);
    const reference = /^\{([^}]+)\}$/.exec(current.value);
    if (!reference) return current.value;
    const next = byPath.get(reference[1]);
    if (!next) throw new Error(`Unresolved color reference ${reference[1]} at ${key}`);
    current = next;
  }
}

/** Inspect raw sRGB channels: serialization/gamut mapping would conceal invalid source colors. */
export function isInSrgb(value: string): boolean {
  return new Color(value).to('srgb').coords.map(Number).every((channel) =>
    Number.isFinite(channel) && channel >= -0.00001 && channel <= 1.00001);
}

export function checkPalette(
  type: PaletteCheckType,
  scope: string,
  entries: readonly DtcgToken[],
  allTokens: readonly DtcgToken[] = entries,
  requiredKeys: readonly string[] = [],
): PaletteCheck[] {
  const result = (ok: boolean, detail: string, suffix = ''): PaletteCheck => ({
    type, scope: suffix ? `${scope}/${suffix}` : scope, ok, detail,
  });
  if (type === 'dark-coverage') {
    if (requiredKeys.length === 0) return [result(false, 'No required dark paint roles declared.')];
    const byKey = new Map(entries.map((entry) => [entry.path.join('.'), entry]));
    return requiredKeys.map((key) => {
      const token = byKey.get(key);
      if (!token) return result(false, `Missing dark override: ${key}`, key);
      if (token.type !== 'color') return result(false, `Dark override must be a color: ${key}`, key);
      try {
        new Color(resolveColorValue(token, allTokens));
        return result(true, `Explicit dark override: ${key}`, key);
      } catch (error) {
        return result(false, `Invalid dark override ${key}: ${String(error)}`, key);
      }
    });
  }
  if (entries.length === 0) return [result(false, 'No color tokens matched the guardrail.')];

  let colors: { token: DtcgToken; value: string; l: number; c: number; h: number }[];
  try {
    colors = entries.map((token) => {
      const value = resolveColorValue(token, allTokens);
      const color = new Color(value);
      const [l, c, rawHue] = color.to('oklch').coords.map(Number);
      const h = c < 1e-7 ? 0 : rawHue;
      if (![l, c, h].every(Number.isFinite)) throw new Error(`Invalid color at ${token.path.join('.')}`);
      return { token, value, l, c, h };
    });
  } catch (error) {
    return [result(false, error instanceof Error ? error.message : String(error))];
  }

  if (type === 'gamut') {
    return colors.map(({ token, value }) => result(isInSrgb(value),
      `${token.path.join('.')} ${value} ${isInSrgb(value) ? 'is in' : 'exceeds'} sRGB gamut`,
      token.path.join('.')));
  }
  if (type === 'family-hue' || type === 'neutral-hue') {
    const chromatic = colors.filter((entry) => entry.c > 1e-7);
    const distance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
    const drift = Math.max(0, ...chromatic.flatMap((a) => chromatic.map((b) => distance(a.h, b.h))));
    // s222-m01 (#2502 ruling 3): a brand recipe picks its neutral's hue, so a neutral is one hue at a low chroma (the
    // recipe's 0.03 ceiling), not a hue fixed near 265°.
    const chroma = Math.max(0, ...colors.map((entry) => entry.c));
    return [result(drift <= HUE_TOLERANCE && (type !== 'neutral-hue' || chroma <= NEUTRAL_CHROMA_CEILING + TOLERANCE),
      `Maximum family hue drift ${drift.toFixed(3)}° (≤ ${HUE_TOLERANCE}°)` +
      (type === 'neutral-hue' ? `; peak chroma ${chroma.toFixed(4)} (≤ ${NEUTRAL_CHROMA_CEILING})` : ''))];
  }
  if (colors.length < 3) return [result(false, 'A ramp requires at least three steps.')];
  if (type === 'ramp-monotonicity') {
    return colors.slice(1).map((current, index) => {
      const previous = colors[index];
      const delta = previous.l - current.l;
      return result(delta > TOLERANCE, `Descending ΔL=${delta.toFixed(5)} (must be > ${TOLERANCE})`,
        `${previous.token.path.at(-1)}-to-${current.token.path.at(-1)}`);
    });
  }
  const peak = Math.max(...colors.map((entry) => entry.c));
  const peakIndex = colors.findIndex((entry) => entry.c === peak);
  const shapeOk = peakIndex > 0 && peakIndex < colors.length - 1 &&
    peak > colors[0].c + TOLERANCE && peak > colors.at(-1)!.c + TOLERANCE &&
    colors.slice(1).every((entry, index) => index < peakIndex
      ? entry.c + TOLERANCE >= colors[index].c
      : entry.c <= colors[index].c + TOLERANCE);
  return [result(shapeOk, `Chroma peak at ${colors[peakIndex].token.path.at(-1)}; ` +
    `requires an interior peak with no dips before it or rebounds after it.`)];
}

export function selectRamp(tokens: readonly DtcgToken[], prefix: string): DtcgToken[] {
  return tokens.filter((token) => token.type === 'color' &&
    (token.path.join('.') === prefix || token.path.join('.').startsWith(`${prefix}.`)))
    .sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'), 'en', { numeric: true }));
}

export function summarizeChecks(checks: readonly { type: string; ok: boolean }[]) {
  const counts: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const check of checks) {
    const entry = counts[check.type] ??= { total: 0, passed: 0, failed: 0 };
    entry.total += 1;
    entry[check.ok ? 'passed' : 'failed'] += 1;
  }
  return counts;
}
