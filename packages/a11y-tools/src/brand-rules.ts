import type { ContrastRule } from './types.js';

/**
 * s168 m04 — contrast rules for the brand × theme cells.
 *
 * ── WHY THIS IS A SEPARATE EXPORT AND NOT AN EXTENSION OF `DEFAULT_CONTRAST_RULES` ──
 * `DEFAULT_CONTRAST_RULES` is shared by three consumers across TWO different token
 * sources. `testing/a11y/contrast.spec.ts` evaluates it against `flatTokens` from
 * `@oods/tokens` (which carries brand keys), while `packages/mcp-server/src/tools/
 * a11y.scan.ts` and `src/a11y/validate-contrast.ts` evaluate it against
 * `artifacts/structured-data/oods-tokens-2026-03-06.json`, which carries NONE. Adding a
 * brand rule to the shared constant makes `resolveFlatToken` throw for those two;
 * `evaluate.ts` catches the throw and returns `passed: false`, so they would go
 * PERMANENTLY red — and a committed mcp-server contract test asserting zero issues
 * against a brand-free fixture would break with them. Hence: a separate rule set,
 * evaluated only against a brand-bearing map.
 *
 * ── WHAT `a11y.scan` DOES AND DOES NOT GRADE, STATED PLAINLY ──
 * Unchanged by this mission. `a11y.scan` grades the reference/theme/system/component/view
 * layers of the structured-data artifact and grades NO brand cell, because that artifact
 * contains no brand token. Brand grading runs in the `guardrails` vitest project against
 * the brand token sources. An MCP consumer calling `a11y.scan` is therefore NOT receiving
 * a brand verdict, and should not read one into it.
 *
 * ── DIVISION OF RESPONSIBILITY WITH THE OTHER TWO GRADERS ──
 *   • `DEFAULT_CONTRAST_RULES`  — non-brand layers, two token sources. Untouched.
 *   • `scanBrandContrast` (mcp-server `dashboard.render.html.ts`) — grades the FOUR pairs
 *     the HTML export actually paints, over already-RESOLVED hexes, for brand A base only,
 *     as an output-time check on one artifact. It is a RENDER-TIME check on what one
 *     exporter emits.
 *   • `brandContrastRules` (here) — grades the token SOURCE, every brand × theme cell,
 *     at build time. It is a SOURCE check on what the palette declares.
 * They overlap on brand A base but answer different questions, so neither replaces the
 * other. A third grader was not added; this is the second, and `scanBrandContrast` keeps
 * its narrower render-time job.
 *
 * ── KEY-STRING TRAP (hit live during planning) ──
 * `normalizeTokenExpression` lowercases and maps `.` and `/` to `-`, so the natural
 * dotted form `brand.A.text.onInteractive` normalises to `brand-a-text-oninteractive` —
 * A KEY THAT DOES NOT EXIST. The real flat key is `color-brand-a-text-on-interactive`.
 * A rule set written in the natural form is red for the WRONG reason, so the pair
 * templates below are expanded into the flat form, and the consuming test asserts every
 * rule's tokens RESOLVE before it asserts any ratio.
 *
 * ── hc IS EXEMPT, EXPLICITLY ──
 * Both hc cells resolve entirely to CSS system colours (`Canvas`, `CanvasText`,
 * `Highlight`, …). Those are context-dependent by design — the user agent supplies the
 * actual colour — so no static ratio exists to grade. Measured: an hc cell yields ZERO
 * resolvable pairs. Generating rules for it would produce evaluations that fail on a
 * conversion error and read as contrast failures, which is worse than not grading. The
 * exemption is encoded in `BRAND_GRADED_THEMES` and asserted by the test, never silent.
 */

/** The themes a numeric ratio can be computed for. `hc` is exempt — see above. */
export const BRAND_GRADED_THEMES = ['base', 'dark'] as const;
export type BrandGradedTheme = (typeof BRAND_GRADED_THEMES)[number];

/** The reason `hc` is absent, carried next to the data so it cannot drift from it. */
export const BRAND_HC_EXEMPTION_REASON =
  'Both hc cells resolve entirely to CSS system colours (Canvas, CanvasText, Highlight, …), ' +
  'whose actual colour is supplied by the user agent. No static contrast ratio exists to grade.';

