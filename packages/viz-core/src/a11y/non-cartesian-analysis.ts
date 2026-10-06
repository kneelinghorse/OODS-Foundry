// Input-shaped a11y analyzers (sprint-128 m01, Forge-Demos FD#10).
//
// The cartesian a11y helpers read spec.data.values + spec.encoding, but the
// non-cartesian adapters take their data via a SEPARATE input the spec never
// carries (adaptSankeyToECharts(spec, SankeyInput);
// adaptTreemap/SunburstToECharts(spec, HierarchyInput); adaptGraphToECharts(spec,
// NetworkInput)). So an agent had to build a THROWAWAY cartesian bar spec over the
// same rows purely to obtain the accessible table + narrative. These analyzers
// derive the EXISTING VizDataAnalysis shape DIRECTLY from each input contract, so
// "a11y from the same source" holds for the hierarchy / flow / network families —
// not just the 5 cartesian types. They feed the same generateAccessibleTable /
// generateNarrativeSummary path via their pre-built-analysis overload.
//
// Type coverage of this file: treemap + sunburst (analyzeHierarchy), sankey +
// chord (analyzeSankey — chord reuses SankeyInput), force_graph (analyzeNetwork).
// Spatial (choropleth/bubble_map/flow_map) lands in m02 via analyzeSpatial.

import type {
  HierarchyInput,
  HierarchyAdjacencyNode,
  HierarchyNestedNode,
  NetworkInput,
  SankeyInput,
} from '../spec/network-flow.js';
import { buildVizDataAnalysis, type DataPoint, type VizDataAnalysis } from './data-analysis.js';

/** A flattened hierarchy leaf, the row shape surfaced in the accessible table. */
interface HierarchyLeaf {
  readonly name: string;
  readonly value: number;
  readonly parent: string;
}

/**
 * Derive a11y analysis from a hierarchy (treemap / sunburst).
 *
 * The accessible table + narrative describe the LEAF nodes — the parts a treemap
 * or sunburst actually encodes by area/angle. Parent/internal nodes are structural
 * aggregations, so excluding them keeps `total` the sum of the whole WITHOUT
 * double-counting a parent and its children. Each leaf row carries its name, value,
 * and immediate parent so the grouping is still legible in text.
 */
export function analyzeHierarchy(input: HierarchyInput): VizDataAnalysis {
  const leaves = input.type === 'nested' ? collectNestedLeaves(input.data, '') : collectAdjacencyLeaves(input.data);
  const rows = leaves.map((leaf) => ({ name: leaf.name, value: leaf.value, parent: leaf.parent }));
  const dataPoints: DataPoint[] = leaves.map((leaf) => ({ label: leaf.name, value: leaf.value }));

  return buildVizDataAnalysis({
    mark: 'unknown',
    rows,
    dataPoints,
    dimensionField: 'name',
    measureField: 'value',
  });
}

function collectAdjacencyLeaves(nodes: readonly HierarchyAdjacencyNode[]): HierarchyLeaf[] {
  const byId = new Map<string, HierarchyAdjacencyNode>();
  const parentIds = new Set<string>();
  for (const node of nodes) {
    byId.set(node.id, node);
    if (node.parentId !== null && node.parentId !== undefined) {
      parentIds.add(node.parentId);
    }
  }
  const leaves: HierarchyLeaf[] = [];
  for (const node of nodes) {
    if (parentIds.has(node.id)) {
      continue; // an internal node — some other node names it as a parent
    }
    const parentNode = node.parentId !== null ? byId.get(node.parentId) : undefined;
    leaves.push({
      name: node.name ?? node.id,
      value: node.value,
      parent: parentNode?.name ?? node.parentId ?? '',
    });
  }
  return leaves;
}

function collectNestedLeaves(node: HierarchyNestedNode, parent: string): HierarchyLeaf[] {
  const children = node.children ?? [];
  if (children.length === 0) {
    return [{ name: node.name, value: node.value ?? 0, parent }];
  }
  return children.flatMap((child) => collectNestedLeaves(child, node.name));
}

/**
 * Derive a11y analysis from a flow graph (sankey / chord — chord reuses
 * SankeyInput). Each LINK is one flow; the row + data point describe a
 * `source → target` flow and its magnitude, so `total` is the total flow,
 * `max`/`min` are the largest/smallest flows, and the table lists every flow.
 */
export function analyzeSankey(input: SankeyInput): VizDataAnalysis {
  const rows = input.links.map((link) => ({ source: link.source, target: link.target, value: link.value }));
  const dataPoints: DataPoint[] = input.links.map((link) => ({
    label: `${link.source} → ${link.target}`,
    value: link.value,
  }));

  return buildVizDataAnalysis({
    mark: 'unknown',
    rows,
    dataPoints,
    measureField: 'value',
  });
}

/**
 * Derive a11y analysis from a node-link network (force_graph). The structured
 * signal a force layout conveys is connectivity, so each row describes a node and
 * its DEGREE (number of incident links); `max`/`min` surface the most/least
 * connected nodes and `total` is the summed degree (= twice the edge count). When
 * nodes carry a `group`, it is surfaced as the color category so the narrative can
 * list the clusters.
 */
export function analyzeNetwork(input: NetworkInput): VizDataAnalysis {
  const degree = new Map<string, number>();
  for (const node of input.nodes) {
    degree.set(node.id, 0);
  }
  for (const link of input.links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  const hasGroup = input.nodes.some((node) => node.group !== undefined && node.group !== null);
  const rows = input.nodes.map((node) => {
    const nodeDegree = degree.get(node.id) ?? 0;
    return hasGroup
      ? { id: node.id, group: node.group ?? '', degree: nodeDegree }
      : { id: node.id, degree: nodeDegree };
  });
  const dataPoints: DataPoint[] = input.nodes.map((node) => ({
    label: node.id,
    value: degree.get(node.id) ?? 0,
  }));

  return buildVizDataAnalysis({
    mark: 'unknown',
    rows,
    dataPoints,
    dimensionField: 'id',
    measureField: 'degree',
    colorField: hasGroup ? 'group' : undefined,
  });
}
