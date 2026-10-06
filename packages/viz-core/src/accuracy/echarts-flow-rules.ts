// Sprint-172 m03 — the sankey/chord accuracy rules: OODS-V156, V157, V158.
//
// All three read the flow data branch. V157 in particular CANNOT be written against the
// emitted option: sankey-utils' calculateNodeValue collapses "the author declared this
// node's value" and "the renderer summed the links" into the same `{name, value}` pair, so
// the provenance the rule needs exists only in the branch.

import type { SankeyInput, SankeyLink, SankeyNode } from '../spec/network-flow.js';
import { findDuplicateLinks, type LinkRef } from '../adapters/echarts/link-integrity.js';
import type { AccuracyRuleOutcome } from './types.js';
import { differsBeyondTolerance, type EChartsAccuracyOperand } from './echarts-types.js';

function flowBranch(operand: EChartsAccuracyOperand): SankeyInput {
  return (operand.branchData ?? { nodes: [], links: [] }) as SankeyInput;
}

function linksOf(input: SankeyInput): readonly SankeyLink[] {
  return Array.isArray(input.links) ? input.links : [];
}

function nodesOf(input: SankeyInput): readonly SankeyNode[] {
  return Array.isArray(input.nodes) ? input.nodes : [];
}

/**
 * OODS-V156 — a negative or non-finite link value on a sankey or chord.
 *
 * The link value IS the ribbon width: a magnitude. What reaches this rule differs by type,
 * and the difference is the point:
 *   - sankey is validated upstream by validateSankeyInput, which rejects non-finite values
 *     (OODS-V126) but says nothing about sign — so a NEGATIVE sankey value renders.
 *   - chord validates NOTHING on values (chord-adapter's buildLinks copies `value`
 *     verbatim), so negative AND non-finite chord values both render.
 * The rule covers both conditions for both types; on sankey the non-finite arm is
 * unreachable because the operand never gets that far, and that is a property of the
 * pipeline rather than of this rule.
 */
export function evaluateFlowNegativeLinkValue(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const links = linksOf(flowBranch(operand));
  if (links.length === 0) {
    return { evaluated: false, note: `The ${operand.chartType} branch carries no links, so link values could not be checked.` };
  }
  const bad = links.filter((link) => {
    const value = (link as { value?: unknown }).value;
    if (value === undefined || value === null) {
      return false;
    }
    return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
  });
  if (bad.length === 0) {
    return { evaluated: true };
  }
  const ribbon = operand.chartType === 'chord' ? 'ribbon' : 'link';
  const shown = bad
    .slice(0, 3)
    .map((link) => `"${link.source}" -> "${link.target}" (${String((link as { value?: unknown }).value)})`);
  return {
    evaluated: true,
    message: `${bad.length} ${operand.chartType} ${ribbon} value(s) are negative or non-finite: ${shown.join(', ')}${bad.length > 3 ? `, +${bad.length - 3} more` : ''}. ${ribbon === 'ribbon' ? 'Ribbon' : 'Link'} width is a magnitude, so a value that is not a finite non-negative number cannot be drawn as the quantity it names.`,
  };
}

/** Incoming / outgoing flow totals for one node, from the links alone. */
function throughput(name: string, links: readonly SankeyLink[]): { incoming: number; outgoing: number } {
  let incoming = 0;
  let outgoing = 0;
  for (const link of links) {
    const value = typeof link.value === 'number' && Number.isFinite(link.value) ? link.value : 0;
    if (link.target === name) {
      incoming += value;
    }
    if (link.source === name) {
      outgoing += value;
    }
  }
  return { incoming, outgoing };
}

/**
 * OODS-V157 — a sankey node whose drawn height is not the flow its ribbons carry.
 *
 * TWO causes, reported distinctly (the V150 per-cause precedent):
 *
 *  (a) EXPLICIT OVERRIDE. sankey-utils' calculateNodeValue uses an author-supplied finite
 *      `node.value` verbatim and otherwise computes max(incoming, outgoing). When the two
 *      disagree, the node is drawn at the declared height while its ribbons carry a
 *      different total — they do not tile it, and nothing in the option says why.
 *
 *  (b) NON-CONSERVATION at an INTERMEDIATE node. Scoped to nodes with incoming > 0 AND
 *      outgoing > 0: those are the only nodes where both sides are supposed to agree.
 *      A source (incoming 0) and a sink (outgoing 0) are endpoints, not leaks, and MUST
 *      NOT fire. Where an intermediate node's in and out differ, the adapter's max() picks
 *      one side arbitrarily and the other side cannot tile the node.
 *
 * Both comparisons use the chartered RELATIVE epsilon so decimal flows that sum correctly
 * in exact arithmetic are not reported as leaks by IEEE-754 drift.
 */
