/**
 * Sankey Accessible Fallback Component
 *
 * Provides an accessible table representation of Sankey/flow data.
 * Shows flow magnitudes between source and target nodes.
 */
import type { JSX } from 'react';

import type { SankeyInput } from '../../../types/viz/network-flow.js';

export interface SankeyA11yFallbackProps {
  /** Flow data (nodes and links) */
  readonly data: SankeyInput;
  /** Name/title for the table caption */
  readonly name?: string;
  /** CSS class name */
  readonly className?: string;
}

interface NodeSummary {
  readonly name: string;
  readonly inflow: number;
  readonly outflow: number;
  readonly total: number;
}

/**
 * Calculate node summaries with flow totals
 */
function calculateNodeSummaries(data: SankeyInput): NodeSummary[] {
  const summaries = new Map<string, { inflow: number; outflow: number }>();

  // Initialize all nodes
  for (const node of data.nodes) {
    summaries.set(node.name, { inflow: 0, outflow: 0 });
  }

  // Sum flows
  for (const link of data.links) {
    const source = summaries.get(link.source);
    const target = summaries.get(link.target);

    if (source) {
      source.outflow += link.value;
    }
    if (target) {
      target.inflow += link.value;
    }
  }

  // Convert to array with totals
  return data.nodes.map((node) => {
    const summary = summaries.get(node.name) ?? { inflow: 0, outflow: 0 };
    return {
      name: node.name,
      inflow: summary.inflow,
      outflow: summary.outflow,
      total: Math.max(summary.inflow, summary.outflow),
    };
  });
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
 * Calculate percentage of total flow
 */
function calculatePercentage(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

/**
 * SankeyA11yFallback Component
 *
 * Renders Sankey flow data as accessible tables - one for node summaries
 * and one for individual flows. This helps screen reader users understand
 * the flow magnitudes between categories.
 */
export function SankeyA11yFallback({
  data,
  name,
  className,
}: SankeyA11yFallbackProps): JSX.Element {
  const nodeSummaries = calculateNodeSummaries(data);
  const totalFlow = data.links.reduce((sum, link) => sum + link.value, 0);

  const nodeCaption = name ? `${name} - Node Summary` : 'Flow Node Summary';
  const flowCaption = name ? `${name} - Flow Details` : 'Flow Details';

  // Sort links by value for easier reading
  const sortedLinks = [...data.links].sort((a, b) => b.value - a.value);

  return (
    <div
      className={`mt-4 space-y-4 overflow-auto rounded border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 ${className ?? ''}`}
      data-testid="sankey-a11y-fallback"
    >
      <details open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Accessible Flow Tables
        </summary>

        {/* Summary stats */}
        <div className="mt-3 mb-4 flex gap-4 text-xs">
          <span className="text-slate-600 dark:text-slate-400">
            <strong>Nodes:</strong> {data.nodes.length}
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            <strong>Flows:</strong> {data.links.length}
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            <strong>Total Volume:</strong> {formatValue(totalFlow)}
          </span>
        </div>

        {/* Node summary table */}
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">
            Node Summary
          </p>
          <table className="min-w-full border-collapse text-sm" aria-live="polite">
            <caption className="sr-only">{nodeCaption}</caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Node
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Inflow
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Outflow
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {nodeSummaries.map((node) => (
                <tr
                  key={node.name}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/50"
                >
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                    {node.name}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {node.inflow > 0 ? formatValue(node.inflow) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {node.outflow > 0 ? formatValue(node.outflow) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatValue(node.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Flow details table */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">
            Flow Details (sorted by magnitude)
          </p>
          <table className="min-w-full border-collapse text-sm" aria-live="polite">
            <caption className="sr-only">{flowCaption}</caption>
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
                  Value
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
                >
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLinks.map((link, index) => (
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
                  <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {calculatePercentage(link.value, totalFlow)}
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

export default SankeyA11yFallback;
