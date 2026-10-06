import { describe, expect, it } from 'vitest';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import {
  handle as brandApplyHandle,
  resolveBrandThemeFile,
  BRAND_ROOT,
} from '../../src/tools/brand.apply.js';
import { isToolError, type ToolError } from '../../src/errors/tool-error.js';
import type { UiSchema } from '../../src/schemas/generated.js';

describe('security model', () => {
  it('blocks prototype pollution via JSON patch paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const baseTree: UiSchema = {
      version: '2026.02',
      screens: [{ id: 'screen_home', component: 'Stack', children: [{ id: 'title', component: 'Text' }] }],
    };

    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ op: 'add', path: '/__proto__/polluted', value: 'yes' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'OODS-V101')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('blocks prototype pollution via node-targeted patch paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const baseTree: UiSchema = {
      version: '2026.02',
      screens: [{ id: 'screen_home', component: 'Stack', children: [{ id: 'title', component: 'Text' }] }],
    };

    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'title', path: '__proto__.polluted', value: 'yes' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'OODS-V101')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects brand.apply deltas containing unsafe keys', async () => {
    expect(({} as any).polluted).toBeUndefined();

    const delta = Object.create(null);
    (delta as any)['__proto__'] = { polluted: true };

    await expect(
      brandApplyHandle({
        apply: false,
        brand: 'A',
        strategy: 'alias',
        delta: delta as any,
      })
    ).rejects.toThrow(/Unsafe key/i);

    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects brand.apply patch operations targeting unsafe paths', async () => {
    expect(({} as any).polluted).toBeUndefined();

    await expect(
      brandApplyHandle({
        apply: false,
        brand: 'A',
        delta: [{ op: 'add', path: '/__proto__/polluted', value: 'yes' }],
      } as any)
    ).rejects.toThrow(/Unsafe key|Invalid JSON pointer/i);

    expect(({} as any).polluted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// s168-m01 — brand.apply brand-id containment
//
// Two independent layers guard the brand id, and each is proved separately because
// each fails differently:
//
//   1. the DERIVED ALLOWLIST (OODS-V001) — an exact-name match against the real
//      brand directories. It is the only layer that can reject `''`, `'.'` and
//      `'A/'`, all of which path.join() collapses to a *legal, readable* path
//      inside BRAND_ROOT.
//   2. CONTAINMENT (OODS-S015) — withinAllowed(BRAND_ROOT, file). Unreachable in
//      production once the allowlist is in place, which is exactly why it gets a
//      direct unit test: a layer no test can turn red is not a layer.
//
// These call handle() directly, bypassing the ajv enum enforced at index.ts:257 —
// the same bypass a direct handler import gives any in-repo caller.
// ---------------------------------------------------------------------------

describe('brand.apply brand-id guard (s168-m01)', () => {
  async function captureBrandError(brand: unknown): Promise<ToolError> {
    try {
      await brandApplyHandle({ apply: false, strategy: 'alias', brand, delta: {} } as any);
    } catch (error) {
      if (!isToolError(error)) {
        throw new Error(
          `brand ${JSON.stringify(brand)} threw a non-ToolError (${(error as Error)?.name}: ${
            (error as Error)?.message
          }) — the guard did not bite; something downstream failed instead`
        );
      }
      return error;
    }
    throw new Error(`brand.apply ACCEPTED brand ${JSON.stringify(brand)} — the guard did not bite`);
  }

  // Traversal, plus the three inputs the allowlist alone can catch: '', '.' and 'A/'
  // all resolve to a readable file under BRAND_ROOT, so containment cannot see them.
  const REJECTED = ['../../../../../../etc', 'A/../B', '..', '', '.', 'A/'];

  for (const brand of REJECTED) {
    it(`rejects brand ${JSON.stringify(brand)} with OODS-V001`, async () => {
      const error = await captureBrandError(brand);
      expect(error.opiCode).toBe('OODS-V001');
    });
  }

  it('rejects a non-string brand with OODS-V001', async () => {
    const error = await captureBrandError(42);
    expect(error.opiCode).toBe('OODS-V001');
  });

  // Not over-broad: every brand directory that actually exists must still resolve.
  for (const brand of ['A', 'B']) {
    it(`accepts the real brand ${brand}`, async () => {
      const result = await brandApplyHandle({
        apply: false,
        strategy: 'alias',
        brand,
        delta: {},
      } as any);
      // s221-m01: a preview writes no transcript since s216-m03 (#2406, #2409); the summary exists only once the guard
      // accepted the brand and its documents loaded.
      expect(result.preview?.summary).toBe(`No updates for brand ${brand}.`);
    });
  }

  // The containment layer, exercised directly — the allowlist is not in the path here,
  // so this is the only test that can turn red when withinAllowed() is removed.
  describe('resolveBrandThemeFile containment', () => {
    it('resolves a legitimate brand/theme pair inside BRAND_ROOT', () => {
      const file = resolveBrandThemeFile('A', 'base');
      expect(file.startsWith(BRAND_ROOT)).toBe(true);
      expect(file.endsWith('base.json')).toBe(true);
    });

    for (const brand of ['../../../../../../etc', '..', 'A/../../..']) {
      it(`refuses to resolve ${JSON.stringify(brand)} outside BRAND_ROOT with OODS-S015`, () => {
        let caught: unknown;
        try {
          resolveBrandThemeFile(brand, 'base');
        } catch (error) {
          caught = error;
        }
        expect(isToolError(caught)).toBe(true);
        expect((caught as ToolError).opiCode).toBe('OODS-S015');
      });
    }
  });
});
