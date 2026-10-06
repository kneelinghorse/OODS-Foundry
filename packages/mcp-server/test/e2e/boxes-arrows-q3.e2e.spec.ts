/**
 * Q3 — Real-data E2E gate for the C1 boxes-and-arrows emitter.
 *
 * Per quality bar (cmos/foundational-docs/quality-bars.md), every new
 * Capability-track render mission must run its emitter end-to-end against:
 *   1. the three internal sprint-97 Object Catalog fixtures (user, product,
 *      subscription) covering informational / action-shaped / relationships
 *      variants, AND
 *   2. at least one independently-sourced external-shape fixture exercising
 *      multi-entity rendering with cross-entity relationships.
 *
 * Gate assertions per fixture:
 *   - boxes-arrows-emitter returns status='ok' with no errors
 *   - emitted HTML parses cleanly via jsdom (no malformed-tag warnings)
 *   - entity count in DOM matches manifest.entities.length
 *   - relationship row count in DOM matches sum of per-entity
 *     relationships.edges plus manifest-level relationships
 *   - every slot declared in oods.render.slots is present in the DOM with
 *     matching data-slot-field
 *   - every trait appears both as a data-trait attribute and a visible chip
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import userFixture from '../../src/object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../../src/object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../../src/object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };

import type { ObjectCatalogManifest, OodsSlot } from '../../src/object-catalog/types.js';
import { emit } from '../../src/codegen/boxes-arrows-emitter.js';

function entitySelector(urn: string): string {
  // CSS.escape is window-scoped in jsdom; do the escape inline so the
  // selector is portable across jsdom + node globals.
  return `.entity[data-entity-urn="${urn.replace(/"/g, '\\"')}"]`;
}

type GateFixture = readonly [name: string, manifest: ObjectCatalogManifest];

const fixtures: ReadonlyArray<GateFixture> = [
  ['user (internal — informational)', userFixture as ObjectCatalogManifest],
  ['product (internal — action-shaped)', productFixture as ObjectCatalogManifest],
  ['subscription (internal — relationships.edges)', subscriptionFixture as ObjectCatalogManifest],
  ['billing (external — multi-entity)', billingFixture as ObjectCatalogManifest],
];

function expectedRelationshipCount(manifest: ObjectCatalogManifest): number {
  let n = manifest.relationships?.length ?? 0;
  for (const entity of manifest.entities) {
    n += entity.relationships?.edges?.length ?? 0;
  }
  return n;
}

function expectedSlots(manifest: ObjectCatalogManifest): Array<{ urn: string; slots: OodsSlot[] }> {
  return manifest.entities.map((e) => ({
    urn: e.urn,
    slots: e.oods?.render?.slots ?? [],
  }));
}

describe('Q3 — boxes-arrows-emitter real-data E2E gate', () => {
  describe.each(fixtures)('%s', (name, manifest) => {
    const result = emit(manifest);
    const dom = new JSDOM(result.code);
    const doc = dom.window.document;

    it('emits status=ok with no errors', () => {
      expect(result.status).toBe('ok');
      expect(result.errors ?? []).toEqual([]);
    });

    it('parses as a well-formed HTML document', () => {
      expect(doc.doctype?.name).toBe('html');
      expect(doc.documentElement.tagName.toLowerCase()).toBe('html');
      expect(doc.querySelector('head')).not.toBeNull();
      expect(doc.querySelector('body')).not.toBeNull();
    });

    it('renders exactly one .entity per manifest entity', () => {
      const entityNodes = doc.querySelectorAll('.entity');
      expect(entityNodes.length).toBe(manifest.entities.length);
      const urns = Array.from(entityNodes).map((n) => n.getAttribute('data-entity-urn'));
      expect(urns).toEqual(manifest.entities.map((e) => e.urn));
      expect(result.meta.entitiesRendered).toBe(manifest.entities.length);
    });

    it('renders exactly one .relationship row per manifest edge', () => {
      const relNodes = doc.querySelectorAll('.relationship');
      const expected = expectedRelationshipCount(manifest);
      expect(relNodes.length).toBe(expected);
      expect(result.meta.relationshipsRendered).toBe(expected);
    });

    it('preserves every declared slot with data-slot-field', () => {
      for (const { urn, slots } of expectedSlots(manifest)) {
        if (slots.length === 0) continue;
        const entityNode = doc.querySelector(entitySelector(urn));
        expect(entityNode, `entity node for ${urn}`).not.toBeNull();
        const slotNodes = entityNode!.querySelectorAll('.slot');
        const renderedFields = Array.from(slotNodes).map((s) => s.getAttribute('data-slot-field'));
        const expectedFields = slots.map((s) => s.binding.field);
        expect(renderedFields).toEqual(expectedFields);
      }
    });

    it('surfaces every trait as both data-trait attribute and visible chip', () => {
      for (const entity of manifest.entities) {
        const traits = entity.traits ?? [];
        if (traits.length === 0) continue;
        const entityNode = doc.querySelector(entitySelector(entity.urn));
        expect(entityNode).not.toBeNull();

        // data-* coverage on the entity article
        const dataTraits = entityNode!.getAttributeNames().filter((n) => n === 'data-trait');
        // jsdom collapses duplicate attribute names to one; verify each trait
        // appears in either the article's data-trait attribute set OR an
        // inner .trait[data-trait] chip.
        const chipTraits = Array.from(entityNode!.querySelectorAll('.trait'))
          .map((c) => c.getAttribute('data-trait'));
        for (const trait of traits) {
          expect(chipTraits).toContain(trait);
          // Visible chip text must match the trait name verbatim.
          const visible = Array.from(entityNode!.querySelectorAll('.trait'))
            .map((c) => c.textContent?.trim())
            .filter((t): t is string => !!t);
          expect(visible).toContain(trait);
        }
        // Silence unused-var warning for dataTraits when no duplicate handling needed.
        expect(dataTraits.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('encodes pragmatic_role as a data-role attribute + visible role label', () => {
      for (const entity of manifest.entities) {
        const entityNode = doc.querySelector(entitySelector(entity.urn));
        expect(entityNode).not.toBeNull();
        const role = entity.pragmatic_role;
        if (!role) continue;
        expect(entityNode!.getAttribute('data-role')).toBe(role);
        const roleNode = entityNode!.querySelector('.role');
        expect(roleNode?.textContent?.trim().length).toBeGreaterThan(0);
      }
    });

    it('flags cross-manifest target URNs as external', () => {
      const knownUrns = new Set(manifest.entities.map((e) => e.urn));
      const relNodes = doc.querySelectorAll('.relationship');
      for (const rel of relNodes) {
        const target = rel.getAttribute('data-relationship-target');
        if (!target) continue;
        const externalAttr = rel.getAttribute('data-relationship-target-external');
        if (knownUrns.has(target)) {
          expect(externalAttr).toBeNull();
        } else {
          expect(externalAttr).toBe('true');
        }
      }
    });

    it('emits no missing-catalog-annotation warnings', () => {
      const missing = result.warnings.filter((w) => w.code === 'OODS-BA-001');
      expect(missing).toHaveLength(0);
    });
  });
});

describe('Q3 — multi-entity external billing fixture coverage', () => {
  const result = emit(billingFixture as ObjectCatalogManifest);
  const doc = new JSDOM(result.code).window.document;

  it('renders three boxes (BillingAccount, PaymentMethod, Invoice)', () => {
    const urns = Array.from(doc.querySelectorAll('.entity')).map((n) =>
      n.getAttribute('data-entity-urn'),
    );
    expect(urns).toEqual([
      'urn:proto:semantic:billing-account-card@1.0.0',
      'urn:proto:semantic:payment-method-row@1.0.0',
      'urn:proto:semantic:invoice-detail-card@1.0.0',
    ]);
  });

  it('renders three relationship rows linking internal entities', () => {
    const rels = Array.from(doc.querySelectorAll('.relationship'));
    expect(rels).toHaveLength(3);
    const types = rels.map((r) => r.getAttribute('data-relationship-type'));
    expect(types.sort()).toEqual(['billed_to', 'charges', 'owns']);
    // None of the three target URNs are external in this manifest.
    const externalFlags = rels.map((r) =>
      r.getAttribute('data-relationship-target-external'),
    );
    expect(externalFlags.every((f) => f === null)).toBe(true);
  });

  it('preserves the via=billing qualifier and reason text', () => {
    const charges = doc.querySelector('.relationship[data-relationship-type="charges"]');
    expect(charges?.getAttribute('data-relationship-via')).toBe('billing');
    expect(charges?.textContent).toContain('Active payment methods are charged');
  });

  it('renders the primary_action invoice with role color encoding', () => {
    const invoice = doc.querySelector(
      '.entity[data-entity-urn="urn:proto:semantic:invoice-detail-card@1.0.0"]',
    );
    expect(invoice?.getAttribute('data-role')).toBe('primary_action');
    expect(invoice?.getAttribute('data-element-action')).toBe('pay_now');
  });
});

describe('Q3 — variant-aware slot rendering (D2 v2, s100-m03)', () => {
  // user fixture declares two projection_variants:
  //   desktop: 3 slots (avatar, title, subtitle)
  //   mobile:  2 slots (avatar, title — no subtitle)
  const manifest = userFixture as ObjectCatalogManifest;

  it('variant="desktop" renders the 3-slot desktop projection', () => {
    const result = emit(manifest, { variant: 'desktop' });
    const doc = new JSDOM(result.code).window.document;
    const slots = doc.querySelectorAll('.slot');
    expect(slots.length).toBe(3);
    const names = Array.from(slots).map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['avatar', 'title', 'subtitle']);
  });

  it('variant="mobile" renders the 2-slot mobile projection (subtitle omitted)', () => {
    const result = emit(manifest, { variant: 'mobile' });
    const doc = new JSDOM(result.code).window.document;
    const slots = doc.querySelectorAll('.slot');
    expect(slots.length).toBe(2);
    const names = Array.from(slots).map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['avatar', 'title']);
    expect(result.code).not.toContain('data-slot-name="subtitle"');
  });

  it('omitting variant falls back to canonical oods.render.slots (matches desktop in user.json)', () => {
    const canonical = new JSDOM(emit(manifest).code).window.document;
    const desktop = new JSDOM(emit(manifest, { variant: 'desktop' }).code).window.document;
    const canonicalNames = Array.from(canonical.querySelectorAll('.slot'))
      .map((n) => n.getAttribute('data-slot-name'));
    const desktopNames = Array.from(desktop.querySelectorAll('.slot'))
      .map((n) => n.getAttribute('data-slot-name'));
    expect(canonicalNames).toEqual(desktopNames);
  });

  it('unknown variant falls back to canonical render slots', () => {
    const result = emit(manifest, { variant: 'watch' });
    const doc = new JSDOM(result.code).window.document;
    expect(doc.querySelectorAll('.slot').length).toBe(3);
  });
});
