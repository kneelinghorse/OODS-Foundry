/**
 * Unit tests for the branded-mockup emitter.
 *
 * Covers: data-* contract preservation, brand-token application via CSS custom
 * properties, brand-overlay resolution (catalog vs option override vs unknown
 * fallback), variant selection forwarded to runPreEmit(), slot-kind visual
 * dispatch, and graceful handling of empty/missing oods.render.
 */

import { resolveTokenToColor, resolveTokenValue } from '@oods/viz-core';
import { describe, expect, it } from 'vitest';

import userFixture from '../object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../object-catalog/fixtures/product.json' with { type: 'json' };
import articleFixture from '../object-catalog/fixtures/content/article.json' with { type: 'json' };
import contentPack from '../../test/fixtures/object-catalog/content-pack.json' with { type: 'json' };

import type { ObjectCatalogManifest } from '../object-catalog/types.js';
import { emit } from './branded-mockup-emitter.js';

const user = userFixture as ObjectCatalogManifest;
const product = productFixture as ObjectCatalogManifest;
const article = articleFixture as ObjectCatalogManifest;
const pack = contentPack as ObjectCatalogManifest;

describe('branded-mockup-emitter — top-level emit shape', () => {
  it('returns status=ok with a non-empty HTML document for a single-entity manifest', () => {
    const r = emit(user);
    expect(r.status).toBe('ok');
    expect(r.framework).toBe('branded-mockup');
    expect(r.fileExtension).toBe('.html');
    expect(r.code.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(r.code).toContain('</html>');
    expect(r.errors ?? []).toEqual([]);
  });

  it('annotates body with data-fidelity="branded-mockup"', () => {
    const r = emit(user);
    expect(r.code).toContain('data-fidelity="branded-mockup"');
  });

  it('reports brandsApplied in meta and renders the same brand list in CSS', () => {
    const r = emit(user);
    expect(r.meta.brandsApplied).toContain('A');
    // brand-a tokens block should always be present (default).
    expect(r.code).toContain('--brand-primary');
  });

  it('omits the inline <style> block when includeStyles=false', () => {
    const r = emit(user, { includeStyles: false });
    expect(r.code).not.toContain('<style>');
    expect(r.code).not.toContain('--brand-primary');
  });
});

describe('branded-mockup-emitter — data-* contract parity with C1/C2', () => {
  it('preserves data-entity-urn for every entity in the manifest', () => {
    const r = emit(pack);
    for (const entity of pack.entities) {
      expect(r.code).toContain(`data-entity-urn="${entity.urn}"`);
    }
  });

  it('preserves data-element-type for every entity', () => {
    const r = emit(pack);
    for (const entity of pack.entities) {
      expect(r.code).toContain(`data-element-type="${entity.element.type}"`);
    }
  });

  it('preserves data-role for entities that declare pragmatic_role', () => {
    const r = emit(product);
    expect(r.code).toContain('data-role="primary_action"');
  });

  it('preserves data-slot-name + data-slot-field for every declared slot', () => {
    const r = emit(article);
    const slots = article.entities[0].oods?.render?.slots ?? [];
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(r.code).toContain(`data-slot-name="${slot.name}"`);
      expect(r.code).toContain(`data-slot-field="${slot.binding.field}"`);
    }
  });

  it('emits data-trait for every declared trait on the entity', () => {
    const r = emit(article);
    for (const trait of article.entities[0].traits ?? []) {
      expect(r.code).toContain(`data-trait="${trait}"`);
    }
  });
});

describe('branded-mockup-emitter — brand-overlay resolution', () => {
  it('uses the catalog brand_overlay verbatim when it is a known brand', () => {
    const r = emit(article);
    // article fixture sets brand_overlay: "brand-a" on render + every variant
    expect(r.meta.brandsApplied).toEqual(['A']);
    expect(r.code).toContain('data-resolved-brand="A"');
    expect(r.warnings.filter((w) => w.code === 'OODS-BM-002')).toHaveLength(0);
  });

  it('options.brandOverlay overrides every entity\'s catalog brand_overlay', () => {
    const r = emit(article, { brandOverlay: 'brand-b' });
    expect(r.meta.brandsApplied).toEqual(['B']);
    expect(r.code).toContain('data-resolved-brand="B"');
    expect(r.code).toContain(resolveTokenValue('--sys-text-scale-body-md-font-family', { brand: 'B', theme: 'light' })!);
  });

  it('rejects unknown brands with OODS-BM-002 when overlay is unknown', () => {
    const r = emit(article, { brandOverlay: 'brand-zzz' });
    expect(r.status).toBe('error');
    expect(r.errors?.filter((w) => w.code === 'OODS-BM-002')).toHaveLength(article.entities.length);
    expect(r.meta.brandsApplied).toEqual([]);
  });

  it('defaults to canonical A when catalog brand_overlay is absent', () => {
    // Construct a manifest with the article entity but strip brand_overlay everywhere.
    const stripped: ObjectCatalogManifest = JSON.parse(JSON.stringify(article));
    const entity = stripped.entities[0];
    if (entity.oods?.render) delete (entity.oods.render as { brand_overlay?: string }).brand_overlay;
    for (const v of entity.oods?.projection_variants ?? []) {
      delete (v as { brand_overlay?: string }).brand_overlay;
    }
    const r = emit(stripped);
    expect(r.meta.brandsApplied).toEqual(['A']);
    expect(r.warnings.filter((w) => w.code === 'OODS-BM-002')).toHaveLength(0);
  });

  it('applies CSS custom properties on :root for the default brand', () => {
    const r = emit(article);
    // The default-brand block uses :root rather than the bracketed selector.
    expect(r.code).toMatch(/:root\s*\{[^}]*--brand-primary:/);
  });

  it('applies CSS custom properties on a scoped selector for non-default brands when used', () => {
    const r = emit(article, { brandOverlay: 'brand-b' });
    expect(r.code).toContain('[data-resolved-brand="B"]');
    expect(r.code).toContain(`--brand-primary: ${resolveTokenToColor('--sys-surface-interactive-primary-default', { brand: 'B', theme: 'light' })}`);
  });
});

