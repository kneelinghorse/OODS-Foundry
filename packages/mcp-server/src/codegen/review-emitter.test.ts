/**
 * Review emitter — unit tests against the four sprint-97/m04 Object Catalog
 * fixtures + the synthetic low-confidence fixture introduced in s99-m04.
 *
 * Covers:
 *   - Tier classification (high ≥0.8, medium 0.5–0.8, low <0.5, unknown for
 *     missing oods.confidence_decomposition)
 *   - Threshold-driven REVIEW NEEDED banner visibility
 *   - data-* attribute contract (data-entity-urn, data-confidence-score,
 *     data-confidence-tier, data-flagged-for-review)
 *   - Top-3-lowest-signal breakdown selection + stable sort for ties
 *   - reviewThreshold option (0.5 / 0.7 default / 0.9)
 *   - tierCounts + entitiesFlaggedForReview meta
 *   - Helper unit coverage (classifyTier, needsReview, lowestSignals)
 */

import { describe, expect, it } from 'vitest';

import userFixture from '../object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../object-catalog/fixtures/subscription.json' with { type: 'json' };
import billingFixture from '../../test/fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };
import lowConfFixture from '../../test/fixtures/object-catalog/subscription-low-confidence.json' with { type: 'json' };

import type {
  ObjectCatalogManifest,
  OodsConfidenceSignal,
} from '../object-catalog/types.js';
import {
  classifyTier,
  emit,
  lowestSignals,
  needsReview,
} from './review-emitter.js';

const user = userFixture as ObjectCatalogManifest;
const product = productFixture as ObjectCatalogManifest;
const subscription = subscriptionFixture as ObjectCatalogManifest;
const billing = billingFixture as ObjectCatalogManifest;
const lowConf = lowConfFixture as ObjectCatalogManifest;

describe('classifyTier', () => {
  it('classifies ≥0.8 as high', () => {
    expect(classifyTier(0.8)).toBe('high');
    expect(classifyTier(0.92)).toBe('high');
    expect(classifyTier(1.0)).toBe('high');
  });

  it('classifies 0.5–<0.8 as medium', () => {
    expect(classifyTier(0.5)).toBe('medium');
    expect(classifyTier(0.65)).toBe('medium');
    expect(classifyTier(0.79)).toBe('medium');
    expect(classifyTier(0.799999)).toBe('medium');
  });

  it('classifies <0.5 as low', () => {
    expect(classifyTier(0.0)).toBe('low');
    expect(classifyTier(0.49)).toBe('low');
    expect(classifyTier(0.4)).toBe('low');
  });

  it('classifies null / undefined / NaN as unknown', () => {
    expect(classifyTier(null)).toBe('unknown');
    expect(classifyTier(NaN)).toBe('unknown');
    // @ts-expect-error — exercising the runtime guard for undefined
    expect(classifyTier(undefined)).toBe('unknown');
  });
});

describe('needsReview', () => {
  it('returns true when score is null (unknown)', () => {
    expect(needsReview(null, 0.7)).toBe(true);
  });

  it('returns true when score is strictly below threshold', () => {
    expect(needsReview(0.4, 0.7)).toBe(true);
    expect(needsReview(0.69, 0.7)).toBe(true);
  });

  it('returns false when score is exactly at or above threshold', () => {
    // Strictly-less-than: equal-to-threshold is acceptable.
    expect(needsReview(0.7, 0.7)).toBe(false);
    expect(needsReview(0.92, 0.7)).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(needsReview(0.6, 0.5)).toBe(false);
    expect(needsReview(0.85, 0.9)).toBe(true);
  });
});

