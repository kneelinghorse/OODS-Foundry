/**
 * C3 — Reframed review/recovery policy evaluator (sprint-103 m01).
 *
 * Pure-function evaluator that resolves low-confidence reconciliation
 * conflicts by policy. The C3 reframing (docs commit db3b3b0, 2026-05-20)
 * made the C3 surface an MCP tool for ORCHESTRATING AGENTS, not a human UI.
 * The s99-m04 review-emitter renders confidence tiers visually for humans;
 * THIS evaluator resolves the same flagged items by policy for agents.
 *
 * Pattern adopted (per s103-m01 mission-start audit, 2026-05-21):
 *   - D4 pure-function evaluator shape (no I/O, deterministic)
 *   - Ordered rules; first match wins; defaultAction covers no-match
 *   - Predicates target entity.oods.confidence_decomposition (NOT canonical
 *     catalog state, which is D4's surface)
 *   - Action space: accept | patch | defer | dismiss (NOT D4's allowed:bool)
 *   - Three policy predicate kinds for v0 (Rule 2 simplicity-first):
 *       confidence_threshold — score vs numeric threshold
 *       signal_type_floor   — named signal's score vs numeric floor
 *       entity_urn_match    — URN exact OR glob pattern (* and ?)
 *
 * The brand_overlay axis named in the audit is intentionally deferred:
 * no fixture or workflow currently forces it.
 */

import type {
  OodsConfidenceDecomposition,
  OodsConfidenceSignal,
} from '../object-catalog/types.js';
import { classifyTier, type ConfidenceTier } from './review-emitter.js';

export type PolicyDecision = 'accept' | 'patch' | 'defer' | 'dismiss';

export type PolicyPredicate =
  | {
      kind: 'confidence_threshold';
      /** Match when total < threshold (or, if matchUnknown, when score is null). */
      threshold: number;
      /** When true, an absent confidence_decomposition also matches. Default false. */
      matchUnknown?: boolean;
    }
  | {
      kind: 'signal_type_floor';
      /** Signal name to look up in confidence_decomposition.signals[]. */
      signal: string;
      /** Match when the named signal's score < floor. */
      floor: number;
    }
  | {
      kind: 'entity_urn_match';
      /** Exact URN match (mutually exclusive with pattern). */
      urn?: string;
      /** Glob pattern with * (any-chars) and ? (one-char). Mutually exclusive with urn. */
      pattern?: string;
    };

export interface Policy {
  id: string;
  when: PolicyPredicate;
  then: PolicyDecision;
  /** Human-readable reason; surfaced verbatim in the resolution when this policy matches. */
  reason?: string;
}

export interface PolicyBundle {
  /** Optional bundle identifier echoed in the audit trail for reproducibility. */
  id?: string;
  policies: Policy[];
}

export interface EvaluationInput {
  urn: string;
  confidenceDecomposition: OodsConfidenceDecomposition | null;
}

export interface EvaluationResult {
  urn: string;
  decision: PolicyDecision;
  reason: string;
  /** ID of the matching policy, or 'default' when no policy matched. */
  policyId: string;
  evaluatedScore: number | null;
  evaluatedTier: ConfidenceTier;
}

// ---------------------------------------------------------------------------
// Predicate evaluation
// ---------------------------------------------------------------------------

function findSignal(
  signals: OodsConfidenceSignal[],
  name: string,
): OodsConfidenceSignal | undefined {
  return signals.find((s) => s.name === name);
}

/**
 * Compile a glob pattern (* = any-chars, ? = one-char) into a RegExp. Escapes
 * regex specials in the rest of the pattern so URNs containing : / @ . are
 * matched literally.
 */
function compileGlob(pattern: string): RegExp {
  const REGEX_SPECIALS = /[.+^${}()|[\]\\]/g;
  let out = '';
  for (const ch of pattern) {
    if (ch === '*') {
      out += '.*';
    } else if (ch === '?') {
      out += '.';
    } else {
      out += ch.replace(REGEX_SPECIALS, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * Returns true if the predicate matches the input. Pure; no I/O.
 */
export function matchesPredicate(
  predicate: PolicyPredicate,
  input: EvaluationInput,
): boolean {
  const decomposition = input.confidenceDecomposition;
  switch (predicate.kind) {
    case 'confidence_threshold': {
      if (decomposition === null) {
        return predicate.matchUnknown === true;
      }
      return decomposition.total < predicate.threshold;
    }
    case 'signal_type_floor': {
      if (decomposition === null) return false;
      const signal = findSignal(decomposition.signals, predicate.signal);
      if (!signal) return false;
      return signal.score < predicate.floor;
    }
    case 'entity_urn_match': {
      if (predicate.urn !== undefined) {
        return input.urn === predicate.urn;
      }
      if (predicate.pattern !== undefined) {
        return compileGlob(predicate.pattern).test(input.urn);
      }
      // Schema layer rejects this; defensive false in case of direct caller.
      return false;
    }
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = predicate;
      void _exhaustive;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Bundle evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single entity against a policy bundle. First match wins; if no
 * policy matches, defaultAction is applied with policyId='default'. Pure.
 */
export function evaluatePolicies(
  input: EvaluationInput,
  bundle: PolicyBundle,
  defaultAction: PolicyDecision,
): EvaluationResult {
  const score = input.confidenceDecomposition?.total ?? null;
  const tier = classifyTier(score);

  for (const policy of bundle.policies) {
    if (matchesPredicate(policy.when, input)) {
      return {
        urn: input.urn,
        decision: policy.then,
        reason: policy.reason ?? `Matched policy '${policy.id}'`,
        policyId: policy.id,
        evaluatedScore: score,
        evaluatedTier: tier,
      };
    }
  }

  return {
    urn: input.urn,
    decision: defaultAction,
    reason: `No policy matched; default action '${defaultAction}' applied`,
    policyId: 'default',
    evaluatedScore: score,
    evaluatedTier: tier,
  };
}

/**
 * Validate a policy bundle's runtime invariants beyond JSON Schema reach.
 * Returns null when valid, or a list of error messages when invalid. Intended
 * for use after AJV has confirmed the shape — checks predicate-level
 * mutual-exclusion (entity_urn_match needs exactly one of urn/pattern), and
 * duplicate policy IDs.
 */
export function validatePolicyBundle(bundle: PolicyBundle): string[] | null {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const [index, policy] of bundle.policies.entries()) {
    if (seenIds.has(policy.id)) {
      errors.push(`policies[${index}]: duplicate policy id '${policy.id}'`);
    } else {
      seenIds.add(policy.id);
    }
    if (policy.when.kind === 'entity_urn_match') {
      const hasUrn = policy.when.urn !== undefined;
      const hasPattern = policy.when.pattern !== undefined;
      if (hasUrn === hasPattern) {
        errors.push(
          `policies[${index}] (${policy.id}): entity_urn_match requires exactly one of 'urn' or 'pattern'`,
        );
      }
    }
  }
  return errors.length === 0 ? null : errors;
}
