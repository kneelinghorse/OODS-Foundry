/**
 * review-policy evaluator unit tests (sprint-103 m01).
 *
 * Covers:
 *   - Each of the 3 policy predicate kinds (confidence_threshold,
 *     signal_type_floor, entity_urn_match) — matching + non-matching
 *   - Ordered first-match-wins precedence when multiple policies match
 *   - No-match falls to defaultAction with policyId='default'
 *   - validatePolicyBundle catches duplicate IDs and urn/pattern mutex
 *   - Glob compilation: * and ?, regex-special chars escaped
 *   - matchUnknown=false (default) does NOT match absent confidence
 *   - matchUnknown=true DOES match absent confidence
 *   - signal_type_floor does NOT match when the named signal is absent
 *   - Tier classification surfaces through evaluatedTier
 */

import { describe, expect, it } from 'vitest';

import {
  evaluatePolicies,
  matchesPredicate,
  validatePolicyBundle,
  type Policy,
  type PolicyBundle,
  type EvaluationInput,
} from './review-policy.js';
import type { OodsConfidenceDecomposition } from '../object-catalog/types.js';

function decomposition(
  total: number,
  signals: Array<{ name: string; score: number }> = [],
): OodsConfidenceDecomposition {
  return { total, signals };
}

const URN_SUB_LOW = 'urn:proto:semantic:subscription-summary-row-lowconf@1.0.0';
const URN_USER = 'urn:proto:semantic:user@1.0.0';
const URN_BILLING = 'urn:proto:semantic:billing-account@1.0.0';

function input(
  urn: string,
  d: OodsConfidenceDecomposition | null = null,
): EvaluationInput {
  return { urn, confidenceDecomposition: d };
}

describe('matchesPredicate — confidence_threshold', () => {
  it('matches when total < threshold', () => {
    expect(
      matchesPredicate(
        { kind: 'confidence_threshold', threshold: 0.7 },
        input(URN_USER, decomposition(0.4)),
      ),
    ).toBe(true);
  });

  it('does NOT match when total === threshold (strict less-than)', () => {
    expect(
      matchesPredicate(
        { kind: 'confidence_threshold', threshold: 0.7 },
        input(URN_USER, decomposition(0.7)),
      ),
    ).toBe(false);
  });

  it('does NOT match when total > threshold', () => {
    expect(
      matchesPredicate(
        { kind: 'confidence_threshold', threshold: 0.7 },
        input(URN_USER, decomposition(0.92)),
      ),
    ).toBe(false);
  });

  it('does NOT match absent confidence by default (matchUnknown omitted)', () => {
    expect(
      matchesPredicate(
        { kind: 'confidence_threshold', threshold: 0.7 },
        input(URN_USER, null),
      ),
    ).toBe(false);
  });

  it('matches absent confidence when matchUnknown=true', () => {
    expect(
      matchesPredicate(
        { kind: 'confidence_threshold', threshold: 0.7, matchUnknown: true },
        input(URN_USER, null),
      ),
    ).toBe(true);
  });
});

describe('matchesPredicate — signal_type_floor', () => {
  it('matches when named signal score < floor', () => {
    expect(
      matchesPredicate(
        { kind: 'signal_type_floor', signal: 'evidence_chain', floor: 0.5 },
        input(
          URN_SUB_LOW,
          decomposition(0.4, [{ name: 'evidence_chain', score: 0.41 }]),
        ),
      ),
    ).toBe(true);
  });

  it('does NOT match when named signal score === floor', () => {
    expect(
      matchesPredicate(
        { kind: 'signal_type_floor', signal: 'evidence_chain', floor: 0.5 },
        input(
          URN_SUB_LOW,
          decomposition(0.4, [{ name: 'evidence_chain', score: 0.5 }]),
        ),
      ),
    ).toBe(false);
  });

  it('does NOT match when the named signal is absent', () => {
    expect(
      matchesPredicate(
        { kind: 'signal_type_floor', signal: 'evidence_chain', floor: 0.5 },
        input(URN_SUB_LOW, decomposition(0.4, [{ name: 'trait_membership', score: 0.32 }])),
      ),
    ).toBe(false);
  });

  it('does NOT match when confidence_decomposition is absent', () => {
    expect(
      matchesPredicate(
        { kind: 'signal_type_floor', signal: 'evidence_chain', floor: 0.5 },
        input(URN_USER, null),
      ),
    ).toBe(false);
  });
});

