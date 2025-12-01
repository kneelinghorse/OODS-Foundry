/**
 * Graph Accessible Fallback Component
 *
 * Provides accessible table representations of network graph data.
 * Shows separate tables for nodes and edges that screen readers can navigate.
 */
import type { JSX } from 'react';

import type { NetworkInput } from '../../../types/viz/network-flow.js';

export interface GraphA11yFallbackProps {
  /** Network data (nodes and links) */
  readonly data: NetworkInput;
  /** Name/title for the table captions */
  readonly name?: string;
  /** CSS class name */
  readonly className?: string;
}

/**
 * Format number for display
 */
function formatValue(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * GraphA11yFallback Component
 *
 * Renders network graph data as accessible tables - one for nodes and one for edges.
 * This allows screen reader users to understand the network structure.
 */
export function GraphA11yFallback({
  data,
  name,
  className,
}: GraphA11yFallbackProps): JSX.Element {
  const nodeCaption = name ? `${name} - Nodes` : 'Network Nodes';
  const edgeCaption = name ? `${name} - Connections` : 'Network Connections';

  // Calculate node degrees for additional context
  const nodeDegrees = new Map<string, { in: number; out: number }>();
  for (const node of data.nodes) {
    nodeDegrees.set(node.id, { in: 0, out: 0 });
  }
  for (const link of data.links) {
    const source = nodeDegrees.get(link.source);
    const target = nodeDegrees.get(link.target);
    if (source) source.out += 1;
    if (target) target.in += 1;
  }

  // Get unique groups for legend
  const groups = [...new Set(data.nodes.map((n) => n.group).filter(Boolean))] as string[];

  return (
    <div
      className={`mt-4 space-y-4 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ''}`}
      data-testid="graph-a11y-fallback"
    >
      <details open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Accessible Network Tables
        </summary>

        {/* Legend for groups */}
        {groups.length > 0 && (
          <div className="mt-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Node Groups
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {groups.map((group) => (
                <li
                  key={group}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {group}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nodes table */}
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">
            Nodes ({data.nodes.length})
          </p>
          <table className="min-w-full border-collapse text-sm" aria-live="polite">
            <caption className="sr-only">{nodeCaption}</caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  ID
                </th>
                {groups.length > 0 && (
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                  >
                    Group
                  </th>
                )}
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  In-Degree
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Out-Degree
                </th>
              </tr>
            </thead>
            <tbody>
              {data.nodes.map((node) => {
                const degrees = nodeDegrees.get(node.id);
                return (
                  <tr
                    key={node.id}
                    className="border-b border-slate-100 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {(node as { name?: string }).name ?? node.id}
                    </td>
                    {groups.length > 0 && (
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {node.group ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {degrees?.in ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {degrees?.out ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Edges table */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">
            Connections ({data.links.length})
          </p>
          <table className="min-w-full border-collapse text-sm" aria-live="polite">
            <caption className="sr-only">{edgeCaption}</caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  From
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  To
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {data.links.map((link, index) => (
                <tr
                  key={`${link.source}-${link.target}-${index}`}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/50"
                >
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {link.source}
                  </td>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {link.target}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatValue(link.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default GraphA11yFallback;
