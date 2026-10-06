// certify contrast pillar — the RENDERED-REALITY contrast engine (s137 m02; s138 m03;
// s139 m02; s176 m01 render-backed).
//
// certify grades the categorical series paints of the RENDERED cartesian chart, against
// the canvas, per the memo §2/§3/§3a rule set. As of s139 it read the color hexes off the
// COMPILED spec's emitted bytes (scale.range for a multi-series color channel, mark.color
// for a single-series chart) rather than re-classifying the raw IR. As of s140 it grades
// EVERY rendered unit — walking all layers / the facet spec / every concat section — and
// combines them worst-verdict, so a color-bearing mark that is not the first layer can
// no longer be masked by a passing sibling (the s139-review C1 false-'pass'). As of s176
// the graded object is the rendered SERIES-TO-PAINT ASSIGNMENT: the compiled spec is
// rendered through @oods/viz-render (the same emitter the live dashboard path uses) and
// the paints the data marks actually carry are graded, with DUPLICATES RETAINED across
// the consumed series. That closes the palette-recycling hole the compiled-bytes read
// could not see: a 10-series chart over a six-hex domainless baked range renders series
// 7–10 in the same paints as series 1–4 (Vega recycles by index), and a recycled pair is
// ΔE00 = 0 — an automatic role-A fail. Grading the DISTINCT baked hexes (pre-s176,
// sliced to a 6-slot cap) could never contain that pair: the distinct palette is
// mutually distinguishable by construction while the rendered assignment is not.
// It evaluates three roles:
//
//   role-C (WCAG 1.4.11 NORMATIVE) — every consumed mark >= 3:1 vs the canvas.
//   role-A (best-practice)         — min-pairwise CIEDE2000 (min over normal +
//                                     deuteran/protan/tritan Machado CVD) across the
//                                     rendered series-to-paint assignment, duplicates
//                                     retained. <2 fail (a recycled pair is 0); 2-10 pass
//                                     with a distinguishability warn; >=10 clean pass.
//   role-B (WCAG-EXEMPT)           — a continuous/default color channel without a
//                                     categorical palette (a sequential/diverging gradient,
//                                     or a divergence/mistype compiled quantitative)
//                                     is the essential-exception gradient -> 'exempt'.
//                                     Classified from the COMPILED spec, BEFORE any
//                                     rendered-paint logic runs (s176 D5).
//
// WHY grade the render (s176): the compiled scale.range is the palette Forge CHOSE, not
// the assignment Vega PAINTS. The two diverge exactly when consumed cardinality exceeds
// the palette — the case the pre-s176 cardinality slice silently capped away. The
// rendered assignment is read from the emitter's SVG (deterministic: pinned text
// metrics, normalized auto-ids), and only paints that match what the unit BAKED are
// graded — an author decoration painted in a palette hex cannot fake a collision, and a
// non-palette decoration stays chrome (the CASE-2 fork, generalized). The
// requested CSS scope supplies the canvas and palette, matching the compiled render.

import Color from 'colorjs.io';
import { contrastRatio, normaliseColor } from '@oods/a11y-tools';
import {
  getVizScaleTokens,
  resolveSingleSeriesColor,
  SINGLE_SERIES_TOKEN,
  resolveTokenToColor,
  type NormalizedVizSpec,
  type TokenScope,
  type VegaLiteAdapterSpec,
} from '@oods/viz-core';
import { renderVegaLiteToSvg, type VegaLiteSpec } from '@oods/viz-render';
import { CVD_TYPES, simulateCvd } from './cvd-machado.js';

// 'ungradeable' (s175 m04, #781): grading was ATTEMPTED on a colour-bearing unit and failed
// for a reason outside the spec — an unresolvable canvas token, an unreadable render, or an
// evaluator fault. 'unchecked' is the OTHER flavour: nothing was attempted or nothing was
// gradeable (no colour-bearing unit, or no gradeable series paint after the chrome fork).
// The fold treats 'ungradeable' like 'fail'; 'unchecked' stays inert.
export type ContrastVerdict = 'pass' | 'fail' | 'ungradeable' | 'unchecked' | 'exempt';

export interface ContrastPillarResult {
  readonly contrast: ContrastVerdict;
  /** Internal: a structural failure cannot claim a completed contrast measurement. */
  readonly contrastMeasured?: false;
  /** The rendered-contrast caveat (pass/fail) or the role-specific rationale. */
  readonly contrastNote?: string;
  /**
   * The SVG the pillar rendered, present EXACTLY when the render happened (>= 1 series
   * unit). An internal reuse seam (s176 m02): artifact.certify hashes it as the FIRST
   * half of the double-render determinism proof — the "KEEP the second call" discipline,
   * render edition — then drops it. Never serialized to the wire.
   */
  readonly renderedSvg?: string;
}

// The requested CSS scope supplies the role-C reference canvas.
const CANVAS_TOKEN = '--oods-sys-surface-canvas';

// OODS viz-scale categorical token names, for the failure-note labels. (The pre-s176
// CATEGORICAL_SLOTS cap died with the cardinality slice: the graded object is the
// rendered assignment now, so there is no slot ceiling to clamp to — an agent-supplied
// range longer than 6 slots is fully graded, a declared s176 coverage expansion.)
const categoricalToken = (slot1: number): string =>
  `--oods-viz-scale-categorical-${String(slot1).padStart(2, '0')}`;