describe('matchesPredicate — entity_urn_match', () => {
  it('exact urn match', () => {
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match', urn: URN_USER },
        input(URN_USER),
      ),
    ).toBe(true);
  });

  it('exact urn non-match', () => {
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match', urn: URN_USER },
        input(URN_SUB_LOW),
      ),
    ).toBe(false);
  });

  it('glob * matches multi-char segment', () => {
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match', pattern: 'urn:proto:semantic:billing-*@*' },
        input(URN_BILLING),
      ),
    ).toBe(true);
  });

  it('glob ? matches single char', () => {
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match', pattern: 'urn:proto:semantic:user@?.?.?' },
        input(URN_USER),
      ),
    ).toBe(true);
  });

  it('regex specials in URN (:, /, @, .) are matched literally', () => {
    // If : / @ . were treated as regex, the pattern would over-match. Asserting
    // a non-matching pattern proves the literal handling.
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match', pattern: 'urn:proto:semantic:user@2.0.0' },
        input(URN_USER), // ends with @1.0.0, not @2.0.0
      ),
    ).toBe(false);
  });

  it('returns false when neither urn nor pattern is provided (defensive)', () => {
    expect(
      matchesPredicate(
        { kind: 'entity_urn_match' } as never,
        input(URN_USER),
      ),
    ).toBe(false);
  });
});

describe('evaluatePolicies — ordering, default action, audit fields', () => {
  const bundle: PolicyBundle = {
    id: 'test-bundle',
    policies: [
      {
        id: 'p1-urn-block',
        when: { kind: 'entity_urn_match', urn: URN_USER },
        then: 'accept',
        reason: 'user fixture is trusted',
      },
      {
        id: 'p2-low-conf-defer',
        when: { kind: 'confidence_threshold', threshold: 0.7 },
        then: 'defer',
        reason: 'below 0.7 — needs review',
      },
      {
        id: 'p3-evidence-floor-dismiss',
        when: { kind: 'signal_type_floor', signal: 'evidence_chain', floor: 0.3 },
        then: 'dismiss',
      },
    ],
  };

  it('first-match-wins: URN policy applies even when later policies would also match', () => {
    // Make this entity also fail the threshold; URN should still win because it's first.
    const result = evaluatePolicies(
      input(URN_USER, decomposition(0.4)),
      bundle,
      'defer',
    );
    expect(result.policyId).toBe('p1-urn-block');
    expect(result.decision).toBe('accept');
    expect(result.reason).toBe('user fixture is trusted');
  });

  it('falls through to threshold policy when URN does not match', () => {
    const result = evaluatePolicies(
      input(URN_SUB_LOW, decomposition(0.4)),
      bundle,
      'defer',
    );
    expect(result.policyId).toBe('p2-low-conf-defer');
    expect(result.decision).toBe('defer');
  });

  it("defaults to 'default' policyId + defaultAction when nothing matches", () => {
    const result = evaluatePolicies(
      input(URN_BILLING, decomposition(0.92)),
      bundle,
      'accept',
    );
    expect(result.policyId).toBe('default');
    expect(result.decision).toBe('accept');
    expect(result.reason).toMatch(/no policy matched/i);
  });

  it('surfaces evaluatedScore and evaluatedTier from confidence_decomposition', () => {
    const high = evaluatePolicies(
      input(URN_BILLING, decomposition(0.92)),
      bundle,
      'accept',
    );
    expect(high.evaluatedScore).toBe(0.92);
    expect(high.evaluatedTier).toBe('high');

    const low = evaluatePolicies(
      input(URN_SUB_LOW, decomposition(0.4)),
      bundle,
      'defer',
    );
    expect(low.evaluatedScore).toBe(0.4);
    expect(low.evaluatedTier).toBe('low');

    const unknown = evaluatePolicies(
      input(URN_BILLING, null),
      bundle,
      'defer',
    );
    expect(unknown.evaluatedScore).toBeNull();
    expect(unknown.evaluatedTier).toBe('unknown');
  });

  it('uses default reason when policy omits one', () => {
    const result = evaluatePolicies(
      input(URN_SUB_LOW, decomposition(0.5, [{ name: 'evidence_chain', score: 0.2 }])),
      bundle,
      'accept',
    );
    // Threshold policy (0.7 floor) matches first at score=0.5; reason is its own.
    expect(result.policyId).toBe('p2-low-conf-defer');
    expect(result.reason).toBe('below 0.7 — needs review');

    // Now force the signal-floor policy to win by raising score above threshold:
    const bundleSignalOnly: PolicyBundle = {
      policies: [bundle.policies[2]],
    };
    const r2 = evaluatePolicies(
      input(URN_SUB_LOW, decomposition(0.9, [{ name: 'evidence_chain', score: 0.2 }])),
      bundleSignalOnly,
      'accept',
    );
    expect(r2.policyId).toBe('p3-evidence-floor-dismiss');
    expect(r2.reason).toMatch(/Matched policy 'p3-evidence-floor-dismiss'/);
  });
});

