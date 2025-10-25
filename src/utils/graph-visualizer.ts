/* c8 ignore file */
/**
 * Graph Visualizer
 *
 * Exports dependency graphs as Mermaid diagrams for visualization.
 */

import { DependencyGraph, GraphNode } from '../core/dependency-graph.js';
import { formatTokenReference } from './token-values.js';

const highlightedFill = formatTokenReference('sys.status.warning.surface', '--cmp-status-warning-surface', 'Canvas');
const highlightedStroke = formatTokenReference('sys.status.warning.border', '--cmp-status-warning-border', 'CanvasText');
const conflictFill = formatTokenReference('sys.status.critical.surface', '--cmp-status-critical-surface', 'Canvas');
const conflictStroke = formatTokenReference('sys.status.critical.border', '--cmp-status-critical-border', 'CanvasText');
const normalFill = formatTokenReference('sys.status.info.surface', '--cmp-status-info-surface', 'Canvas');
const normalStroke = formatTokenReference('sys.status.info.border', '--cmp-status-info-border', 'CanvasText');

/**
 * Visualization options
 */
export interface VisualizationOptions {
  /** Include node details (dependencies count, etc.) */
  showDetails?: boolean;
  /** Highlight specific nodes */
  highlightNodes?: string[];
  /** Show conflict relationships */
  showConflicts?: boolean;
  /** Graph direction: TB (top-bottom), LR (left-right), BT (bottom-top), RL (right-left) */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Use subgraphs for grouping */
  useSubgraphs?: boolean;
}

/**
 * Generate a Mermaid diagram from a dependency graph
 *
 * Example output:
 * ```mermaid
 * graph TB
 *   A[Timestamped] --> B[Auditable]
 *   B --> C[Versioned]
 *   A --> D[Searchable]
 * ```
 */
export function generateMermaidDiagram(
  graph: DependencyGraph,
  options: VisualizationOptions = {}
): string {
  const {
    showDetails = false,
    highlightNodes = [],
    showConflicts = true,
    direction = 'TB',
  } = options;

  const lines: string[] = [];
  const nodes = graph.getAllNodes();

  // Start diagram
  lines.push(`graph ${direction}`);

  // Add nodes with styling
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const label = formatNodeLabel(node, showDetails);
    const style = getNodeStyle(node, highlightNodes);

    if (style) {
      lines.push(`  ${nodeId}[${label}]:::${style}`);
    } else {
      lines.push(`  ${nodeId}[${label}]`);
    }
  }

  // Add dependency edges
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);

    for (const dep of node.dependencies) {
      const depId = sanitizeId(dep);
      lines.push(`  ${nodeId} --> ${depId}`);
    }
  }

  // Add conflict edges (if enabled)
  if (showConflicts) {
    for (const node of nodes) {
      const nodeId = sanitizeId(node.id);

      for (const conflict of node.conflicts) {
        const conflictId = sanitizeId(conflict);
        // Use a different style for conflict relationships
        lines.push(`  ${nodeId} -.x ${conflictId}`);
      }
    }
  }

  // Add styling classes
  lines.push('');
  lines.push(`  classDef highlighted fill:${highlightedFill},stroke:${highlightedStroke},stroke-width:3px`);
  lines.push(`  classDef hasConflicts fill:${conflictFill},stroke:${conflictStroke},stroke-width:2px`);
  lines.push(`  classDef normal fill:${normalFill},stroke:${normalStroke},stroke-width:1px`);

  return lines.join('\n');
}

/**
 * Generate a detailed Mermaid diagram with subgraphs for organization
 */
