#!/usr/bin/env tsx

import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import Color from 'colorjs.io';

import { loadDtcgTokens, type DtcgToken } from '../../src/tooling/tokens/dtcg.js';

import { checkPalette, summarizeChecks } from './palette-checks.js';

const projectRoot = process.cwd();
const vizScaleSource = path.resolve(projectRoot, 'packages/tokens/src/viz-scales.json');

const MIN_SEQUENTIAL_STEPS = 9;
const MIN_SEQUENTIAL_DELTA_L = 0.1;
const SEQUENTIAL_TOLERANCE = 0.002;
const SYMMETRY_TOLERANCE = 0.02;
const DIVERGING_ORDER = [
  'neg-05',
  'neg-04',
  'neg-03',
  'neg-02',
  'neg-01',
  'neutral',
  'pos-01',
  'pos-02',
  'pos-03',
  'pos-04',
  'pos-05',
] as const;
type DivergingId = (typeof DIVERGING_ORDER)[number];
const DIVERGING_INDEX = new Map<DivergingId, number>(
  DIVERGING_ORDER.map((token, index) => [token, index]),
);
const NEGATIVE_IDS: DivergingId[] = ['neg-05', 'neg-04', 'neg-03', 'neg-02', 'neg-01'];
const POSITIVE_IDS: DivergingId[] = ['pos-05', 'pos-04', 'pos-03', 'pos-02', 'pos-01'];
const NEUTRAL_ID = 'neutral';
const CATEGORICAL_LITERAL_PATTERN = /^oklch\([^)]+\)$/;
// Source-side floor co-designed with certify's runtime ROLE_A_CHROMA_FLOOR (0.03):
// slots must keep margin above the fail line so the default palette can never read as gray.
const CATEGORICAL_MIN_CHROMA = 0.045;

interface CliOptions {
  quiet: boolean;
  json?: string;
}

