/**
 * Q3 — Real-data E2E gate for the C-track branded mockup emitter.
 *
 * Per quality bar (cmos/foundational-docs/quality-bars.md), every new
 * Capability-track render mission must run its emitter end-to-end against:
 *   1. the three internal sprint-97 Object Catalog fixtures (user, product,
 *      subscription) covering informational / action-shaped / relationships
 *      variants,
 *   2. at least one independently-sourced external-shape fixture exercising
 *      multi-entity rendering (billing-multi-entity), AND
 *   3. the new sprint-102 content domain pack (Article / Author / Comment)
 *      both as single-entity fixtures and as a multi-entity content-pack.
 *
 * Gate assertions per fixture:
 *   - branded-mockup emitter returns status='ok' with no errors
 *   - emitted HTML parses cleanly via jsdom
 *   - entity count in DOM matches manifest.entities.length
 *   - every slot declared in oods.render.slots is present with
 *     data-slot-name + data-slot-field
 *   - data-entity-urn / data-element-type / data-role preserved verbatim
 *   - brand tokens applied (CSS custom properties present, data-resolved-brand
 *     attribute on each entity)
 */

import { resolveTokenToColor, resolveTokenValue } from '@oods/viz-core';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import userFixture from '../../src/object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../../src/object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../../src/object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };
import articleFixture from '../../src/object-catalog/fixtures/content/article.json' with { type: 'json' };
import authorFixture from '../../src/object-catalog/fixtures/content/author.json' with { type: 'json' };
import commentFixture from '../../src/object-catalog/fixtures/content/comment.json' with { type: 'json' };
import contentPackFixture from '../fixtures/object-catalog/content-pack.json' with { type: 'json' };

import type { ObjectCatalogManifest, OodsSlot } from '../../src/object-catalog/types.js';
import { emit } from '../../src/codegen/branded-mockup-emitter.js';

function entitySelector(urn: string): string {
  return `.entity[data-entity-urn="${urn.replace(/"/g, '\\"')}"]`;
}

type GateFixture = readonly [name: string, manifest: ObjectCatalogManifest];

const fixtures: ReadonlyArray<GateFixture> = [
  ['user (internal — informational)', userFixture as ObjectCatalogManifest],
  ['product (internal — action-shaped)', productFixture as ObjectCatalogManifest],
  ['subscription (internal — relationships.edges source)', subscriptionFixture as ObjectCatalogManifest],
  ['billing (external — multi-entity)', billingFixture as ObjectCatalogManifest],
  ['content-article (s102-m01)', articleFixture as ObjectCatalogManifest],
  ['content-author (s102-m01)', authorFixture as ObjectCatalogManifest],
  ['content-comment (s102-m01)', commentFixture as ObjectCatalogManifest],
  ['content-pack (s102-m01 multi-entity)', contentPackFixture as ObjectCatalogManifest],
];

function expectedSlots(manifest: ObjectCatalogManifest): Array<{ urn: string; slots: OodsSlot[] }> {
  return manifest.entities.map((e) => ({
    urn: e.urn,
    slots: e.oods?.render?.slots ?? [],
  }));
}

