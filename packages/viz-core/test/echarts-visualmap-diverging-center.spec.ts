import { describe, expect, it } from 'vitest';
import { createVisualMapForScale } from '../src/adapters/spatial/echarts-visualmap-generator.js';
import { toEChartsOption } from '../src/adapters/echarts-adapter.js';
import { toVegaLiteSpec } from '../src/adapters/vega-lite-adapter.js';
import type { ColorScaleType } from '../src/spec/spatial.js';
import type { NormalizedVizSpec } from '../src/spec/normalized-viz-spec.js';

// ============================================================================
// Sprint-157 m03 — B2 DIVERGING visualMap symmetric-center (SSOT memo §3).
// ECharts continuous visualMap has no domainMid and distributes the palette EVENLY
// across [min,max], so the OODS diverging palette's array-center neutral lands at
// (min+max)/2 — 0.34 on the shipped correlation-matrix [-0.32, 1] — while the Vega
// side bakes color.scale.domainMid:0. The two SHIPPED renderers therefore disagree on
// the semantic center of every asymmetric diverging scale (value 0 paints a cool hue
// in ECharts, neutral in Vega).
//
// FIX (single centralized pure-fn): when scale==='diverging' and the domain is finite
// with M=max(|min|,|max|)>0, symmetrize the domain to [-M,+M] before the continuous
// visualMap — forcing neutral to render at data 0 == Vega domainMid, while the larger
// extreme still reaches a palette endpoint. NO-OP on every non-diverging / degenerate /
// non-finite scale.
//
// RED-FIRST: at HEAD the diverging branch passes the raw domain straight through, so
// P1 (center===0) and P4 (cross-renderer agreement) FAIL on every asymmetric domain.
// ============================================================================

interface VisualMapLike {
  readonly type?: string;
  readonly min?: number;
  readonly max?: number;
  readonly pieces?: Array<{ min?: number; max?: number }>;
  readonly inRange?: { color?: readonly string[] };
}

// (min, max) domains crossing negatives / zero / positives, plus degenerates.
const DOMAINS: Array<[number, number]> = [
  [-1, 1],       // symmetric
  [-0.32, 1],    // the shipped correlation-matrix shape (M=1)
  [-5, 2],       // negative-dominant (M=5)
  [2, 8],        // all-positive nonzero (M=8)
  [-8, -2],      // all-negative (M=8)
  [0, 10],       // zero-anchored positive (M=10)
  [-10, 0],      // zero-anchored negative (M=10)
  [-3, 3],       // symmetric
];
const DEGENERATE: Array<[number, number]> = [
  [0, 0],
  [5, 5],
];
const NON_DIVERGING: Array<ColorScaleType | undefined> = ['linear', undefined, 'quantize', 'quantile', 'threshold'];

function vm(scale: ColorScaleType | undefined, domain: [number, number]): VisualMapLike {
  return createVisualMapForScale({ scale, domain, values: [...domain] }) as VisualMapLike;
}

describe('s157 m03 property P1 — CENTER (diverging symmetrizes about data 0)', () => {
  for (const [min, max] of DOMAINS) {
    const M = Math.max(Math.abs(min), Math.abs(max));
    it(`diverging [${min}, ${max}] ⇒ center 0, [-${M}, ${M}]`, () => {
      const m = vm('diverging', [min, max]);
      expect(m.type).toBe('continuous');
      expect(m.min).toBe(-M);
      expect(m.max).toBe(M);
      expect((m.min! + m.max!) / 2).toBe(0);
    });
  }
});

describe('s157 m03 property P2 — EXTREME-COVERAGE (the larger extreme still hits an endpoint)', () => {
  for (const [min, max] of DOMAINS) {
    const M = Math.max(Math.abs(min), Math.abs(max));
    it(`diverging [${min}, ${max}] ⇒ max(|min|,|max|) === M (${M})`, () => {
      const m = vm('diverging', [min, max]);
      expect(Math.max(Math.abs(m.min!), Math.abs(m.max!))).toBe(M);
    });
  }
});

