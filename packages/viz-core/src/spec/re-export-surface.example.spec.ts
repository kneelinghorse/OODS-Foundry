import { describe, expect, it } from 'vitest';
// s153 F1 — the RE-EXPORT SURFACE witness (closes the s152 F1 gate gap, PS-2026-07-12-006).
//
// The core IR shapes Mark / DataSource / EncodingMap / Transform are re-exported from the
// `@oods/viz-core` package root (normalized-viz-spec.ts:12-15) as a first-class library-consumer
// contract. The s152 grounding mutation-proved that DELETING any of those re-exports left every
// gate green — root `tsc --noEmit` never reaches packages/viz-core/src, tsup strips types, and
// vitest is runtime-only. The new `typecheck` script (tsc --noEmit -p tsconfig.json, wired into
// CI) is the red gate; THIS file gives it teeth for all four re-exports.
//
// Each `const` is typed via the PACKAGE-ROOT re-export (import from '@oods/viz-core', not the deep
// './normalized-viz-spec.types' path). If any of the four re-exports regresses, its `import { type
// X }` stops resolving and `tsc --noEmit` goes RED — the type-level teeth the contract needs. The
// median-rule-layer example already gives `Mark` teeth; this file additionally covers DataSource /
// EncodingMap / Transform (else 3 of 4 re-exports stay ungated).
import type { DataSource, EncodingMap, Mark, Transform } from '@oods/viz-core';

// DataSource — the inline-values / external-reference data slot.
const dataSource: DataSource = {
  name: 'design-dna-ladder',
  values: [
    { site: 'Gov A', score: 92 },
    { site: 'Gov B', score: 74 },
  ],
};

// EncodingMap — the channel→binding map an importer authors for a spec's top-level encoding.
const encoding: EncodingMap = {
  x: { field: 'site', trait: 'EncodingX' },
  y: { field: 'score', trait: 'EncodingY' },
};

// Mark — a layer, authored by name via `Mark.from` (the Demo-03 Hero-B median-rule shape).
const mark: Mark = {
  trait: 'MarkLine',
  from: 'gov_median',
  encodings: encoding,
};

// Transform — a declarative pre-render transform (e.g. a sort applied before layout).
const transform: Transform = {
  type: 'sort',
  params: { field: 'score', order: 'descending' },
};

describe('re-export surface — #16 library-consumer contract type witnesses (s153 F1)', () => {
  it('the four core IR shapes are nameable from the @oods/viz-core package root', () => {
    // The type annotations above are the compile-time teeth (checked by `pnpm --filter
    // @oods/viz-core run typecheck`). The runtime assertions below keep this a valid, passing
    // vitest spec and confirm the authored literals materialize as expected.
    expect(dataSource.values).toHaveLength(2);
    expect(dataSource.name).toBe('design-dna-ladder');
    expect(encoding.x?.field).toBe('site');
    expect(encoding.y?.field).toBe('score');
    expect(mark.from).toBe('gov_median');
    expect(mark.encodings).toBe(encoding);
    expect(transform.type).toBe('sort');
    expect(transform.params?.field).toBe('score');
  });
});
