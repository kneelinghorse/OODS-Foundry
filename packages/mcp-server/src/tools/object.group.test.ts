import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../lib/ajv.js';
import { handle } from './object.js';
import { handle as listHandle } from './object.list.js';
import { handle as showHandle } from './object.show.js';
import { listObjects } from '../objects/object-loader.js';
import { isToolError } from '../errors/tool-error.js';

const SCHEMAS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schemas');
const readSchema = (file: string): any =>
  JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));

const groupedInput = readSchema('object.input.json');
const groupedOutput = readSchema('object.output.json');

// Per-action originals (untouched) — the parity baseline.
const PER_ACTION = {
  list: {
    input: readSchema('object.list.input.json'),
    output: readSchema('object.list.output.json'),
  },
  show: {
    input: readSchema('object.show.input.json'),
    output: readSchema('object.show.output.json'),
  },
  // s213-m03: the actions that let a team check, keep and re-read its own objects and traits.
  validate: {
    input: readSchema('object.validate.input.json'),
    output: readSchema('object.validate.output.json'),
  },
  register: {
    input: readSchema('object.register.input.json'),
    output: readSchema('object.register.output.json'),
  },
  reload: {
    input: readSchema('object.reload.input.json'),
    output: readSchema('object.reload.output.json'),
  },
} as const;

const ajv = getAjv();
const compile = (schema: any) => ajv.compile(schema);

// Compile once. The grouped validator is shared; AJV mutates in place via useDefaults,
// so each defaults assertion clones its payload before validating.
const validateGroupedIn = compile(groupedInput);
const validateWriteIn = compile(readSchema('object.write.input.json'));
const validateGroupedOut = compile(groupedOutput);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Representative payloads per action. `withAction` is what a grouped caller sends;
 * `perAction` is the original (no `action` key) used against the old per-action schema.
 */
const CASES = {
  list: {
    valid: [
      {},
      { domain: 'core' },
      { maturity: 'stable' },
      { trait: 'Priceable' },
      { domain: 'saas.billing', maturity: 'beta', trait: 'lifecycle/Stateful' },
    ],
    invalid: [
      { maturity: 'gold' }, // not in enum
      { bogus: true }, // additionalProperties:false
    ],
  },
  show: {
    valid: [
      { name: 'User' },
      { name: 'Product', context: 'detail' },
    ],
    invalid: [
      {}, // missing required `name`
      { name: 'User', extra: 1 }, // additionalProperties:false
    ],
  },
  validate: {
    valid: [{ yaml: 'object:\n  name: Warehouse\n' }],
    invalid: [{}, { yaml: '' }, { yaml: 'x', overwrite: true }],
  },
  register: {
    valid: [{ yaml: 'trait:\n  name: Stockable\n' }, { yaml: 'object:\n  name: Warehouse\n', overwrite: true }],
    invalid: [{}, { yaml: 'x', overwrite: 'yes' }],
  },
  reload: {
    valid: [{}],
    invalid: [{ folder: '/tmp' }],
  },
} as const;

describe('tools/object grouped schema — input parity', () => {
  for (const action of ['list', 'show', 'validate', 'register', 'reload'] as const) {
    const validatePerActionIn = compile(PER_ACTION[action].input);
    const validateInput = action === 'register' ? validateWriteIn : validateGroupedIn;

    describe(`action="${action}"`, () => {
      for (const body of CASES[action].valid) {
        it(`valid payload ${JSON.stringify(body)} passes BOTH old and grouped`, () => {
          // Old schema sees the body without `action`.
          const okOld = validatePerActionIn(clone(body));
          expect(okOld, JSON.stringify(validatePerActionIn.errors)).toBe(true);
          // Grouped schema sees the body WITH the discriminator added.
          const okGrouped = validateInput(clone({ action, ...body }));
          expect(okGrouped, JSON.stringify(validateInput.errors)).toBe(true);
        });
      }

      for (const body of CASES[action].invalid) {
        it(`invalid payload ${JSON.stringify(body)} fails the grouped schema`, () => {
          // It must also fail the old schema (sanity on the test fixture).
          expect(validatePerActionIn(clone(body))).toBe(false);
          expect(validateInput(clone({ action, ...body }))).toBe(false);
        });
      }
    });
  }

  it('grouped schema rejects a missing action', () => {
    expect(validateGroupedIn({})).toBe(false);
  });

  it('grouped schema rejects an unknown action', () => {
    expect(validateGroupedIn({ action: 'destroy' })).toBe(false);
  });

  it('grouped schema applies the SAME defaults as the per-action schema (list)', () => {
    // object.list.input.json declares no defaults — so the grouped branch must
    // likewise inject nothing beyond the passed-in keys (plus the discriminator).
    const perActionSchemaList = compile(PER_ACTION.list.input);
    const perPayload: any = { domain: 'core' };
    const groupedPayload: any = { action: 'list', domain: 'core' };
    perActionSchemaList(perPayload);
    validateGroupedIn(groupedPayload);
    // Strip the discriminator and compare the residual shape: identical.
    const { action: _drop, ...groupedResidual } = groupedPayload;
    expect(groupedResidual).toEqual(perPayload);
  });

  it('grouped schema applies the SAME defaults as the per-action schema (show)', () => {
    const perActionSchemaShow = compile(PER_ACTION.show.input);
    const perPayload: any = { name: 'User' };
    const groupedPayload: any = { action: 'show', name: 'User' };
    perActionSchemaShow(perPayload);
    validateGroupedIn(groupedPayload);
    const { action: _drop, ...groupedResidual } = groupedPayload;
    expect(groupedResidual).toEqual(perPayload);
  });
});

