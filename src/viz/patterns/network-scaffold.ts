/**
 * Network Visualization Scaffold Generator
 *
 * Generates TypeScript scaffold code for network & flow visualizations:
 * - Treemap (hierarchical)
 * - Sunburst (hierarchical)
 * - ForceGraph (network)
 * - Sankey (flow)
 */

export type NetworkScaffoldType = 'treemap' | 'sunburst' | 'force-graph' | 'sankey';

export interface NetworkScaffoldOptions {
  readonly type: NetworkScaffoldType;
  /** Field for node name/label */
  readonly nameField?: string;
  /** Field for node value */
  readonly valueField?: string;
  /** Field for parent ID (adjacency list) */
  readonly parentField?: string;
  /** Field for children (nested) */
  readonly childrenField?: string;
  /** Field for node group/category */
  readonly groupField?: string;
  /** Field for link source */
  readonly sourceField?: string;
  /** Field for link target */
  readonly targetField?: string;
  /** Enable interactivity (zoom, drag) */
  readonly interactive?: boolean;
  /** Show accessible table fallback */
  readonly showTable?: boolean;
}

export function generateNetworkScaffold(options: NetworkScaffoldOptions): string {
  switch (options.type) {
    case 'treemap':
      return buildTreemapScaffold(options);
    case 'sunburst':
      return buildSunburstScaffold(options);
    case 'force-graph':
      return buildForceGraphScaffold(options);
    case 'sankey':
      return buildSankeyScaffold(options);
    default:
      return buildTreemapScaffold(options);
  }
}

function buildTreemapScaffold(options: NetworkScaffoldOptions): string {
  const nameField = options.nameField ?? 'name';
  const valueField = options.valueField ?? 'value';
  const childrenField = options.childrenField ?? 'children';
  const showTable = options.showTable ?? true;
  const drilldown = options.interactive ?? true;

  return `import { Treemap } from '@/components/viz/Treemap.js';
import type { HierarchyInput } from '@/types/viz/network-flow.js';

// Sample hierarchical data (nested format)
// You can also use 'adjacency_list' format with parentId references
const data: HierarchyInput = {
  type: 'nested',
  data: {
    ${nameField}: 'Root',
    ${childrenField}: [
      {
        ${nameField}: 'Category A',
        ${valueField}: 100,
        ${childrenField}: [
          { ${nameField}: 'Item A1', ${valueField}: 40 },
          { ${nameField}: 'Item A2', ${valueField}: 60 },
        ],
      },
      {
        ${nameField}: 'Category B',
        ${valueField}: 150,
        ${childrenField}: [
          { ${nameField}: 'Item B1', ${valueField}: 80 },
          { ${nameField}: 'Item B2', ${valueField}: 70 },
        ],
      },
      {
        ${nameField}: 'Category C',
        ${valueField}: 75,
      },
    ],
  },
};

export function TreemapScaffold(): JSX.Element {
  const handleSelect = (node: { name: string; value: number; depth: number; path: readonly string[] }) => {
    console.log('Selected node:', node);
    console.log('Path:', node.path.join(' > '));
  };

  const handleDrillDown = (path: readonly string[]) => {
    console.log('Drill down to:', path.join(' > '));
  };

  return (
    <Treemap
      data={data}
      width={640}
      height={400}
      name="Hierarchical Data Treemap"
      drilldown={${drilldown}}
      breadcrumb={true}
      showTable={${showTable}}
      onSelect={handleSelect}
      onDrillDown={handleDrillDown}
      description="Treemap visualization showing hierarchical data with drill-down navigation"
    />
  );
}

// Example with adjacency list format (alternative data structure)
export const adjacencyListExample: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, ${nameField}: 'Root', ${valueField}: 0 },
    { id: 'a', parentId: 'root', ${nameField}: 'Category A', ${valueField}: 100 },
    { id: 'b', parentId: 'root', ${nameField}: 'Category B', ${valueField}: 150 },
    { id: 'a1', parentId: 'a', ${nameField}: 'Item A1', ${valueField}: 40 },
    { id: 'a2', parentId: 'a', ${nameField}: 'Item A2', ${valueField}: 60 },
    { id: 'b1', parentId: 'b', ${nameField}: 'Item B1', ${valueField}: 80 },
  ],
};
`;
}

