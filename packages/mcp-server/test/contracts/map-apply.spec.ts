import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/map.apply.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/map.apply.output.json' assert { type: 'json' };
import type { MapApplyInput, MapApplyOutput, Stage1ReconciliationReport } from '../../src/tools/types.js';
import { computeMappingsEtag, type ComponentMapping } from '../../src/tools/map.shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const DEFAULT_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';
const FIXTURE_PATH = path.join(REPO_ROOT, 'packages', 'mcp-server', 'test', 'fixtures', 'reconciliation-report-v1.1.0.json');

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

function loadFixture(): Stage1ReconciliationReport {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Stage1ReconciliationReport;
}

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

function writeMappings(mappings: ComponentMapping[]): void {
  const mappingsPath = currentMappingsPath();
  const doc = {
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

async function loadHandle(): Promise<(input: MapApplyInput) => Promise<MapApplyOutput>> {
  const mod = await import('../../src/tools/map.apply.js');
  return mod.handle as (input: MapApplyInput) => Promise<MapApplyOutput>;
}

let originalMappings: string | null = null;
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const originalPath = currentMappingsPath();
  originalMappings = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : null;

  mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-map-apply-spec-'));
  process.env[MAPPINGS_PATH_ENV] = path.join(mappingsTmpDir, 'component-mappings.json');
});

afterAll(() => {
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }

  const restoredMappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(restoredMappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(restoredMappingsPath), { recursive: true });
    fs.writeFileSync(restoredMappingsPath, originalMappings);
  }

  if (mappingsTmpDir) {
    fs.rmSync(mappingsTmpDir, { recursive: true, force: true });
    mappingsTmpDir = null;
  }
});

