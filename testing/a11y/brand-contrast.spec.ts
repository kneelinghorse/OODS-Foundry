/**
 * s168 m04 — the brand × theme cells are GRADED.
 *
 * Before this, `DEFAULT_CONTRAST_RULES` contained zero rules naming a brand token, so the
 * six cells s167 made real on five platforms were ungraded: a brand palette could ship any
 * contrast at all and every gate stayed green. `brandContrastRules` is a SEPARATE export
 * for the reason documented in `packages/a11y-tools/src/brand-rules.ts` — extending the
 * shared constant would permanently red two consumers that read a brand-free token source.
 *
 * ── THE TOKEN-MAP PLUMBING, AND WHY IT IS NOT `flatTokens` ──
 * MEASURED: `flatTokens` from `@oods/tokens` carries 122 brand keys and **zero of them are
 * dark or hc** — 82 `color-brand-*` plus 40 legacy `brand-*`, all of them the BASE cell.
 * Grading through `flatTokens` could therefore only ever cover base, silently leaving half
 * the graded surface unmeasured while looking complete. So each cell's map is built from
 * that cell's own token source, which is the only artifact that holds all six.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BRAND_CONTRAST_PAIRS,
  brandContrastRules,
  BRAND_GRADED_THEMES,
  BRAND_HC_EXEMPTION_REASON,
  brandFlatKey,
  buildBrandContrastRules,
  evaluateContrastRules,
  resolveColorSample,
  type FlatTokenMap,
} from '@oods/a11y-tools';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../..');
/**
 * s213-m04: the current cells are every brand in the brand registry (the brands folder), so a brand added there is
 * graded here with no edit. The RED-first replays below grade recorded fixtures, which hold brands A and B only: that
 * list is the evidence's, not the product's.
 */
const BRANDS: readonly string[] = createRequire(import.meta.url)('../../packages/tokens/scripts/brand-registry.cjs').readBrandRegistry();
const FIXTURE_BRANDS = ['A', 'B'] as const;
const STATUS_ON_PANEL_ID = /^status-(?:info|success|warning|critical|neutral|accent)-(?:text|icon)-on-(?:canvas|raised|subtle)$/;
const isStatusOnPanelPairId = (id: string): boolean => STATUS_ON_PANEL_ID.test(id);
const pairIdOfRule = (id: string): string => id.replace(/^brand-[a-z0-9]+-(?:base|dark)-/, '');
const isStatusOnPanelRuleId = (id: string): boolean => isStatusOnPanelPairId(pairIdOfRule(id));
// s206-m04: the accent status family exists since Sprint 206 m01. The RED-first replays below grade revisions from before
// it, where its tokens do not exist (an unresolved token reads as a failure), so they grade the rule surface as it stood.
const isAccentStatusPairId = (id: string): boolean => id.startsWith('status-accent-');
const isAccentStatusRuleId = (id: string): boolean => isAccentStatusPairId(pairIdOfRule(id));
// s222-m01 (#2502 ruling 7): control borders, the focus ring, and text on the secondary, destructive and solid status
// fills. Their tokens do not exist in the vendored revisions, so the replays grade the rule surface as it stood.
const S222_PAIR_ID = /^(?:border-interactive(?:-hover)?-on-(?:canvas|raised)|focus-ring-on-(?:canvas|raised|primary)|text-on-secondary-(?:default|hover|pressed)|on-destructive-(?:default|hover|pressed)|status-[a-z]+-on-solid)$/;
const isS222PairId = (id: string): boolean => S222_PAIR_ID.test(id);
const isS222RuleId = (id: string): boolean => isS222PairId(pairIdOfRule(id));
const PRE_F4_PAIR_COUNT = BRAND_CONTRAST_PAIRS.filter((pair) => !isStatusOnPanelPairId(pair.id) && !isAccentStatusPairId(pair.id) && !isS222PairId(pair.id)).length;