function buildSunburstScaffold(options: NetworkScaffoldOptions): string {
  const nameField = options.nameField ?? 'name';
  const valueField = options.valueField ?? 'value';
  const childrenField = options.childrenField ?? 'children';
  const showTable = options.showTable ?? true;
  const drilldown = options.interactive ?? true;

  return `import { Sunburst } from '@/components/viz/Sunburst.js';
import type { HierarchyInput } from '@/types/viz/network-flow.js';

// Sample hierarchical data (nested format)
const data: HierarchyInput = {
  type: 'nested',
  data: {
    ${nameField}: 'Total',
    ${childrenField}: [
      {
        ${nameField}: 'Region A',
        ${childrenField}: [
          { ${nameField}: 'Sub A1', ${valueField}: 120 },
          { ${nameField}: 'Sub A2', ${valueField}: 80 },
          { ${nameField}: 'Sub A3', ${valueField}: 60 },
        ],
      },
      {
        ${nameField}: 'Region B',
        ${childrenField}: [
          { ${nameField}: 'Sub B1', ${valueField}: 90 },
          { ${nameField}: 'Sub B2', ${valueField}: 110 },
        ],
      },
      {
        ${nameField}: 'Region C',
        ${valueField}: 150,
      },
    ],
  },
};

export function SunburstScaffold(): JSX.Element {
  const handleSelect = (node: { name: string; value: number; depth: number; path: readonly string[] }) => {
    console.log('Selected:', node.name, 'at depth', node.depth);
  };

  const handleDrillDown = (path: readonly string[]) => {
    console.log('Navigated to:', path.join(' > '));
  };

  return (
    <Sunburst
      data={data}
      width={500}
      height={500}
      name="Hierarchical Sunburst"
      drilldown={${drilldown}}
      showTable={${showTable}}
      onSelect={handleSelect}
      onDrillDown={handleDrillDown}
      description="Sunburst chart showing hierarchical proportions with radial layout"
    />
  );
}
`;
}

function buildForceGraphScaffold(options: NetworkScaffoldOptions): string {
  const groupField = options.groupField ?? 'group';
  const valueField = options.valueField ?? 'value';
  const sourceField = options.sourceField ?? 'source';
  const targetField = options.targetField ?? 'target';
  const showTable = options.showTable ?? true;
  const interactive = options.interactive ?? true;

  return `import { ForceGraph } from '@/components/viz/ForceGraph.js';
import type { NetworkInput } from '@/types/viz/network-flow.js';

// Sample network data with nodes and links
const data: NetworkInput = {
  nodes: [
    { id: 'node-1', name: 'Alice', ${groupField}: 'team-a' },
    { id: 'node-2', name: 'Bob', ${groupField}: 'team-a' },
    { id: 'node-3', name: 'Charlie', ${groupField}: 'team-b' },
    { id: 'node-4', name: 'Diana', ${groupField}: 'team-b' },
    { id: 'node-5', name: 'Eve', ${groupField}: 'team-c' },
  ],
  links: [
    { ${sourceField}: 'node-1', ${targetField}: 'node-2', ${valueField}: 10 },
    { ${sourceField}: 'node-1', ${targetField}: 'node-3', ${valueField}: 5 },
    { ${sourceField}: 'node-2', ${targetField}: 'node-4', ${valueField}: 8 },
    { ${sourceField}: 'node-3', ${targetField}: 'node-4', ${valueField}: 12 },
    { ${sourceField}: 'node-4', ${targetField}: 'node-5', ${valueField}: 6 },
    { ${sourceField}: 'node-5', ${targetField}: 'node-1', ${valueField}: 3 },
  ],
};

export function ForceGraphScaffold(): JSX.Element {
  const handleNodeSelect = (node: { id: string; name: string; group?: string; value?: number }) => {
    console.log('Node selected:', node.name, 'in group:', node.group);
  };

  const handleLinkSelect = (link: { source: string; target: string; value?: number }) => {
    console.log('Link selected:', link.source, '->', link.target, 'weight:', link.value);
  };

  return (
    <ForceGraph
      data={data}
      width={800}
      height={600}
      name="Network Relationships"
      colorField="${groupField}"
      zoom={${interactive}}
      draggable={${interactive}}
      showLabels={true}
      showLegend={true}
      showTable={${showTable}}
      force={{
        repulsion: 500,
        gravity: 0.1,
        edgeLength: 150,
        friction: 0.6,
      }}
      onSelect={handleNodeSelect}
      onLinkSelect={handleLinkSelect}
      description="Force-directed graph showing network connections between entities"
    />
  );
}
`;
}