export interface VizScaleCheck {
  readonly type?: string;
  readonly scope: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface VizScaleCollections {
  readonly sequential: VizScaleColorEntry[];
  readonly diverging: VizScaleColorEntry[];
  readonly categorical: DtcgToken[];
}

export interface VizScaleColorEntry {
  readonly id: string;
  readonly order: number;
  readonly token: DtcgToken;
  readonly oklch: OklchColor;
}

type OklchColor = {
  readonly l: number;
  readonly c: number;
  readonly h: number;
};

export async function runVizScaleValidation(sourcePath: string = vizScaleSource): Promise<VizScaleCheck[]> {
  const tokens = await loadDtcgTokens(sourcePath);
  const collections = collectVizScaleCollections(tokens);
  const results = validateVizScaleCollections(collections);
  // s213-m04: every brand in the brand registry (the brands folder beside the scale source).
  const { readBrandRegistry } = createRequire(import.meta.url)('../../packages/tokens/scripts/brand-registry.cjs');
  for (const brand of readBrandRegistry(path.dirname(path.dirname(sourcePath))) as readonly string[]) {
    // s222-m02 (#2502 ruling 12): each brand's base carries its own recipe's light chart colours and gets the same scale
    // checks as the shared file (a brand made before 0.4.0 carries at most one categorical override, and is skipped).
    const base = (await loadDtcgTokens(path.resolve(path.dirname(sourcePath), `tokens/brands/${brand}/base.json`)))
      .filter((token) => token.path[0] === 'viz');
    if (base.some((token) => token.path[2] === 'sequential')) {
      results.push(...validateVizScaleCollections(collectVizScaleCollections(base))
        .map(check => ({ ...check, scope: `${brand}/base/${check.scope}` })));
    }
    const source = path.resolve(path.dirname(sourcePath), `tokens/brands/${brand}/dark.json`);
    const dark = await loadDtcgTokens(source);
    const required = [...collections.sequential, ...collections.diverging].map((entry) => entry.token.path.join('.'));
    results.push(...checkPalette('dark-coverage', `${brand}/dark`, dark, dark, required));
    results.push(...validateVizScaleCollections(collectVizScaleCollections(dark), 'dark')
      .map(check => ({ ...check, scope: `${brand}/dark/${check.scope}` })));
  }
  return results;
}

export function collectVizScaleCollections(tokens: readonly DtcgToken[]): VizScaleCollections {
  const sequential: VizScaleColorEntry[] = [];
  const diverging: VizScaleColorEntry[] = [];
  const categorical: DtcgToken[] = [];

  for (const token of tokens) {
    if (!token.path || token.path.length < 3) {
      continue;
    }

    if (token.path[0] !== 'viz' || token.path[1] !== 'scale') {
      continue;
    }

    const variant = token.path[2];
    const identifier = token.path[token.path.length - 1] ?? '';

    if (variant === 'sequential') {
      const order = Number.parseInt(identifier, 10);
      if (Number.isNaN(order)) {
        continue;
      }
      sequential.push({
        id: identifier,
        order,
        token,
        oklch: parseOklchValue(token),
      });
    } else if (variant === 'diverging' && isDivergingId(identifier)) {
      const order = DIVERGING_INDEX.get(identifier);
      if (typeof order !== 'number') {
        continue;
      }
      diverging.push({
        id: identifier,
        order,
        token,
        oklch: parseOklchValue(token),
      });
    } else if (variant === 'categorical') {
      categorical.push(token);
    }
  }

  sequential.sort((a, b) => a.order - b.order);
  diverging.sort((a, b) => a.order - b.order);

  return { sequential, diverging, categorical };
}

/**
 * The ordered scales' direction is the theme's: s222-m02 (#2502 ruling 12) runs the dark ladders the other way, so the
 * strongest value is the brightest on a dark canvas (01 darkest, a dark diverging midpoint), with the same ≥0.1 steps.
 */
export function validateVizScaleCollections(collections: VizScaleCollections, mode: 'light' | 'dark' = 'light'): VizScaleCheck[] {
  const results: VizScaleCheck[] = [];
  results.push(...validateSequentialScales(collections.sequential, mode));
  results.push(...validateDivergingScales(collections.diverging, mode));
  results.push(...validateCategoricalScales(collections.categorical));
  const sequential = collections.sequential.map((entry) => entry.token);
  const all = [...sequential, ...collections.diverging.map((entry) => entry.token), ...collections.categorical];
  results.push(...checkPalette('chroma-curve', 'sequential/chroma', sequential, all));
  results.push(...checkPalette('gamut', 'viz', all));
  const diverging = new Map(collections.diverging.map((entry) => [entry.id, entry]));
  for (let index = 0; index < NEGATIVE_IDS.length; index += 1) {
    const neg = diverging.get(NEGATIVE_IDS[index]);
    const pos = diverging.get(POSITIVE_IDS[index]);
    if (!neg || !pos) continue;
    const delta = Math.abs(neg.oklch.c - pos.oklch.c);
    results.push({ type: 'chroma-symmetry', scope: `diverging/chroma-${neg.id}|${pos.id}`,
      ok: delta <= 0.002, detail: `|ΔC|=${delta.toFixed(5)} (allowed ≤ 0.002)` });
  }
  return results;
}

function isDivergingId(value: string): value is DivergingId {
  return DIVERGING_INDEX.has(value as DivergingId);
}

function validateSequentialScales(entries: VizScaleColorEntry[], mode: 'light' | 'dark'): VizScaleCheck[] {
  const results: VizScaleCheck[] = [];
  if (entries.length !== MIN_SEQUENTIAL_STEPS) {
    results.push({
      scope: 'sequential/count',
      ok: false,
      detail: `Expected ${MIN_SEQUENTIAL_STEPS} steps but found ${entries.length}.`,
    });
    return results;
  }

  results.push({
    scope: 'sequential/count',
    ok: true,
    detail: 'All 9 sequential steps detected.',
  });

  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    // Light steps darken toward 09; dark steps brighten toward it (s222-m02).
    const delta = mode === 'dark' ? current.oklch.l - previous.oklch.l : previous.oklch.l - current.oklch.l;
    const ok = delta >= MIN_SEQUENTIAL_DELTA_L - SEQUENTIAL_TOLERANCE;
    results.push({
      scope: `sequential/step-${previous.id}-to-${current.id}`,
      ok,
      detail: `ΔL=${delta.toFixed(3)} (required ≥ ${MIN_SEQUENTIAL_DELTA_L.toFixed(2)}, ${mode === 'dark' ? 'brighter' : 'darker'} toward 09)`,
    });
  }

  return results;
}