/** Flatten one brand × theme token file into the shape the evaluator resolves against. */
function cellTokenMap(brand: string, source: string): FlatTokenMap {
  const doc = JSON.parse(source);
  const map: FlatTokenMap = {};
  const walk = (node: unknown, trail: string[]): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, any>;
    if ('$value' in obj) {
      const tokenPath = trail.join('.').replace(/^color\.brand\.[^.]+\./, '');
      map[brandFlatKey(brand, tokenPath)] = { value: obj.$value };
      return;
    }
    for (const [key, child] of Object.entries(obj)) walk(child, trail.concat(key));
  };
  walk(doc, []);
  return map;
}

function cellPath(brand: string, theme: string): string {
  return `packages/tokens/src/tokens/brands/${brand}/${theme}.json`;
}

function currentCell(brand: string, theme: string): FlatTokenMap {
  return cellTokenMap(brand, readFileSync(path.resolve(repoRoot, cellPath(brand, theme)), 'utf8'));
}

/**
 * A pre-change cell, read from a VENDORED FIXTURE rather than from git history.
 *
 * ── WHY THIS IS NOT `git show <sha>:<path>` (s169 m01) ──
 * It used to be, and MEASURED: it therefore proved nothing in CI. The `coverage` job is
 * the only CI runner of the `guardrails` project (`pnpm run test:coverage`, ci.yml:560),
 * and its checkout takes the `actions/checkout` default of `fetch-depth: 1` — so
 * `git show e5f2172:…` failed there, the old skip branch took over, and the assertion
 * that a shipped rule set names real historical failures never executed on any machine
 * except a maintainer's full clone. A green CI run said nothing about the proof.
 *
 * `fetch-depth: 0` would fix today's skip but not the durable problem: `e5f2172` and
 * `00ae5b3` are BRANCH commits, and a squash-merge orphans them — at which point the
 * "fix" reverts to skipping, silently, exactly as before. This spec was the repo's only
 * history-reading test; vendoring the eight cells removes the dependency entirely and the
 * skip path is DELETED, so an unavailable fixture is now a hard failure, not a pass.
 *
 * THE TRADE, stated: the fixtures freeze bytes. A history rewrite can orphan the commit
 * they were taken from, and their `$source` key would then point at nothing — auditability
 * degrades, but the proof keeps running. That is the direction of failure we want.
 */
const FIXTURE_ROOT = path.resolve(moduleDir, '__fixtures__/brand-cells');

function cellAtRevision(brand: string, theme: string, revision: string): FlatTokenMap {
  const file = path.join(FIXTURE_ROOT, revision, `${brand}-${theme}.json`);
  const source = readFileSync(file, 'utf8');
  // Provenance is asserted, not merely present: a hand-edited fixture that drops or
  // rewrites `$source` stops being evidence about that revision.
  expect(
    JSON.parse(source).$source,
    `${revision}/${brand}-${theme}.json lost its provenance key`,
  ).toBe(`${revision}:${cellPath(brand, theme)}`);
  // `cellTokenMap`'s walker only descends objects and only records `$value` leaves, so the
  // top-level `$source` string is ignored. (JSON admits no comments — hence a key.)
  return cellTokenMap(brand, source);
}

