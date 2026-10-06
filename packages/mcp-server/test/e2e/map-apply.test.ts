import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as applyHandle } from '../../src/tools/map.apply.js';
import { loadMappings, type ComponentMapping, type MappingsDoc } from '../../src/tools/map.shared.js';
import type { Stage1ReconciliationReport } from '../../src/tools/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const DEFAULT_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';
const ARTIFACT_PATH = path.join(REPO_ROOT, '.oods', 'conflicts', '2026-04-16T16-50-00.000Z-stage1-map-apply-e2e.json');

let originalMappings: string | null = null;
let originalArtifact: string | null = null;
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

function seedMappings(mappings: ComponentMapping[]): void {
  const mappingsPath = currentMappingsPath();
  const doc: MappingsDoc = {
    $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
    generatedAt: '2026-04-16T00:00:00.000Z',
    version: '2026-04-16',
    stats: {
      mappingCount: mappings.length,
      systemCount: new Set(mappings.map((mapping) => mapping.externalSystem)).size,
    },
    mappings,
  };
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, JSON.stringify(doc, null, 2) + '\n');
}

function buildExistingMappings(): ComponentMapping[] {
  const mappings: ComponentMapping[] = [];

  for (let index = 1; index <= 6; index += 1) {
    mappings.push({
      id: `linear-patch-widget-${index}`,
      externalSystem: 'linear',
      externalComponent: `Patch Widget ${index}`,
      oodsTraits: ['Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-04-01T00:00:00.000Z',
        notes: `Patch Widget ${index} before Stage1 apply`,
      },
    });
  }

  for (let index = 1; index <= 3; index += 1) {
    mappings.push({
      id: `linear-skip-widget-${index}`,
      externalSystem: 'linear',
      externalComponent: `Skip Widget ${index}`,
      oodsTraits: ['Priceable', 'Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    });
  }

  for (let index = 1; index <= 2; index += 1) {
    mappings.push({
      id: `linear-conflict-widget-${index}`,
      externalSystem: 'linear',
      externalComponent: `Conflict Widget ${index}`,
      oodsTraits: ['Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    });
  }

  return mappings;
}

function buildReport(): Stage1ReconciliationReport {
  const candidateObjects: Stage1ReconciliationReport['candidate_objects'] = [];

  for (let index = 1; index <= 8; index += 1) {
    candidateObjects.push({
      object_id: `obj-create-${index}`,
      name: `Create Widget ${index}`,
      role: 'button',
      inferred_role: 'action',
      confidence: 0.95,
      recommended_oods_traits: ['Stateful', 'Labelled'],
      recommended_domain: 'navigation',
      action: 'create',
      reasoning: `Create Widget ${index} is new to the registry.`,
      verdict_reasoning: `No existing mapping matched Create Widget ${index}.`,
    });
  }

  for (let index = 1; index <= 6; index += 1) {
    candidateObjects.push({
      object_id: `obj-patch-${index}`,
      name: `Patch Widget ${index}`,
      role: 'row',
      inferred_role: 'data-display',
      confidence: 0.9,
      recommended_oods_traits: ['Stateful', 'Labelled'],
      recommended_domain: 'list',
      action: 'patch',
      reasoning: `Patch Widget ${index} needs an additional label trait.`,
      verdict_reasoning: `Existing mapping for Patch Widget ${index} is missing Labelled.`,
      existing_map_id: `linear-patch-widget-${index}`,
      diff: {
        added_traits: ['Labelled'],
        removed_traits: [],
        changed_fields: [
          {
            field: 'oodsTraits',
            from: ['Stateful'],
            to: ['Stateful', 'Labelled'],
          },
          {
            field: 'metadata.notes',
            from: `Patch Widget ${index} before Stage1 apply`,
            to: `Patch Widget ${index} updated from Stage1 E2E`,
          },
        ],
      },
    });
  }

  for (let index = 1; index <= 3; index += 1) {
    candidateObjects.push({
      object_id: `obj-skip-${index}`,
      name: `Skip Widget ${index}`,
      role: 'card',
      inferred_role: 'data-display',
      confidence: 0.93,
      recommended_oods_traits: ['Priceable', 'Stateful'],
      recommended_domain: 'billing',
      action: 'skip',
      reasoning: `Skip Widget ${index} already matches the registry.`,
      verdict_reasoning: `Existing mapping for Skip Widget ${index} is current.`,
      existing_map_id: `linear-skip-widget-${index}`,
    });
  }

  for (let index = 1; index <= 2; index += 1) {
    candidateObjects.push({
      object_id: `obj-conflict-${index}`,
      name: `Conflict Widget ${index}`,
      role: 'menu',
      inferred_role: 'navigation',
      confidence: 0.84,
      recommended_oods_traits: ['Navigable', 'Labelled'],
      recommended_domain: 'navigation',
      action: 'conflict',
      reasoning: `Conflict Widget ${index} diverges from the canonical registry mapping.`,
      verdict_reasoning: `Conflict Widget ${index} requires review before any registry mutation.`,
      existing_map_id: `linear-conflict-widget-${index}`,
    });
  }

  candidateObjects.push({
    object_id: 'obj-queued-1',
    name: 'Queued Widget 1',
    role: 'badge',
    inferred_role: 'status',
    confidence: 0.52,
    recommended_oods_traits: ['Labelled', 'Stateful'],
    recommended_domain: 'status',
    action: 'create',
    reasoning: 'Queued Widget 1 is actionable but below the default threshold.',
    verdict_reasoning: 'Queued Widget 1 should remain review-only at minConfidence 0.75.',
  });

  return {
    kind: 'reconciliation_report',
    schema_version: '1.1.0',
    generated_at: '2026-04-16T16:50:00.000Z',
    target: {
      id: 'stage1-map-apply-e2e',
      url: 'https://linear.app/',
    },
    candidate_objects: candidateObjects,
    candidate_actions: [],
    candidate_traits: [],
    conflicts: [
      {
        type: 'registry_conflict',
        description: 'Two widgets need manual review before registry mutation.',
        severity: 'error',
      },
    ],
    coverage_gaps: [],
    validation_failures: [],
    reconciliation_summary: {
      mode: 'reconciliation',
      existing_map_count: 11,
      verdict_counts: {
        create: 9,
        patch: 6,
        skip: 3,
        conflict: 2,
      },
    },
  };
}

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const originalPath = currentMappingsPath();
  originalMappings = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : null;
  mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-map-apply-e2e-'));
  process.env[MAPPINGS_PATH_ENV] = path.join(mappingsTmpDir, 'component-mappings.json');
  originalArtifact = fs.existsSync(ARTIFACT_PATH) ? fs.readFileSync(ARTIFACT_PATH, 'utf8') : null;
});

afterAll(() => {
  if (mappingsTmpDir) {
    fs.rmSync(mappingsTmpDir, { force: true, recursive: true });
    mappingsTmpDir = null;
  }
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }
  const mappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(mappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
    fs.writeFileSync(mappingsPath, originalMappings);
  }

  if (originalArtifact === null) {
    fs.rmSync(ARTIFACT_PATH, { force: true });
  } else {
    fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
    fs.writeFileSync(ARTIFACT_PATH, originalArtifact);
  }
});

beforeEach(() => {
  seedMappings(buildExistingMappings());
  fs.rmSync(ARTIFACT_PATH, { force: true });
});

describe('map.apply e2e', () => {
  it('supports dry-run, apply, conflict artifacts, and idempotent re-apply on a 20-verdict report', async () => {
    const report = buildReport();

    const dryRun = await applyHandle({
      report,
      minConfidence: 0.75,
    });

    expect(dryRun.applied).toHaveLength(14);
    expect(dryRun.applied.every((entry) => entry.persisted === false)).toBe(true);
    expect(dryRun.skipped).toHaveLength(3);
    expect(dryRun.queued).toHaveLength(1);
    expect(dryRun.conflicted).toHaveLength(2);
    expect(dryRun.errors).toEqual([]);
    expect(dryRun.diff).toMatchObject({
      create: 8,
      patch: 6,
      skip: 3,
      conflict: 2,
      queued: 1,
    });
    expect(loadMappings().mappings).toHaveLength(11);
    expect(fs.existsSync(ARTIFACT_PATH)).toBe(false);

    const applied = await applyHandle({
      report,
      apply: true,
      minConfidence: 0.75,
    });

    expect(applied.applied).toHaveLength(14);
    expect(applied.applied.every((entry) => entry.persisted === true)).toBe(true);
    expect(applied.skipped).toHaveLength(3);
    expect(applied.queued).toHaveLength(1);
    expect(applied.conflicted).toHaveLength(2);
    expect(applied.errors).toEqual([]);
    expect(applied.diff).toMatchObject({
      create: 8,
      patch: 6,
      skip: 3,
      conflict: 2,
      queued: 1,
    });
    expect(applied.conflictArtifactPath).toBe('.oods/conflicts/2026-04-16T16-50-00.000Z-stage1-map-apply-e2e.json');
    expect(fs.existsSync(ARTIFACT_PATH)).toBe(true);

    const doc = loadMappings();
    expect(doc.mappings).toHaveLength(19);
    expect(doc.mappings.find((mapping) => mapping.id === 'linear-create-widget-1')).toBeDefined();
    expect(doc.mappings.find((mapping) => mapping.id === 'linear-patch-widget-1')?.oodsTraits).toEqual([
      'Stateful',
      'Labelled',
    ]);
    expect(doc.mappings.find((mapping) => mapping.id === 'linear-patch-widget-1')?.metadata?.notes).toBe(
      'Patch Widget 1 updated from Stage1 E2E',
    );

    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
    expect(artifact.conflicts).toHaveLength(2);
    expect(artifact.belowConfidence).toHaveLength(1);

    const reapplied = await applyHandle({
      report,
      apply: true,
      minConfidence: 0.75,
    });

    expect(reapplied.etag).toBe(applied.etag);
    expect(reapplied.applied).toHaveLength(14);
    expect(reapplied.applied.every((entry) => entry.persisted === false)).toBe(true);
    expect(reapplied.errors).toEqual([]);
  });
});
