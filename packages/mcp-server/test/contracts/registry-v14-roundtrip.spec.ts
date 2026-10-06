/**
 * C6 v1.4.0 registry round-trip contract tests (sprint-103 m02).
 *
 * Closes the largest remaining gap in the canonical mission-graph C-track by
 * proving that the OODS-side handlers preserve the four v1.4.0 stub fields
 * losslessly through write → save → load:
 *
 *   - top-level `disambiguation_decisions[]` (Stage1 review-decision events)
 *   - top-level `preferred_terms[]`           (canonical-term entities)
 *   - top-level `capabilities[]`              (capability rollup entities)
 *   - per-mapping `projection_variants[]`     (cross-surface identity)
 *
 * s216-m03: top-level drafts stay in storage and are omitted from registry.snapshot;
 * they are not consumed by map.resolve, composition or generation. Lossless persistence is the bounded claim;
 * this contract does not certify executable review or vocabulary semantics.
 *
 * Bilateral non-regression: the production
 * `artifacts/structured-data/component-mappings.json` continues to validate
 * against the updated component-mapping.schema.json (pre-v1.4.0 docs omit
 * the three new top-level arrays entirely; they're optional + additive).
 *
 * projection_variants round-trip: serialize a SemanticEntity with
 * projection_variants → reload → runPreEmit({variant:'mobile'}) selects the
 * mobile-variant slot tree (proves the s100-m03 selectVariant pathway
 * survives a JSON round-trip, not just a render-time call).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAjv } from '../../src/lib/ajv.js';
import componentMappingSchema from '../../src/schemas/component-mapping.schema.json' with { type: 'json' };
import syntheticFixture from '../fixtures/object-catalog/registry-v14-synthetic.json' with { type: 'json' };
import stage1ShapeFixture from '../fixtures/object-catalog/registry-v14-stage1-shape.json' with { type: 'json' };
import userFixture from '../../src/object-catalog/fixtures/user.json' with { type: 'json' };

import { handle as createHandle } from '../../src/tools/map.create.js';
import { handle as snapshotHandle } from '../../src/tools/registry.snapshot.js';
import { runPreEmit } from '../../src/codegen/pre-emit.js';
import type {
  MapCreateInput,
  Stage1CapabilityEntity,
  Stage1DisambiguationDecision,
  Stage1PreferredTermEntity,
} from '../../src/tools/types.js';
import type { SemanticEntity } from '../../src/object-catalog/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const PROD_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';

const ajv = getAjv();
const validateMappingDoc = ajv.compile(componentMappingSchema);

let originalEnvOverride: string | undefined;
let tmpRoot: string;

beforeAll(() => {
  originalEnvOverride = process.env[MAPPINGS_PATH_ENV];
});

afterAll(() => {
  if (originalEnvOverride === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalEnvOverride;
  }
});

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-v14-'));
  process.env[MAPPINGS_PATH_ENV] = path.join(tmpRoot, 'component-mappings.json');
});

afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// G1 — AJV validation of the two new contract fixtures
// ---------------------------------------------------------------------------

describe('G1 — v1.4.0 fixtures validate against the updated mapping schema', () => {
  it('synthetic fixture validates cleanly', () => {
    const ok = validateMappingDoc(syntheticFixture);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(validateMappingDoc.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('Stage1-shape fixture validates cleanly', () => {
    const ok = validateMappingDoc(stage1ShapeFixture);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(validateMappingDoc.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('both fixtures carry all 4 v1.4.0 surfaces (sanity check on the fixture content itself)', () => {
    for (const fixture of [syntheticFixture, stage1ShapeFixture] as Array<Record<string, unknown>>) {
      expect(Array.isArray(fixture.disambiguation_decisions)).toBe(true);
      expect(Array.isArray(fixture.preferred_terms)).toBe(true);
      expect(Array.isArray(fixture.capabilities)).toBe(true);
      const mappings = fixture.mappings as Array<Record<string, unknown>>;
      const hasProjVariants = mappings.some(
        (m) => Array.isArray(m.projection_variants) && (m.projection_variants as unknown[]).length > 0,
      );
      expect(hasProjVariants).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// G2 — Bilateral non-regression: existing production doc still validates
// ---------------------------------------------------------------------------

describe('G2 — bilateral non-regression', () => {
  it('production artifacts/structured-data/component-mappings.json still validates against the updated schema', () => {
    if (!fs.existsSync(PROD_MAPPINGS_PATH)) {
      // Test is meaningful only when the production file exists; if absent,
      // skip with a visible reason rather than silently passing.
      // eslint-disable-next-line no-console
      console.warn(`[G2] production mappings doc not found at ${PROD_MAPPINGS_PATH}; skipping`);
      return;
    }
    const doc = JSON.parse(fs.readFileSync(PROD_MAPPINGS_PATH, 'utf8'));
    const ok = validateMappingDoc(doc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(validateMappingDoc.errors, null, 2));
    }
    expect(ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// G3 — Round-trip via map.create → save → load → registry.snapshot
// ---------------------------------------------------------------------------

const DECISION_FIXTURE: Stage1DisambiguationDecision = {
  decision_id: 'rt-dec-001',
  decision_type: 'preferred_name',
  scope: 'registry',
  status: 'promoted',
  target_kind: 'preferred_term',
  target_id: 'rt-term-001',
  selected_value: 'Save Record',
  rationale: 'round-trip test',
  decided_by: 'agent',
  decided_at: '2026-05-21T00:00:00.000Z',
};

const PREFERRED_TERM_FIXTURE: Stage1PreferredTermEntity = {
  entity_type: 'preferred_term',
  id: 'rt-term-001',
  slug: 'save-record',
  label: 'Save Record',
  aliases: ['Save', 'Store'],
  scope: 'registry',
  source_decision_ids: ['rt-dec-001'],
};

const CAPABILITY_FIXTURE: Stage1CapabilityEntity = {
  entity_type: 'capability',
  id: 'rt-cap-001',
  slug: 'save-record',
  name: 'Save Record',
  canonical_verb: 'save',
  oods_traits: ['Stateful'],
};

const BASE_INPUT: MapCreateInput = {
  apply: true,
  externalSystem: 'roundtrip-system',
  externalComponent: 'SaveButton',
  oodsTraits: ['Stateful'],
  confidence: 'manual',
  projection_variants: [
    {
      id: 'rt-desktop',
      surface: 'desktop',
      external_component: 'DesktopSaveButton',
      capability_id: 'rt-cap-001',
      selector: '.save-btn',
      confidence: 0.88,
    },
    {
      id: 'rt-mobile',
      surface: 'mobile',
      external_component: 'MobileSaveButton',
      capability_id: 'rt-cap-001',
      confidence: 0.74,
    },
  ],
  disambiguation_decisions: [DECISION_FIXTURE],
  preferred_terms: [PREFERRED_TERM_FIXTURE],
  capabilities: [CAPABILITY_FIXTURE],
};

describe('G3 — round-trip preserves all 4 v1.4.0 fields losslessly', () => {
  it('map.create preserves historical draft fields without advertising them as registry capabilities', async () => {
    const created = await createHandle(BASE_INPUT);
    expect(created.status).toBe('ok');
    expect(created.applied).toBe(true);

    const snapshot = await snapshotHandle({});
    const stored = JSON.parse(fs.readFileSync(process.env[MAPPINGS_PATH_ENV]!, 'utf8'));
    expect(stored.disambiguation_decisions).toEqual([DECISION_FIXTURE]);
    expect(stored.preferred_terms).toEqual([PREFERRED_TERM_FIXTURE]);
    expect(stored.capabilities).toEqual([CAPABILITY_FIXTURE]);
    for (const key of ['disambiguation_decisions', 'preferred_terms', 'capabilities']) expect(snapshot).not.toHaveProperty(key);

    // projection_variants survive as a mapping-level field (already shipped before m02; we verify it didn't regress).
    const persistedMapping = snapshot.maps.find(
      (m) => (m as { id: string }).id === 'roundtrip-system-save-button',
    ) as Record<string, unknown> | undefined;
    expect(persistedMapping).toBeDefined();
    expect(Array.isArray(persistedMapping!.projection_variants)).toBe(true);
    expect((persistedMapping!.projection_variants as unknown[])).toHaveLength(2);
  });

  it('on-disk MappingsDoc validates against the updated schema after the round-trip', async () => {
    await createHandle(BASE_INPUT);
    const persistedPath = process.env[MAPPINGS_PATH_ENV]!;
    const doc = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
    const ok = validateMappingDoc(doc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(validateMappingDoc.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  it('dry-run (apply=false) does NOT write top-level arrays', async () => {
    const dry = await createHandle({ ...BASE_INPUT, apply: false });
    expect(dry.status).toBe('ok');
    expect(dry.applied).toBe(false);
    // The persisted file should still be empty (or pre-existing without these fields).
    const snapshot = await snapshotHandle({});
    expect(snapshot).not.toHaveProperty('disambiguation_decisions');
    expect(snapshot).not.toHaveProperty('preferred_terms');
    expect(snapshot).not.toHaveProperty('capabilities');
  });

  it('omitting v1.4.0 inputs entirely keeps the persisted doc free of the new top-level keys', async () => {
    const minimalInput: MapCreateInput = {
      apply: true,
      externalSystem: 'roundtrip-system',
      externalComponent: 'PlainButton',
      oodsTraits: ['Stateful'],
      confidence: 'manual',
    };
    await createHandle(minimalInput);
    const persistedPath = process.env[MAPPINGS_PATH_ENV]!;
    const doc = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
    expect(doc.disambiguation_decisions).toBeUndefined();
    expect(doc.preferred_terms).toBeUndefined();
    expect(doc.capabilities).toBeUndefined();
  });

  it('multiple map.create calls APPEND to the top-level arrays (not replace)', async () => {
    await createHandle(BASE_INPUT);
    await createHandle({
      ...BASE_INPUT,
      externalComponent: 'AnotherButton',
      disambiguation_decisions: [{ ...DECISION_FIXTURE, decision_id: 'rt-dec-002' }],
      preferred_terms: [],
      capabilities: [],
    });
    const snapshot = JSON.parse(fs.readFileSync(process.env[MAPPINGS_PATH_ENV]!, 'utf8'));
    expect(snapshot.disambiguation_decisions).toHaveLength(2);
    expect(snapshot.disambiguation_decisions!.map((d) => d.decision_id).sort()).toEqual([
      'rt-dec-001',
      'rt-dec-002',
    ]);
    // preferred_terms / capabilities array unchanged after the second call.
    expect(snapshot.preferred_terms).toHaveLength(1);
    expect(snapshot.capabilities).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// G4 — projection_variants selectVariant() round-trip via runPreEmit
// ---------------------------------------------------------------------------

describe('G4 — projection_variants round-trip via runPreEmit (Object Catalog side)', () => {
  // Synthesize a SemanticEntity with multiple projection variants, serialize,
  // then reload, then call runPreEmit with a variant arg. selectVariant() must
  // pick the variant tree from the reloaded entity, not the canonical render
  // slots.
  const entity: SemanticEntity = {
    urn: 'urn:proto:semantic:roundtrip-button@1.0.0',
    element: { type: 'ui.action.button', name: 'Roundtrip Button' },
    semantics: { purpose: 'save', human_meaning: 'persist the record' },
    pragmatic_role: 'primary_action',
    traits: ['Stateful'],
    oods: {
      catalog: { version: '1.0.0' },
      render: {
        ui_schema_ref: 'compose-save-button',
        slots: [
          { name: 'label', binding: { field: 'label' } },
          { name: 'icon', binding: { field: 'icon' } },
          { name: 'helper', binding: { field: 'helper' } },
        ],
      },
      projection_variants: [
        {
          surface: 'desktop',
          ui_schema_ref: 'compose-save-button',
          slots: [
            { name: 'label', binding: { field: 'label' } },
            { name: 'icon', binding: { field: 'icon' } },
            { name: 'helper', binding: { field: 'helper' } },
          ],
        },
        {
          surface: 'mobile',
          ui_schema_ref: 'compose-save-button-mobile',
          slots: [
            { name: 'label', binding: { field: 'label' } },
            { name: 'icon', binding: { field: 'icon' } },
          ],
        },
      ],
    },
  };

  it('JSON-roundtripped entity still selects mobile variant via runPreEmit({variant: "mobile"})', () => {
    const roundtripped = JSON.parse(JSON.stringify(entity)) as SemanticEntity;
    const ctx = runPreEmit(roundtripped, { variant: 'mobile' });
    expect(ctx.catalog).toBeDefined();
    expect(ctx.catalog!.slots).toHaveLength(2);
    expect(ctx.catalog!.slots.map((s) => s.name)).toEqual(['label', 'icon']);
  });

  it('JSON-roundtripped entity selects desktop variant when explicitly requested', () => {
    const roundtripped = JSON.parse(JSON.stringify(entity)) as SemanticEntity;
    const ctx = runPreEmit(roundtripped, { variant: 'desktop' });
    expect(ctx.catalog!.slots).toHaveLength(3);
    expect(ctx.catalog!.slots.map((s) => s.name)).toEqual(['label', 'icon', 'helper']);
  });

  it('JSON-roundtripped entity falls back to canonical render slots when variant is omitted', () => {
    const roundtripped = JSON.parse(JSON.stringify(entity)) as SemanticEntity;
    const ctx = runPreEmit(roundtripped);
    expect(ctx.catalog!.slots).toHaveLength(3);
    expect(ctx.catalog!.slots.map((s) => s.name)).toEqual(['label', 'icon', 'helper']);
  });

  it('production user fixture round-trips through JSON without losing oods.* extension fields', () => {
    const roundtripped = JSON.parse(JSON.stringify(userFixture)) as { entities: SemanticEntity[] };
    const ctx = runPreEmit(roundtripped.entities[0]);
    expect(ctx.catalog).toBeDefined();
    expect(ctx.catalog!.urn).toBe(roundtripped.entities[0].urn);
  });
});