// Role thresholds (memo §2/§3a).
const ROLE_C_MIN_RATIO = 3; // WCAG 1.4.11 non-text contrast (mark vs background)
const ROLE_A_FAIL_DELTA_E = 2; // < 2 -> indistinguishable -> fail (a recycled pair is 0)
const ROLE_A_CLEAN_DELTA_E = 10; // >= 10 -> clean pass; 2-10 -> pass + warn note
// Role-A "reads-as-gray" chroma floor (s146 F2). A slot whose OKLCH chroma is below this
// is not a real categorical hue — it reads as gray, so the ΔE distance check below would be
// a misleading pass. The s146 F1 re-space put EVERY default slot at chroma >= 0.045 (the
// co-designed margin above this floor — memo §2.2), so this fires on NOTHING for the default
// palette = a permanent zero-flip guardrail; it DOES fire on a low-chroma config.tokens
// override an agent supplies (a gray "palette" -> honest fail, the real value on agent input).
const ROLE_A_CHROMA_FLOOR = 0.03;

/** Internal render-backed grading detail used by the ECharts carrier/semantic split. */
export interface CategoricalRoleCGrade {
  readonly verdict: 'pass' | 'fail' | 'ungradeable';
  readonly minimumRatio?: number;
  readonly failingPaints: readonly string[];
}

/** Internal render-backed grading detail used by the ECharts carrier/semantic split. */
export interface CategoricalRoleAGrade {
  readonly verdict: 'pass' | 'fail' | 'ungradeable';
  readonly minimumDeltaE?: number;
  readonly lowChromaPaints: readonly string[];
}

// Render-backed and spec-only evidence remain distinct. s190 scopes both paths;
// the literal caveat pin declares the scope wording change without moving old fixtures.
const RENDERED_CONTRAST_CAVEAT =
  'certify grades the series-to-paint assignment of the rendered chart (the compiled ' +
  'spec rendered through @oods/viz-render), against the requested CSS scope canvas.';

// Spec-only calls grade a reconstructed palette, never rendered carriers.
const BAKED_CONTRAST_CAVEAT =
  'certify measures the categorical color bytes OODS Foundry baked into the compiled spec, ' +
  'against the requested CSS scope canvas; no rendered carrier measurement is claimed.';

// A continuous/default color channel exists but the adapter baked NO categorical
// palette: the chart renders as a continuous/default color
// scale — a legit sequential/diverging gradient, OR a divergence/mistype (a color
// binding the bake gate left quantitative). Either way there is no discrete palette to
// contrast-check, so WCAG 1.4.11's essential exception applies (memo §3 case 3 / fork A).
// Classified from the compiled spec before render logic; no canvas ratio is graded.
const NO_RATIO_CAVEAT = 'No categorical canvas ratio is graded for this scope.';
const EXEMPT_NOTE =
  'No OODS categorical palette was baked into the compiled color scale — the chart renders ' +
  'as a continuous/default color scale (WCAG 1.4.11 gradient essential exception); ' +
  "OODS Foundry's generated accessible data table is the guarantee. " + NO_RATIO_CAVEAT;
const MISSING_CATEGORICAL_PALETTE_NOTE =
  'Categorical color encoding is missing its baked palette; the renderer default cannot ' +
  'establish categorical contrast conformance. No categorical canvas ratio is graded ' +
  'for the missing-palette unit.';

function distinctCount(values: Array<Record<string, unknown>> | undefined, field: string): number {
  if (!values || values.length === 0) return 0;
  const seen = new Set<string>();
  for (const row of values) {
    const v = row[field];
    if (v !== undefined && v !== null) seen.add(String(v));
  }
  return seen.size;
}

/** config.tokens overrides, keyed by the `--`-prefixed token name. */
function overrideMap(spec: NormalizedVizSpec): Map<string, string> {
  const out = new Map<string, string>();
  const tokens = spec.config?.tokens;
  if (!tokens) return out;
  for (const [k, v] of Object.entries(tokens)) {
    if (typeof v !== 'string') continue; // numeric overrides are not colors
    out.set(k.startsWith('--') ? k : `--${k}`, v);
  }
  return out;
}

/** Resolve a token to hex, honoring an agent config.tokens override; undefined if unresolvable. */
function resolveSlotHex(token: string, overrides: Map<string, string>, scope: TokenScope = {}): string | undefined {
  const raw = overrides.get(token) ?? resolveTokenToColor(token, scope);
  if (!raw) return undefined;
  try {
    return normaliseColor(raw, token); // rgb()/oklch->hex bridge (throws on non-color)
  } catch {
    return undefined;
  }
}

function deltaE2000(aHex: string, bHex: string): number {
  return new Color(aHex).deltaE(new Color(bHex), '2000');
}

/** OKLCH chroma of a resolved hex — the s146 F2 "reads-as-gray" measure. Pure fn of the hex. */
function chromaOf(hex: string): number {
  return new Color(hex).oklch[1];
}