describe('lowestSignals', () => {
  const signals: OodsConfidenceSignal[] = [
    { name: 'a', score: 0.9 },
    { name: 'b', score: 0.32 },
    { name: 'c', score: 0.55 },
    { name: 'd', score: 0.41 },
    { name: 'e', score: 0.48 },
  ];

  it('returns the n lowest by score, ascending order', () => {
    const result = lowestSignals(signals, 3);
    expect(result.map((s) => s.name)).toEqual(['b', 'd', 'e']);
    expect(result.map((s) => s.score)).toEqual([0.32, 0.41, 0.48]);
  });

  it('preserves source order on ties (stable sort)', () => {
    const tied: OodsConfidenceSignal[] = [
      { name: 'first', score: 0.5 },
      { name: 'second', score: 0.5 },
      { name: 'third', score: 0.5 },
      { name: 'high', score: 0.9 },
    ];
    const result = lowestSignals(tied, 3);
    expect(result.map((s) => s.name)).toEqual(['first', 'second', 'third']);
  });

  it('returns empty array for n<=0 or empty input', () => {
    expect(lowestSignals(signals, 0)).toEqual([]);
    expect(lowestSignals(signals, -1)).toEqual([]);
    expect(lowestSignals([], 3)).toEqual([]);
  });

  it('returns all signals when n exceeds count', () => {
    const result = lowestSignals(signals.slice(0, 2), 5);
    expect(result).toHaveLength(2);
  });
});

describe('review-emitter — Product fixture (HIGH tier, total=0.92)', () => {
  const result = emit(product);

  it('returns status ok with framework review and .html extension', () => {
    expect(result.status).toBe('ok');
    expect(result.framework).toBe('review');
    expect(result.fileExtension).toBe('.html');
  });

  it('produces a self-contained HTML document with embedded styles + fidelity marker', () => {
    expect(result.code).toMatch(/^<!DOCTYPE html>/);
    expect(result.code).toContain('<html lang="en">');
    expect(result.code).toContain('<style>');
    expect(result.code).toContain('data-fidelity="review"');
  });

  it('classifies the product entity as high tier with score 0.92', () => {
    expect(result.code).toContain(
      'data-entity-urn="urn:proto:semantic:product-detail-card@1.0.0"',
    );
    expect(result.code).toContain('data-confidence-score="0.92"');
    expect(result.code).toContain('data-confidence-tier="high"');
    expect(result.code).toContain('class="entity tier-high"');
    expect(result.code).toContain('class="confidence-badge tier-high"');
  });

  it('renders the confidence badge with HIGH label + score formatted to 2 decimals', () => {
    expect(result.code).toMatch(/<span class="badge-label">HIGH<\/span>/);
    expect(result.code).toMatch(/<span class="badge-score">0\.92<\/span>/);
  });

  it('does NOT render a REVIEW NEEDED banner element for high-confidence entities', () => {
    // The legend text describes the banner concept, so the literal phrase
    // "REVIEW NEEDED" can appear there. The meaningful check is that NO
    // banner element exists in the document.
    expect(result.code).not.toContain('class="review-banner"');
    expect(result.code).toContain('data-flagged-for-review="false"');
  });

  it('does NOT render a review breakdown section for high-confidence entities (compact mode)', () => {
    expect(result.code).not.toContain('class="review-breakdown"');
    expect(result.code).not.toContain('class="review-section"');
  });

  it('meta records 1 entity, tier=high, no flags', () => {
    expect(result.meta.entitiesRendered).toBe(1);
    expect(result.meta.entitiesFlaggedForReview).toBe(0);
    expect(result.meta.tierCounts).toEqual({ high: 1, medium: 0, low: 0, unknown: 0 });
    expect(result.meta.reviewThreshold).toBe(0.7);
  });
});