describe('s157 m03 property P3 — GATE-ISOLATION (no symmetrize leak to a non-diverging scale)', () => {
  for (const scale of NON_DIVERGING) {
    for (const [min, max] of DOMAINS) {
      it(`${scale ?? 'undefined'} [${min}, ${max}] keeps the RAW data extent`, () => {
        const m = vm(scale, [min, max]);
        if (m.type === 'continuous') {
          // linear / undefined → continuous visualMap keyed on the raw extent.
          expect(m.min).toBe(min);
          expect(m.max).toBe(max);
        } else {
          // quantize / quantile / threshold → piecewise; the bins must still span [min,max]
          // (an untouched raw domain), never a symmetrized [-M,+M].
          expect(m.type).toBe('piecewise');
          const pieces = m.pieces ?? [];
          expect(pieces[0]?.min).toBe(min);
          expect(pieces[pieces.length - 1]?.max).toBe(max);
        }
      });
    }
  }
});

// P4 — cross-renderer agreement on a full spec: the ECharts visualMap center equals
// the Vega baked color.scale.domainMid (both 0), the INDEPENDENT oracle.
function divergingHeatmap(values: number[]): NormalizedVizSpec {
  const color = { field: 'corr', trait: 'EncodingColor', type: 'quantitative' as const, scale: 'diverging' as const, title: 'Correlation' };
  const rows = values.map((corr, i) => ({ region: `R${i}`, factor: `F${i}`, corr }));
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'corr-matrix',
    name: 'Correlation matrix',
    data: { name: 'm', values: rows },
    marks: [
      {
        trait: 'MarkRect',
        encodings: {
          x: { field: 'region', trait: 'EncodingX', scale: 'band' },
          y: { field: 'factor', trait: 'EncodingY', scale: 'band' },
          color: { ...color },
        },
      },
    ],
    encoding: {
      x: { field: 'region', trait: 'EncodingX', scale: 'band' },
      y: { field: 'factor', trait: 'EncodingY', scale: 'band' },
      color: { ...color },
    },
    a11y: { description: 'Correlation matrix with a diverging color scale.' },
  } as NormalizedVizSpec;
}

describe('s157 m03 property P4 — CROSS-RENDERER AGREEMENT (ECharts center === Vega domainMid)', () => {
  const fixtures: number[][] = [
    [-0.32, 0.5, 1],
    [-5, -1, 0.5, 2],
    [-10, 0, 10],
    [2, 5, 8],
  ];
  for (const values of fixtures) {
    it(`[${values.join(', ')}] — both renderers center the diverging scale at 0`, () => {
      const spec = divergingHeatmap(values);
      const echarts = (toEChartsOption(spec) as unknown as { visualMap?: VisualMapLike }).visualMap;
      expect(echarts).toBeDefined();
      const echartsCenter = (echarts!.min! + echarts!.max!) / 2;
      // Independent oracle: the Vega adapter bakes domainMid on the diverging color scale.
      const vega = toVegaLiteSpec(spec) as unknown as {
        encoding?: { color?: { scale?: { domainMid?: number } } };
      };
      const vegaMid = vega.encoding?.color?.scale?.domainMid;
      expect(vegaMid).toBe(0);
      expect(echartsCenter).toBe(vegaMid);
    });
  }
});

describe('s157 m03 property P5 — DEGENERATE (min===max is a finite no-op, no throw)', () => {
  for (const [min, max] of DEGENERATE) {
    it(`diverging [${min}, ${max}] returns unchanged, finite, no throw`, () => {
      const m = vm('diverging', [min, max]);
      expect(m.type).toBe('continuous');
      expect(m.min).toBe(min);
      expect(m.max).toBe(max);
      expect(Number.isFinite(m.min!)).toBe(true);
      expect(Number.isFinite(m.max!)).toBe(true);
    });
  }
});

describe('s157 m03 property P6 — DETERMINISM (same input ⇒ byte-identical visualMap)', () => {
  for (const [min, max] of [...DOMAINS, ...DEGENERATE]) {
    it(`diverging [${min}, ${max}] is byte-identical across calls`, () => {
      const a = createVisualMapForScale({ scale: 'diverging', domain: [min, max], values: [min, max] });
      const b = createVisualMapForScale({ scale: 'diverging', domain: [min, max], values: [min, max] });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  }
});