/** min over all pairs of min-over-CVD CIEDE2000 — the cols4all categorical metric. */
function minPairwiseDeltaEOverCvd(hexes: readonly string[]): number {
  let min = Infinity;
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      let d = deltaE2000(hexes[i], hexes[j]);
      for (const type of CVD_TYPES) {
        d = Math.min(d, deltaE2000(simulateCvd(hexes[i], type), simulateCvd(hexes[j], type)));
      }
      min = Math.min(min, d);
    }
  }
  return min;
}

/**
 * Grade the paints carried by actual rendered geometry against the requested CSS
 * ECharts canvas. This is deliberately independent from Role A: hierarchy tints can
 * fail here without changing the semantic category assignment.
 */
export function evaluateCategoricalRoleC(
  paints: readonly string[],
  scope: TokenScope = {},
  canvas?: string,
): CategoricalRoleCGrade {
  const canvasHex = resolveSlotHex(CANVAS_TOKEN, canvas === undefined ? new Map() : new Map([[CANVAS_TOKEN, canvas]]), scope);
  if (paints.length === 0 || !canvasHex) {
    return { verdict: 'ungradeable', failingPaints: [] };
  }

  const ratios = paints.map((paint) => ({
    paint,
    ratio: contrastRatio(paint, canvasHex),
  }));
  const minimumRatio = Math.min(...ratios.map(({ ratio }) => ratio));
  const failingPaints = ratios
    .filter(({ ratio }) => ratio < ROLE_C_MIN_RATIO)
    .map(({ paint }) => paint);

  return {
    verdict: failingPaints.length > 0 ? 'fail' : 'pass',
    minimumRatio,
    failingPaints,
  };
}

/**
 * Grade the N-long semantic category-to-paint assignment. Duplicates are retained so
 * a genuine palette recycle contributes a zero-distance pair; rendered geometry
 * multiplicity never enters this function.
 */
export function evaluateCategoricalRoleA(
  assignment: readonly string[],
): CategoricalRoleAGrade {
  if (assignment.length === 0) {
    return { verdict: 'ungradeable', lowChromaPaints: [] };
  }

  const lowChromaPaints = assignment.filter(
    (paint) => chromaOf(paint) < ROLE_A_CHROMA_FLOOR,
  );
  if (lowChromaPaints.length > 0) {
    return { verdict: 'fail', lowChromaPaints };
  }

  if (assignment.length < 2) {
    return { verdict: 'pass', lowChromaPaints: [] };
  }

  const minimumDeltaE = minPairwiseDeltaEOverCvd(assignment);
  return {
    verdict: minimumDeltaE < ROLE_A_FAIL_DELTA_E ? 'fail' : 'pass',
    minimumDeltaE,
    lowChromaPaints: [],
  };
}

interface CompiledUnit {
  readonly mark?: unknown;
  readonly encoding?: Record<string, unknown>;
}

/**
 * The compiled Vega-Lite spec carries its mark + encoding at the top level
 * ({mark,encoding}), inside a layer array ({layer:[{mark,encoding},…]}), or — for a
 * faceted/concat layout — nested under `spec` / a concat container
 * (vega-lite-layout-mapper.ts). Walk to EVERY unit node (all layers, the facet spec,
 * every concat section) so the grader classifies the color bytes Forge baked into all of
 * them, never re-deriving from the IR. Grading only the first unit (pre-s140) let a
 * color-bearing mark in a non-first layer be masked by a passing sibling — the
 * s139-review C1 false-'pass'.
 *
 * A unit node (mark/encoding present) is terminal: Vega-Lite unit/layer/facet/concat
 * are mutually exclusive, so this returns without descending further. Nesting is
 * depth-2 bounded (the primitive threaded into a facet/concat is never itself a
 * facet/concat — layout is single-trait dispatch), so the recursion terminates.
 */
function compiledColorUnits(node: unknown): CompiledUnit[] {
  if (!node || typeof node !== 'object') return [];
  const rec = node as Record<string, unknown>;
  if ('mark' in rec || 'encoding' in rec) {
    return [{ mark: rec.mark, encoding: rec.encoding as Record<string, unknown> | undefined }];
  }
  const units: CompiledUnit[] = [];
  if (Array.isArray(rec.layer)) {
    for (const child of rec.layer) units.push(...compiledColorUnits(child));
  }
  if (rec.spec) units.push(...compiledColorUnits(rec.spec));
  for (const key of ['hconcat', 'vconcat', 'concat'] as const) {
    const sections = rec[key];
    if (Array.isArray(sections)) {
      for (const child of sections) units.push(...compiledColorUnits(child));
    }
  }
  return units;
}

/** Grade a slot set (role-C vs canvas, then role-A distinguishability over the full
 * list, duplicates included — a recycled assignment pair is ΔE00=0 and fails). The
 * `caveat` is the path's forked caveat sentence (D11): the render-backed one on the
 * cartesian path, the frozen pre-fork one on the ECharts paths. */
