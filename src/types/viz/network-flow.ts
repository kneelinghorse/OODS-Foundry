/**
 * Network & Flow Visualization Types
 *
 * Canonical data contracts for hierarchy (treemap/sunburst), network (force),
 * and flow (Sankey) visualizations. Sourced from the Network & Flow Module
 * architecture reference (Section 2).
 */

export type HierarchyInputFormat = 'adjacency_list' | 'nested' | 'unknown';

export interface HierarchyAdjacencyNode {
  id: string;
  parentId: string | null;
  value: number;
  name?: string;
  [key: string]: unknown;
}

export interface HierarchyAdjacencyInput {
  type: 'adjacency_list';
  data: HierarchyAdjacencyNode[];
}

export interface HierarchyNestedNode {
  name: string;
  value?: number;
  children?: HierarchyNestedNode[];
  [key: string]: unknown;
}

export interface HierarchyNestedInput {
  type: 'nested';
  data: HierarchyNestedNode;
}

export type HierarchyInput = HierarchyAdjacencyInput | HierarchyNestedInput;

export interface NetworkNode {
  id: string;
  group?: string;
  radius?: number;
  fixed?: boolean;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

export interface NetworkLink {
  source: string;
  target: string;
  value?: number;
  [key: string]: unknown;
}

export interface NetworkInput {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface SankeyNode {
  name: string;
  [key: string]: unknown;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  [key: string]: unknown;
}

export interface SankeyInput {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface TreemapNodeOutput {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  depth: number;
  value: number;
  [key: string]: unknown;
}

export interface TreemapOutput {
  nodes: TreemapNodeOutput[];
}

export interface SunburstNodeOutput {
  id: string;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  depth: number;
  value: number;
  [key: string]: unknown;
}

export interface SunburstOutput {
  nodes: SunburstNodeOutput[];
}

export interface ForceNodeOutput {
  id: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface ForceLinkOutput {
  source: string;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  [key: string]: unknown;
}

export interface ForceOutput {
  nodes: ForceNodeOutput[];
  links: ForceLinkOutput[];
}

export interface SankeyNodeOutput {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  value: number;
  [key: string]: unknown;
}

export interface SankeyLinkOutput {
  source: string;
  target: string;
  value: number;
  width: number;
  y0: number;
  y1: number;
  svgPath: string;
  [key: string]: unknown;
}

export interface SankeyOutput {
  nodes: SankeyNodeOutput[];
  links: SankeyLinkOutput[];
}
