/**
 * Q1 determinism gate (map.apply half).
 *
 * Mission-graph V2 axis #7: real artifacts at 100/500/1000 mapping states.
 * Mission spec recommended pipeline + map.apply but pipeline has no
 * N-cardinality input — only map.apply does (candidate_objects[]). This
 * spec covers the map.apply scale axis; registry.snapshot is exercised
 * as a read-side consistency check.
 *
 * Parallel-execution isolation: each test creates its own temp dir and
 * points MCP_MAPPINGS_PATH at it; afterEach restores the prior env.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handle as mapApplyHandle } from '../../src/tools/map.apply.js';
import { handle as registrySnapshotHandle } from '../../src/tools/registry.snapshot.js';
import {
  synthesizeMappingsDoc,
  synthesizeReconciliationReport,
  type ScaleTier,
} from './synth.js';

const TIERS: ScaleTier[] = [100, 500, 1000];

let tempDir: string;
let priorMappingsPath: string | undefined;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-scale-'));
  priorMappingsPath = process.env.MCP_MAPPINGS_PATH;
  process.env.MCP_MAPPINGS_PATH = path.join(tempDir, 'component-mappings.json');
});

afterEach(() => {
  if (priorMappingsPath === undefined) delete process.env.MCP_MAPPINGS_PATH;
  else process.env.MCP_MAPPINGS_PATH = priorMappingsPath;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function seedRegistry(report: ReturnType<typeof synthesizeReconciliationReport>): void {
  const doc = synthesizeMappingsDoc(report);
  const mappingsPath = process.env.MCP_MAPPINGS_PATH!;
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

describe('map.apply at scale (dry-run)', () => {
  for (const tier of TIERS) {
    it(`tier=${tier}: dry-run handler returns, diff totals match, registry unchanged`, async () => {
      const report = synthesizeReconciliationReport({ tier, seed: 17 });
      seedRegistry(report);

      const snapshotBefore = await registrySnapshotHandle({} as never);
      const result = await mapApplyHandle({ report, apply: false });
      const snapshotAfter = await registrySnapshotHandle({} as never);

      // Per-candidate routing accounts for every input: the diff summary
      // partitions the tier into create/patch/skip/conflict/queued. Errors
      // must be empty — the synthesizer is shape-correct by construction.
      expect(result.errors).toHaveLength(0);
      const diffTotal =
        result.diff.create +
        result.diff.patch +
        result.diff.skip +
        result.diff.conflict +
        result.diff.queued;
      expect(diffTotal).toBe(tier);

      // Below-threshold candidates (~20% per synth distribution) are routed
      // to queued regardless of action.
      expect(result.queued.length).toBeGreaterThan(0);

      // Dry-run must not mutate the registry — the etag is content-addressed
      // (sans generatedAt) so equality is the right invariant.
      expect(snapshotAfter.etag).toBe(snapshotBefore.etag);
    });
  }
});

describe('map.apply at scale (apply=true at 100-tier only)', () => {
  it('apply=true persists the create count; snapshot reflects the mutation', async () => {
    const tier = 100 as const;
    const report = synthesizeReconciliationReport({ tier, seed: 17 });
    seedRegistry(report);

    const snapshotBefore = await registrySnapshotHandle({} as never);
    const mapsBefore = snapshotBefore.maps.length;

    const result = await mapApplyHandle({ report, apply: true });

    expect(result.errors).toHaveLength(0);

    const snapshotAfter = await registrySnapshotHandle({} as never);
    const mapsAfter = snapshotAfter.maps.length;

    // Each create verdict above the confidence threshold persists exactly
    // one new mapping; the snapshot length delta must equal the create
    // count. Patches mutate in place (no length change); skips and
    // conflicts never touch the registry.
    expect(mapsAfter - mapsBefore).toBe(result.diff.create);
    expect(snapshotAfter.etag).not.toBe(snapshotBefore.etag);
  });
});

describe('map.apply determinism across runs', () => {
  it('tier=100: two consecutive dry-runs with the same seed produce identical diff summaries', async () => {
    const tier = 100 as const;
    const seed = 99;
    const reportA = synthesizeReconciliationReport({ tier, seed });
    const reportB = synthesizeReconciliationReport({ tier, seed });
    seedRegistry(reportA);

    const a = await mapApplyHandle({ report: reportA, apply: false });
    const b = await mapApplyHandle({ report: reportB, apply: false });

    expect(a.diff).toEqual(b.diff);
    expect(a.queued.map((q) => q.objectId)).toEqual(b.queued.map((q) => q.objectId));
    expect(a.applied.map((r) => r.objectId)).toEqual(b.applied.map((r) => r.objectId));
  });
});
