import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVizSpec, generateNarrativeSummary, type NormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-159 m7 (§3.3) — corpus-wide narrative-vs-drawn REGRESSION SWEEP (assert-only).
// Runs the analysis + narrative pipeline over the CANONICAL example corpus (real specs, not the
// synthetic hand-oracle harness) and asserts three durable properties:
//   (1) the pipeline never THROWS on a canonical fixture;
//   (2) it is DETERMINISTIC — two runs produce identical extrema/Total;
//   (3) for every NON-aggregate fixture (28 of 32), each narrated extremum is a RAW data value —
//       an INDEPENDENT check (no product grouping code): a chart with no declared aggregate draws
//       one mark per row, so a High/Low the narrative names MUST be a value actually present in the
//       data. A fabricated extremum outside the data is caught here.
// The AGGREGATE fixtures' cell-honesty proof lives in the synthetic facet×aggregate hand-oracle
// harness (a11y-drawn-value-invariant-properties-s158.spec.ts) — an independent corpus oracle would
// have to replicate the product's stack/facet grouping (the faceted marginal proves it), so it is NOT
// claimed here; those fixtures get the no-throw + determinism net only.
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const CANONICAL_GLOBS = ['examples/viz/patterns-v2/**/*.spec.json', 'examples/viz/patterns/**/*.spec.json'];

function canonicalFixtures(): string[] {
  const files = CANONICAL_GLOBS.flatMap((pattern) => globSync(path.join(REPO_ROOT, pattern)));
  return [...new Set(files)].sort();
}

function loadSpec(file: string): NormalizedVizSpec {
  return JSON.parse(readFileSync(file, 'utf8')) as NormalizedVizSpec;
}

// Every finite numeric cell across the inline rows — the INDEPENDENT ground truth for a non-aggregate
// chart (each drawn mark is a raw row value, so a narrated extremum must be one of these).
function allNumericCells(spec: NormalizedVizSpec): Set<number> {
  const out = new Set<number>();
  const rows = Array.isArray(spec.data?.values) ? spec.data.values : [];
  for (const row of rows) {
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        out.add(value);
      }
    }
  }
  return out;
}

const FIXTURES = canonicalFixtures();

describe('s159 m7 (§3.3) — corpus-wide narrative honesty regression sweep', () => {
  it('the canonical corpus is non-empty (a corpus move cannot hollow this gate)', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(30);
  });

  for (const file of FIXTURES) {
    const name = path.relative(REPO_ROOT, file);
    it(`${name}: pipeline is crash-free, deterministic, and (non-aggregate) names only drawn values`, () => {
      const spec = loadSpec(file);

      // (1) no throw
      const a1 = analyzeVizSpec(spec);
      expect(() => generateNarrativeSummary(spec)).not.toThrow();

      // (2) determinism
      const a2 = analyzeVizSpec(spec);
      expect(a2.max).toEqual(a1.max);
      expect(a2.min).toEqual(a1.min);
      expect(a2.total).toBe(a1.total);

      // (3) non-aggregate → narrated extrema are RAW data values (independent of any product grouping)
      const hasAggregate = JSON.stringify(spec).includes('"aggregate"');
      const cells = allNumericCells(spec);
      if (!hasAggregate && cells.size > 0) {
        if (a1.max) {
          expect(cells.has(a1.max.value)).toBe(true);
        }
        if (a1.min) {
          expect(cells.has(a1.min.value)).toBe(true);
        }
      }
    });
  }
});