function buildSankeyScaffold(options: NetworkScaffoldOptions): string {
  const nameField = options.nameField ?? 'name';
  const valueField = options.valueField ?? 'value';
  const sourceField = options.sourceField ?? 'source';
  const targetField = options.targetField ?? 'target';
  const showTable = options.showTable ?? true;

  return `import { Sankey } from '@/components/viz/Sankey.js';
import type { SankeyInput } from '@/types/viz/network-flow.js';

// Sample flow data showing resource allocation or process flow
const data: SankeyInput = {
  nodes: [
    { ${nameField}: 'Source A' },
    { ${nameField}: 'Source B' },
    { ${nameField}: 'Process 1' },
    { ${nameField}: 'Process 2' },
    { ${nameField}: 'Output X' },
    { ${nameField}: 'Output Y' },
    { ${nameField}: 'Output Z' },
  ],
  links: [
    // Source A flows
    { ${sourceField}: 'Source A', ${targetField}: 'Process 1', ${valueField}: 100 },
    { ${sourceField}: 'Source A', ${targetField}: 'Process 2', ${valueField}: 50 },
    // Source B flows
    { ${sourceField}: 'Source B', ${targetField}: 'Process 1', ${valueField}: 75 },
    { ${sourceField}: 'Source B', ${targetField}: 'Process 2', ${valueField}: 125 },
    // Process outputs
    { ${sourceField}: 'Process 1', ${targetField}: 'Output X', ${valueField}: 80 },
    { ${sourceField}: 'Process 1', ${targetField}: 'Output Y', ${valueField}: 95 },
    { ${sourceField}: 'Process 2', ${targetField}: 'Output Y', ${valueField}: 75 },
    { ${sourceField}: 'Process 2', ${targetField}: 'Output Z', ${valueField}: 100 },
  ],
};

export function SankeyScaffold(): JSX.Element {
  const handleNodeSelect = (node: { name: string }) => {
    console.log('Node selected:', node.name);
  };

  const handleLinkSelect = (link: { source: string; target: string; value: number }) => {
    console.log('Flow selected:', link.source, '->', link.target, ':', link.value);
  };

  return (
    <Sankey
      data={data}
      width={800}
      height={500}
      name="Resource Flow"
      showLabels={true}
      nodeAlign="justify"
      showTable={${showTable}}
      onSelect={handleNodeSelect}
      onLinkSelect={handleLinkSelect}
      description="Sankey diagram showing flow quantities between stages"
    />
  );
}
`;
}

/**
 * Validate scaffold options
 */
export function validateNetworkScaffoldOptions(options: NetworkScaffoldOptions): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for type-specific requirements
  if (options.type === 'force-graph' || options.type === 'sankey') {
    if (!options.sourceField && !options.targetField) {
      warnings.push(`${options.type} typically requires sourceField and targetField for links`);
    }
  }

  if (options.type === 'treemap' || options.type === 'sunburst') {
    if (!options.valueField) {
      warnings.push(`${options.type} works best with a valueField for sizing`);
    }
  }

  return {
    valid: true, // Always valid, warnings are suggestions
    warnings,
  };
}
