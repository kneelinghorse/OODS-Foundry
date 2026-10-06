// s190 #1850/#1856: s195 literal pins admit the measured Role-A clean palette and retain the scoped caveat; historical fixture bytes are untouched.
// D11 path-scoped byte pin for the ECharts SPEC-ONLY fallback.
//
// Operand-backed ECharts calls now replace these notes with render-evidence wording in
// artifact.certify. Calls without `data` cannot emit or render an option, so they continue
// through evaluateEChartsCategoricalContrast/ECHARTS_GEO_EXEMPT_NOTE. This pin freezes
// those two fallback surfaces as LITERALS — deliberately not imports of the source
// constants, which would make the pin tautological — while the handler-level
// spec-only-bytes control proves they remain the only path that exposes these bytes.
//
// The frozen text intentionally retains its baked-byte wording because it is still true
// for the no-operand fallback. The operand-backed integration spec separately forbids
// these phrases and pins the normalized-SVG evidence note.

import { describe, expect, it } from 'vitest';
import {
  ECHARTS_GEO_EXEMPT_NOTE,
  evaluateEChartsCategoricalContrast,
} from '../../src/tools/certify-contrast.js';

// s211-m03 (#2296): the one admitted mover is the product's public name, which the frozen texts below
// still carry as it was at 4f64bcf.
const publicName = (text: string) => text.replaceAll('Forge', 'OODS Foundry');

// The pre-fork shared caveat, byte-for-byte as of pristine 4f64bcf (less the product's name). After the fork this
// exact text must keep ending every spec-only fallback contrastNote.
const FROZEN_ECHARTS_CAVEAT = publicName(
  'certify measures the categorical color bytes Forge baked into the compiled spec, ' +
  'against the requested CSS scope canvas; no rendered carrier measurement is claimed.');

// evaluateEChartsCategoricalContrast's clean-pass contrastNote at 4f64bcf: the shared
// grader's clean-pass note (the caveat alone) + ' ' + ECHARTS_CATEGORICAL_CAVEAT.
const FROZEN_ECHARTS_CATEGORICAL_NOTE =
  FROZEN_ECHARTS_CAVEAT +
  ' ' +
  'This grades the fixed OODS categorical palette the ECharts adapter bakes into itemStyle ' +
  '(reconstructed from the shared viz-scale tokens; data-independent, so the verdict is a ' +
  'per-palette constant — a weaker claim than a cartesian, cardinality-sliced verdict). ' +
  'touching-mark/adjacency contrast not graded; relies on the separating stroke. ' +
  'Per-node data-color overrides are ungraded — the grade reflects the default baked palette.';

// ECHARTS_GEO_EXEMPT_NOTE at 4f64bcf, in full (less the product's name) — it ends with the frozen caveat.
const FROZEN_ECHARTS_GEO_EXEMPT_NOTE = publicName(
  'Geo color renders as a sequential/continuous scale (choropleth visualMap ramp, ' +
  'flow_map single-hue line, bubble_map visualMap) — WCAG 1.4.11 gradient essential ' +
  'exception, so there is no discrete categorical palette to contrast-check; ' +
  "Forge's generated accessible data table is the guarantee. An author-supplied " +
  'ordinal-categorical bubble_map color is still NOT graded, and as of s172 the reason ' +
  'is the s141 exempt-all-geo RULING rather than invisibility: certify can now see the ' +
  'geo data branch (the optional `data` operand), so that colorField and the colorScale ' +
  'it renders on are reachable — grading them would be a new scope decision, not a bug ' +
  'fix. The palette itself stays out of reach either way: the branch has no range field, ' +
  "so an ordinal bubble_map paints from Forge's own categorical list, cycling it when the " +
  'categories outnumber it. No categorical canvas ratio is graded for this scope.');

describe('certify-contrast — D11 keeps the ECharts spec-only fallback byte-frozen', () => {
  it('the spec-only categorical fallback is byte-identical to the baked-palette text', () => {
    const out = evaluateEChartsCategoricalContrast();
    expect(out.contrast).toBe('pass');
    expect(out.contrastNote).toBe(FROZEN_ECHARTS_CATEGORICAL_NOTE);
  });

  it('the spec-only geo fallback is byte-identical to the baked-palette text', () => {
    expect(ECHARTS_GEO_EXEMPT_NOTE).toBe(FROZEN_ECHARTS_GEO_EXEMPT_NOTE);
  });
});