function gradeCategorical(
  slots: ReadonlyArray<{ readonly token: string; readonly hex: string }>,
  canvasHex: string | undefined,
  caveat: string,
): ContrastPillarResult {
  // Could not resolve the canvas -> 'ungradeable' (s175 m04, #781): a colour-bearing unit
  // WAS identified and grading was attempted, so this is "tried and failed", never the
  // nothing-to-grade 'unchecked' and never a silent pass. (The slots.length === 0 arm is
  // unreachable — every caller passes >= 1 slot — and is kept only as a guard.)
  if (slots.length === 0 || !canvasHex) {
    return {
      contrast: 'ungradeable',
      contrastNote: 'Could not resolve the canvas token for this IR. ' + caveat,
    };
  }

  // Role C (WCAG-normative): every consumed mark >= 3:1 vs the canvas.
  const roleCFailures = slots.filter((s) => contrastRatio(s.hex, canvasHex) < ROLE_C_MIN_RATIO);
  if (roleCFailures.length > 0) {
    const which = [...new Set(roleCFailures.map((s) => s.token))].join(', ');
    return {
      contrast: 'fail',
      contrastNote:
        `Role-C (WCAG 1.4.11) fail: ${which} below ${ROLE_C_MIN_RATIO}:1 vs the canvas. ` + caveat,
    };
  }

  // Role A chroma floor (s146 F2): a slot whose OKLCH chroma is below the floor reads as
  // gray — not a real categorical hue — so the ΔE distinguishability check below would be a
  // misleading pass. Placed AFTER the WCAG-normative role-C check and BEFORE the role-A ΔE
  // distance check (memo §3). Fires on NOTHING for the default palette (F1 re-chromatized
  // every slot >= 0.045) but catches a gray config.tokens override (reads-as-gray -> fail).
  const grayFailures = slots.filter((s) => chromaOf(s.hex) < ROLE_A_CHROMA_FLOOR);
  if (grayFailures.length > 0) {
    const which = [...new Set(grayFailures.map((s) => s.token))].join(', ');
    return {
      contrast: 'fail',
      contrastNote:
        `Role-A chroma-floor fail: ${which} below ${ROLE_A_CHROMA_FLOOR} OKLCH chroma — ` +
        `reads as gray, not a distinguishable categorical hue. ` + caveat,
    };
  }

  // Role A (best-practice): categorical distinguishability, min-over-CVD, over the FULL
  // slot list — duplicates retained (s176 D2), so a recycled series-to-paint pair
  // contributes ΔE00 = 0 and hits the fail floor. A single consumed slot has no pair to
  // compare -> role-A N/A.
  const roleAMin = slots.length >= 2 ? minPairwiseDeltaEOverCvd(slots.map((s) => s.hex)) : Infinity;
  if (roleAMin < ROLE_A_FAIL_DELTA_E) {
    return {
      contrast: 'fail',
      contrastNote:
        `Role-A fail: min-pairwise CIEDE2000 (min over normal + deuteran/protan/tritan CVD) = ` +
        `${roleAMin.toFixed(2)} < ${ROLE_A_FAIL_DELTA_E} — categorical series are not distinguishable. ` +
        caveat,
    };
  }
  if (roleAMin < ROLE_A_CLEAN_DELTA_E) {
    return {
      contrast: 'pass',
      contrastNote:
        `Distinguishability caution: min-pairwise CIEDE2000 (min-over-CVD) = ${roleAMin.toFixed(2)} ` +
        `(below the ${ROLE_A_CLEAN_DELTA_E} best-practice target but >= ${ROLE_A_FAIL_DELTA_E}, so not a failure). ` +
        caveat,
    };
  }
  return { contrast: 'pass', contrastNote: caveat };
}

// The worst-verdict lattice (memo §3a): higher rank wins when combining the graded
// units. fail > ungradeable > unchecked > pass > exempt; ties resolve to the first unit in
// walker document order. A graded unit returns 'ungradeable' iff the canvas is
// unresolvable — which is global (resolved once) — so graded-'ungradeable' is
// all-or-nothing and never mixes with a real pass/fail; 'unchecked' never leaves
// the per-unit grade at all (the whole-chart graded.length===0 branch below is its only
// source). This defensive ordering is provably identical to the simpler fail>pass>exempt
// on every reachable input, and a withheld canvas claim should not read as an affirmative
// pass.
const VERDICT_RANK: Record<ContrastVerdict, number> = {
  fail: 4,
  ungradeable: 3,
  unchecked: 2,
  pass: 1,
  exempt: 0,
};

// The single-series slot the adapter bakes as mark.color (memo §3 CASE 2 fork).
const SLOT1_TOKEN = SINGLE_SERIES_TOKEN;

// ─── s176 m01: compile-time unit classification + rendered-paint extraction ─────────────

/**
 * What a compiled unit IS, decided from the COMPILED SPEC ALONE (s176 D5: CASE-3
 * exemption and the CASE-2 chrome fork are classified before any rendered-paint logic
 * runs). Only 'series' units participate in render-backed grading:
 *
 *   CASE 1 (baked categorical range)          -> 'series' with the range as the match set
 *   CASE 2 (mark.color === the OODS slot-1)   -> 'series' with slot-1 as the match set
 *   CASE 2 (mark.color, NOT the OODS slot-1)  -> 'chrome' (author decoration — neutral)
 *   CASE 3 (categorical color, no palette)   -> 'missing-palette' (contrast fail)
 *   CASE 3 (continuous/default color)        -> 'exempt' (gradient essential exception)
 *   CASE 4 (no color in this unit)            -> 'chrome' (neutral)
 */
