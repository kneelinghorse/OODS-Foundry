// {spec}-only byte-compat control — BASELINE CAPTURE. (s172 §1g; rebased in s173 m01,
// s176 m01, s177 m02, s179 m01, and s180 m01.)
//
// Dumps artifact.certify's {spec}-only response for all 13 mark traits to
// __fixtures__/s172-certify-spec-only-baseline.json.
//
// The fixture is the output of code that actually ran at pristine HEAD
// `c02eb4342fa34faacf4fcb6a3467341af8a92e01` — s179's final commit and s180's
// starting tree — BEFORE any s180 product edit. It was captured in a detached worktree
// rather than by stashing, so the tree it measured is named by a commit and the capture
// is reproducible by anyone:
//
//   git worktree add --detach "${TMPDIR%/}/oods-forge-s181-m01-85004fe" 85004fe8b43d869d23ab67025e438edadf82deb8
//   git -C "${TMPDIR%/}/oods-forge-s181-m01-85004fe" rev-parse HEAD
//   # observed 85004fe8b43d869d23ab67025e438edadf82deb8 before the probe
//   pnpm -C "${TMPDIR%/}/oods-forge-s181-m01-85004fe" install --frozen-lockfile
//   pnpm -C "${TMPDIR%/}/oods-forge-s181-m01-85004fe" run build:packages
//   pnpm -C "${TMPDIR%/}/oods-forge-s181-m01-85004fe" --filter @oods/mcp-server exec tsx test/tools/s172-spec-only-capture.mts
//   shasum -a 256 "${TMPDIR%/}/oods-forge-s181-m01-85004fe/packages/mcp-server/test/tools/__fixtures__/s172-certify-spec-only-baseline.json"
//   cmp -s "${TMPDIR%/}/oods-forge-s181-m01-85004fe/packages/mcp-server/test/tools/__fixtures__/s172-certify-spec-only-baseline.json" packages/mcp-server/test/tools/__fixtures__/s172-certify-spec-only-baseline.json
//
// (s172 captured at `95dd57d` with `git stash push -- packages/mcp-server/src`; s173
// recaptured at `e5bf2f6` and s176 at `4f64bcf` with the worktree protocol above. Those
// baselines are superseded; s177 recaptured at `86d50ed` and s179 at `1be93f8`.
// Re-baselining is not a weakening of the control: each old baseline's declared movements
// are exactly the diff between consecutive captures. The c02eb43 capture has SHA-256
// da68a40aa71c99a7b2d67b3e3bca9a206297da1b5108c532788f231ff65364a3 and is
// byte-identical to 1be93f8, re-proving s179's zero spec-only movement before s180.)
//
// The fixture is therefore never a restatement of what a plan said it would be (rule 15).
// It is the operand of artifact.certify.spec-only-bytes.spec.ts, which asserts the split
// control: each half moves only where a mission declared it in writing — byte-identical
// wherever nothing is declared.

import { writeFileSync } from 'node:fs';
import { buildVizSpecFromRows, type NormalizedVizSpec } from '@oods/viz-core';
import { handle } from '../../src/tools/artifact.certify.js';
import { SPEC_ONLY_CASES } from './s172-spec-only-cases.js';

const out: Record<string, unknown> = {};
for (const [trait, spec] of Object.entries(SPEC_ONLY_CASES(buildVizSpecFromRows))) {
  out[trait] = await handle({ spec: spec as NormalizedVizSpec });
}

const target = new URL('./__fixtures__/s172-certify-spec-only-baseline.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(out).length} trait responses to ${target.pathname}`);
