// s173 m02 (crawl 1) — Tailwind's breakpoints come from sys.breakpoint.*, and this proves it.
//
// The hard part of this test is that it must not be satisfiable by the thing it is meant to
// catch. The chartered token values ARE the installed Tailwind defaults — deliberately, so
// the wiring moves zero rendered layout — which means a config that silently ignored the
// tokens and fell through to Tailwind's built-in screens map would produce IDENTICAL output
// today. "screens equal 640/768/1024/1280/1536" is therefore a vacuous assertion on its own.
//
// So the file asserts three separable things:
//   1. LIVE: Tailwind's own loader (loadConfig, the jiti path postcss uses) can load the root
//      config at all, and the screens it produces equal the values in the built artifact.
//   2. READ, not defaulted: the REAL generator, handed a substituted artifact carrying values
//      that are not Tailwind's defaults, returns THOSE values.
//   3. FAIL LOUD: a missing artifact and a malformed token each THROW, naming
//      `pnpm build:tokens`. A silent fallback would be indistinguishable from success.
//
// (2) and (3) are why tailwind.config.ts exports its generator and lets the artifact path be
// passed in. Re-typing the generator here would have proven something about this file only.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BREAKPOINT_SCREEN_KEYS,
  screensFromTokens,
  tokenArtifactPath,
} from '../../tailwind.config.js';

const requireCjs = createRequire(import.meta.url);
// Tailwind's own config loader — the same entry point postcss uses, not a hand-rolled import.
const loadConfig = requireCjs('tailwindcss/loadConfig') as (path: string) => {
  theme?: { screens?: Record<string, string> };
};

const ROOT_CONFIG = resolve(process.cwd(), 'tailwind.config.ts');
const SOURCE_TOKENS = resolve(
  process.cwd(),
  'packages/tokens/src/tokens/base/system/breakpoint.json',
);

const tempDirs: string[] = [];
function artifactFixture(flat: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'oods-screens-'));
  tempDirs.push(dir);
  const file = join(dir, 'tokens.json');
  writeFileSync(file, JSON.stringify({ flat }), 'utf8');
  return file;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('tailwind screens — generated from sys.breakpoint.* (s173 m02)', () => {
  it('the ROOT config loads through Tailwind\'s own loader and its screens equal the built tokens', () => {
    const artifact = JSON.parse(readFileSync(tokenArtifactPath(), 'utf8')) as {
      flat: Record<string, { value?: unknown }>;
    };
    const expected = Object.fromEntries(
      BREAKPOINT_SCREEN_KEYS.map((key) => [key, `${artifact.flat[`sys-breakpoint-${key}`].value}px`]),
    );

    const config = loadConfig(ROOT_CONFIG);
    expect(config.theme?.screens).toEqual(expected);
  });

  it('the SOURCE token file, the built artifact and the config all agree — a stale artifact is caught', () => {
    const source = JSON.parse(readFileSync(SOURCE_TOKENS, 'utf8')) as {
      sys: { breakpoint: Record<string, { $value: number; $type: string }> };
    };
    const config = loadConfig(ROOT_CONFIG);

    for (const key of BREAKPOINT_SCREEN_KEYS) {
      const token = source.sys.breakpoint[key];
      // $type number is load-bearing: a dimension emits an invalid raw string into the
      // Swift/Kotlin artifacts, so the mobile compile gates are downstream of this line.
      expect(token.$type).toBe('number');
      expect(config.theme?.screens?.[key]).toBe(`${token.$value}px`);
    }
  });

  it('emits the keys ASCENDING sm -> 2xl, because Tailwind orders its @media blocks by config order', () => {
    const config = loadConfig(ROOT_CONFIG);
    expect(Object.keys(config.theme?.screens ?? {})).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
  });

  it('is value-identical to the Tailwind defaults it replaces — the zero-movement claim, as a ratchet', () => {
    // Crawl 1's whole safety argument is that tokenising the breakpoints changes no rendered
    // layout, because the values ARE the framework defaults the ~37 responsive-prefix usages
    // already render against. Measured once at build time (the compiled globals.css is
    // byte-identical before and after this wiring); pinned here so it stays true.
    //
    // This is deliberately a RATCHET, not a coincidence check: the day someone changes a
    // sys.breakpoint value, this reds. That is the point — it is the moment the change stops
    // being a no-op and starts needing a visual review.
    const defaults = requireCjs('tailwindcss/defaultTheme') as { screens: Record<string, string> };
    const config = loadConfig(ROOT_CONFIG);
    expect(config.theme?.screens).toEqual(defaults.screens);
  });

  it('READS the artifact rather than falling through to Tailwind\'s defaults', () => {
    // Values that are NOT Tailwind defaults. If the generator ignored the file, this returns
    // 640px and the test reds — which is the only way to tell wiring from coincidence, since
    // the shipped values and the framework defaults are identical by design.
    const fixture = artifactFixture({
      'sys-breakpoint-sm': { value: 1 },
      'sys-breakpoint-md': { value: 2 },
      'sys-breakpoint-lg': { value: 3 },
      'sys-breakpoint-xl': { value: 4 },
      'sys-breakpoint-2xl': { value: 5 },
    });
    expect(screensFromTokens(fixture)).toEqual({
      sm: '1px',
      md: '2px',
      lg: '3px',
      xl: '4px',
      '2xl': '5px',
    });
  });

  it('THROWS naming `pnpm build:tokens` when the artifact is missing — never a silent default', () => {
    expect(() => screensFromTokens(join(tmpdir(), 'oods-screens-does-not-exist', 'tokens.json'))).toThrow(
      /pnpm build:tokens/,
    );
  });

  it('THROWS naming the offending token when a value is absent or not a number', () => {
    const missingKey = artifactFixture({
      'sys-breakpoint-sm': { value: 640 },
      'sys-breakpoint-md': { value: 768 },
      'sys-breakpoint-lg': { value: 1024 },
      'sys-breakpoint-xl': { value: 1280 },
    });
    expect(() => screensFromTokens(missingKey)).toThrow(/sys\.breakpoint\.2xl/);

    // A dimension-typed token would arrive here as the string '640px'. That must fail rather
    // than be coerced: a screens map of '640pxpx' would be silently dropped by Tailwind.
    const stringValue = artifactFixture({
      'sys-breakpoint-sm': { value: '640px' },
      'sys-breakpoint-md': { value: 768 },
      'sys-breakpoint-lg': { value: 1024 },
      'sys-breakpoint-xl': { value: 1280 },
      'sys-breakpoint-2xl': { value: 1536 },
    });
    expect(() => screensFromTokens(stringValue)).toThrow(/sys\.breakpoint\.sm/);
    expect(() => screensFromTokens(stringValue)).toThrow(/pnpm build:tokens/);
  });
});
