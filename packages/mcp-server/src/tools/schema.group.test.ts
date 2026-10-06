import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import { handle as groupHandle } from './schema/index.js';
import { handle as saveHandle } from './schema/save.js';
import { handle as loadHandle } from './schema/load.js';
import { handle as listHandle } from './schema/list.js';
import { handle as deleteHandle } from './schema/delete.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.join(__dirname, '../schemas');

function loadSchema(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
}

const ajv = getAjv();

// Per-action (OLD) input schemas + grouped input schema.
const groupedInput = loadSchema('schema.input.json');
const groupedOutput = loadSchema('schema.output.json');
const perActionInput: Record<string, any> = {
  save: loadSchema('schema.save.input.json'),
  load: loadSchema('schema.load.input.json'),
  list: loadSchema('schema.list.input.json'),
  delete: loadSchema('schema.delete.input.json'),
};
const perActionOutput: Record<string, any> = {
  save: loadSchema('schema.save.output.json'),
  load: loadSchema('schema.load.output.json'),
  list: loadSchema('schema.list.output.json'),
  delete: loadSchema('schema.delete.output.json'),
};

// Compile once. AJV with useDefaults mutates the validated value in place.
const validateGroupedIn = ajv.compile(groupedInput);
const validateGroupedOut = ajv.compile(groupedOutput);
const validatePerIn: Record<string, any> = Object.fromEntries(
  Object.entries(perActionInput).map(([k, v]) => [k, ajv.compile(v)]),
);
const validatePerOut: Record<string, any> = Object.fromEntries(
  Object.entries(perActionOutput).map(([k, v]) => [k, ajv.compile(v)]),
);

// Representative VALID per-action payloads (without the action discriminator).
const VALID: Record<string, any> = {
  save: { name: 'invoice-detail', schemaRef: 'schema://abc123', tags: ['billing'], author: 'derek' },
  load: { name: 'invoice-detail' },
  list: { object: 'Invoice', context: 'detail', tags: ['billing'] },
  delete: { name: 'invoice-detail' },
};

// Representative INVALID payloads per action (each should fail BOTH schemas).
const INVALID: Record<string, any[]> = {
  // missing required schemaRef; extra unknown key; bad slug pattern
  save: [
    { name: 'invoice-detail' },
    { name: 'invoice-detail', schemaRef: 'schema://abc', bogus: 1 },
    { name: 'bad name!', schemaRef: 'schema://abc' },
  ],
  load: [{}, { name: 'ok', extra: true }, { name: 'bad name!' }],
  list: [{ object: '' }, { unknown: true }],
  delete: [{}, { name: 'ok', extra: true }, { name: 'bad name!' }],
};

const ACTIONS = ['save', 'load', 'list', 'delete'] as const;

describe('schema grouped tool — input schema parity', () => {
  it('grouped input schema and output schema compile under the repo AJV', () => {
    expect(typeof validateGroupedIn).toBe('function');
    expect(typeof validateGroupedOut).toBe('function');
  });

  for (const action of ACTIONS) {
    describe(`action=${action}`, () => {
      it('valid payload is valid under BOTH old per-action and grouped schema', () => {
        const perOk = validatePerIn[action](structuredClone(VALID[action]));
        expect(perOk, JSON.stringify(validatePerIn[action].errors)).toBe(true);

        const grouped = { action, ...structuredClone(VALID[action]) };
        const groupedOk = validateGroupedIn(grouped);
        expect(groupedOk, JSON.stringify(validateGroupedIn.errors)).toBe(true);
      });

      it('applies IDENTICAL defaults under both schemas (useDefaults parity)', () => {
        // None of the schema-family inputs declare schema defaults, so the
        // parity assertion is that neither mutates the payload (beyond the
        // discriminator we add for the grouped case).
        const perPayload = structuredClone(VALID[action]);
        validatePerIn[action](perPayload);

        const groupedPayload = { action, ...structuredClone(VALID[action]) };
        validateGroupedIn(groupedPayload);

        // Strip the discriminator and compare the remaining mutated shape.
        const { action: _drop, ...groupedRest } = groupedPayload as any;
        expect(groupedRest).toEqual(perPayload);
      });

      it('invalid payloads fail under the grouped schema', () => {
        for (const bad of INVALID[action]) {
          const perOk = validatePerIn[action](structuredClone(bad));
          expect(perOk, `old schema unexpectedly accepted: ${JSON.stringify(bad)}`).toBe(false);

          const groupedOk = validateGroupedIn({ action, ...structuredClone(bad) });
          expect(groupedOk, `grouped schema unexpectedly accepted: ${JSON.stringify(bad)}`).toBe(false);
        }
      });
    });
  }

  it('rejects an unknown action value', () => {
    expect(validateGroupedIn({ action: 'frobnicate', name: 'x' })).toBe(false);
  });

  it('rejects a missing action discriminator', () => {
    expect(validateGroupedIn({ name: 'invoice-detail', schemaRef: 'schema://abc' })).toBe(false);
  });

  it('rejects a payload whose body belongs to a different action than the discriminator', () => {
    // action=load but carrying save-only keys (schemaRef) — load branch is
    // additionalProperties:false so this must fail.
    expect(validateGroupedIn({ action: 'load', name: 'x', schemaRef: 'schema://abc' })).toBe(false);
  });
});