type UnitClass =
  | { readonly kind: 'series'; readonly matchSlots: ReadonlyArray<{ token: string; hex: string }>; readonly n: number }
  | { readonly kind: 'exempt' }
  | { readonly kind: 'missing-palette' }
  | { readonly kind: 'chrome' };

function classifyUnit(
  unit: CompiledUnit,
  spec: NormalizedVizSpec,
  slot1Hex: string | undefined,
): UnitClass {
  const colorEnc = unit.encoding?.color as Record<string, unknown> | undefined;
  const markColor =
    typeof (unit.mark as Record<string, unknown> | undefined)?.color === 'string'
      ? ((unit.mark as Record<string, unknown>).color as string)
      : undefined;

  const scale = colorEnc?.scale as Record<string, unknown> | undefined;
  const rangeRaw = scale?.range;
  const range =
    Array.isArray(rangeRaw) && rangeRaw.length > 0 && rangeRaw.every((h) => typeof h === 'string')
      ? (rangeRaw as string[])
      : undefined;

  // CASE 1 — categorical: the adapter baked a hex range into this unit's color scale.
  // The match set is the WHOLE baked range (positional token labels); the consumed
  // cardinality n comes from the sample data. The pre-s176 code sliced the range to
  // min(n, 6) and graded that DISTINCT set — which is exactly why a recycled assignment
  // (n > range.length) was invisible. No slice survives (D4).
  if (range) {
    const field = typeof colorEnc?.field === 'string' ? (colorEnc.field as string) : undefined;
    const n = field ? distinctCount(spec.data?.values, field) : 0;
    return {
      kind: 'series',
      matchSlots: range.map((hex, i) => ({ token: categoricalToken(i + 1), hex })),
      n,
    };
  }

  // s195-m06: absent bake is not evidence of a gradient. A compiled discrete
  // color channel must carry its categorical range even if a mark also has a
  // decorative fallback color. The physical palette-removal bite exposed the
  // previous false exemption (and conformant:true) here.
  if (colorEnc?.type === 'nominal' || colorEnc?.type === 'ordinal') {
    return { kind: 'missing-palette' };
  }

  // CASE 2 — single-series: no color channel, so the adapter baked the single-series token as
  // mark.color. A series unit ONLY when it IS the OODS series color (it equals the
  // resolved single-series token, override-aware, so a config.tokens-poisoned
  // categorical-01 still matches -> graded -> fails correctly). Compared against the same
  // SHARED resolver the adapter bakes from, so it matches the emitted bytes exactly —
  // including the non-color-override fallback to the OODS default. An author's decorative
  // mark.color (a faint reference/annotation line) is chrome (OOS per s138) -> NEUTRAL
  // skip, never a contrast fail (CASE-2 fork "grade OODS series colors only") —
  // even when its paint coincides with a palette hex, it never enters the assignment.
  if (markColor) {
    if (slot1Hex && markColor.toLowerCase() === slot1Hex.toLowerCase()) {
      return { kind: 'series', matchSlots: [{ token: SLOT1_TOKEN, hex: markColor }], n: 1 };
    }
    return { kind: 'chrome' };
  }

  // CASE 3 — a continuous/default color channel has no categorical palette (gradient,
  // or a divergence/mistype rendering on a continuous/default scale): WCAG-exempt,
  // decided here — before any render — so an interpolated ramp's rgb() fills are never
  // fed to the palette-match fold (which would silently move 'exempt' -> 'unchecked').
  if (colorEnc) {
    return { kind: 'exempt' };
  }

  // CASE 4 — no color in THIS unit: neutral chrome. A colorless unit (e.g. a plain line
  // layer beneath a color-encoded layer) must be skipped, not poison the union verdict.
  return { kind: 'chrome' };
}

// SVG structural roles: role-frame and role-scope are STRUCTURAL wrappers (the root
// frame; line/facet path groups) — treating them as chrome returns ZERO data marks for
// every chart (reproduced at planning). Chrome is excluded by ANCESTRY on these three
// roles only: axis, legend (whose swatches repeat every series paint and would
// double-count), and title.
const CHROME_ROLE = /\brole-(?:axis|legend|title)/;
const DATA_MARK_ROLE = /\brole-mark\b/;
// Drawable elements a Vega data mark renders as. Bars/areas/rects arrive as <path>
// (Vega emits geometry as paths), line series as one <path> per series, points as
// symbol <path>s; the rest are defensive coverage. Series colour rides fill (bar/area/
// rect) or stroke (line/point) — both are collected per mark (D2 fill∪stroke).
const DRAWABLE_TAG = /^(?:path|rect|circle|ellipse|line|polygon|polyline|text)$/;

interface RenderedPaints {
  /** Data-mark groups found (role-mark, no chrome ancestor). 0 = unreadable render (D6). */
  readonly markGroupCount: number;
  /** Distinct data-mark paints (fill ∪ stroke), lowercased, in first-seen document order. */
  readonly paints: ReadonlySet<string>;
}