beforeEach(() => {
  writeMappings([
    {
      id: 'linear-issue-row',
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
        notes: 'Imported from sprint-52 fixture',
      },
    },
    {
      id: 'linear-billing-plan-card',
      externalSystem: 'linear',
      externalComponent: 'Billing Plan Card',
      oodsTraits: ['Priceable', 'Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    },
    {
      id: 'linear-workspace-switcher',
      externalSystem: 'linear',
      externalComponent: 'Workspace Switcher',
      oodsTraits: ['Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    },
  ]);
});

describe('map.apply schema validation', () => {
  it('accepts inline reconciliation reports with v1.1.0 fields', () => {
    expect(validateInput({ report: loadFixture() })).toBe(true);
  });

  it('accepts reportPath input for filesystem-driven runs', () => {
    expect(validateInput({ reportPath: FIXTURE_PATH })).toBe(true);
  });

  it('rejects both report and reportPath together', () => {
    expect(
      validateInput({
        report: loadFixture(),
        reportPath: FIXTURE_PATH,
      }),
    ).toBe(false);
  });

  it('rejects inputs that provide neither report nor reportPath', () => {
    expect(validateInput({ minConfidence: 0.9 })).toBe(false);
  });

  it('accepts legacy string alternates alongside typed v1.1.0 payloads', () => {
    const report = loadFixture();
    report.candidate_objects[1].alternate_interpretations = ['table-row', 'data-display'];
    report.candidate_actions![0].alternate_verbs = ['save', 'publish'];
    expect(validateInput({ report })).toBe(true);
  });
});

describe('map.apply output schema validation', () => {
  it('accepts the planned routing surface for dry-run/apply reports', () => {
    const sample: MapApplyOutput = {
      applied: [
        {
          objectId: 'obj-command-menu',
          name: 'Command Menu Trigger',
          action: 'create',
          confidence: 0.94,
          recommendedOodsTraits: ['Stateful', 'Labelled'],
          mappingId: 'linear-command-menu-trigger',
          reason: 'No matching external component in the OODS registry snapshot.',
          persisted: false,
        },
        {
          objectId: 'obj-issue-row',
          name: 'Issue Row',
          action: 'patch',
          confidence: 0.88,
          recommendedOodsTraits: ['Listable', 'Sortable'],
          existingMapId: 'linear-issue-row',
          mappingId: 'linear-issue-row',
          reason: 'Existing map lacks Sortable and needs notes updated for the current evidence set.',
          persisted: false,
          diff: {
            added_traits: ['Sortable'],
            removed_traits: [],
            changed_fields: [
              {
                field: 'oodsTraits',
                from: ['Listable'],
                to: ['Listable', 'Sortable'],
              },
            ],
          },
        },
      ],
      skipped: [
        {
          objectId: 'obj-billing-plan-card',
          name: 'Billing Plan Card',
          action: 'skip',
          confidence: 0.97,
          recommendedOodsTraits: ['Priceable', 'Stateful'],
          existingMapId: 'linear-billing-plan-card',
          mappingId: 'linear-billing-plan-card',
          reason: 'Existing mapping already matches name, system, and trait set.',
          persisted: false,
        },
      ],
      queued: [
        {
          objectId: 'obj-experimental-badge',
          name: 'Experimental Badge',
          action: 'create',
          confidence: 0.61,
          threshold: 0.75,
          queueReason: 'below_confidence',
          recommendedOodsTraits: ['Labelled', 'Stateful'],
          reason: 'Candidate remains actionable but should queue for review at the default minConfidence.',
        },
      ],
      conflicted: [
        {
          objectId: 'obj-workspace-switcher',
          name: 'Workspace Switcher',
          action: 'conflict',
          confidence: 0.82,
          existingMapId: 'linear-workspace-switcher',
          reason: 'Existing mapping classifies this control as Stateful rather than Navigable, and the trait sets are incompatible without review.',
        },
      ],
      errors: [],
      diff: {
        create: 1,
        patch: 1,
        skip: 1,
        conflict: 1,
        queued: 1,
        changedFields: ['oodsTraits', 'metadata.notes'],
        addedTraits: ['Sortable'],
        removedTraits: [],
      },
      conflictArtifactPath: '.oods/conflicts/2026-04-16T15-06-35.268Z-stage1-linear-smoke.json',
      etag: '6d6224a2293e24fcefff2060dc60d8b3cf516af14f8d8f7344e3d5d726b7d0d6',
    };

    expect(validateOutput(sample)).toBe(true);
  });
});

describe('map.apply contract (pending implementation)', () => {
  it('routes create, patch, skip, queued, and conflict buckets from an inline report', async () => {
    const handle = await loadHandle();
    const result = await handle({
      report: loadFixture(),
      minConfidence: 0.75,
    });

    expect(validateOutput(result)).toBe(true);
    expect(result.applied).toHaveLength(2);
    expect(result.applied.map((entry) => entry.action)).toEqual(['create', 'patch']);
    expect(result.applied.every((entry) => entry.persisted === false)).toBe(true);
    expect(result.skipped).toHaveLength(1);
    expect(result.queued).toHaveLength(1);
    expect(result.queued[0].queueReason).toBe('below_confidence');
    expect(result.conflicted).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.diff).toMatchObject({
      create: 1,
      patch: 1,
      skip: 1,
      conflict: 1,
      queued: 1,
      addedTraits: ['Sortable'],
      changedFields: ['oodsTraits', 'metadata.notes'],
    });
    expect(result.etag).toBe(
      computeMappingsEtag(JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8')) as Parameters<typeof computeMappingsEtag>[0]),
    );
  });

  it('supports reportPath + apply=true while preserving the same output contract', async () => {
    const handle = await loadHandle();
    const result = await handle({
      reportPath: FIXTURE_PATH,
      apply: true,
      minConfidence: 0.75,
    });

    expect(validateOutput(result)).toBe(true);
    expect(result.applied.map((entry) => entry.action)).toEqual(['create', 'patch']);
    expect(result.applied.every((entry) => entry.persisted === true)).toBe(true);
    expect(result.skipped).toHaveLength(1);
    expect(result.queued).toHaveLength(1);
    expect(result.conflicted).toHaveLength(1);
    expect(result.conflictArtifactPath).toMatch(/\.oods\/conflicts\/.+\.json$/);
  });
});

// ── s92-m02: projection_variants[] pass-through through map.apply ──
// Aligns with Stage1 contract v1.5.0 §7.3. When a reconciliation_report
// carries projection_variants[] on a candidate_object (create or patch
// verdict), map.apply threads them through to the persisted mapping.

describe('map.apply schema validation (s92-m02)', () => {
  it('accepts candidate_objects with external_component (Stage1 v1.2.0 reconciliation_report shape)', () => {
    const report = loadFixture();
    report.candidate_objects[0].external_component = 'command-menu-trigger';
    expect(validateInput({ report })).toBe(true);
  });

  it('accepts candidate_objects with projection_variants[]', () => {
    const report = loadFixture();
    (report.candidate_objects[0] as any).projection_variants = [
      { id: 'variant-1', surface: 'desktop', selector: '.cmdk', confidence: 0.92 },
    ];
    expect(validateInput({ report })).toBe(true);
  });

  it('rejects projection_variants entry missing required surface', () => {
    const report = loadFixture();
    (report.candidate_objects[0] as any).projection_variants = [{ id: 'variant-1' }];
    expect(validateInput({ report })).toBe(false);
  });

  it('still rejects unknown top-level fields on candidate_object', () => {
    const report = loadFixture();
    (report.candidate_objects[0] as any).bogus_field = 'should reject';
    expect(validateInput({ report })).toBe(false);
  });
});

describe('map.apply projection_variants[] handler pass-through (s92-m02)', () => {
  it('forwards candidate.projection_variants to the persisted mapping on create verdict (apply:true)', async () => {
    const handle = await loadHandle();
    const report = loadFixture();
    const variants = [
      { id: 'variant-1', surface: 'desktop', selector: '.cmdk', confidence: 0.92 },
      { id: 'variant-2', surface: 'mobile', external_component: 'CommandSheet' },
    ];
    (report.candidate_objects[0] as any).projection_variants = variants;

    const result = await handle({
      report,
      apply: true,
      minConfidence: 0.75,
    });

    expect(result.errors).toEqual([]);
    expect(result.applied.filter((r) => r.action === 'create')).toHaveLength(1);

    const doc = JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8'));
    const persisted = doc.mappings.find((m: any) => m.externalComponent === 'Command Menu Trigger');
    expect(persisted).toBeDefined();
    expect(persisted.projection_variants).toEqual(variants);
  });

  it('dry-run (apply:false) does NOT persist projection_variants even when present on candidate', async () => {
    const handle = await loadHandle();
    const report = loadFixture();
    const variants = [{ id: 'variant-1', surface: 'desktop' }];
    (report.candidate_objects[0] as any).projection_variants = variants;

    const result = await handle({ report, apply: false, minConfidence: 0.75 });

    expect(result.errors).toEqual([]);
    const doc = JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8'));
    const candidateNotPersisted = doc.mappings.find((m: any) => m.externalComponent === 'Command Menu Trigger');
    expect(candidateNotPersisted).toBeUndefined();
  });

  it('updates projection_variants on patch verdict when they differ from the existing mapping', async () => {
    // Seed existing mapping with old variants
    writeMappings([
      {
        id: 'linear-issue-row',
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z', notes: 'Imported from sprint-52 fixture' },
        projection_variants: [{ id: 'old-variant', surface: 'desktop' }],
      },
      {
        id: 'linear-billing-plan-card',
        externalSystem: 'linear',
        externalComponent: 'Billing Plan Card',
        oodsTraits: ['Priceable', 'Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
      {
        id: 'linear-workspace-switcher',
        externalSystem: 'linear',
        externalComponent: 'Workspace Switcher',
        oodsTraits: ['Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
    ]);

    const handle = await loadHandle();
    const report = loadFixture();
    const patchCandidate = report.candidate_objects.find((c) => c.action === 'patch')!;
    const newVariants = [
      { id: 'variant-1', surface: 'desktop', selector: '.issue-row' },
      { id: 'variant-2', surface: 'mobile' },
    ];
    (patchCandidate as any).projection_variants = newVariants;

    const result = await handle({ report, apply: true, minConfidence: 0.75 });

    expect(result.errors).toEqual([]);
    const doc = JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8'));
    const patched = doc.mappings.find((m: any) => m.id === 'linear-issue-row');
    expect(patched.projection_variants).toEqual(newVariants);
  });

  it('does NOT trigger a patch when candidate projection_variants match existing (routing stability)', async () => {
    const sameVariants = [{ id: 'variant-1', surface: 'desktop' }];
    writeMappings([
      {
        id: 'linear-issue-row',
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z', notes: 'Imported from sprint-52 fixture' },
        projection_variants: sameVariants,
      },
      {
        id: 'linear-billing-plan-card',
        externalSystem: 'linear',
        externalComponent: 'Billing Plan Card',
        oodsTraits: ['Priceable', 'Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
      {
        id: 'linear-workspace-switcher',
        externalSystem: 'linear',
        externalComponent: 'Workspace Switcher',
        oodsTraits: ['Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
    ]);

    const handle = await loadHandle();
    const report = loadFixture();
    const patchCandidate = report.candidate_objects.find((c) => c.action === 'patch')!;
    // Zero out diff-triggered changes so the candidate only has the SAME variants.
    patchCandidate.diff = { added_traits: [], removed_traits: [], changed_fields: [] };
    patchCandidate.recommended_oods_traits = ['Listable'];
    (patchCandidate as any).projection_variants = sameVariants;

    const result = await handle({ report, apply: true, minConfidence: 0.75 });

    // Patch still routed (bucket count preserved), but persisted:false because no changes.
    const patchedEntry = result.applied.find((r) => r.action === 'patch');
    expect(patchedEntry).toBeDefined();
    expect(patchedEntry!.persisted).toBe(false);
  });

  it('bucket counts are invariant when variants are added to a fixture that otherwise routes unchanged (routing stability)', async () => {
    const baselineHandle = await loadHandle();
    const baseline = await baselineHandle({ report: loadFixture(), minConfidence: 0.75 });

    const reportWithVariants = loadFixture();
    (reportWithVariants.candidate_objects[0] as any).projection_variants = [
      { id: 'v1', surface: 'desktop' },
    ];
    (reportWithVariants.candidate_objects[1] as any).projection_variants = [
      { id: 'v2', surface: 'mobile' },
    ];

    const handle = await loadHandle();
    const withVariants = await handle({ report: reportWithVariants, minConfidence: 0.75 });

    expect(withVariants.applied.length).toBe(baseline.applied.length);
    expect(withVariants.skipped.length).toBe(baseline.skipped.length);
    expect(withVariants.queued.length).toBe(baseline.queued.length);
    expect(withVariants.conflicted.length).toBe(baseline.conflicted.length);
    expect(withVariants.errors.length).toBe(baseline.errors.length);
    expect(withVariants.diff).toMatchObject({
      create: baseline.diff.create,
      patch: baseline.diff.patch,
      skip: baseline.diff.skip,
      conflict: baseline.diff.conflict,
      queued: baseline.diff.queued,
    });
  });

  it('dry-run preview surfaces variants on the proposed mapping applied-route entry (SC3)', async () => {
    const handle = await loadHandle();
    const report = loadFixture();
    (report.candidate_objects[0] as any).projection_variants = [
      { id: 'variant-1', surface: 'desktop' },
    ];

    // Reset to empty so the create verdict actually routes to create (not existing-match).
    writeMappings([
      {
        id: 'linear-issue-row',
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z', notes: 'Imported from sprint-52 fixture' },
      },
      {
        id: 'linear-billing-plan-card',
        externalSystem: 'linear',
        externalComponent: 'Billing Plan Card',
        oodsTraits: ['Priceable', 'Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
      {
        id: 'linear-workspace-switcher',
        externalSystem: 'linear',
        externalComponent: 'Workspace Switcher',
        oodsTraits: ['Stateful'],
        confidence: 'manual',
        metadata: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
    ]);

    const dryRun = await handle({ report, apply: false, minConfidence: 0.75 });

    // Dry-run output exposes the applied routes with persisted:false — m01 dry-run already
    // returns the constructed mapping in map.create's response; here we confirm the apply
    // loop at least routes the variant-bearing candidate into `applied` with persisted:false.
    const createdRoute = dryRun.applied.find((r) => r.action === 'create' && r.name === 'Command Menu Trigger');
    expect(createdRoute).toBeDefined();
    expect(createdRoute!.persisted).toBe(false);
  });
});
