import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle } from './structuredData.fetch.js';
import { ToolError } from '../errors/tool-error.js';

const RUN_ID = 'test-run-xxxx';

function makeIdentityGraph(schemaVersion = '1.1.0') {
  return {
    kind: 'identity_graph',
    schema_version: schemaVersion,
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN_ID,
    target: { id: RUN_ID, url: 'https://example.com/' },
    nodes: [
      {
        canonical_id: 'canonical:object:alpha',
        canonical_label: 'Alpha',
        identity_class: 'object',
        candidate_mappings: [{ target: 'Alpha', confidence: 0.9 }],
        member_candidates: [],
      },
    ],
  };
}

function makeCapabilityRollup(schemaVersion = '1.1.0') {
  return {
    kind: 'capability_rollup',
    schema_version: schemaVersion,
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN_ID,
    target: { id: RUN_ID, url: 'https://example.com/' },
    capabilities: [
      {
        canonical_id: 'capability:alpha',
        display_label: 'Alpha',
        presentations: [
          {
            surface: 'dom',
            label: 'Alpha',
            member_instances: [
              {
                artifact_ref: 'orca_candidates.json',
                json_pointer: '/action_candidates/0',
                run_id: RUN_ID,
                source_surface: 'dom',
                observation_type: 'orca_action',
              },
            ],
          },
        ],
        resolution_strategy: 'identity_node',
        derived_from_runs: [RUN_ID],
      },
    ],
  };
}

function makeObjectRollup(schemaVersion = '1.0.0') {
  return {
    kind: 'object_rollup',
    schema_version: schemaVersion,
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN_ID,
    target: { id: RUN_ID, url: 'https://example.com/' },
    objects: [
      {
        canonical_id: 'canonical:object:card',
        canonical_label: 'Card',
        external_component: 'Card',
        oods_traits: ['layout'],
        projection_variants: [
          {
            id: 'card-desktop',
            surface: 'desktop',
            confidence: 0.92,
            evidence_chain: [],
            metadata: {},
            selector: 'cluster-0',
          },
          {
            id: 'card-mobile',
            surface: 'mobile',
            confidence: 0.8,
            evidence_chain: [],
            metadata: {},
            selector: 'cluster-0',
          },
        ],
        reconciliation: { action: 'create' },
      },
    ],
  };
}

function makeDriftReport(schemaVersion = '1.0.0') {
  return {
    kind: 'drift_report',
    schema_version: schemaVersion,
    generated_at: '2026-04-18T02:16:31.952Z',
    current_run: { id: RUN_ID, url: 'https://example.com/' },
    semantic_drift: [],
    projection_inconsistency: [],
    capability_contradiction: [],
    token_intent_mismatch: [],
    object_coverage_gap: [],
    signals: [],
  };
}