export function evaluateSankeyNodeValueOverride(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const input = flowBranch(operand);
  const links = linksOf(input);
  const nodes = nodesOf(input);
  if (nodes.length === 0 || links.length === 0) {
    return {
      evaluated: false,
      note: 'The sankey branch carries no nodes or no links, so node heights could not be compared with the flow they carry.',
    };
  }

  const overrides: string[] = [];
  const leaks: string[] = [];
  for (const node of nodes) {
    const { incoming, outgoing } = throughput(node.name, links);
    const declared = typeof node.value === 'number' && Number.isFinite(node.value) ? node.value : undefined;

    if (declared !== undefined) {
      const computed = Math.max(incoming, outgoing);
      if (differsBeyondTolerance(declared, computed)) {
        overrides.push(`"${node.name}" declared ${declared}, links carry ${computed}`);
      }
    }

    if (incoming > 0 && outgoing > 0 && differsBeyondTolerance(incoming, outgoing)) {
      leaks.push(`"${node.name}" takes in ${incoming} and sends out ${outgoing}`);
    }
  }

  if (overrides.length === 0 && leaks.length === 0) {
    return { evaluated: true };
  }
  const parts: string[] = [];
  if (overrides.length > 0) {
    parts.push(
      `${overrides.length} node(s) declare a value the links do not support (${overrides.slice(0, 3).join('; ')}${overrides.length > 3 ? '; …' : ''}) — the node is drawn at the declared height while its ribbons carry a different total, and the option preserves no trace of the override`,
    );
  }
  if (leaks.length > 0) {
    parts.push(
      `${leaks.length} intermediate node(s) do not conserve flow (${leaks.slice(0, 3).join('; ')}${leaks.length > 3 ? '; …' : ''}) — the renderer sizes the node from the larger side, so the smaller side's ribbons cannot tile it`,
    );
  }
  return { evaluated: true, message: `${parts.join('. ')}.` };
}

/**
 * OODS-V158 — duplicate DIRECTED links on a sankey.
 *
 * A deliberate REOPEN of the s148 F4 sankey exclusion, and certify-side ONLY: viz.render is
 * untouched and still emits no duplicate diagnostic for sankey (F4's OODS-V148 warning
 * covers chord and force_graph only). Two links with the same (source, target) pair are
 * drawn as two stacked ribbons, so the flow between that pair reads as the SUM while every
 * label reads as one of the parts.
 *
 * SEVERITY IS ESCALATED, and that is a choice, not an oversight: F4 treats a duplicate as a
 * WARNING because the chart still renders, while a certify accuracy finding is
 * error-severity by construction. certify's question is not "did this render" but "does the
 * rendered picture mean what the data says", and a double-counted flow does not.
 */
export function evaluateSankeyDuplicateLink(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const links = linksOf(flowBranch(operand));
  if (links.length === 0) {
    return { evaluated: false, note: 'The sankey branch carries no links, so duplicate flows could not be checked.' };
  }
  const duplicates = findDuplicateLinks(links as unknown as readonly LinkRef[]);
  if (duplicates.length === 0) {
    return { evaluated: true };
  }
  const shown = duplicates.slice(0, 3).map((dup) => `"${dup.source}" -> "${dup.target}" x${dup.count}`);
  return {
    evaluated: true,
    message: `${duplicates.length} directed flow(s) appear more than once: ${shown.join(', ')}${duplicates.length > 3 ? `, +${duplicates.length - 3} more` : ''}. Duplicate (source, target) pairs stack into one visually-merged ribbon, so the width shown between those nodes is the SUM of the duplicates while each label describes only one of them. Merge them into a single link.`,
  };
}