/**
 * Extract the data-mark paints from the emitter's SVG: walk every tag with an
 * open-element stack; a <g> whose class carries role-mark with NO role-axis/role-legend/
 * role-title ancestor is a data-mark group, and every drawable inside it contributes its
 * fill and stroke. Pure string scan — no DOM.
 */
function extractRenderedPaints(svg: string): RenderedPaints {
  const paints = new Set<string>();
  let markGroupCount = 0;

  // Open-element stack entries: is this element (or an ancestor) chrome? is a data-mark
  // group open? Non-<g> containers (svg, defs) ride the stack too so depth stays honest.
  const stack: Array<{ tag: string; chrome: boolean; markGroup: boolean }> = [];
  const top = () => stack[stack.length - 1];

  const tagRe = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  for (const m of svg.matchAll(tagRe)) {
    const [, closing, rawTag, attrs, selfClosing] = m;
    const tag = rawTag.toLowerCase();

    if (closing) {
      // Pop to the matching open tag (tolerates the void elements SVG never nests oddly).
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const parentChrome = stack.length > 0 ? top().chrome : false;
    const parentMarkGroup = stack.length > 0 ? top().markGroup : false;

    const classMatch = /\bclass="([^"]*)"/.exec(attrs);
    const className = classMatch ? classMatch[1] : '';
    const chrome = parentChrome || CHROME_ROLE.test(className);
    const isDataMarkGroup = tag === 'g' && !chrome && DATA_MARK_ROLE.test(className);
    if (isDataMarkGroup) markGroupCount++;
    const markGroup = (parentMarkGroup && !chrome) || isDataMarkGroup;

    if (!chrome && parentMarkGroup && DRAWABLE_TAG.test(tag)) {
      for (const channel of ['fill', 'stroke'] as const) {
        const paint = new RegExp(`\\b${channel}="([^"]*)"`).exec(attrs)?.[1];
        if (paint && paint !== 'none' && paint !== 'transparent') paints.add(paint.toLowerCase());
      }
    }

    if (!selfClosing) stack.push({ tag, chrome, markGroup });
  }

  return { markGroupCount, paints };
}

/**
 * Build a series unit's graded slots from the paints the chart ACTUALLY rendered
 * (s176 D2): the unit's baked match set is filtered to the paints present in the SVG
 * (preserving baked order, so token labels stay positional), then the consumed series
 * are assigned over those paints by index — Vega's own recycling rule — with DUPLICATES
 * RETAINED. Consumed cardinality above the rendered-paint count therefore produces
 * repeated slots, whose pairwise ΔE00 is 0: the recycled pair reaches the grader.
 *
 * Both naive readings are rejected (D2, in writing): a deduplicated distinct-paint set
 * can never contain the recycled pair (ten series render only six distinct hexes — the
 * pre-s176 defect rebuilt); a raw per-mark fill multiset would let an author decoration
 * painted in a palette hex fake a ΔE00=0 collision and break the s139 lock — here a
 * duplicate can arise ONLY from consumed cardinality exceeding the rendered paints,
 * never from extra marks sharing a paint.
 */
function renderedAssignment(
  matchSlots: ReadonlyArray<{ token: string; hex: string }>,
  n: number,
  rendered: ReadonlySet<string>,
): Array<{ token: string; hex: string }> {
  const renderedSlots = matchSlots.filter((s) => rendered.has(s.hex.toLowerCase()));
  if (renderedSlots.length === 0) return [];
  const count = Math.max(n, 1);
  return Array.from({ length: count }, (_, i) => renderedSlots[i % renderedSlots.length]);
}

/**
 * Evaluate the contrast pillar for a (cartesian) NormalizedVizSpec IR by grading the
 * series-to-paint assignment the chart RENDERS (s176 m01): `compiled` is rendered
 * through @oods/viz-render and the data-mark paints are read from the SVG. Classification
 * (which unit is a series unit, which is exempt, which is chrome) comes from the COMPILED
 * spec alone (D5); the render decides what the series units actually painted. It grades
 * EVERY rendered unit (s140) and combines them worst-verdict (memo §3a). Deterministic:
 * the emitter pins text metrics and normalizes auto-ids, so the same IR renders the same
 * bytes. Never returns 'pass' for a chart whose compiled spec baked no OODS palette
 * (memo §3 governing rule).
 *
 * ASYNC as of s176 (the render); a render throw propagates to the caller's existing
 * catch, which degrades to 'ungradeable' + a fault note at status:'ok' (D6) — the call
 * sits inside artifact.certify's contrast try for exactly that reason. A render that
 * yields no readable data-mark groups is 'ungradeable' here directly. `spec` is retained
 * ONLY for the canvas token (config.tokens override -> role-C reference), the consumed
 * cardinality (distinctCount over spec.data.values), and the CASE-2 categorical-01 gate.
 * All graded paints come from the render; contentHash never touches it (D7).
 */