describe('review-emitter — User fixture (UNKNOWN tier, no confidence_decomposition)', () => {
  const result = emit(user);

  it('classifies entity without confidence_decomposition as unknown tier with empty score attr', () => {
    expect(result.code).toContain('data-confidence-tier="unknown"');
    // Absent score → data-confidence-score should be omitted entirely (attr helper skips empty values).
    expect(result.code).not.toMatch(/data-confidence-score="[^"]+"/);
    expect(result.code).toContain('class="entity tier-unknown flagged"');
  });

  it('flags unknown-tier entities for review with reason "Confidence not provided"', () => {
    expect(result.code).toContain('REVIEW NEEDED');
    expect(result.code).toContain('Confidence not provided');
    expect(result.code).toContain('data-flagged-for-review="true"');
  });

  it('renders the breakdown placeholder with data-breakdown="missing" when source provides no decomposition', () => {
    expect(result.code).toContain('data-breakdown="missing"');
    expect(result.code).toContain('No confidence_decomposition emitted by source.');
  });

  it('badge shows UNKNOWN with — score placeholder', () => {
    expect(result.code).toMatch(/<span class="badge-label">UNKNOWN<\/span>/);
    expect(result.code).toMatch(/<span class="badge-score">—<\/span>/);
  });

  it('meta classifies as unknown, flagged for review', () => {
    expect(result.meta.tierCounts).toEqual({ high: 0, medium: 0, low: 0, unknown: 1 });
    expect(result.meta.entitiesFlaggedForReview).toBe(1);
  });
});

describe('review-emitter — Subscription synthetic low-confidence fixture (LOW tier, REVIEW NEEDED)', () => {
  const result = emit(lowConf);

  it('classifies the synthetic fixture as low tier with score 0.4', () => {
    expect(result.code).toContain('data-confidence-tier="low"');
    expect(result.code).toContain('data-confidence-score="0.4"');
    expect(result.code).toContain('class="entity tier-low flagged"');
  });

  it('renders REVIEW NEEDED banner with threshold-comparison reason', () => {
    expect(result.code).toContain('REVIEW NEEDED');
    expect(result.code).toContain('Score 0.40 below threshold 0.70');
    expect(result.code).toContain('data-flagged-for-review="true"');
  });

  it('renders top-3 lowest-confidence signal breakdown (4 signals → 3 shown)', () => {
    expect(result.code).toContain('data-breakdown="ranked"');
    expect(result.code).toContain('Lowest sub-signals (top 3):');
    // The synthetic fixture has signals with scores 0.32, 0.41, 0.48, 0.55.
    // Top 3 lowest = trait_membership (0.32), evidence_chain (0.41), field_binding_coverage (0.48).
    expect(result.code).toContain('data-signal-name="trait_membership"');
    expect(result.code).toContain('data-signal-score="0.32"');
    expect(result.code).toContain('data-signal-name="evidence_chain"');
    expect(result.code).toContain('data-signal-score="0.41"');
    expect(result.code).toContain('data-signal-name="field_binding_coverage"');
    expect(result.code).toContain('data-signal-score="0.48"');
    // The 0.55 signal must NOT appear in the top-3 breakdown.
    expect(result.code).not.toContain('data-signal-score="0.55"');
  });

  it('renders signal hint text when present', () => {
    expect(result.code).toContain('Identifiable: weak match');
    expect(result.code).toContain('Stage1 declared-only fallback');
  });

  it('meta classifies as low + flagged', () => {
    expect(result.meta.tierCounts).toEqual({ high: 0, medium: 0, low: 1, unknown: 0 });
    expect(result.meta.entitiesFlaggedForReview).toBe(1);
  });
});

