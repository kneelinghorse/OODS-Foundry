/**
 * Treemap Accessible Fallback Component
 *
 * Provides an accessible table representation of hierarchical treemap data.
 * Screen readers can navigate this table to understand the data structure.
 */
import type { JSX } from 'react';

import type {
  HierarchyInput,
  HierarchyAdjacencyInput,
  HierarchyNestedInput,
  HierarchyNestedNode,
  HierarchyAdjacencyNode,
} from '../../../types/viz/network-flow.js';

export interface TreemapA11yFallbackProps {
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
}

/**
 * Flatten hierarchy data to a table-friendly format
 */
function flattenHierarchy(input: HierarchyInput): FlatNode[] {
  const nodes: FlatNode[] = [];

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

    // Find roots
    const roots = adjInput.data.filter((n) => n.parentId === null);

    // Traverse
    const traverse = (nodeId: string, depth: number, pathParts: string[]) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const name = node.name ?? node.id;
      const currentPath = [...pathParts, name];

      nodes.push({
        name,
        value: node.value,
        depth,
        path: currentPath.join(' > '),
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

    const traverse = (node: HierarchyNestedNode, depth: number, pathParts: string[]) => {
      const name = node.name;
      const currentPath = [...pathParts, name];

      nodes.push({
        name,
        value: node.value ?? 0,
        depth,
        path: currentPath.join(' > '),
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
 * TreemapA11yFallback Component
 *
 * Renders hierarchical treemap data as an accessible table.
 * Each row shows the node name, value, and path for context.
 */
export function TreemapA11yFallback({
  data,
  name,
  className,
}: TreemapA11yFallbackProps): JSX.Element {
  const nodes = flattenHierarchy(data);
  const caption = name ? `${name} - Hierarchical Data Table` : 'Hierarchical Data Table';

  return (
    <div
      className={`mt-4 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ''}`}
      data-testid="treemap-a11y-fallback"
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
                Name
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
              >
                Value
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

export default TreemapA11yFallback;
