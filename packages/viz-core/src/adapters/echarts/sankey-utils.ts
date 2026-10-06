// Sankey validation + node/link transforms (sprint-111 m03, extracted from
// src/viz/adapters/echarts/sankey-adapter.ts during the port). Pure TS, no
// echarts/runtime coupling — the data-shaping half of the sankey adapter:
// validate the SankeyInput, then transform its nodes/links into the ECharts
// sankey series data shape. The adapter (sankey-adapter.ts) owns the ECharts
// option assembly + palette/tooltip; this module owns the data contract checks.

import type { SankeyInput, SankeyLink, SankeyNode } from '../../spec/network-flow.js';

export interface EChartsSankeyNode {
  readonly name: string;
  readonly value?: number;
  readonly itemStyle?: { readonly color?: string };
  readonly [key: string]: unknown;
}

export interface EChartsSankeyLink {
  readonly source: string;
  readonly target: string;
  readonly value: number;
  readonly [key: string]: unknown;
}

/**
 * Sankey input validation error
 */
export class SankeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SankeyValidationError';
  }
}

/**
 * Validate Sankey input - values are required on all links
 *
 * Sankey diagrams are fundamentally about flow QUANTITIES. A Sankey without
 * values is meaningless - the link widths convey the magnitude of flow.
 */
export function validateSankeyInput(input: SankeyInput): void {
  const linksWithoutValue = input.links.filter(
    (l) => l.value === undefined || l.value === null || !Number.isFinite(l.value)
  );

  if (linksWithoutValue.length > 0) {
    throw new SankeyValidationError(
      `Sankey diagrams require 'value' on all links. ` +
        `Found ${linksWithoutValue.length} links without valid values.`
    );
  }

  // Validate that source and target nodes exist
  const nodeNames = new Set(input.nodes.map((n) => n.name));
  const brokenLinks = input.links.filter(
    (l) => !nodeNames.has(l.source) || !nodeNames.has(l.target)
  );

  if (brokenLinks.length > 0) {
    const firstBroken = brokenLinks[0];
    throw new SankeyValidationError(
      `Sankey link references non-existent node. ` +
        `Link from "${firstBroken.source}" to "${firstBroken.target}" has invalid node reference.`
    );
  }
}

/**
 * Transform nodes for ECharts Sankey format
 */
export function transformNodes(
  nodes: readonly SankeyNode[],
  links: readonly SankeyLink[],
  palette: readonly string[]
): EChartsSankeyNode[] {
  return nodes.map((node, index) => {
    const value = calculateNodeValue(node, links);
    const color = (node.color as string | undefined) ?? palette[index % palette.length];

    return pruneUndefined({
      name: node.name,
      value,
      itemStyle: color ? { color } : undefined,
      ...preserveExtraFields(node, ['name', 'value', 'color']),
    }) as EChartsSankeyNode;
  });
}

/**
 * Transform links for ECharts Sankey format
 */
export function transformLinks(links: readonly SankeyLink[]): EChartsSankeyLink[] {
  return links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.value,
    ...preserveExtraFields(link, ['source', 'target', 'value']),
  }));
}

/**
 * Calculate node value from incoming/outgoing flows
 *
 * For Sankey diagrams, node value represents the total flow through the node.
 * This is the maximum of incoming or outgoing flow totals.
 */
function calculateNodeValue(node: SankeyNode, links: readonly SankeyLink[]): number {
  // If node has explicit value, use it
  if (typeof node.value === 'number' && Number.isFinite(node.value)) {
    return node.value as number;
  }

  const nodeName = node.name;

  // Sum of incoming flows
  const incoming = links
    .filter((l) => l.target === nodeName)
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  // Sum of outgoing flows
  const outgoing = links
    .filter((l) => l.source === nodeName)
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  // Use whichever is larger (they're often equal, but not for source/sink nodes)
  return Math.max(incoming, outgoing);
}

function preserveExtraFields(
  data: Record<string, unknown>,
  exclude: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!exclude.includes(key)) {
      result[key] = value;
    }
  });
  return result;
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