export interface BrandContrastPair {
  /** Stable id fragment; the generated ruleId is `brand-<brand>-<theme>-<id>`. */
  readonly id: string;
  /** Token path under `color.brand.<X>.`, e.g. `text.primary`. */
  readonly foreground: string;
  readonly background: string;
  readonly threshold: number;
  readonly summary: string;
  /**
   * s222-m01: a theme the pair is not graded in, with the reason. Only the focus ring on the primary fill uses it: in hc
   * the fill is the platform's Highlight and the ring CanvasText, whose contrast the platform decides, and the ring sits
   * outside a 2px Canvas gap, so it never touches the fill.
   */
  readonly exempt?: { readonly theme: 'hc'; readonly reason: string };
}

/**
 * The semantic pairs, declared ONCE and expanded across every brand × graded theme.
 *
 * ── THE TEXT × PANEL GRID IS COMPLETE (s169 m01) ──
 * The first four entry groups are the full cross-product of the four body text roles
 * (`primary`, `secondary`, `muted`, `accent`) against the three panel surfaces a page
 * actually stacks (`canvas`, `raised`, `subtle`) — 12 pairs. s168 shipped 7 of those 12,
 * chosen one at a time; the five that were missing were not deliberate exemptions, they
 * were simply never written down, and three of them turned out to FAIL. A grid is
 * declared as a grid so a gap cannot be a silent judgement call.
 *
 * `text.disabled` on `surface.disabled` is deliberately ABSENT: WCAG 1.4.3 exempts
 * inactive components from any contrast requirement, and the low contrast IS the disabled
 * affordance. Its measured ratio is asserted by `brand-description-truth.spec.ts` instead,
 * so the number is still pinned — it is simply not graded against a threshold it was
 * never required to meet.
 *
 * ── STATUS FOREGROUNDS ON PANEL SURFACES ARE THE FIFTH PAIR GROUP (s178 m03) ──
 * The grid now also pairs every status text/icon role with canvas, raised, and subtle. The
 * earlier exclusion was based on current components painting those roles only on their own
 * status surface. F4 (PS-2026-08-25-004) overturns that boundary: brand tokens are an
 * advertised design-system surface, so a consumer may compose a status foreground directly
 * on a panel even before this repo does. Grading the composition before a consumer paints it
 * is the generate-and-certify posture; absence of a current component is not an exemption.
 *
 * The pre-change sweep measured 7 failures among 60 icon candidates and none among 60 text
 * candidates; all dark candidates passed. Four base icon values (A/B success + warning) were
 * re-authored by lowering lightness only. Distinct status identity and interaction ramps stay
 * parked: this group changes neither hue/chroma nor any other status token.
 */
/**
 * The status families every status pair group covers. s206-m04: `accent` joins the five. Sprint 206 m01 generated an
 * accent status family for every brand scope (surface, border, text, icon) and bridged its four slots, but no rule
 * graded them, and the guardrails suite that would have said so ran in no gate.
 */
export const BRAND_STATUS_FAMILIES = ['info', 'success', 'warning', 'critical', 'neutral', 'accent'] as const;