export function generateDetailedMermaidDiagram(
  graph: DependencyGraph,
  categories?: Map<string, string[]>
): string {
  const lines: string[] = [];
  const nodes = graph.getAllNodes();

  lines.push('graph TB');

  if (categories && categories.size > 0) {
    // Use subgraphs for categories
    for (const [category, traitIds] of categories.entries()) {
      const categoryId = sanitizeId(category);
      lines.push(`  subgraph ${categoryId}[${category}]`);

      for (const traitId of traitIds) {
        const node = nodes.find((n) => n.id === traitId);
        if (node) {
          const nodeId = sanitizeId(node.id);
          const label = node.id;
          lines.push(`    ${nodeId}[${label}]`);
        }
      }

      lines.push('  end');
    }
  } else {
    // No categories, just add all nodes
    for (const node of nodes) {
      const nodeId = sanitizeId(node.id);
      lines.push(`  ${nodeId}[${node.id}]`);
    }
  }

  // Add edges
  lines.push('');
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);

    for (const dep of node.dependencies) {
      const depId = sanitizeId(dep);
      lines.push(`  ${nodeId} --> ${depId}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a cycle visualization for circular dependency errors
 */
export function generateCycleDiagram(cycle: string[]): string {
  const lines: string[] = [];

  lines.push('graph LR');

  for (let i = 0; i < cycle.length - 1; i++) {
    const from = sanitizeId(cycle[i]);
    const to = sanitizeId(cycle[i + 1]);

    if (i === cycle.length - 2) {
      // Last edge in cycle, highlight it
      lines.push(`  ${from} -->|cycle| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  // Add styling for cycle nodes
  for (const node of new Set(cycle)) {
    const nodeId = sanitizeId(node);
    lines.push(`  ${nodeId}:::cycleNode`);
  }

  lines.push('');
  lines.push(`  classDef cycleNode fill:${conflictFill},stroke:${conflictStroke},stroke-width:3px`);

  return lines.join('\n');
}

/**
 * Generate a DOT format graph for Graphviz
 *
 * Alternative format for more advanced visualization tools
 */
export function generateDotGraph(graph: DependencyGraph): string {
  const lines: string[] = [];
  const nodes = graph.getAllNodes();

  lines.push('digraph Dependencies {');
  lines.push('  rankdir=TB;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');

  // Add nodes
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const hasConflicts = node.conflicts.size > 0;
    const color = hasConflicts ? 'red' : 'blue';

    lines.push(`  ${nodeId} [label="${node.id}", color=${color}];`);
  }

  lines.push('');

  // Add edges
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);

    for (const dep of node.dependencies) {
      const depId = sanitizeId(dep);
      lines.push(`  ${nodeId} -> ${depId};`);
    }

    // Add conflict edges
    for (const conflict of node.conflicts) {
      const conflictId = sanitizeId(conflict);
      lines.push(`  ${nodeId} -> ${conflictId} [style=dashed, color=red, label="conflicts"];`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Export graph statistics as a text report
 */
export function generateGraphReport(graph: DependencyGraph): string {
  const nodes = graph.getAllNodes();
  const lines: string[] = [];

  lines.push('# Dependency Graph Report');
  lines.push('');
  lines.push(`Total Traits: ${nodes.length}`);
  lines.push('');

  // Calculate statistics
  let totalDeps = 0;
  let totalConflicts = 0;
  let maxDeps = 0;
  let maxDepsTrait = '';

  for (const node of nodes) {
    const depCount = node.dependencies.size;
    totalDeps += depCount;
    totalConflicts += node.conflicts.size;

    if (depCount > maxDeps) {
      maxDeps = depCount;
      maxDepsTrait = node.id;
    }
  }

  lines.push(`Total Dependencies: ${totalDeps}`);
  lines.push(`Total Conflicts: ${totalConflicts}`);
  lines.push(`Average Dependencies per Trait: ${(totalDeps / nodes.length).toFixed(2)}`);
  lines.push(`Most Dependencies: ${maxDepsTrait} (${maxDeps})`);
  lines.push('');

  // List traits with no dependencies (root traits)
  const rootTraits = nodes.filter((n) => n.dependencies.size === 0);
  lines.push(`## Root Traits (${rootTraits.length})`);
  for (const trait of rootTraits) {
    lines.push(`- ${trait.id}`);
  }
  lines.push('');

  // List traits with conflicts
  const conflictingTraits = nodes.filter((n) => n.conflicts.size > 0);
  if (conflictingTraits.length > 0) {
    lines.push(`## Traits with Conflicts (${conflictingTraits.length})`);
    for (const trait of conflictingTraits) {
      const conflicts = Array.from(trait.conflicts).join(', ');
      lines.push(`- ${trait.id}: conflicts with ${conflicts}`);
    }
    lines.push('');
  }

  // List dependency chains
  lines.push('## Dependency Details');
  for (const node of nodes.sort((a, b) => a.id.localeCompare(b.id))) {
    if (node.dependencies.size > 0) {
      const deps = Array.from(node.dependencies).sort().join(', ');
      lines.push(`- ${node.id} → [${deps}]`);
    } else {
      lines.push(`- ${node.id} (no dependencies)`);
    }
  }

  return lines.join('\n');
}

// Helper functions

function sanitizeId(id: string): string {
  // Replace special characters with underscores for Mermaid/DOT compatibility
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function formatNodeLabel(node: GraphNode, showDetails: boolean): string {
  if (!showDetails) {
    return node.id;
  }

  const depCount = node.dependencies.size;
  const conflictCount = node.conflicts.size;

  let label = node.id;
  if (depCount > 0) {
    label += `\n(${depCount} deps)`;
  }
  if (conflictCount > 0) {
    label += `\n⚠ ${conflictCount} conflicts`;
  }

  return label;
}

function getNodeStyle(node: GraphNode, highlightNodes: string[]): string | null {
  if (highlightNodes.includes(node.id)) {
    return 'highlighted';
  }

  if (node.conflicts.size > 0) {
    return 'hasConflicts';
  }

  return 'normal';
}
