/**
 * Q3 — Real-data E2E gate for the C2 wireframe emitter.
 *
 * Per quality bar (cmos/foundational-docs/quality-bars.md), every new
 * Capability-track render mission must run its emitter end-to-end against:
 *   1. the three internal sprint-97 Object Catalog fixtures (user, product,
 *      subscription) covering informational / action-shaped / relationships
 *      variants, AND
 *   2. at least one independently-sourced external-shape fixture exercising
 *      multi-entity rendering (the billing-multi-entity fixture shared with C1).
 *
 * Gate assertions per fixture:
 *   - wireframe emitter returns status='ok' with no errors
 *   - emitted HTML parses cleanly via jsdom
 *   - entity count in DOM matches manifest.entities.length
 *   - every slot declared in oods.render.slots is present as a dashed
 *     placeholder with data-slot-name + data-slot-field
 *   - data-entity-urn / data-element-type / data-role attributes preserved
 *     verbatim (same contract as C1)
 *   - NO relationship rows rendered (wireframe = layout fidelity, not
 *     relationship fidelity — that is C1's surface)
 *   - NO trait chips or visible role labels (those are also C1's surface)
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import userFixture from '../../src/object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../../src/object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../../src/object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };

import type { ObjectCatalogManifest, OodsSlot } from '../../src/object-catalog/types.js';
import { emit } from '../../src/codegen/wireframe-emitter.js';

function entitySelector(urn: string): string {
  return `.entity[data-entity-urn="${urn.replace(/"/g, '\\"')}"]`;
}

type GateFixture = readonly [name: string, manifest: ObjectCatalogManifest];

const fixtures: ReadonlyArray<GateFixture> = [
  ['user (internal — informational)', userFixture as ObjectCatalogManifest],
  ['product (internal — action-shaped)', productFixture as ObjectCatalogManifest],
  ['subscription (internal — relationships.edges source)', subscriptionFixture as ObjectCatalogManifest],
  ['billing (external — multi-entity)', billingFixture as ObjectCatalogManifest],
];

function expectedSlots(manifest: ObjectCatalogManifest): Array<{ urn: string; slots: OodsSlot[] }> {
  return manifest.entities.map((e) => ({
    urn: e.urn,
    slots: e.oods?.render?.slots ?? [],
  }));
}

describe('Q3 — wireframe-emitter real-data E2E gate', () => {
  describe.each(fixtures)('%s', (_name, manifest) => {
    const result = emit(manifest);
    const dom = new JSDOM(result.code);
    const doc = dom.window.document;

    it('emits status=ok with no errors', () => {
      expect(result.status).toBe('ok');
      expect(result.errors ?? []).toEqual([]);
    });

    it('parses as a well-formed HTML document with wireframe fidelity marker', () => {
      expect(doc.doctype?.name).toBe('html');
      expect(doc.documentElement.tagName.toLowerCase()).toBe('html');
      expect(doc.querySelector('head')).not.toBeNull();
      expect(doc.querySelector('body')).not.toBeNull();
      expect(doc.querySelector('body')?.getAttribute('data-fidelity')).toBe('wireframe');
    });

    it('renders exactly one .entity per manifest entity', () => {
      const entityNodes = doc.querySelectorAll('.entity');
      expect(entityNodes.length).toBe(manifest.entities.length);
      const urns = Array.from(entityNodes).map((n) => n.getAttribute('data-entity-urn'));
      expect(urns).toEqual(manifest.entities.map((e) => e.urn));
      expect(result.meta.entitiesRendered).toBe(manifest.entities.length);
    });

    it('preserves every declared slot with data-slot-name + data-slot-field', () => {
      for (const { urn, slots } of expectedSlots(manifest)) {
        if (slots.length === 0) continue;
        const entityNode = doc.querySelector(entitySelector(urn));
        expect(entityNode, `entity node for ${urn}`).not.toBeNull();
        const slotNodes = entityNode!.querySelectorAll('.slot');
        const renderedNames = Array.from(slotNodes).map((s) => s.getAttribute('data-slot-name'));
        const renderedFields = Array.from(slotNodes).map((s) => s.getAttribute('data-slot-field'));
        expect(renderedNames).toEqual(slots.map((s) => s.name));
        expect(renderedFields).toEqual(slots.map((s) => s.binding.field));
      }
    });

    it('preserves data-role + data-element-type on every entity (no visible labels)', () => {
      for (const entity of manifest.entities) {
        const entityNode = doc.querySelector(entitySelector(entity.urn));
        expect(entityNode).not.toBeNull();
        if (entity.pragmatic_role) {
          expect(entityNode!.getAttribute('data-role')).toBe(entity.pragmatic_role);
        }
        expect(entityNode!.getAttribute('data-element-type')).toBe(entity.element.type);
        // Wireframe must NOT render a visible role label
        expect(entityNode!.querySelector('.role')).toBeNull();
      }
    });

    it('renders NO relationship rows (layout fidelity excludes relationships)', () => {
      expect(doc.querySelectorAll('.relationship').length).toBe(0);
      expect(result.code).not.toContain('data-relationship-type');
      expect(result.code).not.toContain('data-relationship-source');
    });

    it('renders NO trait chips (layout fidelity excludes trait styling)', () => {
      expect(doc.querySelectorAll('.trait').length).toBe(0);
      expect(doc.querySelectorAll('[data-trait]').length).toBe(0);
    });

    it('emits no missing-catalog-annotation warnings', () => {
      const missing = result.warnings.filter((w) => w.code === 'OODS-WF-001');
      expect(missing).toHaveLength(0);
    });
  });
});

describe('Q3 — multi-entity external billing fixture coverage', () => {
  const result = emit(billingFixture as ObjectCatalogManifest);
  const doc = new JSDOM(result.code).window.document;

  it('renders three entity boxes in declaration order', () => {
    const urns = Array.from(doc.querySelectorAll('.entity')).map((n) =>
      n.getAttribute('data-entity-urn'),
    );
    expect(urns).toEqual([
      'urn:proto:semantic:billing-account-card@1.0.0',
      'urn:proto:semantic:payment-method-row@1.0.0',
      'urn:proto:semantic:invoice-detail-card@1.0.0',
    ]);
  });

  it('renders dashed slot placeholders for every slot across all 3 entities', () => {
    const slots = doc.querySelectorAll('.slot');
    expect(slots.length).toBe(result.meta.slotsRendered);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('emits zero relationships even though the billing manifest declares 3 cross-links', () => {
    expect(doc.querySelectorAll('.relationship').length).toBe(0);
  });

  it('preserves the primary_action invoice via data-role + data-element-action only', () => {
    const invoice = doc.querySelector(
      '.entity[data-entity-urn="urn:proto:semantic:invoice-detail-card@1.0.0"]',
    );
    expect(invoice?.getAttribute('data-role')).toBe('primary_action');
    expect(invoice?.getAttribute('data-element-action')).toBe('pay_now');
    // No visible role label in wireframe fidelity
    expect(invoice?.querySelector('.role')).toBeNull();
  });
});

describe('Q3 — variant-aware slot rendering (D2 v2, s100-m03)', () => {
  // user fixture declares two projection_variants:
  //   desktop: 3 slots (avatar, title, subtitle)
  //   mobile:  2 slots (avatar, title — no subtitle)
  // oods.render.slots == desktop projection.
  const manifest = userFixture as ObjectCatalogManifest;

  it('variant="desktop" renders the 3-slot desktop projection', () => {
    const result = emit(manifest, { variant: 'desktop' });
    const doc = new JSDOM(result.code).window.document;
    const slots = doc.querySelectorAll('.slot');
    expect(slots.length).toBe(3);
    expect(result.meta.slotsRendered).toBe(3);
    const names = Array.from(slots).map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['avatar', 'title', 'subtitle']);
  });

  it('variant="mobile" renders the 2-slot mobile projection (subtitle omitted)', () => {
    const result = emit(manifest, { variant: 'mobile' });
    const doc = new JSDOM(result.code).window.document;
    const slots = doc.querySelectorAll('.slot');
    expect(slots.length).toBe(2);
    expect(result.meta.slotsRendered).toBe(2);
    const names = Array.from(slots).map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['avatar', 'title']);
    expect(result.code).not.toContain('data-slot-name="subtitle"');
  });

  it('omitting variant falls back to canonical oods.render.slots (3 slots, matches desktop)', () => {
    const canonical = emit(manifest);
    const desktop = emit(manifest, { variant: 'desktop' });
    expect(canonical.meta.slotsRendered).toBe(3);
    expect(desktop.meta.slotsRendered).toBe(3);
    // Slot names appear in the same order in both outputs.
    const canonicalNames = Array.from(new JSDOM(canonical.code).window.document.querySelectorAll('.slot'))
      .map((n) => n.getAttribute('data-slot-name'));
    const desktopNames = Array.from(new JSDOM(desktop.code).window.document.querySelectorAll('.slot'))
      .map((n) => n.getAttribute('data-slot-name'));
    expect(canonicalNames).toEqual(desktopNames);
  });

  it('unknown variant falls back to canonical render slots (selectVariant fallthrough)', () => {
    const result = emit(manifest, { variant: 'watch' });
    expect(result.meta.slotsRendered).toBe(3);
  });
});
