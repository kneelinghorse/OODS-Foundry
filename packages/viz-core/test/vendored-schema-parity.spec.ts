import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Each viz-core AJV validator inlines a VENDORED copy of its repo-root source
// schema (so the package is self-contained / tsup-inlinable). There is no
// build-time sync step, so the vendored copy can silently drift from the source.
// This guard fails the suite the moment a pair diverges — covering both the
// normalized-viz-spec IR (sprint-112 m01) and the dashboard IR (sprint-113 m01).
const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..', '..', '..');

const PAIRS: ReadonlyArray<{ name: string; source: string; vendored: string }> = [
  {
    name: 'normalized-viz-spec',
    source: 'schemas/viz/normalized-viz-spec.schema.json',
    vendored: 'packages/viz-core/src/spec/normalized-viz-spec.schema.json',
  },
  {
    name: 'dashboard-spec',
    source: 'schemas/viz/dashboard-spec.schema.json',
    vendored: 'packages/viz-core/src/spec/dashboard-spec.schema.json',
  },
];

describe('@oods/viz-core — vendored schema parity', () => {
  for (const pair of PAIRS) {
    it(`${pair.name}: vendored runtime copy is byte-identical to the repo-root source`, () => {
      const source = readFileSync(path.join(repoRoot, pair.source), 'utf8');
      const vendored = readFileSync(path.join(repoRoot, pair.vendored), 'utf8');
      expect(vendored).toBe(source);
    });
  }
});
