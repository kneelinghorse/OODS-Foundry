// F4 link integrity for chord + force_graph (sprint-148 m04), lifted verbatim out of
// viz.render.ts in sprint-172 m01 so artifact.certify's operand path REJECTS exactly
// what the render path rejects — the same predicate and the same message, never a
// transcription of them.
//
// Pure helpers over the INPUT links. A dangling ref names a node absent from the key set
// (FAIL-LOUD V147); a duplicate is two links with the same DIRECTED (source,target) pair
// (WARN V148) — chord is directed, so A->B and B->A are distinct (a reciprocal-trade chord
// is valid data, not a duplicate). The dedup key is collision-safe via JSON.stringify (NOT
// ECharts' naive `${source}-${target}` concat, which collides when a name contains '-').
//
// SPLIT OF CONSUMERS, stated (s172 m01): certify replays the V147 half ONLY. The V148
// duplicate WARNs stay render-side — sankey duplicates become certify's own V158 accuracy
// rule (s172 m03, an error-severity certify finding), and chord/force_graph duplicates
// remain render-side warnings. certify emits no warnings channel at all.
//
// s172 m03: the two PREDICATES moved down into @oods/viz-core
// (adapters/echarts/link-integrity.ts) once V158 became a second consumer of
// findDuplicateLinks from inside viz-core. This module keeps what is genuinely
// mcp-server's: the OODS-V147 wording and the node-key choice per chart type.

import { findDanglingLinks, type LinkRef } from '@oods/viz-core';

export { findDanglingLinks, findDuplicateLinks, type LinkRef } from '@oods/viz-core';

/** chord keys ring arcs by `name`; force_graph keys nodes by `id`. */
export type LinkKeyedChartType = 'chord' | 'force_graph';

/**
 * The V147 dangling-reference check, message included — the ONE place the failure text
 * is written. viz.render maps the result onto errorOut, artifact.certify onto its
 * structured error verdict; neither re-types the predicate or the wording.
 *
 * Returns undefined when every link resolves.
 */
export function danglingLinkError(
  chartType: LinkKeyedChartType,
  branchData: unknown,
): { readonly code: 'OODS-V147'; readonly message: string } | undefined {
  const graph = (branchData ?? {}) as { nodes?: unknown; links?: unknown };
  const nodes = (Array.isArray(graph.nodes) ? graph.nodes : []) as Array<Record<string, unknown>>;
  const links = (Array.isArray(graph.links) ? graph.links : []) as LinkRef[];
  const nodeKey = chartType === 'chord' ? 'name' : 'id';
  const nodeKeys = new Set(nodes.map((node) => String(node[nodeKey])));
  const dangling = findDanglingLinks(nodeKeys, links);
  if (dangling.length === 0) {
    return undefined;
  }
  const first = dangling[0];
  const missing = !nodeKeys.has(first.source) ? first.source : first.target;
  return {
    code: 'OODS-V147',
    message: `Link "${first.source}" -> "${first.target}" references a non-existent ${chartType} node "${missing}"${dangling.length > 1 ? ` (${dangling.length} links reference a missing node)` : ''}. Every link source/target must match a node ${nodeKey}. Add the node or fix the link.`,
  };
}
