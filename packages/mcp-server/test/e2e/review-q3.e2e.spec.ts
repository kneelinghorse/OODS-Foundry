/**
 * Q3 — Real-data E2E gate for the C3 review/recovery emitter (sprint-99 m04).
 *
 * Per quality bar (cmos/foundational-docs/quality-bars.md), every new
 * Capability-track render mission must run its emitter end-to-end against:
 *   1. the three internal sprint-97 Object Catalog fixtures (user, product,
 *      subscription) covering informational / action-shaped / relationships
 *      variants, AND
 *   2. the multi-entity billing fixture used by C1 + C2 Q3 gates, AND
 *   3. for C3 specifically: the synthetic low-confidence fixture introduced
 *      in this mission (production fixtures don't exercise the LOW tier path
 *      so the synthetic is required to gate it).
 *
 * Gate assertions per fixture:
 *   - emitter returns status='ok' with no errors
 *   - emitted HTML parses cleanly via jsdom
 *   - entity count in DOM matches manifest.entities.length
 *   - every entity carries a data-confidence-tier classifying it as
 *     high|medium|low|unknown (no unclassified entities)
 *   - flagged entities are exactly those whose tier is unknown OR whose score
 *     is below reviewThreshold (default 0.7)
 *   - flagged entities expose a REVIEW NEEDED banner + a review-breakdown
 *     block; unflagged entities expose neither
 *   - for the low-confidence synthetic specifically: breakdown lists exactly
 *     min(3, signals.length) lowest signals in ascending score order
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import userFixture from '../../src/object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../../src/object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../../src/object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };
import lowConfFixture from '../fixtures/object-catalog/subscription-low-confidence.json' with { type: 'json' };

import type {
  ObjectCatalogManifest,
  SemanticEntity,
} from '../../src/object-catalog/types.js';
import { emit, classifyTier, needsReview } from '../../src/codegen/review-emitter.js';

type GateFixture = readonly [name: string, manifest: ObjectCatalogManifest];

const fixtures: ReadonlyArray<GateFixture> = [
  ['user (internal — informational, no confidence_decomposition)', userFixture as ObjectCatalogManifest],
  ['product (internal — high confidence 0.92)', productFixture as ObjectCatalogManifest],
  ['subscription (internal — no confidence_decomposition)', subscriptionFixture as ObjectCatalogManifest],
  ['billing (external — multi-entity, mixed confidence)', billingFixture as ObjectCatalogManifest],
  ['subscription-low-confidence (synthetic — exercises LOW tier)', lowConfFixture as ObjectCatalogManifest],
];

const DEFAULT_THRESHOLD = 0.7;

function entitySelector(urn: string): string {
  return `.entity[data-entity-urn="${urn.replace(/"/g, '\\"')}"]`;
}

function expectedTierForEntity(entity: SemanticEntity): 'high' | 'medium' | 'low' | 'unknown' {
  const score = entity.oods?.confidence_decomposition?.total ?? null;
  return classifyTier(score);
}

function expectedFlaggedForEntity(entity: SemanticEntity, threshold: number): boolean {
  const score = entity.oods?.confidence_decomposition?.total ?? null;
  return needsReview(score, threshold);
}

describe('Q3 — review-emitter real-data E2E gate', () => {
  describe.each(fixtures)('%s', (_name, manifest) => {
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

    it('renders exactly manifest.entities.length entity articles', () => {
      const articles = doc.querySelectorAll('article.entity');
      expect(articles.length).toBe(manifest.entities.length);
    });

    it('every entity has a non-empty data-confidence-tier in {high,medium,low,unknown}', () => {
      const articles = Array.from(doc.querySelectorAll('article.entity'));
      const validTiers = new Set(['high', 'medium', 'low', 'unknown']);
      for (const article of articles) {
        const tier = article.getAttribute('data-confidence-tier');
        expect(tier).not.toBeNull();
        expect(validTiers.has(tier!)).toBe(true);
      }
    });

    it('every entity carries the standard data-* contract attributes', () => {
      const articles = Array.from(doc.querySelectorAll('article.entity'));
      for (const article of articles) {
        // URN is required.
        expect(article.getAttribute('data-entity-urn')).toBeTruthy();
        // Tier is required.
        expect(article.getAttribute('data-confidence-tier')).toBeTruthy();
        // flagged-for-review must be 'true' or 'false', never absent.
        const flagged = article.getAttribute('data-flagged-for-review');
        expect(['true', 'false']).toContain(flagged);
      }
    });

    it('tier classification matches expected per-entity outcome', () => {
      for (const entity of manifest.entities as SemanticEntity[]) {
        const article = doc.querySelector(entitySelector(entity.urn));
        expect(article).not.toBeNull();
        const observedTier = article!.getAttribute('data-confidence-tier');
        const expectedTier = expectedTierForEntity(entity);
        expect(observedTier).toBe(expectedTier);
      }
    });

    it('flagged-for-review flag matches expected per-entity outcome at default threshold', () => {
      for (const entity of manifest.entities as SemanticEntity[]) {
        const article = doc.querySelector(entitySelector(entity.urn));
        expect(article).not.toBeNull();
        const observed = article!.getAttribute('data-flagged-for-review') === 'true';
        const expectedFlag = expectedFlaggedForEntity(entity, DEFAULT_THRESHOLD);
        expect(observed).toBe(expectedFlag);
      }
    });

    it('flagged entities expose a REVIEW NEEDED banner + review-breakdown; unflagged expose neither', () => {
      const articles = Array.from(doc.querySelectorAll('article.entity'));
      for (const article of articles) {
        const flagged = article.getAttribute('data-flagged-for-review') === 'true';
        const banner = article.querySelector('.review-banner');
        const breakdown = article.querySelector('.review-breakdown');
        if (flagged) {
          expect(banner).not.toBeNull();
          expect(banner!.textContent).toContain('REVIEW NEEDED');
          expect(breakdown).not.toBeNull();
        } else {
          expect(banner).toBeNull();
          expect(breakdown).toBeNull();
        }
      }
    });

    it('summary section emits exactly 4 tier-pills with non-negative counts', () => {
      const pills = Array.from(doc.querySelectorAll('.summary-pill'));
      expect(pills.length).toBe(4);
      const tiersSeen = new Set(pills.map((p) => p.getAttribute('data-tier')));
      expect(tiersSeen).toEqual(new Set(['high', 'medium', 'low', 'unknown']));
      let totalFromPills = 0;
      for (const pill of pills) {
        const count = Number(pill.getAttribute('data-count'));
        expect(Number.isInteger(count) && count >= 0).toBe(true);
        totalFromPills += count;
      }
      // Tier counts must sum to entities rendered.
      expect(totalFromPills).toBe(manifest.entities.length);
    });

    it('result.meta.tierCounts matches DOM-derived per-tier counts', () => {
      const articles = Array.from(doc.querySelectorAll('article.entity'));
      const domCounts: Record<string, number> = { high: 0, medium: 0, low: 0, unknown: 0 };
      for (const article of articles) {
        const tier = article.getAttribute('data-confidence-tier')!;
        domCounts[tier] = (domCounts[tier] ?? 0) + 1;
      }
      expect(result.meta.tierCounts).toEqual(domCounts);
    });
  });

  // ── Synthetic fixture: exercise breakdown row-count + score-order ───────────
  // The synthetic low-confidence fixture has exactly 4 signals with scores
  // 0.32, 0.41, 0.48, 0.55 (assigned in that order in the JSON). The renderer
  // must take the top-3 lowest, ascending: 0.32, 0.41, 0.48. The 0.55 signal
  // must NOT appear in the breakdown.

  describe('synthetic low-confidence fixture — signal breakdown shape', () => {
    const result = emit(lowConfFixture as ObjectCatalogManifest);
    const dom = new JSDOM(result.code);
    const doc = dom.window.document;
    const breakdown = doc.querySelector('.review-breakdown[data-breakdown="ranked"]');

    it('renders a ranked breakdown (not missing/empty)', () => {
      expect(breakdown).not.toBeNull();
    });

    it('renders exactly 3 signal rows (top-3 of 4)', () => {
      const rows = breakdown!.querySelectorAll('.signal-row');
      expect(rows.length).toBe(3);
    });

    it('signal rows ordered ascending by data-signal-score', () => {
      const rows = Array.from(breakdown!.querySelectorAll('.signal-row'));
      const scores = rows.map((r) => Number(r.getAttribute('data-signal-score')));
      expect(scores).toEqual([0.32, 0.41, 0.48]);
      // Must be ascending.
      for (let i = 1; i < scores.length; i += 1) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('signal rows carry the correct names', () => {
      const rows = Array.from(breakdown!.querySelectorAll('.signal-row'));
      const names = rows.map((r) => r.getAttribute('data-signal-name'));
      expect(names).toEqual(['trait_membership', 'evidence_chain', 'field_binding_coverage']);
    });

    it('the 0.55 sub-signal is NOT in the breakdown (above top-3 cutoff)', () => {
      const rows = Array.from(breakdown!.querySelectorAll('.signal-row'));
      const scores = rows.map((r) => Number(r.getAttribute('data-signal-score')));
      expect(scores).not.toContain(0.55);
    });

    it('REVIEW NEEDED banner reason cites score + threshold numerically', () => {
      const banner = doc.querySelector('.review-banner-reason');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('0.40');
      expect(banner!.textContent).toContain('0.70');
    });

    it('breakdown signal-hint surfaces stored hint text', () => {
      const hints = Array.from(breakdown!.querySelectorAll('.signal-hint'))
        .map((h) => h.textContent ?? '')
        .join(' | ');
      expect(hints).toContain('Identifiable');
      expect(hints).toContain('Stage1 declared-only fallback');
    });
  });

  // ── Production fixtures sanity: NO low-tier in any of the 4 production fixtures
  describe('production fixtures sanity check', () => {
    it('no production fixture surfaces a LOW tier (which is why the synthetic exists)', () => {
      for (const [name, manifest] of fixtures) {
        if (name.includes('synthetic')) continue;
        const result = emit(manifest);
        expect(result.meta.tierCounts.low).toBe(0);
      }
    });
  });

  // ── Variant-aware slot rendering (D2 v2, s100-m03)
  describe('variant-aware slot rendering (D2 v2, s100-m03)', () => {
    // user fixture: desktop=3 slots (avatar/title/subtitle); mobile=2 slots (avatar/title).
    const manifest = userFixture as ObjectCatalogManifest;

    it('variant="desktop" renders the 3-slot desktop projection in data-slot-count', () => {
      const result = emit(manifest, { variant: 'desktop' });
      const doc = new JSDOM(result.code).window.document;
      const entity = doc.querySelector('.entity[data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"]');
      expect(entity?.getAttribute('data-slot-count')).toBe('3');
    });

    it('variant="mobile" renders the 2-slot mobile projection in data-slot-count', () => {
      const result = emit(manifest, { variant: 'mobile' });
      const doc = new JSDOM(result.code).window.document;
      const entity = doc.querySelector('.entity[data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"]');
      expect(entity?.getAttribute('data-slot-count')).toBe('2');
    });

    it('omitting variant falls back to canonical render slots (matches desktop)', () => {
      const canonical = new JSDOM(emit(manifest).code).window.document;
      const desktop = new JSDOM(emit(manifest, { variant: 'desktop' }).code).window.document;
      const canonicalSlotCount = canonical
        .querySelector('.entity[data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"]')
        ?.getAttribute('data-slot-count');
      const desktopSlotCount = desktop
        .querySelector('.entity[data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"]')
        ?.getAttribute('data-slot-count');
      expect(canonicalSlotCount).toBe(desktopSlotCount);
    });

    it('unknown variant falls back to canonical render slots', () => {
      const result = emit(manifest, { variant: 'watch' });
      const doc = new JSDOM(result.code).window.document;
      const entity = doc.querySelector('.entity[data-entity-urn="urn:proto:semantic:user-profile-card@1.0.0"]');
      expect(entity?.getAttribute('data-slot-count')).toBe('3');
    });
  });
});
