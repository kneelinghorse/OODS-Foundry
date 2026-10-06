// s173 m02 (crawl 1) — THE KEEP-IN-STEP TEST, stage 1 of 2.
//
// `@container` and `@media` cannot read a CSS custom property in their condition — the
// browser resolves them before custom properties exist — so a container query written at
// 48rem is a LITERAL that no token can bind. `@custom-media` was evaluated and dropped: no
// chain in this repo processes it. What is left is to keep the literals in step with the
// tokens by TEST, which is what this file is.
//
// THE RULE: every width literal in a scanned stylesheet either equals a `sys.breakpoint.*`
// value, or is listed in the LEGACY catalogue below. Nothing else is admissible.
//
// WHY THIS FILE IS TWO STAGES, stated plainly rather than discovered later: at m02 the
// CONFORMING set is EMPTY. The repo has no container queries yet — m03 (crawl 2) writes the
// first one — and every existing width query is legacy. A test whose operand does not exist
// yet cannot discriminate, so stage 1 proves the matcher on FIXTURES and pins the legacy
// catalogue, and m03 turns on the real-file leg and re-proves discrimination against the
// real 48rem literal it introduces. The alternative — asserting over an empty set and
// calling it green — is exactly the vacuous control this project keeps catching in review.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BREAKPOINT_SCREEN_KEYS, tokenArtifactPath } from '../../tailwind.config.js';

const ROOT = process.cwd();
const REM_PX = 16;

/** The token values, read from the built artifact — never re-typed here. */
function tokenPixels(): Map<string, number> {
  const { flat } = JSON.parse(readFileSync(tokenArtifactPath(), 'utf8')) as {
    flat: Record<string, { value?: unknown }>;
  };
  return new Map(
    BREAKPOINT_SCREEN_KEYS.map((key) => {
      const value = flat[`sys-breakpoint-${key}`]?.value;
      if (typeof value !== 'number') {
        throw new Error(`sys.breakpoint.${key} missing from the built artifact — run \`pnpm build:tokens\``);
      }
      return [key, value] as const;
    }),
  );
}

export interface WidthLiteral {
  readonly rule: '@media' | '@container';
  readonly bound: 'min-width' | 'max-width';
  readonly raw: string;
  readonly px: number;
}

/**
 * Pull every width literal out of a stylesheet, normalised to px.
 *
 * Deliberately naive about everything except widths: `forced-colors`, `prefers-*` and any
 * other feature query is not a breakpoint and must not be reported, or the catalogue would
 * fill with noise and stop being readable as a list of breakpoints.
 */