describe('branded-mockup-emitter — variant selection forwarded to runPreEmit', () => {
  it('variant="list-card" renders the 4-slot list-card projection (Article)', () => {
    const r = emit(article, { variant: 'list-card' });
    // list-card slot set: thumb, title, excerpt, byline
    expect(r.code).toContain('data-slot-name="thumb"');
    expect(r.code).toContain('data-slot-name="excerpt"');
    expect(r.code).not.toContain('data-slot-name="body"');
    expect(r.code).not.toContain('data-slot-name="related"');
    expect(r.meta.slotsRendered).toBe(4);
  });

  it('variant="hero-feature" renders the 3-slot hero-feature projection (Article)', () => {
    const r = emit(article, { variant: 'hero-feature' });
    expect(r.meta.slotsRendered).toBe(3);
    expect(r.code).toContain('data-slot-name="hero"');
    expect(r.code).not.toContain('data-slot-name="body"');
  });

  it('omitting variant falls back to canonical oods.render.slots (Article: 5 slots)', () => {
    const r = emit(article);
    expect(r.meta.slotsRendered).toBe(5);
  });
});

describe('branded-mockup-emitter — slot kind dispatch (visual treatment only, data-* unchanged)', () => {
  it('avatar/hero/thumb slots emit data-slot-kind="image" with image-placeholder markup', () => {
    const r = emit(article);
    expect(r.code).toContain('data-slot-kind="image"');
    expect(r.code).toContain('slot-image-placeholder');
  });

  it('title slot emits data-slot-kind="heading" as an <h3>', () => {
    const r = emit(article);
    expect(r.code).toContain('data-slot-kind="heading"');
    expect(r.code).toMatch(/<h3[^>]*class="slot slot-heading"/);
  });

  it('product primary_action slot emits data-slot-kind="action" as a <button>', () => {
    const r = emit(product);
    expect(r.code).toContain('data-slot-kind="action"');
    expect(r.code).toMatch(/<button[^>]*class="slot slot-action"/);
  });

  it('price slot emits data-slot-kind="price"', () => {
    const r = emit(product);
    expect(r.code).toContain('data-slot-kind="price"');
  });
});

describe('branded-mockup-emitter — multi-entity manifest rendering', () => {
  it('renders one .entity block per entity in declaration order for content-pack', () => {
    const r = emit(pack);
    expect(r.meta.entitiesRendered).toBe(pack.entities.length);
    const urns = pack.entities.map((e) => e.urn);
    let lastIndex = -1;
    for (const urn of urns) {
      const idx = r.code.indexOf(`data-entity-urn="${urn}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it('reports slotsRendered as the sum of slots across all entities (no variant)', () => {
    const r = emit(pack);
    const expected = pack.entities.reduce(
      (sum, e) => sum + (e.oods?.render?.slots ?? []).length,
      0,
    );
    expect(r.meta.slotsRendered).toBe(expected);
  });
});

describe('branded-mockup-emitter — edge cases', () => {
  it('handles a manifest with an entity missing oods entirely (no crash, structured warning)', () => {
    const noOods: ObjectCatalogManifest = JSON.parse(JSON.stringify(user));
    delete noOods.entities[0].oods;
    const r = emit(noOods);
    // pre-emit still produces a catalog annotation (with empty slots) so the
    // entity renders; verify status=ok and no slots rendered.
    expect(r.status).toBe('ok');
    expect(r.meta.slotsRendered).toBe(0);
  });

  it('handles a manifest with zero entities (renders empty entities section)', () => {
    const empty: ObjectCatalogManifest = {
      manifest_version: '4.0',
      schema_version: '1.1.0',
      source: { agent: 'test', captured_at: '2026-05-20T00:00:00.000Z', oods_catalog_version: '1.0.0' },
      entities: [],
    };
    const r = emit(empty);
    expect(r.status).toBe('ok');
    expect(r.meta.entitiesRendered).toBe(0);
    expect(r.meta.brandsApplied).toEqual(['A']);
    const invalid = emit(empty, { brandOverlay: 'unknown' });
    expect(invalid.status).toBe('error');
    expect(invalid.errors?.[0].code).toBe('OODS-BM-002');
  });
});