describe('schema grouped tool — output schema parity', () => {
  const SAMPLE_OUTPUTS: Record<string, any> = {
    save: {
      name: 'invoice-detail',
      version: 1,
      object: 'Invoice',
      context: 'detail',
      author: 'derek',
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
      tags: ['billing'],
    },
    load: {
      schemaRef: 'schema://abc123',
      name: 'invoice-detail',
      version: 1,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
      tags: [],
    },
    list: [
      {
        name: 'invoice-detail',
        schemaRef: 'schema://abc123',
        version: 2,
        createdAt: '2026-06-09T00:00:00.000Z',
        updatedAt: '2026-06-09T00:00:00.000Z',
        tags: ['billing'],
      },
    ],
    delete: {
      deleted: true,
      schema: {
        name: 'invoice-detail',
        schemaRef: 'schema://abc123',
        version: 1,
        createdAt: '2026-06-09T00:00:00.000Z',
        updatedAt: '2026-06-09T00:00:00.000Z',
        tags: [],
      },
    },
  };

  for (const action of ACTIONS) {
    it(`${action} output validates under BOTH old per-action and grouped output schema`, () => {
      const sample = SAMPLE_OUTPUTS[action];
      expect(validatePerOut[action](structuredClone(sample)), JSON.stringify(validatePerOut[action].errors)).toBe(true);
      expect(validateGroupedOut(structuredClone(sample)), JSON.stringify(validateGroupedOut.errors)).toBe(true);
    });
  }

  it('grouped output rejects a malformed result (missing required fields)', () => {
    expect(validateGroupedOut({ deleted: true })).toBe(false);
    expect(validateGroupedOut({ name: 'x' })).toBe(false);
  });
});

describe('schema grouped tool — dispatch routing (hermetic, tmp store)', () => {
  let tempRoot = '';
  const prevRoot = process.env.MCP_SCHEMA_STORE_ROOT;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-schema-group-test-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.MCP_SCHEMA_STORE_ROOT;
    else process.env.MCP_SCHEMA_STORE_ROOT = prevRoot;
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('routes action=list to the list handler (empty store -> same bare-array result)', async () => {
    const direct = await listHandle({});
    const viaGroup = await groupHandle({ action: 'list' });
    expect(viaGroup).toEqual(direct);
    expect(Array.isArray(viaGroup)).toBe(true);
  });

  it('routes action=load to the load handler (not-found path matches direct call)', async () => {
    const directErr = await loadHandle({ name: 'does-not-exist' }).then(
      () => null,
      (e) => e,
    );
    const groupErr = await groupHandle({ action: 'load', name: 'does-not-exist' }).then(
      () => null,
      (e) => e,
    );
    expect(directErr).toBeTruthy();
    expect(groupErr).toBeTruthy();
    expect(String(groupErr?.message)).toBe(String(directErr?.message));
  });

  it('routes action=delete to the delete handler (not-found path matches direct call)', async () => {
    const directErr = await deleteHandle({ name: 'does-not-exist' }).then(
      () => null,
      (e) => e,
    );
    const groupErr = await groupHandle({ action: 'delete', name: 'does-not-exist' }).then(
      () => null,
      (e) => e,
    );
    expect(directErr).toBeTruthy();
    expect(groupErr).toBeTruthy();
    expect(String(groupErr?.message)).toBe(String(directErr?.message));
  });

  it('routes action=save to the save handler (invalid schemaRef path matches direct call)', async () => {
    // No real write: an unresolvable schemaRef short-circuits before store.save.
    const directErr = await saveHandle({ name: 'x', schemaRef: 'schema://nope' }).then(
      () => null,
      (e) => e,
    );
    const groupErr = await groupHandle({ action: 'save', name: 'x', schemaRef: 'schema://nope' }).then(
      () => null,
      (e) => e,
    );
    expect(directErr).toBeTruthy();
    expect(groupErr).toBeTruthy();
    expect(String(groupErr?.message)).toBe(String(directErr?.message));
  });

  it('throws on an unknown action (defensive default)', async () => {
    await expect(groupHandle({ action: 'frobnicate' as any })).rejects.toThrow(/Unknown action: frobnicate/);
  });
});
