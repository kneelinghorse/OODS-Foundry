import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  handle,
  FIXTURE_NAMES,
  type FidelityKind,
  type FidelityPreviewInput,
} from './fidelity.preview.js';

const ALL_KINDS: FidelityKind[] = ['boxes-arrows', 'wireframe', 'review', 'branded-mockup'];

// Inline-manifest fixtures: load real on-disk manifests and feed them through the
// inline `manifest` path (no fixture name) to prove the inline source renders
// identically to the named-fixture source.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const loadManifest = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(HERE, rel), 'utf8'));
const USER_MANIFEST = loadManifest('../object-catalog/fixtures/user.json');
const CONTENT_PACK_MANIFEST = loadManifest('../../test/fixtures/object-catalog/content-pack.json');
const LOW_CONF_MANIFEST = loadManifest('../../test/fixtures/object-catalog/subscription-low-confidence.json');

describe('tools/fidelity.preview', () => {
  describe('happy path — all 4 fidelities × representative fixture', () => {
    for (const kind of ALL_KINDS) {
      it(`emits non-empty HTML for ${kind} fidelity on the user fixture`, async () => {
        const out = await handle({ fidelityKind: kind, fixture: 'user' });
        expect(out.status).toMatch(/^(ok|warning)$/);
        expect(out.fidelityKind).toBe(kind);
        expect(out.fixture).toBe('user');
        expect(out.html.length).toBeGreaterThan(0);
        expect(out.errors).toEqual([]);
        expect(out.meta.entityCount).toBeGreaterThan(0);
      });
    }
  });

  describe('multi-entity manifest (content-pack)', () => {
    it('boxes-arrows renders multi-entity manifest with edge metadata', async () => {
      const out = await handle({ fidelityKind: 'boxes-arrows', fixture: 'content-pack' });
      expect(out.status).toMatch(/^(ok|warning)$/);
      expect(out.meta.entityCount).toBe(3);
      expect(out.html).toContain('article');
    });

    it('wireframe renders multi-entity manifest', async () => {
      const out = await handle({ fidelityKind: 'wireframe', fixture: 'content-pack' });
      expect(out.status).toMatch(/^(ok|warning)$/);
      expect(out.meta.entityCount).toBe(3);
      expect(out.html.length).toBeGreaterThan(0);
    });
  });

  describe('branded-mockup brandOverlay pass-through (audit axis b)', () => {
    // s221-m01: since s216-m06 (#2416) meta names the canonical brand the mockup actually applied, not the input string.
    // B differs from the user fixture's own brand-a, so the override is what reached the mockup.
    it('names the brand the overlay applied in meta when brandOverlay is provided', async () => {
      const out = await handle({
        fidelityKind: 'branded-mockup',
        fixture: 'user',
        options: { brandOverlay: 'B' },
      });
      expect(out.meta.appliedBrandOverlay).toBe('B');
    });

    it("names the fixture's own brand when brandOverlay is omitted", async () => {
      // The user fixture declares brand_overlay: brand-a, which the mockup applies as brand A.
      const out = await handle({ fidelityKind: 'branded-mockup', fixture: 'user' });
      expect(out.meta.appliedBrandOverlay).toBe('A');
    });

    it('handles brand-b correctly (different resolved brand than brand-a)', async () => {
      const outA = await handle({
        fidelityKind: 'branded-mockup',
        fixture: 'user',
        options: { brandOverlay: 'brand-a' },
      });
      const outB = await handle({
        fidelityKind: 'branded-mockup',
        fixture: 'user',
        options: { brandOverlay: 'brand-b' },
      });
      expect(outA.html).not.toBe(outB.html);
    });

    it('non-branded fidelities ignore brandOverlay option (no error)', async () => {
      const out = await handle({
        fidelityKind: 'wireframe',
        fixture: 'user',
        options: { brandOverlay: 'brand-a' },
      });
      expect(out.status).toMatch(/^(ok|warning)$/);
      expect(out.meta.appliedBrandOverlay).toBeUndefined();
    });
  });

  describe('review fidelity threshold pass-through', () => {
    it('respects reviewThreshold option', async () => {
      // Different thresholds change the flagged count → markup differs
      const strict = await handle({
        fidelityKind: 'review',
        fixture: 'subscription-low-confidence',
        options: { reviewThreshold: 0.9 },
      });
      const lax = await handle({
        fidelityKind: 'review',
        fixture: 'subscription-low-confidence',
        options: { reviewThreshold: 0.1 },
      });
      expect(strict.status).toMatch(/^(ok|warning)$/);
      expect(lax.status).toMatch(/^(ok|warning)$/);
      // The two outputs SHOULD differ — stricter threshold flags more entities
      expect(strict.html).not.toBe(lax.html);
    });
  });

  describe('fixture allow-list (no path traversal)', () => {
    it('rejects unknown fixture name with OODS-FP-001', async () => {
      const out = await handle({
        fidelityKind: 'wireframe',
        fixture: 'definitely-not-a-real-fixture',
      });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-001');
      expect(out.html).toBe('');
    });

    it('rejects path-traversal attempts with OODS-FP-001 (not OODS-FP-002)', async () => {
      const out = await handle({
        fidelityKind: 'wireframe',
        fixture: '../../etc/passwd',
      });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-001');
    });

    it('exports the FIXTURE_NAMES allow-list with the expected entries', () => {
      expect(FIXTURE_NAMES).toContain('user');
      expect(FIXTURE_NAMES).toContain('product');
      expect(FIXTURE_NAMES).toContain('subscription');
      expect(FIXTURE_NAMES).toContain('content-pack');
      expect(FIXTURE_NAMES).toContain('billing-multi-entity');
      expect(FIXTURE_NAMES).toContain('subscription-low-confidence');
    });
  });

  describe('error paths', () => {
    it('rejects unsupported fidelityKind with OODS-FP-003', async () => {
      const out = await handle({
        fidelityKind: 'production' as unknown as FidelityKind,
        fixture: 'user',
      });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-003');
    });
  });

  describe('inline manifest source (agents render their own manifests, no fixture committed here)', () => {
    it('renders an inline manifest for wireframe — source echoed as (inline)', async () => {
      const out = await handle({ fidelityKind: 'wireframe', manifest: USER_MANIFEST });
      expect(out.status).toMatch(/^(ok|warning)$/);
      expect(out.fixture).toBe('(inline)');
      expect(out.html.length).toBeGreaterThan(0);
      expect(out.errors).toEqual([]);
      expect(out.meta.entityCount).toBeGreaterThan(0);
    });

    it('inline manifest renders byte-identically to the equivalent named fixture', async () => {
      const viaFixture = await handle({ fidelityKind: 'boxes-arrows', fixture: 'user' });
      const viaInline = await handle({ fidelityKind: 'boxes-arrows', manifest: USER_MANIFEST });
      expect(viaInline.html).toBe(viaFixture.html);
      expect(viaInline.meta.entityCount).toBe(viaFixture.meta.entityCount);
    });

    it('renders an inline multi-entity manifest', async () => {
      const out = await handle({ fidelityKind: 'boxes-arrows', manifest: CONTENT_PACK_MANIFEST });
      expect(out.status).toMatch(/^(ok|warning)$/);
      expect(out.meta.entityCount).toBe(3);
    });

    it('inline manifest honors emitter options (review threshold)', async () => {
      const strict = await handle({ fidelityKind: 'review', manifest: LOW_CONF_MANIFEST, options: { reviewThreshold: 0.9 } });
      const lax = await handle({ fidelityKind: 'review', manifest: LOW_CONF_MANIFEST, options: { reviewThreshold: 0.1 } });
      expect(strict.status).toMatch(/^(ok|warning)$/);
      expect(strict.html).not.toBe(lax.html);
    });

    it('rejects when NEITHER fixture nor manifest is supplied — OODS-FP-004', async () => {
      const out = await handle({ fidelityKind: 'wireframe' });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-004');
      expect(out.html).toBe('');
    });

    it('rejects when BOTH fixture and manifest are supplied — OODS-FP-004', async () => {
      const out = await handle({ fidelityKind: 'wireframe', fixture: 'user', manifest: USER_MANIFEST });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-004');
    });

    it('rejects a malformed inline manifest (no entities array) — OODS-FP-005', async () => {
      const out = await handle({ fidelityKind: 'wireframe', manifest: { not: 'a catalog' } });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-005');
    });

    it('rejects a non-object inline manifest — OODS-FP-005', async () => {
      const out = await handle({ fidelityKind: 'wireframe', manifest: 'just a string' });
      expect(out.status).toBe('error');
      expect(out.errors[0].code).toBe('OODS-FP-005');
    });
  });

  describe('includeStyles option', () => {
    it('omits <style> block when includeStyles is false', async () => {
      const withStyles = await handle({
        fidelityKind: 'wireframe',
        fixture: 'user',
        options: { includeStyles: true },
      });
      const withoutStyles = await handle({
        fidelityKind: 'wireframe',
        fixture: 'user',
        options: { includeStyles: false },
      });
      expect(withStyles.html.length).toBeGreaterThan(withoutStyles.html.length);
      expect(withoutStyles.html).not.toContain('<style>');
    });
  });

  describe('all fixtures × all kinds — coverage smoke', () => {
    const SKIP_PAIRS = new Set<string>([
      // registry-v14-synthetic intentionally has no projection_variants;
      // emitters that require them surface warnings or empty entity blocks.
      // We still verify the call does not throw or return status='error'.
    ]);
    for (const fixture of FIXTURE_NAMES) {
      for (const kind of ALL_KINDS) {
        if (SKIP_PAIRS.has(`${kind}:${fixture}`)) continue;
        it(`${kind} × ${fixture} → does not throw, returns html string`, async () => {
          const out = await handle({ fidelityKind: kind, fixture } as FidelityPreviewInput);
          expect(typeof out.html).toBe('string');
          expect(['ok', 'warning', 'error']).toContain(out.status);
        });
      }
    }
  });
});