describe('tools/object grouped schema — output parity (anyOf accepts each branch)', () => {
  it('a valid list output validates under the grouped output schema', async () => {
    const out = await listHandle({});
    const validatePerOut = compile(PER_ACTION.list.output);
    expect(validatePerOut(out), JSON.stringify(validatePerOut.errors)).toBe(true);
    expect(validateGroupedOut(out), JSON.stringify(validateGroupedOut.errors)).toBe(true);
  });

  it('a validate and a reload output validate under the grouped output schema', async () => {
    for (const [action, out] of [
      ['validate', await handle({ action: 'validate', yaml: 'object:\n  name: Warehouse\n' })],
      ['reload', await handle({ action: 'reload' })],
    ] as const) {
      const validatePerOut = compile(PER_ACTION[action].output);
      expect(validatePerOut(out), JSON.stringify(validatePerOut.errors)).toBe(true);
      expect(validateGroupedOut(out), JSON.stringify(validateGroupedOut.errors)).toBe(true);
    }
  });

  it('a valid show output validates under the grouped output schema', async () => {
    const names = listObjects();
    expect(names.length).toBeGreaterThan(0); // catalog present in repo root
    const out = await showHandle({ name: names[0] });
    const validatePerOut = compile(PER_ACTION.show.output);
    expect(validatePerOut(out), JSON.stringify(validatePerOut.errors)).toBe(true);
    expect(validateGroupedOut(out), JSON.stringify(validateGroupedOut.errors)).toBe(true);
  });
});

describe('tools/object grouped dispatch — routing parity', () => {
  it('action="list" returns the same result as object.list.handle (read-only, no side effects)', async () => {
    const direct = await listHandle({ domain: 'core' });
    const viaGroup = await handle({ action: 'list', domain: 'core' });
    expect(viaGroup).toEqual(direct);
  });

  it('action="show" returns the same result as object.show.handle for an existing object', async () => {
    const names = listObjects();
    const direct = await showHandle({ name: names[0] });
    const viaGroup = await handle({ action: 'show', name: names[0] });
    expect(viaGroup).toEqual(direct);
  });

  it('action="show" delegates the OODS-N005 did-you-mean error path unchanged', async () => {
    let directErr: unknown;
    try {
      await showHandle({ name: '__definitely_missing__' });
    } catch (e) {
      directErr = e;
    }
    let groupErr: unknown;
    try {
      await handle({ action: 'show', name: '__definitely_missing__' });
    } catch (e) {
      groupErr = e;
    }
    // Both throw the same ToolError code; delegation does not swallow or rewrap it.
    // ToolError carries the OODS code on `.opiCode`.
    expect(isToolError(directErr)).toBe(true);
    expect(isToolError(groupErr)).toBe(true);
    expect((groupErr as any).opiCode).toBe('OODS-N005');
    expect((groupErr as any).opiCode).toBe((directErr as any).opiCode);
  });

  it('an unknown action throws a defensive "Unknown action" error', async () => {
    await expect(handle({ action: 'destroy' } as any)).rejects.toThrow(/Unknown action: destroy/);
  });
});
