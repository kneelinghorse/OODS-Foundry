import { findDuplicateLinks, type LinkRef } from '../adapters/echarts/link-integrity.js';
import type { EChartsAccuracyOperand } from './echarts-types.js';
import type { AccuracyRuleOutcome } from './types.js';

/**
 * OODS-V173 — certify-side escalation of the public renderer's V148 warning.
 * Repeated DIRECTED edges coalesce at the same endpoint pair; reciprocal edges
 * and a single self-loop remain legitimate relationships. Public graph IR has
 * encoding:{}, so optional link.value does not drive width: this rule makes no
 * unsupported negative-weight-as-width claim and no force-layout claim.
 */
export function evaluateForceGraphDuplicateLink(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const branch = operand.branchData as { links?: unknown } | null | undefined;
  const links = branch?.links;
  if (!Array.isArray(links)) {
    return { evaluated: false, note: 'The force_graph directed link list could not be resolved; duplicate-edge accuracy was not evaluated.' };
  }
  const resolved = links.filter((link): link is LinkRef =>
    link !== null && typeof link === 'object' && typeof link.source === 'string' && typeof link.target === 'string',
  );
  const duplicates = findDuplicateLinks(resolved);
  if (duplicates.length > 0) {
    return {
      evaluated: true,
      message: `artifact.certify: ${duplicates.length} force_graph directed edge(s) appear more than once: ${duplicates.slice(0, 3).map((edge) => `"${edge.source}" -> "${edge.target}" x${edge.count}`).join('; ')}. Repeated directed edges share the same endpoints and overdraw the relationship, concealing multiplicity. Merge duplicate directed edges; reciprocal edges are distinct.`,
    };
  }
  if (resolved.length !== links.length) {
    return { evaluated: false, note: 'Some force_graph directed link endpoints could not be resolved; duplicate-edge accuracy was not evaluated.' };
  }
  return { evaluated: true };
}