export const BRAND_CONTRAST_PAIRS: readonly BrandContrastPair[] = Object.freeze([
  // 1. Body text × page panels.
  { id: 'text-primary-on-canvas', foreground: 'text.primary', background: 'surface.canvas', threshold: 4.5, summary: 'Primary text on the brand canvas.' },
  { id: 'text-primary-on-raised', foreground: 'text.primary', background: 'surface.raised', threshold: 4.5, summary: 'Primary text on a raised brand surface.' },
  { id: 'text-primary-on-subtle', foreground: 'text.primary', background: 'surface.subtle', threshold: 4.5, summary: 'Primary text on a subtle brand surface.' },
  { id: 'text-secondary-on-canvas', foreground: 'text.secondary', background: 'surface.canvas', threshold: 4.5, summary: 'Secondary text on the brand canvas.' },
  { id: 'text-secondary-on-raised', foreground: 'text.secondary', background: 'surface.raised', threshold: 4.5, summary: 'Secondary text on a raised brand surface.' },
  { id: 'text-secondary-on-subtle', foreground: 'text.secondary', background: 'surface.subtle', threshold: 4.5, summary: 'Secondary text on a subtle brand surface.' },
  { id: 'text-muted-on-canvas', foreground: 'text.muted', background: 'surface.canvas', threshold: 4.5, summary: 'Muted text on the brand canvas.' },
  { id: 'text-muted-on-raised', foreground: 'text.muted', background: 'surface.raised', threshold: 4.5, summary: 'Muted text on a raised brand surface.' },
  { id: 'text-muted-on-subtle', foreground: 'text.muted', background: 'surface.subtle', threshold: 4.5, summary: 'Muted text on a subtle brand surface.' },
  { id: 'text-accent-on-canvas', foreground: 'text.accent', background: 'surface.canvas', threshold: 4.5, summary: 'Accent text on the brand canvas.' },
  { id: 'text-accent-on-raised', foreground: 'text.accent', background: 'surface.raised', threshold: 4.5, summary: 'Accent text on a raised brand surface.' },
  { id: 'text-accent-on-subtle', foreground: 'text.accent', background: 'surface.subtle', threshold: 4.5, summary: 'Accent text on a subtle brand surface.' },
  // 2. Inverse text on its semantic surface.
  { id: 'text-inverse-on-inverse', foreground: 'text.inverse', background: 'surface.inverse', threshold: 4.5, summary: 'Inverse text on the inverse brand surface.' },
  // 3. Interactive text across its state ramp.
  { id: 'on-interactive-default', foreground: 'text.onInteractive', background: 'surface.interactive.primary.default', threshold: 4.5, summary: 'Foreground on the primary interactive surface.' },
  { id: 'on-interactive-hover', foreground: 'text.onInteractive', background: 'surface.interactive.primary.hover', threshold: 4.5, summary: 'Foreground on the hovered interactive surface.' },
  { id: 'on-interactive-pressed', foreground: 'text.onInteractive', background: 'surface.interactive.primary.pressed', threshold: 4.5, summary: 'Foreground on the pressed interactive surface.' },
  // 4. Accent/status foregrounds on their own semantic surfaces.
  { id: 'accent-text-on-accent-bg', foreground: 'accent.text', background: 'accent.background', threshold: 4.5, summary: 'Accent text on the accent background panel.' },
  ...BRAND_STATUS_FAMILIES.flatMap((status) => [
    { id: `status-${status}-text`, foreground: `status.${status}.text`, background: `status.${status}.surface`, threshold: 4.5, summary: `${status} status text on its own surface.` },
    { id: `status-${status}-icon`, foreground: `status.${status}.icon`, background: `status.${status}.surface`, threshold: 3, summary: `${status} status icon on its own surface (non-text 3:1).` },
  ]),
  // 5. Status foregrounds × page panels (F4).
  ...BRAND_STATUS_FAMILIES.flatMap((status) =>
    (['canvas', 'raised', 'subtle'] as const).flatMap((panel) => [
      { id: `status-${status}-text-on-${panel}`, foreground: `status.${status}.text`, background: `surface.${panel}`, threshold: 4.5, summary: `${status} status text on the brand ${panel} panel.` },
      { id: `status-${status}-icon-on-${panel}`, foreground: `status.${status}.icon`, background: `surface.${panel}`, threshold: 3, summary: `${status} status icon on the brand ${panel} panel (non-text 3:1).` },
    ]),
  ),
  // 6. s222-m01 (#2502 ruling 7): what identifies a control. Its border (input, select, checkbox, outline button), at
  // rest and hovered, reaches 3:1 on the canvas and the raised panel controls sit on; the focus ring reaches 3:1 on the
  // canvas, on a raised panel (the Sprint 192 promise) and on the primary fill. Dividers and card edges (border.subtle, border.strong) stay exempt: they separate
  // content and identify no control.
  ...(['canvas', 'raised'] as const).flatMap((panel) => [
    { id: `border-interactive-on-${panel}`, foreground: 'border.interactive', background: `surface.${panel}`, threshold: 3, summary: `A control's border on the brand ${panel} panel (non-text 3:1).` },
    { id: `border-interactive-hover-on-${panel}`, foreground: 'border.interactiveHover', background: `surface.${panel}`, threshold: 3, summary: `A hovered control's border on the brand ${panel} panel (non-text 3:1).` },
  ]),
  { id: 'focus-ring-on-canvas', foreground: 'focus.ring.outer', background: 'surface.canvas', threshold: 3, summary: 'The focus ring on the brand canvas (non-text 3:1).' },
  { id: 'focus-ring-on-raised', foreground: 'focus.ring.outer', background: 'surface.raised', threshold: 3, summary: 'The focus ring on a raised panel, a card (non-text 3:1).' },
  {
    id: 'focus-ring-on-primary', foreground: 'focus.ring.outer', background: 'surface.interactive.primary.default', threshold: 3,
    summary: 'The focus ring against the primary fill (non-text 3:1).',
    exempt: { theme: 'hc', reason: 'In high contrast the primary fill is the platform\'s Highlight and the ring CanvasText, a pairing the platform decides; the ring sits outside a 2px Canvas gap, so it never touches the fill.' },
  },
  // 7. Text on the secondary and destructive actions, across their states.
  ...(['default', 'hover', 'pressed'] as const).flatMap((state) => [
    { id: `text-on-secondary-${state}`, foreground: 'text.primary', background: `surface.interactive.secondary.${state}`, threshold: 4.5, summary: `Text on the ${state === 'default' ? 'resting' : state} secondary action.` },
    { id: `on-destructive-${state}`, foreground: 'text.onDestructive', background: `surface.interactive.destructive.${state}`, threshold: 4.5, summary: `Text on the ${state === 'default' ? 'resting' : state} destructive action.` },
  ]),
  // 8. Text on each solid status fill (a solid badge or banner).
  ...BRAND_STATUS_FAMILIES.map((status) => (
    { id: `status-${status}-on-solid`, foreground: `status.${status}.onSolid`, background: `status.${status}.solid`, threshold: 4.5, summary: `Text on the solid ${status} fill.` }
  )),
]);

