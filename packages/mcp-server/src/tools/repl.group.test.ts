import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import { handle as groupedHandle } from './repl.js';
import { handle as renderHandle } from './repl.render.js';
import { handle as validateHandle } from './repl.validate.js';

// Per-action schemas (unchanged) and the new grouped schemas.
import groupedInput from '../schemas/repl.input.json' assert { type: 'json' };
import groupedOutput from '../schemas/repl.output.json' assert { type: 'json' };
import renderInput from '../schemas/repl.render.input.json' assert { type: 'json' };
import validateInput from '../schemas/repl.validate.input.json' assert { type: 'json' };
import renderOutput from '../schemas/repl.render.output.json' assert { type: 'json' };
import validateOutput from '../schemas/repl.validate.output.json' assert { type: 'json' };

const ajv = getAjv();

// Compile once. getAjv() preloads repl.ui.schema.json + repl.patch.json by $id,
// so the relative $refs (./repl.ui.schema.json, ./repl.patch.json) resolve in
// both the per-action and grouped schemas.
const validateGroupedIn = ajv.compile(groupedInput);
const validateGroupedOut = ajv.compile(groupedOutput);
const validateRenderIn = ajv.compile(renderInput);
const validateValidateIn = ajv.compile(validateInput);
const validateRenderOut = ajv.compile(renderOutput);
const validateValidateOut = ajv.compile(validateOutput);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Minimal valid UiSchema (version + >=1 screen with id+component).
const UI_SCHEMA = {
  version: '1.0',
  screens: [{ id: 'screen-root', component: 'Stack' }],
};

// Representative VALID payloads per action, in their OLD (un-grouped) form.
// Each grouped form is the same body with `action` added.
const VALID = {
  render: [
    { schema: UI_SCHEMA },
    { mode: 'full', schemaRef: 'ref-123' },
    {
      mode: 'patch',
      baseTree: UI_SCHEMA,
      patch: [{ op: 'replace', path: '/screens/0/component', value: 'Card' }],
    },
    { schema: UI_SCHEMA, output: { format: 'fragments', strict: true } },
    // s169 m04 — brand-BEARING payloads. `brand` had to be added to TWO files (the
    // per-action repl.render.input.json and the duplicated render branch inside
    // repl.input.json), and the existing parity tests could not have caught a one-sided
    // edit: every payload above omits `brand`, so both schemas accept them either way.
    // These do carry it, so a schema that gained the field on only one side goes red.
    { schema: UI_SCHEMA, brand: 'A' },
    { mode: 'full', schemaRef: 'ref-123', brand: 'B' },
  ],
  validate: [
    { schema: UI_SCHEMA },
    { mode: 'full', schemaRef: 'ref-abc' },
    {
      mode: 'patch',
      patch: [{ op: 'add', path: '/screens/0/props/label', value: 'Save' }],
    },
    { schema: UI_SCHEMA, options: { checkA11y: true, includeNormalized: false } },
  ],
} as const;

const PER_ACTION_IN = {
  render: validateRenderIn,
  validate: validateValidateIn,
} as const;

