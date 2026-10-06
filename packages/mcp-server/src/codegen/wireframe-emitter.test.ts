/**
 * Wireframe emitter — unit + byte-stability tests against the three sprint-97
 * Object Catalog fixtures (user / product / subscription) plus the multi-entity
 * billing fixture used by the C1 Q3 gate.
 *
 * Verifies that the rendered HTML:
 *   - preserves the data-* attribute contract from C1 (data-entity-urn,
 *     data-element-type, data-role, data-slot-name, data-slot-field)
 *   - omits role color encoding, trait styling, and relationship arrows
 *     (those are explicit non-goals of wireframe fidelity)
 *   - produces deterministic byte-stable output across runs
 */

import { describe, expect, it } from 'vitest';

import userFixture from '../object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../../test/fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };

import type { ObjectCatalogManifest } from '../object-catalog/types.js';
import { emit } from './wireframe-emitter.js';

const user = userFixture as ObjectCatalogManifest;
const product = productFixture as ObjectCatalogManifest;
const subscription = subscriptionFixture as ObjectCatalogManifest;
const billing = billingFixture as ObjectCatalogManifest;

describe('wireframe-emitter — User fixture (informational, 1 entity, 3 slots)', () => {
  const result = emit(user);

  it('returns status ok with framework wireframe and .html extension', () => {
    expect(result.status).toBe('ok');
    expect(result.framework).toBe('wireframe');
    expect(result.fileExtension).toBe('.html');
  });

  it('produces a self-contained HTML document with embedded styles', () => {
    expect(result.code).toMatch(/^<!DOCTYPE html>/);
    expect(result.code).toContain('<html lang="en">');
    expect(result.code).toContain('</html>');
    expect(result.code).toContain('<style>');
    expect(result.code).toContain('data-fidelity="wireframe"');
  });

  it('renders the entity name as a visible heading with data-entity-urn', () => {
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"');
    expect(result.code).toContain('<h2 class="entity-name">User profile card</h2>');
  });

  it('preserves data-role attribute without rendering a visible role label', () => {
    expect(result.code).toContain('data-role="informational"');
    // No visible "Informational" role label (that is C1's job)
    expect(result.code).not.toContain('Informational</p>');
    expect(result.code).not.toContain('class="role"');
  });

  it('emits all three slots as dashed placeholders with data-slot-name + data-slot-field', () => {
    expect(result.code).toContain('data-slot-name="avatar"');
    expect(result.code).toContain('data-slot-field="user.photo_url"');
    expect(result.code).toContain('data-slot-name="title"');
    expect(result.code).toContain('data-slot-field="user.display_name"');
    expect(result.code).toContain('data-slot-name="subtitle"');
    expect(result.code).toContain('data-slot-field="user.email"');
  });

  it('records meta counts for 1 entity, 3 slots', () => {
    expect(result.meta.entitiesRendered).toBe(1);
    expect(result.meta.slotsRendered).toBe(3);
    expect(result.meta.catalogVersion).toBe('1.0.0');
    expect(result.meta.sourceAgent).toBe('oods-forge');
  });

  it('omits trait rendering entirely (no chips, no data-trait attributes)', () => {
    // Wireframe is a layout fidelity; traits live in C1 boxes-and-arrows.
    expect(result.code).not.toContain('data-trait="Identifiable"');
    expect(result.code).not.toContain('data-trait="Avatarable"');
    expect(result.code).not.toMatch(/<li class="trait"/);
  });
});

describe('wireframe-emitter — Product fixture (action-shaped, 1 entity, 4 slots)', () => {
  const result = emit(product);

  it('preserves data-role and data-element-action without visible action label', () => {
    expect(result.code).toContain('data-role="primary_action"');
    expect(result.code).toContain('data-element-action="add_to_cart"');
    expect(result.code).toContain('data-element-object="Product"');
    // Wireframe does not surface visible role text
    expect(result.code).not.toContain('Primary action</p>');
  });

  it('renders all four product slots as dashed placeholders', () => {
    for (const field of [
      'product.hero_image_url',
      'product.name',
      'product.price_display',
      'product.add_to_cart_label',
    ]) {
      expect(result.code).toContain(`data-slot-field="${field}"`);
    }
    expect(result.meta.slotsRendered).toBe(4);
  });

  it('omits confidence_decomposition rendering (that is C3 review/recovery scope)', () => {
    expect(result.code).not.toContain('data-confidence-total');
    expect(result.code).not.toContain('class="confidence"');
  });

  it('records data-slot-count on the entity matching slot list length', () => {
    expect(result.code).toContain('data-slot-count="4"');
  });
});