/**
 * s224-m01 (#2542 ruling 5; the website's I58): the chart marks a brand paints on its canvas. The one-series colour and
 * the six categorical series identify data, so each reaches 3:1 on the canvas (non-text). brand.intake grades them beside
 * the pairs above, in every theme. A separate list, not part of BRAND_CONTRAST_PAIRS: the build's guardrails, the claims
 * and the guides count that list, and a recipe's charts (brands A and B included) hold 3:1 on its canvas by construction
 * (@oods/tokens recipe.mjs vizPalette).
 */
export const BRAND_CHART_PAIRS: readonly BrandContrastPair[] = Object.freeze([
  { id: 'chart-mark-single-on-canvas', foreground: 'viz.mark.single', background: 'surface.canvas', threshold: 3, summary: 'The colour of a one-series chart on the brand canvas (non-text 3:1).' },
  ...(['01', '02', '03', '04', '05', '06'] as const).map((step) => (
    { id: `chart-series-${step}-on-canvas`, foreground: `viz.scale.categorical.${step}`, background: 'surface.canvas', threshold: 3, summary: `Chart series ${Number(step)} of 6 on the brand canvas (non-text 3:1).` }
  )),
]);

/** `text.primary` → `color-brand-a-text-primary`: the flat key the evaluator resolves. */
export function brandFlatKey(brand: string, tokenPath: string): string {
  const kebab = tokenPath
    .split('.')
    .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
    .join('-');
  return `color-brand-${brand.toLowerCase()}-${kebab}`;
}

/**
 * Expand the pair templates into concrete rules for one brand × theme cell.
 *
 * GENERATED, not hand-listed, on purpose: hand-listing is exactly how s167 ended up with
 * slots present in the artifact that no rule named. The consuming test additionally
 * asserts that every bridged text/icon and surface slot is reachable from these pairs, so
 * a newly bridged slot arrives with grading attached or the build fails.
 * s224-m01: `pairs` defaults to BRAND_CONTRAST_PAIRS; brand.intake also passes BRAND_CHART_PAIRS.
 */
export function buildBrandContrastRules(brand: string, theme: BrandGradedTheme, pairs: readonly BrandContrastPair[] = BRAND_CONTRAST_PAIRS): ContrastRule[] {
  return pairs.map((pair) => ({
    ruleId: `brand-${brand.toLowerCase()}-${theme}-${pair.id}`,
    target: `brand ${brand}/${theme}: ${pair.foreground} on ${pair.background}`,
    foreground: brandFlatKey(brand, pair.foreground),
    background: brandFlatKey(brand, pair.background),
    threshold: pair.threshold,
    summary: `${pair.summary} (brand ${brand}, ${theme})`,
  }));
}

/**
 * Every rule for every graded cell of the given brands — the full brand grading surface. s213-m04: the brands are the
 * brand registry's (packages/tokens/scripts/brand-registry.cjs), passed in, so a brand added to the brands folder is
 * graded with no edit here.
 */
export function brandContrastRules(brands: readonly string[]): ReadonlyArray<ContrastRule> {
  return Object.freeze(brands.flatMap((brand) => BRAND_GRADED_THEMES.flatMap((theme) => buildBrandContrastRules(brand, theme))));
}