function validateDivergingScales(entries: VizScaleColorEntry[], mode: 'light' | 'dark'): VizScaleCheck[] {
  // The midpoint is the lightest step in light and the darkest in dark (s222-m02): the wings gain emphasis away from it.
  const sign = mode === 'dark' ? -1 : 1;
  const results: VizScaleCheck[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const missing = DIVERGING_ORDER.filter((id) => !byId.has(id));

  if (missing.length > 0) {
    results.push({
      scope: 'diverging/missing',
      ok: false,
      detail: `Missing diverging steps: ${missing.join(', ')}`,
    });
    return results;
  }

  results.push({
    scope: 'diverging/count',
    ok: true,
    detail: 'All 11 diverging steps detected.',
  });

  const ordered = DIVERGING_ORDER.map((id) => byId.get(id)!);
  const neutralIndex = DIVERGING_ORDER.indexOf(NEUTRAL_ID);

  for (let index = 1; index <= neutralIndex; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const delta = sign * (current.oklch.l - previous.oklch.l);
    const ok = delta >= MIN_SEQUENTIAL_DELTA_L - SEQUENTIAL_TOLERANCE;
    results.push({
      scope: `diverging/${previous.id}-to-${current.id}`,
      ok,
      detail: `ΔL=${delta.toFixed(3)} (${mode === 'dark' ? 'decreasing' : 'increasing'} toward neutral)`,
    });
  }

  for (let index = neutralIndex + 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const delta = sign * (previous.oklch.l - current.oklch.l);
    const ok = delta >= MIN_SEQUENTIAL_DELTA_L - SEQUENTIAL_TOLERANCE;
    results.push({
      scope: `diverging/${previous.id}-to-${current.id}`,
      ok,
      detail: `ΔL=${delta.toFixed(3)} (${mode === 'dark' ? 'increasing' : 'decreasing'} away from neutral)`,
    });
  }

  for (let index = 0; index < NEGATIVE_IDS.length; index += 1) {
    const neg = byId.get(NEGATIVE_IDS[index])!;
    const pos = byId.get(POSITIVE_IDS[index])!;
    const diff = Math.abs(neg.oklch.l - pos.oklch.l);
    const ok = diff <= SYMMETRY_TOLERANCE;
    results.push({
      scope: `diverging/symmetry-${NEGATIVE_IDS[index]}|${POSITIVE_IDS[index]}`,
      ok,
      detail: `|ΔL|=${diff.toFixed(3)} (allowed ≤ ${SYMMETRY_TOLERANCE.toFixed(2)})`,
    });
  }

  return results;
}

function validateCategoricalScales(tokens: DtcgToken[]): VizScaleCheck[] {
  const results: VizScaleCheck[] = [];
  if (tokens.length === 0) {
    results.push({
      scope: 'categorical/count',
      ok: false,
      detail: 'No categorical viz tokens found.',
    });
    return results;
  }

  results.push({
    scope: 'categorical/count',
    ok: true,
    detail: `${tokens.length} categorical entries detected.`,
  });

  for (const token of tokens) {
    const raw = typeof token.value === 'string' ? token.value.trim() : '';
    const scope = `categorical/${token.path[token.path.length - 1] ?? 'unknown'}`;

    if (!CATEGORICAL_LITERAL_PATTERN.test(raw)) {
      results.push({
        scope,
        ok: false,
        detail: `Value ${raw || '<empty>'} must be a static inline oklch() literal (categorical slots are decoupled from sys.status.*).`,
      });
      continue;
    }

    let oklch: OklchColor;
    try {
      oklch = parseOklchValue(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ scope, ok: false, detail: message });
      continue;
    }

    const ok = oklch.c >= CATEGORICAL_MIN_CHROMA;
    results.push({
      scope,
      ok,
      detail: ok
        ? `Inline oklch literal, chroma ${oklch.c.toFixed(3)} ≥ ${CATEGORICAL_MIN_CHROMA}.`
        : `Chroma ${oklch.c.toFixed(3)} is below the ${CATEGORICAL_MIN_CHROMA} categorical chroma floor — reads as gray.`,
    });
  }

  return results;
}

function parseOklchValue(token: DtcgToken): OklchColor {
  if (typeof token.value !== 'string') {
    throw new Error(`Token ${token.path.join('.')} is not a color string.`);
  }

  try {
    const color = new Color(token.value);
    const { l, c, h } = color.oklch;
    return { l, c, h };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse OKLCH value for ${token.path.join('.')}: ${message}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  let quiet = false;
  for (const arg of argv) {
    if (arg === '--quiet') {
      quiet = true;
    }
  }
  const jsonIndex = argv.indexOf('--json');
  if (jsonIndex >= 0 && (!argv[jsonIndex + 1] || argv[jsonIndex + 1].startsWith('--'))) {
    throw new Error('Expected path after --json');
  }
  return { quiet, json: jsonIndex >= 0 ? argv[jsonIndex + 1] : undefined };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const results = await runVizScaleValidation();
  const failures = results.filter((result) => !result.ok);
  const summary = summarizeChecks(results.map((result) => ({ ...result, type: result.type ?? 'scale-contract' })));
  if (options.json) await fs.writeFile(options.json, `${JSON.stringify({ summary, checks: results }, null, 2)}\n`);
  console.log(`Viz check counts: ${JSON.stringify(summary)}`);

  if (!options.quiet) {
    for (const result of results) {
      const line = `${result.ok ? '✓' : '✖'} ${result.scope} — ${result.detail}`;
      (result.ok ? console.log : console.error)(line);
    }
  } else if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`✖ ${failure.scope} — ${failure.detail}`);
    }
  }

  if (failures.length === 0) {
    console.log(`✔ Viz scale validation passed (${results.length} checks).`);
  } else {
    console.error(`✖ Viz scale validation failed (${failures.length}/${results.length} checks).`);
    process.exitCode = 1;
  }
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (modulePath === invokedPath) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
