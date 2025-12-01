/**
 * Sunburst Accessible Fallback Component
 *
 * Provides an accessible table representation of hierarchical sunburst data.
 * Screen readers can navigate this table to understand the radial hierarchy.
 */
import type { JSX } from 'react';

import type {
  HierarchyInput,
  HierarchyAdjacencyInput,
  HierarchyNestedInput,
  HierarchyNestedNode,
  HierarchyAdjacencyNode,
} from '../../../types/viz/network-flow.js';

export interface SunburstA11yFallbackProps {
  /** Hierarchical data (nested or adjacency list format) */
  readonly data: HierarchyInput;
  /** Name/title for the table caption */
  readonly name?: string;
  /** CSS class name */
  readonly className?: string;
}

interface FlatNode {
  readonly name: string;
  readonly value: number;
  readonly depth: number;
  readonly path: string;
  readonly percentage?: number;
}

/**
 * Flatten hierarchy data to a table-friendly format with percentage calculation
 */
function flattenHierarchy(input: HierarchyInput): FlatNode[] {
  const nodes: FlatNode[] = [];
  let rootValue = 0;

  if (input.type === 'adjacency_list') {
    const adjInput = input as HierarchyAdjacencyInput;
    const nodeMap = new Map<string, HierarchyAdjacencyNode>();
    const childrenMap = new Map<string, string[]>();

    // Build maps
    for (const node of adjInput.data) {
      nodeMap.set(node.id, node);
      if (node.parentId !== null) {
        const siblings = childrenMap.get(node.parentId) ?? [];
        siblings.push(node.id);
        childrenMap.set(node.parentId, siblings);
      }
    }

    // Find roots and calculate root value
    const roots = adjInput.data.filter((n) => n.parentId === null);
    rootValue = roots.reduce((sum, r) => sum + r.value, 0);

    // Traverse
    const traverse = (nodeId: string, depth: number, pathParts: string[]) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const name = node.name ?? node.id;
      const currentPath = [...pathParts, name];
      const percentage = rootValue > 0 ? (node.value / rootValue) * 100 : 0;

      nodes.push({
        name,
        value: node.value,
        depth,
        path: currentPath.join(' > '),
        percentage,
      });

      const children = childrenMap.get(nodeId) ?? [];
      for (const childId of children) {
        traverse(childId, depth + 1, currentPath);
      }
    };

    for (const root of roots) {
      traverse(root.id, 0, []);
    }
  } else {
    const nestedInput = input as HierarchyNestedInput;
    rootValue = nestedInput.data.value ?? 0;

    // Calculate total if root doesn't have explicit value
    if (rootValue === 0 && nestedInput.data.children) {
      const sumChildren = (node: HierarchyNestedNode): number => {
        if (node.value !== undefined) return node.value;
        if (!node.children) return 0;
        return node.children.reduce((sum, child) => sum + sumChildren(child), 0);
      };
      rootValue = sumChildren(nestedInput.data);
    }

    const traverse = (node: HierarchyNestedNode, depth: number, pathParts: string[]) => {
      const name = node.name;
      const currentPath = [...pathParts, name];
      const value = node.value ?? 0;
      const percentage = rootValue > 0 ? (value / rootValue) * 100 : 0;

      nodes.push({
        name,
        value,
        depth,
        path: currentPath.join(' > '),
        percentage,
      });

      if (node.children) {
        for (const child of node.children) {
          traverse(child, depth + 1, currentPath);
        }
      }
    };

    traverse(nestedInput.data, 0, []);
  }

  return nodes;
}

/**
 * Format number for display
 */
function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * SunburstA11yFallback Component
 *
 * Renders hierarchical sunburst data as an accessible table.
 * Each row shows the segment name, value, percentage, and path.
 */
export function SunburstA11yFallback({
  data,
  name,
  className,
}: SunburstA11yFallbackProps): JSX.Element {
  const nodes = flattenHierarchy(data);
  const caption = name ? `${name} - Radial Hierarchy Table` : 'Radial Hierarchy Table';

  return (
    <div
      className={`mt-4 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ''}`}
      data-testid="sunburst-a11y-fallback"
    >
      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Accessible Data Table
        </summary>
        <table className="mt-3 min-w-full border-collapse text-sm" aria-live="polite">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
              >
                Segment
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
              >
                Value
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
              >
                % of Total
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
              >
                Path
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, index) => (
              <tr
                key={`${node.path}-${index}`}
                className="border-b border-slate-100 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/50"
              >
                <td
                  className="px-3 py-2 text-slate-800 dark:text-slate-200"
                  style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
                >
                  {node.name}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                  {formatValue(node.value)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                  {node.percentage !== undefined ? `${node.percentage.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {node.path}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default SunburstA11yFallback;