export function collectWidthLiterals(css: string): WidthLiteral[] {
  const found: WidthLiteral[] = [];
  const pattern = /@(media|container)([^{]*)\{/g;
  for (const match of css.matchAll(pattern)) {
    const rule = `@${match[1]}` as WidthLiteral['rule'];
    const condition = match[2];
    const widths = condition.matchAll(/(min|max)-width:\s*([\d.]+)(px|rem)/g);
    for (const width of widths) {
      const magnitude = Number.parseFloat(width[2]);
      found.push({
        rule,
        bound: `${width[1]}-width` as WidthLiteral['bound'],
        raw: `${width[2]}${width[3]}`,
        px: width[3] === 'rem' ? magnitude * REM_PX : magnitude,
      });
    }
  }
  return found;
}

/** Which literals BREAK the rule: not a token value, and not catalogued as legacy. */
export function nonConforming(literals: readonly WidthLiteral[], legacyPx: readonly number[]): WidthLiteral[] {
  const tokens = new Set(tokenPixels().values());
  const legacy = new Set(legacyPx);
  return literals.filter((literal) => !tokens.has(literal.px) && !legacy.has(literal.px));
}

/**
 * THE LEGACY CATALOGUE — width queries that predate the tokens and are NOT rewritten.
 *
 * Rewriting them would change shipped rendering (a 480px pagination collapse is not a 640px
 * one), which crawl 1 explicitly does not do. They are catalogued instead, and the catalogue
 * is asserted EXACT, so a new hand-written breakpoint cannot slip in beside them: an added
 * query is either a token value (conforming) or a diff to this list.
 *
 * The last entry is not in the sprint memo's enumeration of six — it was found by the sweep
 * that built this list, in a tool that inlines its CSS as a TS string. It is catalogued on
 * the same terms rather than left out because the memo did not predict it.
 */
const LEGACY_SITES: ReadonlyArray<{ file: string; px: number; why: string }> = [
  { file: 'src/components/pagination/pagination.css', px: 480, why: 'phone-width pagination collapse' },
  { file: 'src/styles/empty-state.css', px: 640, why: 'empty-state stacking' },
  { file: 'src/styles/toast-portal.css', px: 640, why: 'full-width toasts on phones' },
  { file: 'src/components/stepper/stepper.css', px: 640, why: 'stepper vertical collapse' },
  { file: 'apps/explorer/src/styles/index.css', px: 960, why: 'explorer shell collapse' },
  { file: 'apps/explorer/src/styles/index.css', px: 920, why: 'explorer detail collapse' },
  { file: 'tools/design-lab-shell/src/styles.ts', px: 1100, why: 'design-lab shell, CSS inlined as a TS string' },
];

/** The three JS paths that hardcode a 720px collapse — a fourth threshold, unrelated to any token. */
const LEGACY_JS_SITES: ReadonlyArray<{ file: string; needle: string }> = [
  { file: 'src/dashboard/widgets/network-widgets.tsx', needle: 'viewportWidth < 720' },
  { file: 'src/viz/contexts/dashboard-spatial-context.tsx', needle: 'viewportWidth < 720' },
  { file: 'packages/viz-core/src/dashboard/auto-layout.ts', needle: 'MOBILE_BREAKPOINT_PX = 720' },
];

describe('breakpoint keep-in-step — the matcher (s173 m02, stage 1)', () => {
  it('reads width literals out of both @media and @container, in px and rem', () => {
    const literals = collectWidthLiterals(`
      @media (max-width: 480px) { .a { color: red } }
      @container (min-width: 48rem) { .b { color: blue } }
      @media (forced-colors: active) { .c { color: green } }
      @media (prefers-reduced-motion: reduce) { .d { color: black } }
    `);
    expect(literals).toEqual([
      { rule: '@media', bound: 'max-width', raw: '480px', px: 480 },
      { rule: '@container', bound: 'min-width', raw: '48rem', px: 768 },
    ]);
  });

  it('DISCRIMINATES: a literal that is neither a token value nor catalogued is reported', () => {
    // 47rem = 752px: one rem off the md token, the exact shape of the drift this test exists
    // to catch. If the matcher tolerated it, the whole file would be decoration.
    const drifted = collectWidthLiterals('@container (max-width: 47rem) { .a { color: red } }');
    expect(nonConforming(drifted, [])).toHaveLength(1);

    const onToken = collectWidthLiterals('@container (max-width: 48rem) { .a { color: red } }');
    expect(nonConforming(onToken, [])).toHaveLength(0);
  });

  it('accepts every token value, in px or rem — so any of the five may be authored either way', () => {
    for (const px of tokenPixels().values()) {
      expect(nonConforming(collectWidthLiterals(`@container (min-width: ${px}px) { .a { color: red } }`), [])).toHaveLength(0);
      expect(nonConforming(collectWidthLiterals(`@container (min-width: ${px / REM_PX}rem) { .a { color: red } }`), [])).toHaveLength(0);
    }
  });
});

describe('breakpoint keep-in-step — the legacy catalogue is EXACT (s173 m02, stage 1)', () => {
  it.each(LEGACY_SITES)('$file still carries its $px px query, unchanged', ({ file, px }) => {
    const source = readFileSync(resolve(ROOT, file), 'utf8');
    const literals = collectWidthLiterals(source);
    expect(literals.map((literal) => literal.px)).toContain(px);
  });

  it('no scanned stylesheet has GAINED a width query outside the catalogue', () => {
    // What this asserts is that the catalogue is COMPLETE, which is falsifiable today: add a
    // query to any catalogued file and this reds.
    const catalogued = LEGACY_SITES.map((site) => site.px);
    const scanned = [...new Set(LEGACY_SITES.map((site) => site.file))];
    const violations = scanned.flatMap((file) =>
      nonConforming(collectWidthLiterals(readFileSync(resolve(ROOT, file), 'utf8')), catalogued).map(
        (literal) => `${file}: ${literal.raw}`,
      ),
    );
    expect(violations).toEqual([]);
  });
});

// ---- STAGE 2 (s173 m03): the real-file leg -----------------------------------------------
//
// m03 wrote the repo's first container query, so the conforming set is no longer empty and
// the rule can be enforced against real files instead of fixtures. The discrimination is
// RE-PROVEN here against the actual 48rem literal — stage 1's fixture case cannot do that,
// because a fixture proves the matcher, not the wiring to the file.

/** Stylesheets that must obey the rule: every width literal is a token value or catalogued. */
const CONFORMING_SOURCES: readonly string[] = ['src/styles/domain-contexts.css'];

describe('breakpoint keep-in-step — the real-file leg (s173 m03, stage 2)', () => {
  const legacyPx = LEGACY_SITES.map((site) => site.px);

  it('at least one @container query EXISTS — the operand this test needs is real now', () => {
    const containers = CONFORMING_SOURCES.flatMap((file) =>
      collectWidthLiterals(readFileSync(resolve(ROOT, file), 'utf8')).filter((l) => l.rule === '@container'),
    );
    expect(containers.length).toBeGreaterThan(0);
    // And it is the collapse threshold, in rem, equal to sys.breakpoint.md.
    expect(containers.map((literal) => literal.px)).toContain(tokenPixels().get('md'));
  });

  it.each(CONFORMING_SOURCES)('%s: every width literal equals a sys.breakpoint value', (file) => {
    const literals = collectWidthLiterals(readFileSync(resolve(ROOT, file), 'utf8'));
    expect(nonConforming(literals, legacyPx)).toEqual([]);
  });

  it('DISCRIMINATES against the REAL file: mutating the shipped 48rem literal is rejected', () => {
    // Stage 1 proved the matcher on a string. This proves the matcher is pointed at the file
    // that actually ships: take the real stylesheet, move its threshold by one rem, and the
    // rule must reject it. A test that only ever saw fixtures could pass with the production
    // stylesheet unread.
    const source = readFileSync(resolve(ROOT, 'src/styles/domain-contexts.css'), 'utf8');
    expect(source).toContain('48rem');
    const mutated = source.replace('max-width: 48rem', 'max-width: 47rem');
    expect(mutated).not.toBe(source);
    expect(nonConforming(collectWidthLiterals(mutated), legacyPx)).toHaveLength(1);
  });

  it('the three JS 720px collapse sites are unmoved — a fourth threshold, owned by no token', () => {
    for (const { file, needle } of LEGACY_JS_SITES) {
      expect(readFileSync(resolve(ROOT, file), 'utf8')).toContain(needle);
    }
    // And 720 is deliberately NOT a token value: naming it sys.breakpoint.* would imply the
    // dashboard collapse is on the shared scale when it is not.
    expect([...tokenPixels().values()]).not.toContain(720);
  });
});
