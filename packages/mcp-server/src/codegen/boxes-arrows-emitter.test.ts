/**
 * Boxes-and-arrows emitter — unit + byte-stability tests against the three
 * sprint-97 Object Catalog fixtures (user / product / subscription).
 *
 * Verifies that the rendered HTML preserves:
 *   - role labels visible per entity
 *   - trait annotations as data-* attributes AND visible text
 *   - relationships rendered as visible labeled connector rows
 *   - data-entity-urn / data-relationship-source/target / data-trait shape
 *     suitable for future interactive-editor hookup
 *   - deterministic byte-stable output across runs
 */

import { describe, expect, it } from 'vitest';

import userFixture from '../object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../object-catalog/fixtures/subscription.json' with { type: 'json' };

import type { ObjectCatalogManifest } from '../object-catalog/types.js';
import { emit } from './boxes-arrows-emitter.js';

const user = userFixture as ObjectCatalogManifest;
const product = productFixture as ObjectCatalogManifest;
const subscription = subscriptionFixture as ObjectCatalogManifest;

describe('boxes-arrows-emitter — User fixture (informational)', () => {
  const result = emit(user);

  it('returns status ok with framework boxes-arrows and .html extension', () => {
    expect(result.status).toBe('ok');
    expect(result.framework).toBe('boxes-arrows');
    expect(result.fileExtension).toBe('.html');
  });

  it('produces a self-contained HTML document', () => {
    expect(result.code).toMatch(/^<!DOCTYPE html>/);
    expect(result.code).toContain('<html lang="en">');
    expect(result.code).toContain('</html>');
    expect(result.code).toContain('<style>');
  });

  it('renders the entity as a box with data-entity-urn + role label', () => {
    expect(result.code).toContain('data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"');
    expect(result.code).toContain('data-role="informational"');
    expect(result.code).toContain('Informational');
    expect(result.code).toContain('User profile card');
  });

  it('emits trait annotations as data-trait attributes AND visible chips', () => {
    expect(result.code).toContain('data-trait="Identifiable"');
    expect(result.code).toContain('data-trait="Avatarable"');
    expect(result.code).toMatch(/<li class="trait"[^>]*>Identifiable<\/li>/);
    expect(result.code).toMatch(/<li class="trait"[^>]*>Avatarable<\/li>/);
  });

  it('emits all three slots with data-slot-name + data-slot-field', () => {
    expect(result.code).toContain('data-slot-name="avatar"');
    expect(result.code).toContain('data-slot-field="user.photo_url"');
    expect(result.code).toContain('data-slot-name="title"');
    expect(result.code).toContain('data-slot-field="user.display_name"');
    expect(result.code).toContain('data-slot-name="subtitle"');
    expect(result.code).toContain('data-slot-field="user.email"');
  });

  it('records meta counts for 1 entity, 0 relationships', () => {
    expect(result.meta.entitiesRendered).toBe(1);
    expect(result.meta.relationshipsRendered).toBe(0);
    expect(result.meta.catalogVersion).toBe('1.0.0');
    expect(result.meta.sourceAgent).toBe('oods-forge');
  });
});

describe('boxes-arrows-emitter — Product fixture (action-shaped)', () => {
  const result = emit(product);

  it('uses the primary_action role color encoding via data-role', () => {
    expect(result.code).toContain('data-role="primary_action"');
    expect(result.code).toContain('Primary action');
  });

  it('renders Actionable + Pricable trait chips with data-trait', () => {
    expect(result.code).toContain('data-trait="Actionable"');
    expect(result.code).toContain('data-trait="Pricable"');
    expect(result.code).toMatch(/<li class="trait"[^>]*>Actionable<\/li>/);
    expect(result.code).toMatch(/<li class="trait"[^>]*>Pricable<\/li>/);
  });

  it('surfaces element.object + element.action via data-attributes', () => {
    expect(result.code).toContain('data-element-object="Product"');
    expect(result.code).toContain('data-element-action="add_to_cart"');
  });

  it('renders confidence_decomposition total', () => {
    expect(result.code).toContain('data-confidence-total="0.92"');
    expect(result.code).toContain('<strong>0.92</strong>');
  });

  it('renders all four product slots', () => {
    for (const field of ['product.hero_image_url', 'product.name', 'product.price_display', 'product.add_to_cart_label']) {
      expect(result.code).toContain(`data-slot-field="${field}"`);
    }
  });
});

describe('boxes-arrows-emitter — Subscription fixture (relationships.edges)', () => {
  const result = emit(subscription);

  it('records 2 relationships in meta', () => {
    expect(result.meta.relationshipsRendered).toBe(2);
  });

  it('renders both relationships as labeled connector rows', () => {
    expect(result.code).toContain('data-relationship-type="renews_to"');
    expect(result.code).toContain('data-relationship-type="depends_on"');
  });

  it('encodes source + target URNs as data-attributes', () => {
    expect(result.code).toContain('data-relationship-source="urn:proto:semantic:subscription-summary-row@1.0.0"');
    expect(result.code).toContain('data-relationship-target="urn:proto:semantic:subscription-renewal-confirmation@1.0.0"');
    expect(result.code).toContain('data-relationship-target="urn:proto:semantic:billing-source-card@1.0.0"');
  });

  it('marks externally-referenced URNs with data-external="true"', () => {
    // Both targets are URNs not present in this manifest; should be flagged.
    expect(result.code).toMatch(/data-relationship-target-external="true"/);
    expect(result.code).toContain('data-external="true"');
  });

  it('renders the via=billing qualifier with a visible label', () => {
    expect(result.code).toContain('data-relationship-via="billing"');
    expect(result.code).toContain('(via billing)');
  });

  it('renders the relationship reason as visible text', () => {
    expect(result.code).toContain('Subscription renewals are charged against the linked billing source.');
  });

  it('uses → glyph for outbound directional arrows', () => {
    expect(result.code).toContain('→');
  });
});

describe('boxes-arrows-emitter — byte stability', () => {
  it('produces identical output across repeated runs (user)', () => {
    const a = emit(user).code;
    const b = emit(user).code;
    expect(a).toBe(b);
  });

  it('produces identical output across repeated runs (product)', () => {
    const a = emit(product).code;
    const b = emit(product).code;
    expect(a).toBe(b);
  });

  it('produces identical output across repeated runs (subscription)', () => {
    const a = emit(subscription).code;
    const b = emit(subscription).code;
    expect(a).toBe(b);
  });

  it('contains no Date.now / random / timestamp side-channels', () => {
    const code = emit(subscription).code;
    // The captured_at field comes straight from the manifest, not from now().
    expect(code).toContain('2026-05-15T00:00:00.000Z');
    // No ISO timestamps that drift on each call:
    const isoCount = (code.match(/2026-05-15T00:00:00\.000Z/g) ?? []).length;
    const allIsoMatches = code.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g) ?? [];
    expect(allIsoMatches.length).toBe(isoCount);
  });
});
