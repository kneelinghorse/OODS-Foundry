import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assertRendererFidelity } from './renderer-fidelity.js';
import { assertNormalizedVizSpec } from '@oods/viz-core';

// ============================================================================
// Sprint-156 m07 — the KEYSTONE anti-rot gate (band-fork M4, SSOT memo §3 m07).
// Three invariants that a live-schema change (or a hand-edited fixture) must never
// silently break:
//   (1) every canonical example fixture validates against the LIVE runtime schema
//       (assertNormalizedVizSpec) — so a fixture rots loudly, at CI, not in a demo;
//   (2) the two copies of each dual-maintained schema stay BYTE-IDENTICAL — the
//       runtime AJV copy (packages/viz-core/src/spec) and the Generator-B type-gen
//       source (schemas/viz) — so they can never drift (the s156 diverging/y2 work
//       edited both copies by hand; this pins that discipline).
//   (3) every selected renderer preserves each declared mark channel; ECharts
//       bands also preserve the actual endpoint values (s199).
//
// SCOPE (Derek-ratified 2026-07-20, AskUserQuestion): the CANONICAL corpus —
// examples/viz/patterns-v2 + examples/viz/patterns (32 fixtures, all valid after
// m03/m04/m05). examples/viz/before-after is DELIBERATELY EXCLUDED: its 5 rotted
// demo fixtures carry pre-existing v1-schema debt (missing top-level `encoding`,
// `color.scheme` instead of `scale`, array-valued `select.on`) unrelated to this
// sprint and are referenced by no test — logged as a separate cleanup residual
// (the retained renderer residual analysis), NOT silently
// swept. The glob is asserted non-empty so a corpus move can't hollow the gate.
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

// Optional immutable Git corpus is used only to retain the before-fix red proof.
const FIXTURE_REF = process.env.OODS_EXAMPLES_REF;
const CANONICAL_GLOBS = ['examples/viz/patterns-v2/**/*.spec.json', 'examples/viz/patterns/**/*.spec.json'];

function canonicalFixtures(): string[] {
  if (FIXTURE_REF) return execFileSync('git', ['ls-tree', '-r', '--name-only', FIXTURE_REF, '--', 'examples/viz/patterns-v2', 'examples/viz/patterns'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim().split('\n').filter((file) => file.endsWith('.spec.json')).map((file) => path.join(REPO_ROOT, file));
  const files = CANONICAL_GLOBS.flatMap((pattern) => globSync(path.join(REPO_ROOT, pattern)));
  // Deterministic order so a failure names a stable file across machines.
  return [...new Set(files)].sort();
}

describe('s156 m07 — canonical example fixtures validate against the live schema (anti-rot gate)', () => {
  const fixtures = canonicalFixtures();

  it('discovers the canonical corpus (guards against an empty-glob hollow gate)', () => {
    // patterns-v2 (21) + patterns (11) = 32 at authoring; assert a floor so a moved/renamed
    // directory can't silently reduce the gate to zero fixtures.
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
  });

  for (const file of fixtures) {
    const rel = path.relative(REPO_ROOT, file);
    it(`${rel} is valid and preserves selected-renderer channels`, () => {
      const spec = JSON.parse(FIXTURE_REF ? execFileSync('git', ['show', `${FIXTURE_REF}:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' }) : readFileSync(file, 'utf8'));
      // The fixtures are top-level NormalizedVizSpec objects (no `.spec` wrapper) — feed the
      // whole parsed JSON directly. Throws NormalizedVizSpecError with per-path AJV errors on rot.
      expect(() => assertNormalizedVizSpec(spec)).not.toThrow();
      assertRendererFidelity(spec);
    });
  }
});

describe('s156 m07 — dual-maintained schema copies stay byte-identical (anti-drift gate)', () => {
  const SCHEMA_PAIRS: Array<{ name: string; runtime: string; generator: string }> = [
    {
      name: 'normalized-viz-spec.schema.json',
      runtime: 'packages/viz-core/src/spec/normalized-viz-spec.schema.json',
      generator: 'schemas/viz/normalized-viz-spec.schema.json',
    },
    {
      name: 'dashboard-spec.schema.json',
      runtime: 'packages/viz-core/src/spec/dashboard-spec.schema.json',
      generator: 'schemas/viz/dashboard-spec.schema.json',
    },
  ];

  for (const pair of SCHEMA_PAIRS) {
    it(`${pair.name}: runtime AJV copy === Generator-B type-gen source`, () => {
      const runtime = readFileSync(path.join(REPO_ROOT, pair.runtime), 'utf8');
      const generator = readFileSync(path.join(REPO_ROOT, pair.generator), 'utf8');
      expect(runtime).toBe(generator);
    });
  }
});