describe('Q3 — branded-mockup-emitter real-data E2E gate', () => {
  describe.each(fixtures)('%s', (_name, manifest) => {
    // External brands need an explicit supported override; silent fallback was removed in s194.
    const result = emit(manifest, { brandOverlay: 'A' });
    const dom = new JSDOM(result.code);
    const doc = dom.window.document;

    it('emits status=ok with no errors', () => {
      expect(result.status).toBe('ok');
      expect(result.errors ?? []).toEqual([]);
    });

    it('parses as a well-formed HTML document with branded-mockup fidelity marker', () => {
      expect(doc.doctype?.name).toBe('html');
      expect(doc.documentElement.tagName.toLowerCase()).toBe('html');
      expect(doc.querySelector('head')).not.toBeNull();
      expect(doc.querySelector('body')).not.toBeNull();
      expect(doc.querySelector('body')?.getAttribute('data-fidelity')).toBe('branded-mockup');
    });

    it('renders exactly one .entity per manifest entity in declaration order', () => {
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

    it('preserves data-role + data-element-type on every entity', () => {
      for (const entity of manifest.entities) {
        const entityNode = doc.querySelector(entitySelector(entity.urn));
        expect(entityNode).not.toBeNull();
        if (entity.pragmatic_role) {
          expect(entityNode!.getAttribute('data-role')).toBe(entity.pragmatic_role);
        }
        expect(entityNode!.getAttribute('data-element-type')).toBe(entity.element.type);
      }
    });

    it('applies brand tokens via CSS custom properties and stamps data-resolved-brand on every entity', () => {
      // Default brand-a tokens are always emitted on :root.
      expect(result.code).toContain('--brand-primary');
      for (const entity of manifest.entities) {
        const entityNode = doc.querySelector(entitySelector(entity.urn));
        const resolved = entityNode!.getAttribute('data-resolved-brand');
        expect(resolved).toBeTruthy();
        expect(result.meta.brandsApplied).toContain(resolved!);
      }
    });

    it('emits no missing-catalog-annotation warnings', () => {
      const missing = result.warnings.filter((w) => w.code === 'OODS-BM-001');
      expect(missing).toHaveLength(0);
    });
  });
});

describe('Q3 — branded-mockup multi-entity content-pack rendering', () => {
  const result = emit(contentPackFixture as ObjectCatalogManifest);
  const doc = new JSDOM(result.code).window.document;

  it('renders three entity cards (article + author + comment) in declaration order', () => {
    const urns = Array.from(doc.querySelectorAll('.entity')).map((n) =>
      n.getAttribute('data-entity-urn'),
    );
    expect(urns).toEqual([
      'urn:proto:semantic:article-detail@1.0.0',
      'urn:proto:semantic:author-profile@1.0.0',
      'urn:proto:semantic:comment-threaded@1.0.0',
    ]);
  });

  it('article entity renders image placeholder for hero slot', () => {
    const article = doc.querySelector(
      '.entity[data-entity-urn="urn:proto:semantic:article-detail@1.0.0"]',
    );
    const hero = article?.querySelector('.slot[data-slot-name="hero"]');
    expect(hero).not.toBeNull();
    expect(hero?.getAttribute('data-slot-kind')).toBe('image');
  });

  it('author entity renders title slot as heading', () => {
    const author = doc.querySelector(
      '.entity[data-entity-urn="urn:proto:semantic:author-profile@1.0.0"]',
    );
    const title = author?.querySelector('.slot[data-slot-name="title"]');
    expect(title?.getAttribute('data-slot-kind')).toBe('heading');
    expect(title?.tagName.toLowerCase()).toBe('h3');
  });

  it('every entity carries traits as data-trait attributes', () => {
    for (const entity of (contentPackFixture as ObjectCatalogManifest).entities) {
      const entityNode = doc.querySelector(entitySelector(entity.urn));
      const traits = entity.traits ?? [];
      const renderedTraits = Array.from(
        entityNode!.querySelectorAll('.trait-chip'),
      ).map((n) => n.getAttribute('data-trait'));
      expect(renderedTraits).toEqual(traits);
    }
  });
});

describe('Q3 — branded-mockup brand-overlay override (option vs catalog vs unknown)', () => {
  const manifest = articleFixture as ObjectCatalogManifest;

  it('options.brandOverlay="brand-b" resolves the deprecated alias to built B/light tokens', () => {
    const result = emit(manifest, { brandOverlay: 'brand-b' });
    expect(result.meta.brandsApplied).toEqual(['B']);
    expect(result.code).toContain('[data-resolved-brand="B"]');
    expect(result.code).toContain(resolveTokenValue('--sys-text-scale-body-md-font-family', { brand: 'B', theme: 'light' })!);
  });

  it('options.brandOverlay="unknown-brand" rejects unknown brands with OODS-BM-002', () => {
    const result = emit(manifest, { brandOverlay: 'definitely-not-a-brand' });
    expect(result.status).toBe('error');
    expect(result.errors?.filter((w) => w.code === 'OODS-BM-002')).toHaveLength(manifest.entities.length);
    expect(result.meta.brandsApplied).toEqual([]);
  });
});

describe('Q3 — branded-mockup variant-aware rendering', () => {
  const manifest = articleFixture as ObjectCatalogManifest;

  it('variant="detail" renders the canonical 5-slot detail projection', () => {
    const result = emit(manifest, { variant: 'detail' });
    const doc = new JSDOM(result.code).window.document;
    const slots = Array.from(doc.querySelectorAll('.slot'));
    const names = slots.map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['hero', 'title', 'byline', 'body', 'related']);
  });

  it('variant="list-card" renders the 4-slot list-card projection (no body, no related)', () => {
    const result = emit(manifest, { variant: 'list-card' });
    const doc = new JSDOM(result.code).window.document;
    const slots = Array.from(doc.querySelectorAll('.slot'));
    const names = slots.map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['thumb', 'title', 'excerpt', 'byline']);
  });

  it('variant="hero-feature" renders the 3-slot hero-feature projection', () => {
    const result = emit(manifest, { variant: 'hero-feature' });
    const doc = new JSDOM(result.code).window.document;
    const slots = Array.from(doc.querySelectorAll('.slot'));
    const names = slots.map((n) => n.getAttribute('data-slot-name'));
    expect(names).toEqual(['hero', 'title', 'byline']);
  });

  it('omitting variant produces byte-identical output to variant="detail" for the canonical fixture', () => {
    const canonical = emit(manifest);
    const explicit = emit(manifest, { variant: 'detail' });
    // article's oods.render is byte-identical to projection_variants[0] (detail).
    expect(canonical.code).toBe(explicit.code);
  });
});