export async function evaluateContrastPillar(
  spec: NormalizedVizSpec,
  compiled: VegaLiteAdapterSpec,
  scope: TokenScope = {},
): Promise<ContrastPillarResult> {
  // Resolve the canvas + the single-series token ONCE (both are global —
  // config.tokens is chart-wide), then classify every unit from the compiled spec.
  const canvasHex = resolveSlotHex(CANVAS_TOKEN, overrideMap(spec), scope);
  const slot1Hex = resolveSingleSeriesColor(spec, scope);

  const classified = compiledColorUnits(compiled).map((unit) => classifyUnit(unit, spec, slot1Hex));
  const seriesUnits = classified.filter(
    (c): c is Extract<UnitClass, { kind: 'series' }> => c.kind === 'series',
  );

  const graded: ContrastPillarResult[] = classified
    .filter((c) => c.kind === 'exempt' || c.kind === 'missing-palette')
    .map((c) => c.kind === 'missing-palette'
      ? { contrast: 'fail', contrastNote: MISSING_CATEGORICAL_PALETTE_NOTE, contrastMeasured: false }
      : { contrast: 'exempt', contrastNote: EXEMPT_NOTE });

  // THE RENDER (s176 D1) — only when a series unit exists: an all-exempt/all-chrome
  // chart never renders (which is what keeps the decorative trio's plain/poisoned
  // byte-equality provable — the poison cannot reach a render that never happens).
  let renderedSvg: string | undefined;
  if (seriesUnits.length > 0) {
    const svg = await renderVegaLiteToSvg(compiled as unknown as VegaLiteSpec);
    renderedSvg = svg;
    const { markGroupCount, paints } = extractRenderedPaints(svg);
    if (markGroupCount === 0) {
      // Readable-render floor (D6): series units were identified but the SVG carries no
      // data-mark groups at all — grading was attempted and failed outside the spec.
      graded.push({
        contrast: 'ungradeable',
        contrastNote:
          'The rendered chart contains no readable data-mark groups to grade; the pillar ' +
          'is reported ungradeable rather than passed. ' + RENDERED_CONTRAST_CAVEAT,
      });
    } else {
      for (const unit of seriesUnits) {
        const assignment = renderedAssignment(unit.matchSlots, unit.n, paints);
        // No gradeable series paint rendered for THIS unit (e.g. an empty sample, or
        // every paint was chrome-filtered): neutral — the whole-chart 'unchecked' below
        // is the honest verdict when NO unit renders a gradeable paint (D6).
        if (assignment.length === 0) continue;
        graded.push(gradeCategorical(assignment, canvasHex, RENDERED_CONTRAST_CAVEAT));
      }
    }
  }

  // No gradeable series paint anywhere (no color-bearing unit, only author chrome, or
  // nothing rendered): honest whole-chart 'unchecked', never a silent pass. The
  // decorative #000000 bars ARE colour-bearing — it is the fork, not colour-presence,
  // that decides (D6).
  if (graded.length === 0) {
    return {
      contrast: 'unchecked',
      contrastNote:
        'No gradeable OODS series paint: the compiled spec has no color encoding or OODS ' +
        'mark color, or none of its series paints rendered — author-decorative colors are ' +
        'skipped as chrome. ' + RENDERED_CONTRAST_CAVEAT,
      ...(renderedSvg !== undefined ? { renderedSvg } : {}),
    };
  }

  // COMBINE — worst-verdict across every graded unit; ties -> first in document order.
  let worst = graded[0];
  for (let i = 1; i < graded.length; i++) {
    if (VERDICT_RANK[graded[i].contrast] > VERDICT_RANK[worst.contrast]) worst = graded[i];
  }
  return { ...worst, ...(renderedSvg !== undefined ? { renderedSvg } : {}) };
}

// ─── ECharts-primary categorical contrast (s141 m02) ────────────────────────────────
//
// The 5 ECharts-primary categorical types (treemap/sunburst/sankey/force_graph/chord)
// have NO Vega-Lite compile. On a SPEC-ONLY call certify also has no data operand from
// which to emit an ECharts option, so this fallback reconstructs the fixed default OODS
// categorical palette those adapters bake into itemStyle — from the SAME
// getVizScaleTokens('categorical') call the adapters make — and grades it with the shared
// role-C / role-A math. Operand-backed calls do not use this fallback: artifact.certify
// renders the retained projected option and grades its carrier and semantic evidence.

/**
 * Reconstruct the FIXED DEFAULT 6-slot OODS categorical palette the ECharts categorical
 * adapters bake into itemStyle, resolved to hex. Uses the SAME shared token source the
 * adapters use (`getVizScaleTokens('categorical')` → `--viz-scale-categorical-NN`,
 * resolved via the same resolveTokenToColor with the `--oods-` prefix fallback), so
 * `certified == rendered` holds by SHARED SOURCE — not by fragile prefix convergence.
 *
 * NON-override by construction (empty overrides): the 5 categorical adapters' buildPalette()
 * takes no args (config.tokens feeds only usermeta), so the grade MUST use the fixed
 * default — it deliberately does NOT call resolveCategoricalPalette(spec) (override-aware +
 * cardinality-aware), which would grade a color the ECharts render ignores (memo §3b).
 * The adapters pass count:8|9 but VIZ_CATEGORICAL_SCALE has 6 slots and the getter clamps,
 * so the count is inert — the no-arg call resolves the identical fixed 6.
 */