describe('wireframe-emitter — Subscription fixture (relationships.edges, 1 entity, 3 slots)', () => {
  const result = emit(subscription);

  it('renders the entity with its slot list', () => {
    expect(result.meta.entitiesRendered).toBe(1);
    expect(result.meta.slotsRendered).toBe(3);
  });

  it('omits all relationship rows (wireframe is layout fidelity, not relationship fidelity)', () => {
    expect(result.code).not.toContain('class="relationship"');
    expect(result.code).not.toContain('data-relationship-type');
    expect(result.code).not.toContain('data-relationship-source');
    expect(result.code).not.toContain('data-relationship-target');
  });

  it('omits relationship arrows and via qualifiers', () => {
    // The →, ←, ↔ glyphs C1 uses are not present in wireframe output
    expect(result.code).not.toContain('→');
    expect(result.code).not.toContain('(via billing)');
    expect(result.code).not.toContain('Subscription renewals are charged');
  });

  it('preserves entity name + slot data-attributes for future editor consumption', () => {
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:subscription-summary-row@1.0.0"');
    expect(result.code).toContain('data-slot-name="title"');
    expect(result.code).toContain('data-slot-name="subtitle"');
    expect(result.code).toContain('data-slot-name="status"');
  });
});

describe('wireframe-emitter — billing multi-entity fixture (3 entities, 3 cross-links)', () => {
  const result = emit(billing);

  it('renders all 3 entities with correct slot totals', () => {
    expect(result.meta.entitiesRendered).toBe(3);
    expect(result.meta.slotsRendered).toBeGreaterThan(0);
  });

  it('emits each entity with its URN preserved verbatim', () => {
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:billing-account-card@1.0.0"');
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:payment-method-row@1.0.0"');
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:invoice-detail-card@1.0.0"');
  });

  it('omits relationship rows even though manifest declares 3 cross-links', () => {
    expect(result.code).not.toContain('class="relationship"');
    expect(result.code).not.toContain('data-relationship-type="billed_to"');
    expect(result.code).not.toContain('data-relationship-type="owns"');
    expect(result.code).not.toContain('data-relationship-type="charges"');
  });
});

describe('wireframe-emitter — variant + options handling', () => {
  // D2 v2 (s100-m03, resolves decision #451): buildCatalogAnnotations now uses
  // selectVariant() so CatalogAnnotations.slots reflects the variant-selected
  // slot list. variant='desktop' renders user.json's 3-slot desktop projection;
  // variant='mobile' renders the 2-slot mobile projection. variant omitted
  // falls back to canonical oods.render.slots.
  it('variant-aware slot rendering: desktop (3 slots) vs mobile (2 slots)', () => {
    const desktop = emit(user, { variant: 'desktop' });
    const mobile = emit(user, { variant: 'mobile' });
    const canonical = emit(user);
    expect(desktop.status).toBe('ok');
    expect(mobile.status).toBe('ok');
    expect(canonical.status).toBe('ok');
    expect(desktop.meta.slotsRendered).toBe(3);
    expect(mobile.meta.slotsRendered).toBe(2);
    // Canonical (no variant) still uses oods.render.slots — same as desktop in user.json.
    expect(canonical.meta.slotsRendered).toBe(3);
    // Mobile output omits the subtitle slot present on desktop.
    expect(desktop.code).toContain('data-slot-name="subtitle"');
    expect(mobile.code).not.toContain('data-slot-name="subtitle"');
    // Both still emit avatar + title.
    expect(mobile.code).toContain('data-slot-name="avatar"');
    expect(mobile.code).toContain('data-slot-name="title"');
  });

  it('honors custom title option in <title> and <h1>', () => {
    const result = emit(user, { title: 'Custom Wireframe Title' });
    expect(result.code).toContain('<title>Custom Wireframe Title</title>');
    expect(result.code).toContain('<h1>Custom Wireframe Title</h1>');
  });

  it('omits <style> block when includeStyles=false', () => {
    const result = emit(user, { includeStyles: false });
    expect(result.code).not.toContain('<style>');
    // But the DOCTYPE + structure still render
    expect(result.code).toMatch(/^<!DOCTYPE html>/);
    expect(result.code).toContain('data-entity-urn=');
  });
});

describe('wireframe-emitter — byte stability', () => {
  it('produces identical output across repeated runs (user)', () => {
    expect(emit(user).code).toBe(emit(user).code);
  });

  it('produces identical output across repeated runs (product)', () => {
    expect(emit(product).code).toBe(emit(product).code);
  });

  it('produces identical output across repeated runs (subscription)', () => {
    expect(emit(subscription).code).toBe(emit(subscription).code);
  });

  it('produces identical output across repeated runs (billing multi-entity)', () => {
    expect(emit(billing).code).toBe(emit(billing).code);
  });

  it('contains no Date.now / random / timestamp side-channels', () => {
    const code = emit(subscription).code;
    // The captured_at field comes straight from the manifest, not from now().
    const isoMatches = code.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g) ?? [];
    for (const ts of isoMatches) {
      expect(ts).toBe('2026-05-15T00:00:00.000Z');
    }
  });
});
