#!/usr/bin/env node
/**
 * Network Visualization Scaffold CLI
 *
 * Usage:
 *   pnpm viz:scaffold-network --type <treemap|sunburst|force-graph|sankey> [options]
 *
 * Examples:
 *   pnpm viz:scaffold-network --type treemap --name department --value headcount
 *   pnpm viz:scaffold-network --type force-graph --group category --source from --target to
 *   pnpm viz:scaffold-network --type sankey --source origin --target destination --value amount
 */
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  generateNetworkScaffold,
  validateNetworkScaffoldOptions,
  type NetworkScaffoldOptions,
  type NetworkScaffoldType,
} from '@/viz/patterns/network-scaffold.js';

export function runVizNetworkScaffold(argv: string[] = process.argv.slice(2)): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      type: { type: 'string', short: 't' },
      name: { type: 'string' },
      value: { type: 'string' },
      parent: { type: 'string' },
      children: { type: 'string' },
      group: { type: 'string' },
      source: { type: 'string' },
      target: { type: 'string' },
      interactive: { type: 'boolean', default: true },
      'no-table': { type: 'boolean' },
    },
    strict: false,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const type = normalizeType(values.type);

  const options: NetworkScaffoldOptions = {
    type,
    nameField: typeof values.name === 'string' ? values.name : undefined,
    valueField: typeof values.value === 'string' ? values.value : undefined,
    parentField: typeof values.parent === 'string' ? values.parent : undefined,
    childrenField: typeof values.children === 'string' ? values.children : undefined,
    groupField: typeof values.group === 'string' ? values.group : undefined,
    sourceField: typeof values.source === 'string' ? values.source : undefined,
    targetField: typeof values.target === 'string' ? values.target : undefined,
    interactive: values.interactive !== false,
    showTable: !values['no-table'],
  };

  // Validate and show warnings
  const validation = validateNetworkScaffoldOptions(options);
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Suggestions:');
    for (const warning of validation.warnings) {
      console.log(`   • ${warning}`);
    }
    console.log('');
  }

  const scaffold = generateNetworkScaffold(options);

  console.log(`Network Scaffold: ${type}`);
  console.log('='.repeat(40));
  console.log(scaffold);
}

function normalizeType(input: unknown): NetworkScaffoldType {
  if (typeof input !== 'string') {
    return 'treemap';
  }

  const normalized = input.trim().toLowerCase();

  // Handle common variations
  const typeMap: Record<string, NetworkScaffoldType> = {
    treemap: 'treemap',
    tree: 'treemap',
    sunburst: 'sunburst',
    sun: 'sunburst',
    radial: 'sunburst',
    'force-graph': 'force-graph',
    forcegraph: 'force-graph',
    force: 'force-graph',
    network: 'force-graph',
    graph: 'force-graph',
    sankey: 'sankey',
    flow: 'sankey',
    alluvial: 'sankey',
  };

  return typeMap[normalized] ?? 'treemap';
}

function printHelp(): void {
  console.log(`
Network Visualization Scaffold Generator

Usage:
  pnpm viz:scaffold-network --type <type> [options]

Types:
  treemap      Hierarchical data as nested rectangles
  sunburst     Hierarchical data as radial chart
  force-graph  Network nodes and edges with physics simulation
  sankey       Flow quantities between stages

Options:
  --type, -t     Visualization type (required)
  --name         Field name for node labels (default: "name")
  --value        Field name for values/sizes (default: "value")
  --parent       Field name for parent ID (adjacency list format)
  --children     Field name for children array (nested format)
  --group        Field name for node grouping (force-graph)
  --source       Field name for link source (force-graph, sankey)
  --target       Field name for link target (force-graph, sankey)
  --interactive  Enable zoom/drag (default: true)
  --no-table     Disable accessible table fallback

Examples:

  # Treemap for organizational hierarchy
  pnpm viz:scaffold-network --type treemap --name department --value headcount

  # Sunburst for budget breakdown
  pnpm viz:scaffold-network --type sunburst --name category --value amount

  # Force-graph for social network
  pnpm viz:scaffold-network --type force-graph --group role --source from --target to

  # Sankey for user flow
  pnpm viz:scaffold-network --type sankey --source step_from --target step_to --value users

  # Treemap without table fallback
  pnpm viz:scaffold-network --type treemap --no-table

Data Formats:

  Hierarchy (treemap, sunburst):
    Nested: { name: "Root", children: [{ name: "Child", value: 10 }] }
    Adjacency: [{ id: "1", parentId: null }, { id: "2", parentId: "1" }]

  Network (force-graph):
    { nodes: [{ id: "a", group: "x" }], links: [{ source: "a", target: "b" }] }

  Flow (sankey):
    { nodes: [{ name: "A" }], links: [{ source: "A", target: "B", value: 100 }] }

Output:
  TypeScript React component code ready to use with OODS components.
  Copy the output to your component file and customize the data.
`);
}

// Self-executing when run directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runVizNetworkScaffold();
}