describe('structuredData.fetch rollup mode', () => {
  let tmpDir: string;
  let artifactsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-rollup-fetch-'));
    artifactsDir = path.join(tmpDir, 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(path.join(artifactsDir, 'identity_graph.json'), JSON.stringify(makeIdentityGraph()));
    fs.writeFileSync(path.join(artifactsDir, 'capability_rollup.json'), JSON.stringify(makeCapabilityRollup()));
    fs.writeFileSync(path.join(artifactsDir, 'object_rollup.json'), JSON.stringify(makeObjectRollup()));
    fs.writeFileSync(path.join(artifactsDir, 'drift_report.json'), JSON.stringify(makeDriftReport()));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns parsed identity_graph with nodes[] populated', async () => {
    const result = await handle({ kind: 'identity_graph', runPath: artifactsDir });
    expect(result.kind).toBe('identity_graph');
    expect(result.schemaVersion).toBe('1.1.0');
    expect(result.runId).toBe(RUN_ID);
    expect(result.schemaValidated).toBe(true);
    expect(result.payloadIncluded).toBe(true);
    expect((result.payload as any).nodes).toHaveLength(1);
    expect(result.meta?.nodeCount).toBe(1);
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns parsed capability_rollup with capabilities[] populated', async () => {
    const result = await handle({ kind: 'capability_rollup', runPath: artifactsDir });
    expect(result.kind).toBe('capability_rollup');
    expect(result.schemaVersion).toBe('1.1.0');
    expect((result.payload as any).capabilities).toHaveLength(1);
    expect(result.meta?.capabilityCount).toBe(1);
  });

  it('returns parsed object_rollup with projection_variants[] intact', async () => {
    const result = await handle({ kind: 'object_rollup', runPath: artifactsDir });
    expect(result.kind).toBe('object_rollup');
    expect(result.schemaVersion).toBe('1.0.0');
    const objects = (result.payload as any).objects;
    expect(objects).toHaveLength(1);
    expect(objects[0].projection_variants).toHaveLength(2);
    expect(result.meta?.objectCount).toBe(1);
    expect(result.meta?.projectionVariantCount).toBe(2);
  });

  it('returns parsed drift_report with empty signals[] intact', async () => {
    const result = await handle({ kind: 'drift_report', runPath: artifactsDir });
    expect(result.kind).toBe('drift_report');
    expect(result.schemaVersion).toBe('1.0.0');
    expect((result.payload as any).signals).toEqual([]);
    expect(result.meta?.signalCount).toBe(0);
  });

  it('accepts a run-root runPath and finds artifacts/<kind>.json', async () => {
    const result = await handle({ kind: 'identity_graph', runPath: tmpDir });
    expect(result.kind).toBe('identity_graph');
    expect((result.payload as any).nodes).toHaveLength(1);
  });

  it('accepts a direct file path and returns the parsed rollup', async () => {
    const result = await handle({
      kind: 'capability_rollup',
      runPath: path.join(artifactsDir, 'capability_rollup.json'),
    });
    expect(result.kind).toBe('capability_rollup');
  });

  it('accepts identity_graph schema_version 1.2.0 (v1.6.0 bump)', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'identity_graph.json'),
      JSON.stringify(makeIdentityGraph('1.2.0')),
    );
    const result = await handle({ kind: 'identity_graph', runPath: artifactsDir });
    expect(result.schemaVersion).toBe('1.2.0');
    expect(result.schemaValidated).toBe(true);
    expect((result.payload as any).nodes).toHaveLength(1);
  });

  it('accepts capability_rollup schema_version 1.2.0 (v1.6.0 bump)', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'capability_rollup.json'),
      JSON.stringify(makeCapabilityRollup('1.2.0')),
    );
    const result = await handle({ kind: 'capability_rollup', runPath: artifactsDir });
    expect(result.schemaVersion).toBe('1.2.0');
    expect(result.schemaValidated).toBe(true);
    expect((result.payload as any).capabilities).toHaveLength(1);
  });

  it('accepts object_rollup schema_version 1.1.0 (v1.6.0 bump)', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'object_rollup.json'),
      JSON.stringify(makeObjectRollup('1.1.0')),
    );
    const result = await handle({ kind: 'object_rollup', runPath: artifactsDir });
    expect(result.schemaVersion).toBe('1.1.0');
    expect(result.schemaValidated).toBe(true);
    expect((result.payload as any).objects).toHaveLength(1);
  });

  it('accepts drift_report schema_version 1.0.0 (s95-m02 read-side widen)', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'drift_report.json'),
      JSON.stringify(makeDriftReport('1.0.0')),
    );
    const result = await handle({ kind: 'drift_report', runPath: artifactsDir });
    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.schemaValidated).toBe(true);
    expect((result.payload as any).signals).toEqual([]);
  });

  it('rejects an unknown schema_version with a structured error', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'identity_graph.json'),
      JSON.stringify(makeIdentityGraph('2.0.0')),
    );
    await expect(handle({ kind: 'identity_graph', runPath: artifactsDir })).rejects.toBeInstanceOf(
      ToolError,
    );
    try {
      await handle({ kind: 'identity_graph', runPath: artifactsDir });
    } catch (err) {
      expect((err as ToolError).message).toMatch(/Unsupported schema_version "2\.0\.0"/);
      expect((err as any).details?.accepted).toEqual(['1.1.0', '1.2.0']);
    }
  });

  it('rejects an unknown object_rollup schema_version with the new allow-list', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'object_rollup.json'),
      JSON.stringify(makeObjectRollup('2.0.0')),
    );
    try {
      await handle({ kind: 'object_rollup', runPath: artifactsDir });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolError);
      expect((err as ToolError).message).toMatch(/Unsupported schema_version "2\.0\.0"/);
      // s204-m03 added 1.2.0 — the version every object_rollup on disk actually carries. The refusal
      // itself is unchanged: an unknown version is still a fast-fail, never a silent parse.
      expect((err as any).details?.accepted).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    }
  });

  it('accepts object_rollup schema_version 1.2.0, and surfaces requires_human_adjudication (s204-m03)', async () => {
    // 1.2.0 adds one optional boolean to the same shape; Stage1 validates all three versions with a
    // single zod schema. The flag marks the rolled-up semantic mappings as PROPOSALS needing human
    // adjudication, which is the distinction Phase E turns on, so it must survive the read.
    const payload = { ...makeObjectRollup('1.2.0'), requires_human_adjudication: true };
    fs.writeFileSync(path.join(artifactsDir, 'object_rollup.json'), JSON.stringify(payload));
    const result = await handle({ kind: 'object_rollup', runPath: artifactsDir });
    expect(result.kind).toBe('object_rollup');
    expect(result.schemaValidated).toBe(true);
    expect((result.payload as { schema_version: string }).schema_version).toBe('1.2.0');
    expect((result.payload as { requires_human_adjudication?: boolean }).requires_human_adjudication).toBe(true);
  });

  it('rejects an unknown drift_report schema_version with the read-side allow-list', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'drift_report.json'),
      JSON.stringify(makeDriftReport('2.0.0')),
    );
    try {
      await handle({ kind: 'drift_report', runPath: artifactsDir });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolError);
      expect((err as ToolError).message).toMatch(/Unsupported schema_version "2\.0\.0"/);
      expect((err as any).details?.accepted).toEqual(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0']);
    }
  });

  it('rejects a payload whose kind disagrees with the requested kind', async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'identity_graph.json'),
      JSON.stringify({ ...makeIdentityGraph(), kind: 'capability_rollup' }),
    );
    await expect(handle({ kind: 'identity_graph', runPath: artifactsDir })).rejects.toThrow(
      /Artifact kind mismatch/,
    );
  });

  it('rejects a payload missing schema_version', async () => {
    const payload: any = makeIdentityGraph();
    delete payload.schema_version;
    fs.writeFileSync(path.join(artifactsDir, 'identity_graph.json'), JSON.stringify(payload));
    await expect(handle({ kind: 'identity_graph', runPath: artifactsDir })).rejects.toThrow(
      /missing schema_version/,
    );
  });

  it('surfaces a structured error when the artifact file is missing', async () => {
    fs.rmSync(path.join(artifactsDir, 'object_rollup.json'));
    await expect(handle({ kind: 'object_rollup', runPath: artifactsDir })).rejects.toThrow(
      /Stage1 rollup artifact not found/,
    );
  });

  it('returns matched=true and omits payload on ETag hit', async () => {
    const first = await handle({ kind: 'identity_graph', runPath: artifactsDir });
    const second = await handle({ kind: 'identity_graph', runPath: artifactsDir, ifNoneMatch: first.etag });
    expect(second.matched).toBe(true);
    expect(second.payloadIncluded).toBe(false);
    expect(second.payload).toBeUndefined();
    expect(second.etag).toBe(first.etag);
  });

  it('rejects listVersions/version in kind mode', async () => {
    await expect(
      handle({ kind: 'identity_graph', runPath: artifactsDir, listVersions: true }),
    ).rejects.toThrow(/listVersions is not supported/);
    await expect(
      handle({ kind: 'identity_graph', runPath: artifactsDir, version: '2026-04-17' }),
    ).rejects.toThrow(/version is not supported/);
  });

  it('throws when kind is set but runPath is omitted', async () => {
    await expect(handle({ kind: 'identity_graph' } as any)).rejects.toThrow(/requires runPath/);
  });
});