describe('brand contrast grading (s168 m04)', () => {
  it('grades every brand × graded-theme cell, and hc is exempt with a stated reason', () => {
    expect([...BRAND_GRADED_THEMES]).toEqual(['base', 'dark']);
    expect(BRAND_HC_EXEMPTION_REASON).toContain('system colours');
    // The exemption must be TRUE, not merely declared: an hc cell has no resolvable pair.
    for (const brand of BRANDS) {
      const hc = currentCell(brand, 'hc');
      const evaluations = evaluateContrastRules(hc, { rules: buildBrandContrastRules(brand, 'base') });
      expect(
        evaluations.every((evaluation) => !Number.isFinite(evaluation.ratio)),
        `${brand}/hc produced a finite ratio — the exemption's premise no longer holds`,
      ).toBe(true);
    }
  });

  // s206-m04: the accent status family (Sprint 206 m01) is graded like the other five: +2 own-surface pairs and +6
  // panel pairs, so the fifth group is 36 templates (was 30). s222-m01 (#2502 ruling 7) adds 19: control borders at rest
  // and hovered on the canvas and the raised panel (4), the focus ring on the canvas, a raised panel and the primary fill
  // (3), text on the secondary and destructive actions in each state (6), and text on each solid status fill (6): 84
  // pairs, 336 rules.
  it('pins the fifth pair group at 36 templates and the full surface at 84 / 336', () => {
    const statusOnPanel = BRAND_CONTRAST_PAIRS.filter((pair) => isStatusOnPanelPairId(pair.id));
    const expectedIds = ['info', 'success', 'warning', 'critical', 'neutral', 'accent'].flatMap((status) =>
      ['canvas', 'raised', 'subtle'].flatMap((panel) => [
        `status-${status}-text-on-${panel}`,
        `status-${status}-icon-on-${panel}`,
      ]),
    );
    expect(PRE_F4_PAIR_COUNT).toBe(27);
    expect(statusOnPanel).toHaveLength(36);
    expect(statusOnPanel.map((pair) => pair.id).sort()).toEqual(expectedIds.sort());
    expect(statusOnPanel.filter((pair) => pair.id.includes('-text-on-'))).toHaveLength(18);
    expect(statusOnPanel.filter((pair) => pair.id.includes('-icon-on-'))).toHaveLength(18);
    expect(BRAND_CONTRAST_PAIRS.filter((pair) => isS222PairId(pair.id))).toHaveLength(19);
    expect(BRAND_CONTRAST_PAIRS).toHaveLength(84);
    // 84 pairs in each graded theme of each brand: 336 for the two shipped brands.
    expect(brandContrastRules(BRANDS)).toHaveLength(BRAND_CONTRAST_PAIRS.length * BRAND_GRADED_THEMES.length * BRANDS.length);
    expect(brandContrastRules(['A', 'B'])).toHaveLength(336);
  });

  // 18 icon and 18 text candidates per brand per graded theme: 72 and 72 for the two shipped brands.
  it('the fifth group grades 18 icon and 18 text candidates per brand and theme, all passing', () => {
    const failures: string[] = [];
    let iconCandidates = 0;
    let textCandidates = 0;
    for (const brand of BRANDS) {
      for (const theme of BRAND_GRADED_THEMES) {
        const rules = buildBrandContrastRules(brand, theme).filter((rule) => isStatusOnPanelRuleId(rule.ruleId));
        for (const evaluation of evaluateContrastRules(currentCell(brand, theme), { rules })) {
          if (evaluation.rule.ruleId.includes('-icon-on-')) iconCandidates += 1;
          else textCandidates += 1;
          if (!evaluation.passed) failures.push(evaluation.rule.ruleId);
        }
      }
    }
    expect(iconCandidates).toBe(18 * BRANDS.length * BRAND_GRADED_THEMES.length);
    expect(textCandidates).toBe(18 * BRANDS.length * BRAND_GRADED_THEMES.length);
    expect(failures).toEqual([]);
  });

  /**
   * CONTROL OF THE CONTROL. `evaluate.ts` returns `passed: false` on ANY exception,
   * including "token not found". A rule set with wrong key strings is therefore red while
   * looking exactly like a contrast failure — the precise trap the natural dotted form
   * (`brand.A.text.onInteractive` → `brand-a-text-oninteractive`, a key that does not
   * exist) would have walked into. Every token must RESOLVE before any ratio is asserted.
   */
  it('every rule’s tokens resolve, so a failure can only mean a real ratio', () => {
    // `resolveColorSample`, not `resolveFlatToken` (s169 m01): the evaluator calls
    // `resolveColorSample`, which is `resolveFlatToken` PLUS `normaliseColor`. A token can
    // be present in the map and still blow up on conversion, and the map-lookup-only check
    // would have declared that healthy. This control now covers the same path the graded
    // assertion below runs on — the whole point of a control of the control.
    for (const brand of BRANDS) {
      for (const theme of BRAND_GRADED_THEMES) {
        const tokens = currentCell(brand, theme);
        for (const rule of buildBrandContrastRules(brand, theme)) {
          expect(() => resolveColorSample(tokens, rule.foreground), `${rule.ruleId} foreground`).not.toThrow();
          expect(() => resolveColorSample(tokens, rule.background), `${rule.ruleId} background`).not.toThrow();
        }
      }
    }
  });

  it('every graded cell passes its thresholds', () => {
    const failures: string[] = [];
    let graded = 0;
    for (const brand of BRANDS) {
      for (const theme of BRAND_GRADED_THEMES) {
        const tokens = currentCell(brand, theme);
        for (const evaluation of evaluateContrastRules(tokens, { rules: buildBrandContrastRules(brand, theme) })) {
          graded += 1;
          if (!evaluation.passed) {
            failures.push(`${evaluation.rule.ruleId}: ${evaluation.ratio} < ${evaluation.threshold} (${evaluation.message ?? ''})`);
          }
        }
      }
    }
    expect(graded).toBe(BRAND_CONTRAST_PAIRS.length * BRANDS.length * BRAND_GRADED_THEMES.length);
    expect(failures, `brand contrast failures:\n  ${failures.join('\n  ')}`).toEqual([]);
  });

  /**
   * RED-FIRST FOR s178 m03. The existing `00ae5b3` fixture carries the exact four base icon
   * values F4 re-authored. Evaluating only the fifth group against those bytes must reproduce
   * the seven measured failures while its other 113 evaluations pass. Reusing the provenance-
   * checked fixture avoids a second hand-copied home for the old palette.
   */
  it('RED-first: the pre-F4 icon values reproduce exactly seven status-on-panel failures', () => {
    const { failed, passed } = sweepRevision('00ae5b3', (ruleId) => isStatusOnPanelRuleId(ruleId) && !isAccentStatusRuleId(ruleId));
    expect(failed.sort()).toEqual(
      [
        'brand-a-base-status-success-icon-on-subtle',
        'brand-a-base-status-warning-icon-on-canvas',
        'brand-a-base-status-warning-icon-on-raised',
        'brand-a-base-status-warning-icon-on-subtle',
        'brand-b-base-status-success-icon-on-subtle',
        'brand-b-base-status-warning-icon-on-raised',
        'brand-b-base-status-warning-icon-on-subtle',
      ].sort(),
    );
    expect(passed).toBe(113);
  });

  /** Evaluate a selected rule surface against one vendored revision of all four graded cells. */
  function sweepRevision(
    revision: string,
    includeRule: (ruleId: string) => boolean = () => true,
  ): { failed: string[]; passed: number } {
    const failed: string[] = [];
    let passed = 0;
    for (const brand of FIXTURE_BRANDS) {
      for (const theme of BRAND_GRADED_THEMES) {
        const tokens = cellAtRevision(brand, theme, revision);
        const rules = buildBrandContrastRules(brand, theme).filter((rule) => includeRule(rule.ruleId));
        for (const evaluation of evaluateContrastRules(tokens, { rules })) {
          if (evaluation.passed) passed += 1;
          else failed.push(evaluation.rule.ruleId);
        }
      }
    }
    return { failed: failed.sort(), passed };
  }

  /**
   * RED-FIRST, run every time rather than recorded once. The s168/s169 rule surface
   * evaluated against the PRE-m03 token values must name the failures m03 fixed — and the
   * remaining rules in that same run must PASS, which proves that historical control was
   * wired and resolving. s178's fifth group has its own fixture-backed proof above, so a
   * later group cannot rewrite what this older proof means.
   *
   * No skip branch (s169 m01): a missing fixture now throws. See `cellAtRevision`.
   */
  it('RED-first: the same rules name the pre-m03 failures, while the rest pass in that run', () => {
    const { failed, passed } = sweepRevision('e5f2172', (ruleId) => !isStatusOnPanelRuleId(ruleId) && !isAccentStatusRuleId(ruleId) && !isS222RuleId(ruleId));

    // Named, not counted: a count-only assertion cannot tell a contrast failure from a
    // resolution error, and both surface as `passed: false`.
    //
    // EIGHT as of s169 m01, five before it. The first five are the failures m03 fixed —
    // and the fifth of those, `brand-b-dark-on-interactive-pressed`, was itself missed by
    // the s168 memo's sweep, which covered the BASE cells only. The last three are the
    // `text.accent`-on-panel failures that only became visible once s169 m01 completed the
    // text × panel grid; measured against these same pre-m03 bytes they are 4.2714 (A/base
    // on subtle), 4.0983 (B/base on raised) and 3.6502 (B/base on subtle). They were
    // failing all along — nothing was grading them.
    expect(failed).toEqual(
      [
        'brand-a-base-on-interactive-default',
        'brand-a-base-text-accent-on-subtle',
        'brand-b-base-on-interactive-default',
        'brand-b-base-status-warning-icon',
        'brand-b-base-text-accent-on-canvas',
        'brand-b-base-text-accent-on-raised',
        'brand-b-base-text-accent-on-subtle',
        'brand-b-dark-on-interactive-pressed',
      ].sort(),
    );
    // ...and the other N−8 passed in the SAME run, proving they resolved.
    expect(passed).toBe(PRE_F4_PAIR_COUNT * 4 - failed.length);
    expect(passed).toBeGreaterThan(0);
  });

  /**
   * RED-FIRST FOR THIS MISSION'S OWN FIX (s169 m01). The proof above is about s168: it
   * pins failures a previous sprint repaired, and it would stay green whether or not THIS
   * sprint's two token moves ever landed. So it cannot be the evidence for them.
   *
   * `00ae5b3` is the tip of sprint-168 — the palette as it stood one commit before m01.
   * The widened grid evaluated against those bytes must name EXACTLY the three ratified
   * failures (measured 4.2714 / 4.2616 / 3.7956 against a 4.5 threshold) and nothing else,
   * with all 105 remaining rules passing in the same run. Both halves matter: the three
   * ids prove the fix had a target, and the 105 prove the widening did not simply break
   * everything into a red heap that happens to contain them.
   */
  it('RED-first: the widened grid names exactly the three pairs this mission fixed', () => {
    const { failed, passed } = sweepRevision('00ae5b3', (ruleId) => !isStatusOnPanelRuleId(ruleId) && !isAccentStatusRuleId(ruleId) && !isS222RuleId(ruleId));

    expect(failed).toEqual(
      [
        'brand-a-base-text-accent-on-subtle',
        'brand-b-base-text-accent-on-raised',
        'brand-b-base-text-accent-on-subtle',
      ].sort(),
    );
    expect(passed).toBe(PRE_F4_PAIR_COUNT * 4 - failed.length);
    // The five grid templates s169 m01 added are what made those three visible: before the
    // widening this same revision graded 88 rules and reported ZERO failures.
    expect(passed).toBe(105);
  });

  /**
   * THE RATIFIED SOURCE PALETTE CONTAINS AN AA DEFECT — pinned, because the sprint memo
   * recorded the opposite and a critic lens that said otherwise was marked "refuted".
   *
   * `brand.css`'s hand-authored brand-A dark palette (the copy that has been shipping, and
   * the one this sprint transcribed into the token source) pairs a NEAR-WHITE foreground
   * with an interaction ramp that BRIGHTENS — L 0.52 → 0.57 → 0.62 — so contrast FALLS as
   * the user interacts. The teal palette it replaced paired near-BLACK text with the same
   * brightening direction, so contrast rose there and the defect had no precedent.
   *
   * Two pairs in the ratified copy miss AA. m03 fixed them by capping the ramp. This test
   * pins WHY those two token values differ from the ratified source, so a future
   * "transcribe brand.css faithfully" pass cannot silently restore the defect.
   */
  it('the ratified brand.css dark ramp fails AA on hover and pressed (why m03 deviates from it)', () => {
    /**
     * FROZEN LITERALS, BY DESIGN — a disclosed exception to the no-hard-pinned-oklch rule.
     *
     * These five values are the sprint-168-ratified brand.css dark ramp. s169 m05 DELETED
     * the source they were transcribed from (69 unreferenced `--brandX-*` primitives came
     * out of brand.css), so there is no longer a live file to derive them from — and that
     * is exactly why they stay written out here rather than being read from somewhere.
     * This test's whole subject is a palette that no longer exists; a "derive it from the
     * source" version of it would be a test with no subject.
     *
     * The only other tracked home of these bytes is the historical drift record at
     * `artifacts/tokens/brand-css-drift-s167.md:102-103`. If a future pass ever needs to
     * re-establish provenance, that file and this test are the two places to look.
     */
    const RATIFIED_NEAR_WHITE = 'oklch(0.97 0.01 95)';
    const RATIFIED_RAMP = {
      'surface.interactive.primary.default': 'oklch(0.52 0.2 45)',
      'surface.interactive.primary.hover': 'oklch(0.57 0.21 45)',
      'surface.interactive.primary.pressed': 'oklch(0.62 0.22 45)',
    } as const;

    const tokens: FlatTokenMap = { [brandFlatKey('A', 'text.onInteractive')]: { value: RATIFIED_NEAR_WHITE } };
    for (const [tokenPath, value] of Object.entries(RATIFIED_RAMP)) {
      tokens[brandFlatKey('A', tokenPath)] = { value };
    }

    const rules = buildBrandContrastRules('A', 'dark').filter((rule) => rule.ruleId.includes('on-interactive'));
    const byId = new Map(evaluateContrastRules(tokens, { rules }).map((e) => [e.rule.ruleId, e]));

    expect(byId.get('brand-a-dark-on-interactive-default')!.passed, 'default state').toBe(true);
    expect(byId.get('brand-a-dark-on-interactive-hover')!.passed, 'ratified hover should FAIL AA').toBe(false);
    expect(byId.get('brand-a-dark-on-interactive-pressed')!.passed, 'ratified pressed should FAIL AA').toBe(false);
    // Contrast falls monotonically as the ramp brightens — the structural cause.
    expect(byId.get('brand-a-dark-on-interactive-hover')!.ratio).toBeLessThan(
      byId.get('brand-a-dark-on-interactive-default')!.ratio,
    );
    expect(byId.get('brand-a-dark-on-interactive-pressed')!.ratio).toBeLessThan(
      byId.get('brand-a-dark-on-interactive-hover')!.ratio,
    );
  });

  /**
   * COVERAGE. Hand-listed rules are how s167 ended up with slots in the artifact that no
   * rule named. Every bridged slot that carries a source-gradeable foreground or background
   * role must be reachable from the pair templates, so a newly bridged slot arrives graded
   * or reds here.
   */
  it('every gradeable bridged slot is named by at least one rule', () => {
    const bridge = readFileSync(path.resolve(repoRoot, 'packages/tokens/scripts/brand-bridge.mjs'), 'utf8');
    const bridged = [...bridge.matchAll(/tokenPath:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(bridged.length, 'the bridge slot map stopped parsing').toBeGreaterThan(30);

    const named = new Set(BRAND_CONTRAST_PAIRS.flatMap((pair) => [pair.foreground, pair.background]));
    // Focus colours are contrast-bearing, but not against one fixed source token: the dual
    // ring and focus text are painted on component-specific surfaces. Grade them in rendered
    // context; their six-cell source values and generated output are pinned by the token
    // contract/browser-proof suites. Listing the exact three here keeps that exception
    // deliberate without letting an unrelated new bridge slot escape this coverage gate.
    const CONTEXTUAL_FOCUS_SLOTS = new Set([
      'focus.ring.outer', 'focus.ring.inner', 'focus.text',
    ]);
    // Slots with no contrast role of their own: a scrim, decorative borders, and the
    // WCAG-1.4.3-exempt disabled pair (whose ratio is pinned by brand-description-truth).
    const NO_CONTRAST_ROLE = new Set([
      'surface.backdrop', 'surface.disabled', 'text.disabled',
      'border.subtle', 'border.strong',
      ...['info', 'success', 'warning', 'critical', 'neutral', 'accent'].map((s) => `status.${s}.border`),
    ]);
    const ungraded = bridged.filter(
      (slot) => !named.has(slot) && !CONTEXTUAL_FOCUS_SLOTS.has(slot) && !NO_CONTRAST_ROLE.has(slot),
    );
    expect(
      ungraded,
      `these bridged slots are graded by no rule and are not declared role-free:\n  ${ungraded.join('\n  ')}`,
    ).toEqual([]);
  });
});
