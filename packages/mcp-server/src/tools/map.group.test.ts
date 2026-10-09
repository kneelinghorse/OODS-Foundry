/**
 * Parity test for the grouped `map` action-parameter tool.
 *
 * Guarantees zero-functionality-loss consolidation:
 *  - every payload valid under the OLD per-action input schema is valid under the
 *    grouped schema (with `action` added), and AJV useDefaults injects identical
 *    defaults via the if/then branches;
 *  - payloads invalid under the old schema (extra key / missing required / wrong
 *    action) are invalid under the grouped schema;
 *  - the grouped dispatch module routes each action to the per-action handler
 *    (read-only list/resolve executed for real against a tmp registry; unknown
 *    action throws; write actions are asserted as switch cases without writes).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS = path.join(HERE, '../schemas');

const readSchema = (rel: string): any =>
  JSON.parse(fs.readFileSync(path.join(SCHEMAS, rel), 'utf8'));

const groupedInput = readSchema('map.input.json');
const readInput = readSchema('map.read.input.json');
const groupedOutput = readSchema('map.output.json');

const perActionInput: Record<string, any> = {
  apply: readSchema('map.apply.input.json'),
  create: readSchema('map.create.input.json'),
  list: readSchema('map.list.input.json'),
  resolve: readSchema('map.resolve.input.json'),
  update: readSchema('map.update.input.json'),
  delete: readSchema('map.delete.input.json'),
};

const perActionOutput: Record<string, any> = {
  apply: readSchema('map.apply.output.json'),
  create: readSchema('map.create.output.json'),
  list: readSchema('map.list.output.json'),
  resolve: readSchema('map.resolve.output.json'),
  update: readSchema('map.update.output.json'),
  delete: readSchema('map.delete.output.json'),
};

const ACTIONS = ['apply', 'create', 'list', 'resolve', 'update', 'delete'] as const;

// A minimal valid reconciliation report for the apply branch.
const RECON_REPORT = {
  kind: 'reconciliation_report',
  schema_version: '1.3.0',
  generated_at: '2026-06-09T00:00:00.000Z',
  target: { id: 'target-1' },
  candidate_objects: [
    {
      object_id: 'obj-1',
      name: 'Button',
      role: 'action',
      confidence: 0.9,
      recommended_oods_traits: ['interactive'],
      action: 'create',
      reasoning: 'High-confidence create candidate.',
    },
  ],
};

// Representative VALID payloads per action (body only, no `action` key).
const VALID_BODY: Record<string, any> = {
  apply: { report: RECON_REPORT },
  create: {
    externalSystem: 'material',
    externalComponent: 'Button',
    oodsTraits: ['interactive'],
  },
  list: { externalSystem: 'material' },
  resolve: { externalSystem: 'material', externalComponent: 'Button' },
  update: { id: 'material-button', updates: { confidence: 'manual' } },
  delete: { id: 'material-button' },
};

// A second VALID payload per action that EXERCISES branch-local defaults so the
// defaults-parity check is meaningful (apply: apply+minConfidence; create:
// apply+confidence; others have no useful defaults so reuse the base body).
const DEFAULTS_BODY: Record<string, any> = {
  apply: { report: RECON_REPORT },
  create: {
    externalSystem: 'material',
    externalComponent: 'TextField',
    oodsTraits: ['input'],
    propMappings: [{ externalProp: 'value', oodsProp: 'value' }],
  },
  list: { externalSystem: 'material' },
  resolve: { externalSystem: 'material', externalComponent: 'Button' },
  update: { id: 'material-button', updates: { confidence: 'manual' } },
  delete: { id: 'material-button' },
};

// Representative INVALID payloads per action (independent of the discriminator):
// extra key / missing required field.
const INVALID_BODY: Record<string, any> = {
  apply: { reportPath: '/x', report: RECON_REPORT }, // oneOf: both -> invalid
  create: { externalSystem: 'material', externalComponent: 'Button' }, // missing oodsTraits
  list: { bogus: true }, // extra key (additionalProperties:false)
  resolve: { externalSystem: 'material' }, // missing externalComponent
  update: { id: 'material-button' }, // missing updates
  delete: {}, // missing id
};

const ajv = getAjv();
const validateGrouped = ajv.compile(groupedInput);
const validateRead = ajv.compile(readInput);
const validateGroupedOut = ajv.compile(groupedOutput);
const perActionValidators: Record<string, any> = Object.fromEntries(
  ACTIONS.map((a) => [a, ajv.compile(perActionInput[a])]),
);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('schemas/map.input — grouped input compiles + parity', () => {
  it('grouped input schema compiles under the production AJV', () => {
    expect(typeof validateGrouped).toBe('function');
  });

  it('each family lists only its read or write actions', () => {
    expect(groupedInput.properties.action.enum.slice().sort()).toEqual(
      ['apply', 'create', 'delete', 'draft', 'update'],
    );
    expect(readInput.properties.action.enum.slice().sort()).toEqual(['list', 'resolve', 'show']);
  });

  for (const action of ACTIONS) {
    const validateGrouped = ['list', 'resolve'].includes(action) ? validateRead : ajv.compile(groupedInput);
    describe(`action="${action}"`, () => {
      it('VALID body validates under BOTH old per-action and grouped schema', () => {
        const old = clone(VALID_BODY[action]);
        expect(perActionValidators[action](old)).toBe(true);

        const grouped = { action, ...clone(VALID_BODY[action]) };
        expect(validateGrouped(grouped)).toBe(true);
      });

      it('useDefaults injects IDENTICAL defaults under old and grouped branches', () => {
        // Per-action validator mutates a bare body; grouped validator mutates a
        // body carrying the discriminator. Strip `action` from the grouped
        // result before comparing — the rest must match byte-for-byte.
        const oldDoc = clone(DEFAULTS_BODY[action]);
        perActionValidators[action](oldDoc);

        const groupedDoc: any = { action, ...clone(DEFAULTS_BODY[action]) };
        validateGrouped(groupedDoc);
        const { action: _drop, ...groupedRest } = groupedDoc;

        expect(groupedRest).toEqual(oldDoc);
      });

      it('INVALID body fails under the grouped schema', () => {
        const grouped = { action, ...clone(INVALID_BODY[action]) };
        expect(validateGrouped(grouped)).toBe(false);
      });

      it('an EXTRA unexpected key fails the grouped branch (additionalProperties:false honored)', () => {
        const grouped = {
          action,
          ...clone(VALID_BODY[action]),
          __unexpected__: true,
        };
        expect(validateGrouped(grouped)).toBe(false);
      });
    });
  }

  it('missing action is rejected (required discriminator)', () => {
    expect(validateGrouped({ externalSystem: 'material' })).toBe(false);
  });

  it('unknown action value is rejected by the enum', () => {
    expect(validateGrouped({ action: 'nope', id: 'x' })).toBe(false);
  });

  it('a create body under a delete action is rejected (branch mismatch)', () => {
    // create's required fields are extra keys under the delete branch.
    expect(
      validateGrouped({ action: 'delete', ...clone(VALID_BODY.create) }),
    ).toBe(false);
  });
});

describe('schemas/map.output — grouped anyOf accepts each per-action output', () => {
  const SAMPLE_ETAG = 'a'.repeat(64);
  const SAMPLE_OUTPUT: Record<string, any> = {
    apply: {
      applied: [],
      skipped: [],
      queued: [],
      conflicted: [],
      errors: [],
      diff: {
        create: 0,
        patch: 0,
        skip: 0,
        conflict: 0,
        queued: 0,
        changedFields: [],
        addedTraits: [],
        removedTraits: [],
      },
      etag: SAMPLE_ETAG,
    },
    create: { status: 'ok', mapping: { id: 'material-button' }, etag: SAMPLE_ETAG },
    list: {
      mappings: [],
      totalCount: 0,
      stats: { mappingCount: 0, systemCount: 0 },
      etag: SAMPLE_ETAG,
    },
    resolve: { status: 'not_found', message: 'nope' },
    update: { status: 'ok', mapping: { id: 'material-button' }, changes: ['confidence'] },
    delete: { status: 'ok', deleted: { id: 'material-button' } },
  };

  for (const action of ACTIONS) {
    it(`${action} output validates against the grouped anyOf output schema`, () => {
      expect(validateGroupedOut(SAMPLE_OUTPUT[action])).toBe(true);
    });
    it(`${action} output validates against its own per-action output schema (sanity)`, () => {
      const v = ajv.compile(perActionOutput[action]);
      expect(v(SAMPLE_OUTPUT[action])).toBe(true);
    });
  }
});

describe('tools/map — grouped dispatch routes to per-action handlers', () => {
  let tmpDir: string;
  const ENV = 'MCP_MAPPINGS_PATH';
  const prevEnv = process.env[ENV];

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-group-'));
    // Point the registry at an empty tmp file so list/resolve are hermetic and
    // never touch the repo's real component-mappings.json.
    process.env[ENV] = path.join(tmpDir, 'component-mappings.json');
  });

  afterAll(() => {
    if (prevEnv === undefined) delete process.env[ENV];
    else process.env[ENV] = prevEnv;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('lets the handler name every invalid list entry under V219, identically for inline and file input', async () => {
    const { handle: groupHandle } = await import('./map.js');
    const mappings = [{ externalSystem: 'team', externalComponent: 'Button', oodsTraits: [] }];
    const payload = { action: 'create', mappings, apply: true };
    expect(validateGrouped(payload)).toBe(true);
    const inline = await groupHandle(payload as any);
    const mappingsPath = path.join(tmpDir, 'checked-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify({ mappings }));
    const file = await groupHandle({ action: 'create', mappingsPath, apply: true });
    expect(file).toEqual(inline);
    expect(validateGroupedOut(inline)).toBe(true);
    expect(inline).toMatchObject({ status: 'error', applied: false, entries: [
      { index: 0, id: 'team-button', status: 'invalid', errors: expect.arrayContaining([expect.objectContaining({ code: 'OODS-V219' })]) },
    ] });
    expect(fs.existsSync(path.join(tmpDir, 'component-mappings.json'))).toBe(false);
  });

  it('routes action="list" identically to the per-action handler (read-only)', async () => {
    const { handle: groupHandle } = await import('./map.read.js');
    const { handle: listHandle } = await import('./map.list.js');
    const direct = await listHandle({ externalSystem: 'material' } as any);
    const viaGroup = await groupHandle({
      action: 'list',
      externalSystem: 'material',
    } as any);
    expect(viaGroup).toEqual(direct);
  });

  it('routes action="resolve" identically to the per-action handler (read-only)', async () => {
    const { handle: groupHandle } = await import('./map.read.js');
    const { handle: resolveHandle } = await import('./map.resolve.js');
    const args = { externalSystem: 'material', externalComponent: 'Button' };
    const direct = await resolveHandle(args as any);
    const viaGroup = await groupHandle({ action: 'resolve', ...args } as any);
    expect(viaGroup).toEqual(direct);
  });

  it('routes action="apply" dry-run identically to the per-action handler (no writes)', async () => {
    // apply defaults to apply:false (dry-run) — no persistence; safe to run.
    const { handle: groupHandle } = await import('./map.js');
    const { handle: applyHandle } = await import('./map.apply.js');
    const payload = { report: clone(RECON_REPORT) };
    const direct = await applyHandle(clone(payload) as any);
    const viaGroup = await groupHandle({ action: 'apply', ...clone(payload) } as any);
    expect(viaGroup).toEqual(direct);
  });

  it('every known action is a switch case; unknown action throws', async () => {
    const { handle: groupHandle } = await import('./map.js');
    // Defensive default branch — AJV would normally reject this upstream.
    await expect(groupHandle({ action: 'frobnicate' } as any)).rejects.toThrow(
      /Unknown action/,
    );

    // Assert the write/destructive actions (create/update/delete) are wired as
    // cases WITHOUT executing real persistence: each is reachable and does NOT
    // fall through to the Unknown-action throw. We probe with a deliberately
    // malformed body so the per-action handler returns/throws BEFORE any write,
    // and assert the error is never the dispatcher's "Unknown action" guard.
    for (const action of ['create', 'update', 'delete'] as const) {
      let threwUnknown = false;
      try {
        await groupHandle({ action } as any);
      } catch (e) {
        threwUnknown = /Unknown action/.test(String((e as Error)?.message));
      }
      expect(threwUnknown).toBe(false);
    }
  });
});