export function reconstructEChartsCategoricalPalette(scope: TokenScope = {}): Array<{ token: string; hex: string }> {
  const noOverrides = new Map<string, string>();
  const slots: Array<{ token: string; hex: string }> = [];
  for (const token of getVizScaleTokens('categorical')) {
    const hex = resolveSlotHex(token, noOverrides, scope);
    if (hex) slots.push({ token, hex });
  }
  return slots;
}

// The MANDATORY ECharts-categorical caveats (memo §4). The verdict is INVARIANT to the
// input IR (the palette is a compile-time constant, data-independent), so an ECharts
// categorical 'pass' is a real WCAG-1.4.11 + CVD claim about the baked palette, but a
// WEAKER claim than a cartesian 'pass' (which is override-aware + render-backed).
// Adjacency (the literal role-C′) is a frozen OOS sub-arc; per-node data-color overrides
// are ungraded. Both caveats are required on every categorical contrastNote.
// The "cardinality-sliced" phrase below describes the pre-s176 cartesian grade. It is
// intentionally retained on the byte-frozen ECharts spec-only response; the operand-backed
// response replaces this entire note with render-measured wording.
const ECHARTS_CATEGORICAL_CAVEAT =
  'This grades the fixed OODS categorical palette the ECharts adapter bakes into itemStyle ' +
  '(reconstructed from the shared viz-scale tokens; data-independent, so the verdict is a ' +
  'per-palette constant — a weaker claim than a cartesian, cardinality-sliced verdict). ' +
  'touching-mark/adjacency contrast not graded; relies on the separating stroke. ' +
  'Per-node data-color overrides are ungraded — the grade reflects the default baked palette.';

/**
 * Grade the fixed default OODS categorical palette the 5 ECharts categorical adapters bake
 * into itemStyle (s141 m02) — role-C (each of the 6 slots vs the requested CSS scope canvas ≥ 3:1)
 * + role-A (min-pairwise CIEDE2000 over Machado CVD). No operand means no render: this
 * fallback uses the scope defaults, excluding per-node paint and canvas overrides.
 */
export function evaluateEChartsCategoricalContrast(scope: TokenScope = {}): ContrastPillarResult {
  const canvasHex = resolveSlotHex(CANVAS_TOKEN, new Map(), scope);
  const slots = reconstructEChartsCategoricalPalette(scope);
  const graded = gradeCategorical(slots, canvasHex, BAKED_CONTRAST_CAVEAT);
  return {
    contrast: graded.contrast,
    contrastNote: `${graded.contrastNote ?? ''} ${ECHARTS_CATEGORICAL_CAVEAT}`.trim(),
  };
}

// ─── ECharts-primary GEO contrast (s141 m03) ────────────────────────────────────────
//
// The 3 geo ECharts types (choropleth/flow_map/bubble_map) render color as a
// SEQUENTIAL/CONTINUOUS scale — choropleth's visualMap ramp (or piecewise binned
// sequential), flow_map's single-hue line, bubble_map's default visualMap gradient — so
// WCAG 1.4.11's essential exception for gradients applies (memo §4 role-B): there is no
// discrete categorical palette to contrast-check. certify returns 'exempt', and Forge's
// generated accessible data table is the guarantee. bubble_map's ORDINAL-categorical color
// branch (an author-supplied scale:'ordinal') is NOT graded. s141's rationale had two
// halves — the exempt-all-geo ruling, and the fact that the encoding was invisible to
// certify. s172 removed the second half: certify takes the geo branch now, so `colorField`
// and `colorScale` are readable. The RULING stands on its own; grading is a fresh scope
// decision. (s173 m01 corrects the s172 wording, which said "the range is reachable": the
// branch has no range field at all — the ordinal palette is Forge's DEFAULT_COLOR_RANGE,
// cycled by index in the bubble adapter, never an author range.)
// (s141 m03 — ruled exempt-all-geo, after the m01 IR-visibility premise was verified false.)
// s176: byte-frozen under the D11 fork (ends with the pre-fork caveat, pinned).
export const ECHARTS_GEO_EXEMPT_NOTE =
  'Geo color renders as a sequential/continuous scale (choropleth visualMap ramp, ' +
  'flow_map single-hue line, bubble_map visualMap) — WCAG 1.4.11 gradient essential ' +
  'exception, so there is no discrete categorical palette to contrast-check; ' +
  "OODS Foundry's generated accessible data table is the guarantee. An author-supplied " +
  'ordinal-categorical bubble_map color is still NOT graded, and as of s172 the reason ' +
  'is the s141 exempt-all-geo RULING rather than invisibility: certify can now see the ' +
  'geo data branch (the optional `data` operand), so that colorField and the colorScale ' +
  'it renders on are reachable — grading them would be a new scope decision, not a bug ' +
  'fix. The palette itself stays out of reach either way: the branch has no range field, ' +
  "so an ordinal bubble_map paints from OODS Foundry's own categorical list, cycling it when the " +
  'categories outnumber it. ' + NO_RATIO_CAVEAT;
