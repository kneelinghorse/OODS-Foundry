import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows, inferFieldProfile } from '@oods/viz-core';
// Single source of truth: the FAOSTAT fixture (the Phase-4 eval-harness seed) lives with
// the mcp-server E2E test. It is PURE DATA (no imports), so reusing it here is a shared
// fixture, not a runtime coupling to mcp-server logic.
import {
  GEO_BUBBLE_ROWS,
  ORDINAL_TRAP_FIELD,
  TRADEFLOW_ROWS,
} from '../../mcp-server/src/tools/__fixtures__/faostat-tradeflow.fixture.js';

// viz-core-level gates for sprint-118 (the #5 recommender + #6 numeric→ordinal bug-shakers,
// pinned at the profiler/recommender unit boundary — the precise unit gate beneath the
// mcp-server E2E test). Both were authored as `it.fails(...)` red baselines in m01 and are
// FLIPPED GREEN here by m04 (geoShaped lowConfidence + nameHintsMeasure). The stable
// shape/sanity `it(...)` tests document WHY the misinference happened.

describe('FAOSTAT type inference — #6 numeric→ordinal (viz-core)', () => {
  it('sanity: the real measure `value` is correctly typed quantitative/measure', () => {
    const profiles = inferFieldProfile(TRADEFLOW_ROWS as ReadonlyArray<Record<string, unknown>>);
    const value = profiles.find((p) => p.name === 'value');
    expect(value).toBeDefined();
    expect(value?.type).toBe('quantitative');
    expect(value?.role).toBe('measure');
  });

  it('baseline: `shipment_qty` has the low-cardinality integer SHAPE that trips inferFieldType rule 4', () => {
    // STABLE proof of mission criterion 3 — about the DATA shape, not the inference, so it
    // survives the m04 fix (m04 rescues by name, it does not change these values). Rule 4:
    // all-integer ∧ present>=8 (ORDINAL_MIN_ROWS) ∧ distinct<=12 (ORDINAL_MAX_CARDINALITY) ∧
    // distinct/present<0.5 (ORDINAL_MAX_DISTINCT_RATIO).
    const present = TRADEFLOW_ROWS.map((r) => (r as Record<string, unknown>)[ORDINAL_TRAP_FIELD]).filter(
      (v) => v !== null && v !== undefined,
    );
    const distinct = new Set(present).size;
    expect(present.every((v) => Number.isInteger(v))).toBe(true);
    expect(present.length).toBeGreaterThanOrEqual(8);
    expect(distinct).toBeLessThanOrEqual(12);
    expect(distinct / present.length).toBeLessThan(0.5);
  });

  // FLIPPED GREEN by m04 (was it.fails): nameHintsMeasure ('qty' is in the conservative set,
  // 'count' is NOT) keeps the measure-named low-cardinality integer column quantitative.
  it('`shipment_qty` (a measure-named low-cardinality integer) infers as quantitative/measure, not ordinal/dimension', () => {
    const profiles = inferFieldProfile(TRADEFLOW_ROWS as ReadonlyArray<Record<string, unknown>>);
    const sc = profiles.find((p) => p.name === ORDINAL_TRAP_FIELD);
    expect(sc).toBeDefined();
    expect(sc?.type).toBe('quantitative');
    expect(sc?.role).toBe('measure');
  });
});

describe('FAOSTAT recommender honesty — #5 (viz-core)', () => {
  // FLIPPED GREEN by m04 (was it.fails): the pattern pool ranks only tabular marks, so geo
  // coordinate data (lat/lon) gets a confident bar — m04 flags lowConfidence + a rationale.
  it('geo-shaped (lat/lon) data fed to the tabular suggest path flags lowConfidence + a geo rationale', () => {
    const result = buildVizSpecFromRows({ rows: GEO_BUBBLE_ROWS as ReadonlyArray<Record<string, unknown>> });
    expect(result.lowConfidence).toBe(true);
    expect((result.suggestion?.signals ?? []).some((s) => /choropleth|bubble_map/.test(s))).toBe(true);
  });
});