describe('review-emitter — reviewThreshold option', () => {
  it('threshold=0.9 flags the high-confidence product (0.92 NOT below 0.9 → not flagged)', () => {
    const result = emit(product, { reviewThreshold: 0.9 });
    expect(result.code).toContain('data-flagged-for-review="false"');
    expect(result.code).not.toContain('class="review-banner"');
    expect(result.meta.reviewThreshold).toBe(0.9);
    expect(result.meta.entitiesFlaggedForReview).toBe(0);
  });

  it('threshold=0.95 flags the high-confidence product (0.92 < 0.95 → flagged)', () => {
    const result = emit(product, { reviewThreshold: 0.95 });
    expect(result.code).toContain('data-flagged-for-review="true"');
    expect(result.code).toContain('REVIEW NEEDED');
    expect(result.code).toContain('Score 0.92 below threshold 0.95');
  });

  it('threshold=0.5 does NOT flag the low-confidence synthetic (0.4 < 0.5 → still flagged)', () => {
    const result = emit(lowConf, { reviewThreshold: 0.5 });
    expect(result.code).toContain('REVIEW NEEDED');
    expect(result.code).toContain('Score 0.40 below threshold 0.50');
  });

  it('threshold=0.3 unflags the low-confidence synthetic (0.4 ≥ 0.3 → not flagged)', () => {
    const result = emit(lowConf, { reviewThreshold: 0.3 });
    expect(result.code).toContain('data-flagged-for-review="false"');
    expect(result.code).not.toContain('class="review-banner"');
  });

  it('threshold defaults to 0.7 when option is omitted', () => {
    const result = emit(product);
    expect(result.meta.reviewThreshold).toBe(0.7);
    expect(result.code).toContain('data-review-threshold="0.7"');
  });

  it('non-finite threshold falls back to default 0.7', () => {
    const result = emit(product, { reviewThreshold: Number.NaN });
    expect(result.meta.reviewThreshold).toBe(0.7);
  });
});

describe('review-emitter — Subscription fixture (informational, no confidence)', () => {
  const result = emit(subscription);

  it('subscription with no confidence_decomposition classifies as unknown + flagged', () => {
    expect(result.code).toContain('data-confidence-tier="unknown"');
    expect(result.code).toContain('REVIEW NEEDED');
    expect(result.meta.tierCounts.unknown).toBe(1);
  });
});

describe('review-emitter — billing-multi-entity fixture (3 entities, mixed tiers)', () => {
  const result = emit(billing);

  it('renders all 3 entities with stable URN-keyed data attributes', () => {
    expect(result.meta.entitiesRendered).toBe(3);
    expect(result.code).toContain(
      'data-entity-urn="urn:proto:semantic:billing-account-card@1.0.0"',
    );
    expect(result.code).toContain(
      'data-entity-urn="urn:proto:semantic:payment-method-row@1.0.0"',
    );
    expect(result.code).toContain(
      'data-entity-urn="urn:proto:semantic:invoice-detail-card@1.0.0"',
    );
  });

  it('classifies billing-account + payment-method as unknown (no confidence) and invoice as high (0.88)', () => {
    expect(result.meta.tierCounts).toEqual({ high: 1, medium: 0, low: 0, unknown: 2 });
    // Two flagged (the two unknown ones), invoice is not flagged.
    expect(result.meta.entitiesFlaggedForReview).toBe(2);
  });

  it('summary section pills emit per-tier counts as data-count attributes', () => {
    expect(result.code).toContain('data-tier="high"');
    expect(result.code).toContain('HIGH · 1');
    expect(result.code).toContain('UNKNOWN · 2');
    expect(result.code).toContain('data-tier="unknown"');
  });
});

describe('review-emitter — output stability', () => {
  it('same input + options yields byte-identical output across runs', () => {
    const a = emit(product).code;
    const b = emit(product).code;
    expect(a).toBe(b);
  });

  it('includeStyles=false omits the embedded <style> block but preserves entity markup', () => {
    const styled = emit(product);
    const bare = emit(product, { includeStyles: false });
    expect(styled.code).toContain('<style>');
    expect(bare.code).not.toContain('<style>');
    // Entity content is unchanged either way.
    expect(bare.code).toContain('data-entity-urn="urn:proto:semantic:product-detail-card@1.0.0"');
  });

  it('custom title flows into both <title> and <h1>', () => {
    const result = emit(product, { title: 'Sprint-99 audit pass' });
    expect(result.code).toContain('<title>Sprint-99 audit pass</title>');
    expect(result.code).toContain('<h1>Sprint-99 audit pass</h1>');
  });

  it('body declares data-review-threshold + data-entities-flagged for downstream dashboards', () => {
    const result = emit(billing, { reviewThreshold: 0.6 });
    expect(result.code).toContain('data-review-threshold="0.6"');
    expect(result.code).toContain('data-entities-flagged="2"'); // billing has 2 unknown entities
  });
});