describe('validatePolicyBundle — runtime invariants beyond AJV', () => {
  it('returns null for a clean bundle', () => {
    const bundle: PolicyBundle = {
      policies: [
        { id: 'a', when: { kind: 'confidence_threshold', threshold: 0.7 }, then: 'defer' },
        {
          id: 'b',
          when: { kind: 'entity_urn_match', pattern: 'urn:*' },
          then: 'accept',
        },
      ],
    };
    expect(validatePolicyBundle(bundle)).toBeNull();
  });

  it('flags duplicate policy IDs', () => {
    const bundle: PolicyBundle = {
      policies: [
        { id: 'dup', when: { kind: 'confidence_threshold', threshold: 0.5 }, then: 'defer' },
        { id: 'dup', when: { kind: 'confidence_threshold', threshold: 0.3 }, then: 'dismiss' },
      ],
    };
    const errs = validatePolicyBundle(bundle);
    expect(errs).not.toBeNull();
    expect(errs![0]).toMatch(/duplicate policy id 'dup'/);
  });

  it("flags entity_urn_match with neither urn nor pattern", () => {
    const bundle: PolicyBundle = {
      policies: [
        { id: 'bad', when: { kind: 'entity_urn_match' } as never, then: 'defer' },
      ],
    };
    const errs = validatePolicyBundle(bundle);
    expect(errs).not.toBeNull();
    expect(errs![0]).toMatch(/exactly one of 'urn' or 'pattern'/);
  });

  it('flags entity_urn_match with BOTH urn and pattern', () => {
    const bundle: PolicyBundle = {
      policies: [
        {
          id: 'overspecified',
          when: { kind: 'entity_urn_match', urn: URN_USER, pattern: 'urn:*' },
          then: 'accept',
        },
      ],
    };
    const errs = validatePolicyBundle(bundle);
    expect(errs).not.toBeNull();
    expect(errs![0]).toMatch(/exactly one of 'urn' or 'pattern'/);
  });
});

describe('evaluatePolicies — empty bundle reduces to defaultAction', () => {
  it('empty policies + defaultAction=defer => every entity defers via policyId=default', () => {
    const empty: PolicyBundle = { policies: [] };
    const result: Policy['then'] = evaluatePolicies(
      input(URN_USER, decomposition(0.92)),
      empty,
      'defer',
    ).decision;
    expect(result).toBe('defer');
  });
});
