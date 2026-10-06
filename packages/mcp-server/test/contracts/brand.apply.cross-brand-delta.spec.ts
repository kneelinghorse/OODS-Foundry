/**
 * s169 m05 — a delta may not address a brand other than the one being applied (OODS-V149).
 *
 * ── THE MEASURED DEFECT ──
 * `brand.apply`'s alias strategy deep-merges its free-form delta at the DOCUMENT ROOT, and
 * nothing constrained the namespace. A delta shaped `{ color: { brand: { A: … } } }` applied
 * with `brand: 'B'` therefore did NOT overwrite brand B — it grafted an entire brand-A
 * subtree INSIDE brand B's files, in all three themes, and the tool reported success.
 *
 * MEASURED at s168's tip using `packages/tokens/src/presets/dark-minimal.json` (which was
 * itself `color.brand.A`-wrapped at the time, so this was a live foot-gun and not a
 * contrived one): the plan carried `/color/brand/A: {…}` as an ADDITION against
 * `brands/B/base.json`, `dark.json` and `hc.json`, under the summary "Updated 3 token
 * values for brand B".
 *
 * ── WHY THE GUARD, AND NOT JUST THE PRESET RE-KEY ──
 * The presets are re-keyed brand-relative in this same mission, which unloads the gun. The
 * graft VECTOR, though, was never the presets — it was the unconstrained merge, and any
 * agent-authored delta could reach it. This suite covers the vector.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../../src/tools/brand.apply.js';
import { isToolError } from '../../src/errors/tool-error.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const PRESET = path.join(REPO_ROOT, 'packages/tokens/src/presets/dark-minimal.json');

const codeOf = async (fn: () => Promise<unknown>): Promise<string | undefined> => {
  try {
    await fn();
    return undefined; // did not throw
  } catch (error) {
    return isToolError(error) ? error.opiCode : `non-tool-error:${String(error)}`;
  }
};

/** A minimal, valid brand-relative palette delta — the shape a preset now has. */
const RELATIVE_DELTA = {
  surface: { canvas: { $type: 'color', $value: 'oklch(0.9 0.01 200)' } },
};

const wrapFor = (brand: string, body: unknown) => ({ color: { brand: { [brand]: body } } });

describe('brand.apply cross-brand delta guard (s169 m05)', () => {
  it('REJECTS the exact graft that was measured: a brand-A-wrapped payload applied to brand B', async () => {
    const code = await codeOf(() =>
      handle({ brand: 'B', strategy: 'alias', delta: wrapFor('A', RELATIVE_DELTA) } as never),
    );
    expect(code).toBe('OODS-V149');
  });

  it('REJECTS the mirror direction too — a brand-B payload applied to brand A', async () => {
    // Both directions, so the guard cannot be a one-sided string comparison that happens to
    // work for the case it was written against.
    const code = await codeOf(() =>
      handle({ brand: 'A', strategy: 'alias', delta: wrapFor('B', RELATIVE_DELTA) } as never),
    );
    expect(code).toBe('OODS-V149');
  });

  it('REJECTS a cross-brand wrapper nested under a THEME key', async () => {
    // A theme-scoped delta nests the wrapper one level deeper. A guard that only looked at
    // the delta's top level would let this straight through.
    const code = await codeOf(() =>
      handle({ brand: 'B', strategy: 'alias', delta: { dark: wrapFor('A', RELATIVE_DELTA) } } as never),
    );
    expect(code).toBe('OODS-V149');
  });

  it('ACCEPTS a delta that names its OWN brand explicitly (previously valid, still valid)', async () => {
    const code = await codeOf(() =>
      handle({ brand: 'B', strategy: 'alias', delta: wrapFor('B', RELATIVE_DELTA) } as never),
    );
    expect(code).toBeUndefined();
  });

  it('ACCEPTS a delta that names no brand at all — the normal case', async () => {
    const code = await codeOf(() =>
      handle({ brand: 'B', strategy: 'alias', delta: { color: { brand: { B: RELATIVE_DELTA } } } } as never),
    );
    expect(code).toBeUndefined();
  });

  it('the SHIPPED presets are now safe to wrap for either brand', async () => {
    // The end-to-end statement of the fix: one payload, correctly wrapped, applies to both.
    const preset = JSON.parse(fs.readFileSync(PRESET, 'utf8'));
    delete preset.$schema;
    delete preset.$description;
    for (const brand of ['A', 'B'] as const) {
      const code = await codeOf(() =>
        handle({ brand, strategy: 'alias', delta: wrapFor(brand, preset) } as never),
      );
      expect(code, `wrapping the preset for brand ${brand}`).toBeUndefined();
    }
    // ...and mis-wrapping the very same payload is what now fails.
    const misWrapped = await codeOf(() =>
      handle({ brand: 'B', strategy: 'alias', delta: wrapFor('A', preset) } as never),
    );
    expect(misWrapped).toBe('OODS-V149');
  });

  it('the rejection message names both brands and tells the caller what to do', async () => {
    // A code alone does not help an agent recover; the message has to carry the fix.
    let message = '';
    try {
      await handle({ brand: 'B', strategy: 'alias', delta: wrapFor('A', RELATIVE_DELTA) } as never);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('"A"');
    expect(message).toContain('"B"');
    expect(message).toContain('color.brand.A');
  });
});