describe('tools/repl grouped action-parameter consolidation', () => {
  describe('input parity: VALID payloads validate under both per-action and grouped schemas', () => {
    for (const action of ['render', 'validate'] as const) {
      for (const [i, body] of VALID[action].entries()) {
        it(`${action}[#${i}] valid under per-action AND grouped`, () => {
          const perAction = PER_ACTION_IN[action];

          const oldOk = perAction(clone(body));
          expect(oldOk, `per-action errors: ${JSON.stringify(perAction.errors)}`).toBe(true);

          const grouped = { action, ...clone(body) };
          const newOk = validateGroupedIn(grouped);
          expect(newOk, `grouped errors: ${JSON.stringify(validateGroupedIn.errors)}`).toBe(true);
        });
      }
    }
  });

  describe('defaults parity: useDefaults injects identical defaults in both schemas', () => {
    for (const action of ['render', 'validate'] as const) {
      for (const [i, body] of VALID[action].entries()) {
        it(`${action}[#${i}] applies the same defaults`, () => {
          const perAction = PER_ACTION_IN[action];

          // Old validator mutates a clone in place via useDefaults.
          const oldPayload = clone(body) as Record<string, unknown>;
          expect(perAction(oldPayload)).toBe(true);

          // Grouped validator mutates a clone (with action) in place.
          const newPayload = { action, ...clone(body) } as Record<string, unknown>;
          expect(validateGroupedIn(newPayload)).toBe(true);

          // The only intended difference is the discriminator key.
          expect(newPayload.action).toBe(action);
          delete newPayload.action;
          expect(newPayload).toEqual(oldPayload);
        });
      }
    }
  });

  describe('complete-document default is consistent through both public schemas', () => {
    // A default render must carry the token CSS it needs; compact remains an explicit opt-in.
    it('grouped repl render injects compact=false when output omits it', () => {
      const payload = {
        action: 'render',
        schema: UI_SCHEMA,
        output: { format: 'document' },
      } as Record<string, unknown>;
      expect(validateGroupedIn(payload)).toBe(true);
      expect((payload.output as Record<string, unknown>).compact).toBe(false);
    });

    it('per-action repl.render schema injects the same compact=false default (parity)', () => {
      const payload = {
        schema: UI_SCHEMA,
        output: { format: 'document' },
      } as Record<string, unknown>;
      expect(validateRenderIn(payload)).toBe(true);
      expect((payload.output as Record<string, unknown>).compact).toBe(false);
    });

    it('explicit compact=false is preserved (opt-out still works)', () => {
      const payload = {
        action: 'render',
        schema: UI_SCHEMA,
        output: { format: 'document', compact: false },
      } as Record<string, unknown>;
      expect(validateGroupedIn(payload)).toBe(true);
      expect((payload.output as Record<string, unknown>).compact).toBe(false);
    });
  });

  describe('negative parity: INVALID payloads are rejected by the grouped schema', () => {
    it('missing action is rejected', () => {
      expect(validateGroupedIn({ schema: UI_SCHEMA })).toBe(false);
    });

    it('unknown action is rejected', () => {
      expect(validateGroupedIn({ action: 'destroy', schema: UI_SCHEMA })).toBe(false);
    });

    it('extra/unknown key inside a branch is rejected (additionalProperties:false preserved)', () => {
      // bogusKey is invalid under the OLD render schema too.
      expect(validateRenderIn(clone({ schema: UI_SCHEMA, bogusKey: 1 }))).toBe(false);
      expect(validateGroupedIn({ action: 'render', schema: UI_SCHEMA, bogusKey: 1 })).toBe(false);
    });

    it('render mode=patch missing baseTree+patch is rejected (branch-local allOf preserved)', () => {
      expect(validateRenderIn(clone({ mode: 'patch' }))).toBe(false);
      expect(validateGroupedIn({ action: 'render', mode: 'patch' })).toBe(false);
    });

    it('full mode with neither schema nor schemaRef is rejected', () => {
      expect(validateValidateIn(clone({ mode: 'full' }))).toBe(false);
      expect(validateGroupedIn({ action: 'validate', mode: 'full' })).toBe(false);
    });

    it('an unknown brand is rejected by BOTH schemas (s169 m04)', () => {
      // The enum has to be enforced on both sides too, not just the property's presence.
      for (const brand of ['C', 'a', '', 1]) {
        expect(validateRenderIn(clone({ schema: UI_SCHEMA, brand }))).toBe(false);
        expect(validateGroupedIn({ action: 'render', schema: UI_SCHEMA, brand })).toBe(false);
      }
    });

    it('brand is a RENDER-only field — the validate branch still rejects it (s169 m04)', () => {
      expect(validateValidateIn(clone({ schema: UI_SCHEMA, brand: 'A' }))).toBe(false);
      expect(validateGroupedIn({ action: 'validate', schema: UI_SCHEMA, brand: 'A' })).toBe(false);
    });

    it('wrong-action body shape (validate-only option under render) is rejected', () => {
      // checkA11y lives only on validate.options; render.options forbids it.
      expect(
        validateGroupedIn({ action: 'render', schema: UI_SCHEMA, options: { checkA11y: true } }),
      ).toBe(false);
    });
  });

  describe('dispatch routing: grouped handle === per-action handle (read-only actions)', () => {
    it('validate routes to repl.validate handle (identical output)', async () => {
      const body = { schema: UI_SCHEMA, options: { includeNormalized: true } };
      const direct = await validateHandle(clone(body) as any);
      const viaGroup = await groupedHandle({ action: 'validate', ...clone(body) } as any);
      expect(viaGroup).toEqual(direct);
    });

    it('render (no apply -> no disk writes) routes to repl.render handle (identical output)', async () => {
      const body = { schema: UI_SCHEMA };
      const direct = await renderHandle(clone(body) as any);
      const viaGroup = await groupedHandle({ action: 'render', ...clone(body) } as any);
      expect(viaGroup).toEqual(direct);
    });

    it('grouped render output validates under grouped output schema (anyOf)', async () => {
      const out = await groupedHandle({ action: 'render', schema: UI_SCHEMA } as any);
      expect(validateGroupedOut(out), JSON.stringify(validateGroupedOut.errors)).toBe(true);
      // and remains valid under its own per-action output schema.
      expect(validateRenderOut(clone(out))).toBe(true);
    });

    it('grouped validate output validates under grouped output schema (anyOf)', async () => {
      const out = await groupedHandle({ action: 'validate', schema: UI_SCHEMA } as any);
      expect(validateGroupedOut(out), JSON.stringify(validateGroupedOut.errors)).toBe(true);
      expect(validateValidateOut(clone(out))).toBe(true);
    });

    it('unknown action throws (defensive default branch)', async () => {
      await expect(groupedHandle({ action: 'nope' } as any)).rejects.toThrow('Unknown action: nope');
    });
  });

  describe('inline tokenOverlay (sprint-121 m05): accepted by both schemas, wired document-only', () => {
    const OVERLAY = { size: { spacing: { sm: '10px' } } };
    const OVERRIDE = ':root {\n  --oods-size-spacing-sm: 10px;\n}';

    it('validates through BOTH repl.input.json (the live grouped tool) and repl.render.input.json', () => {
      const grouped = { action: 'render', schema: UI_SCHEMA, output: { tokenOverlay: clone(OVERLAY) } };
      expect(validateGroupedIn(grouped), JSON.stringify(validateGroupedIn.errors)).toBe(true);
      const perAction = { schema: UI_SCHEMA, output: { tokenOverlay: clone(OVERLAY) } };
      expect(validateRenderIn(perAction), JSON.stringify(validateRenderIn.errors)).toBe(true);
    });

    it('resolves the overlay into the document <style> at apply=true', async () => {
      const out = (await renderHandle({
        schema: UI_SCHEMA,
        apply: true,
        output: { format: 'document', compact: false, tokenOverlay: clone(OVERLAY) },
      } as any)) as any;
      expect(out.html).toContain(OVERRIDE);
    });

    it('never echoes tokenOverlay into output.output (exact shape preserved)', async () => {
      const out = (await renderHandle({
        schema: UI_SCHEMA,
        apply: true,
        output: { format: 'document', compact: false, tokenOverlay: clone(OVERLAY) },
      } as any)) as any;
      expect(out.output).toEqual({ format: 'document', strict: false });
    });

    it('absent overlay => no override in html (default-absent byte-identity)', async () => {
      const out = (await renderHandle({
        schema: UI_SCHEMA,
        apply: true,
        output: { format: 'document', compact: false },
      } as any)) as any;
      expect(out.html ?? '').not.toContain('--oods-size-spacing-sm: 10px');
    });

    it('rejects a malicious overlay value before any HTML is emitted (OODS-V136)', async () => {
      await expect(
        renderHandle({
          schema: UI_SCHEMA,
          apply: true,
          output: {
            format: 'document',
            compact: false,
            tokenOverlay: { size: { spacing: { sm: '10px</style><script>1' } } },
          },
        } as any),
      ).rejects.toMatchObject({ opiCode: 'OODS-V136' });
    });

    it('fragments format ignores the overlay (never dirties fragment output)', async () => {
      const out = (await renderHandle({
        schema: UI_SCHEMA,
        apply: true,
        output: { format: 'fragments', compact: false, tokenOverlay: clone(OVERLAY) },
      } as any)) as any;
      expect(JSON.stringify(out)).not.toContain('--oods-size-spacing-sm: 10px');
    });
  });
});
