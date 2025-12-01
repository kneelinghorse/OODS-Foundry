import { describe, expect, it } from 'vitest';
import {
  generateNetworkScaffold,
  validateNetworkScaffoldOptions,
  type NetworkScaffoldOptions,
} from '@/viz/patterns/network-scaffold.js';

describe('network scaffold generation', () => {
  describe('treemap scaffold', () => {
    it('builds treemap scaffold with default fields', () => {
      const output = generateNetworkScaffold({ type: 'treemap' });

      expect(output).toContain('Treemap');
      expect(output).toContain("import { Treemap } from '@/components/viz/Treemap.js'");
      expect(output).toContain('HierarchyInput');
      expect(output).toContain("type: 'nested'");
      expect(output).toContain('name:');
      expect(output).toContain('value:');
      expect(output).toContain('children:');
      expect(output).toContain('handleSelect');
      expect(output).toContain('handleDrillDown');
      expect(output).toContain('description=');
    });

    it('builds treemap with custom field names', () => {
      const output = generateNetworkScaffold({
        type: 'treemap',
        nameField: 'department',
        valueField: 'headcount',
        childrenField: 'subdivisions',
      });

      expect(output).toContain('department:');
      expect(output).toContain('headcount:');
      expect(output).toContain('subdivisions:');
    });

    it('includes adjacency list example', () => {
      const output = generateNetworkScaffold({ type: 'treemap' });

      expect(output).toContain("type: 'adjacency_list'");
      expect(output).toContain('parentId:');
      expect(output).toContain('adjacencyListExample');
    });

    it('respects interactive option', () => {
      const interactive = generateNetworkScaffold({ type: 'treemap', interactive: true });
      const nonInteractive = generateNetworkScaffold({ type: 'treemap', interactive: false });

      expect(interactive).toContain('drilldown={true}');
      expect(nonInteractive).toContain('drilldown={false}');
    });

    it('respects showTable option', () => {
      const withTable = generateNetworkScaffold({ type: 'treemap', showTable: true });
      const withoutTable = generateNetworkScaffold({ type: 'treemap', showTable: false });

      expect(withTable).toContain('showTable={true}');
      expect(withoutTable).toContain('showTable={false}');
    });
  });

  describe('sunburst scaffold', () => {
    it('builds sunburst scaffold with default fields', () => {
      const output = generateNetworkScaffold({ type: 'sunburst' });

      expect(output).toContain('Sunburst');
      expect(output).toContain("import { Sunburst } from '@/components/viz/Sunburst.js'");
      expect(output).toContain('HierarchyInput');
      expect(output).toContain("type: 'nested'");
      expect(output).toContain('width={500}');
      expect(output).toContain('height={500}');
    });

    it('builds sunburst with custom field names', () => {
      const output = generateNetworkScaffold({
        type: 'sunburst',
        nameField: 'category',
        valueField: 'amount',
      });

      expect(output).toContain('category:');
      expect(output).toContain('amount:');
    });
  });

  describe('force-graph scaffold', () => {
    it('builds force-graph scaffold with default fields', () => {
      const output = generateNetworkScaffold({ type: 'force-graph' });

      expect(output).toContain('ForceGraph');
      expect(output).toContain("import { ForceGraph } from '@/components/viz/ForceGraph.js'");
      expect(output).toContain('NetworkInput');
      expect(output).toContain('nodes:');
      expect(output).toContain('links:');
      expect(output).toContain('group:');
      expect(output).toContain('source:');
      expect(output).toContain('target:');
      expect(output).toContain('handleNodeSelect');
      expect(output).toContain('handleLinkSelect');
    });

    it('builds force-graph with custom field names', () => {
      const output = generateNetworkScaffold({
        type: 'force-graph',
        groupField: 'role',
        sourceField: 'from',
        targetField: 'to',
        valueField: 'weight',
      });

      expect(output).toContain('role:');
      expect(output).toContain('from:');
      expect(output).toContain('to:');
      expect(output).toContain('weight:');
      expect(output).toContain("colorField=\"role\"");
    });

    it('respects interactive options', () => {
      const interactive = generateNetworkScaffold({ type: 'force-graph', interactive: true });
      const nonInteractive = generateNetworkScaffold({ type: 'force-graph', interactive: false });

      expect(interactive).toContain('zoom={true}');
      expect(interactive).toContain('draggable={true}');
      expect(nonInteractive).toContain('zoom={false}');
      expect(nonInteractive).toContain('draggable={false}');
    });

    it('includes force layout parameters', () => {
      const output = generateNetworkScaffold({ type: 'force-graph' });

      expect(output).toContain('force={{');
      expect(output).toContain('repulsion:');
      expect(output).toContain('gravity:');
      expect(output).toContain('edgeLength:');
      expect(output).toContain('friction:');
    });
  });

  describe('sankey scaffold', () => {
    it('builds sankey scaffold with default fields', () => {
      const output = generateNetworkScaffold({ type: 'sankey' });

      expect(output).toContain('Sankey');
      expect(output).toContain("import { Sankey } from '@/components/viz/Sankey.js'");
      expect(output).toContain('SankeyInput');
      expect(output).toContain('nodes:');
      expect(output).toContain('links:');
      expect(output).toContain('source:');
      expect(output).toContain('target:');
      expect(output).toContain('value:');
    });

    it('builds sankey with custom field names', () => {
      const output = generateNetworkScaffold({
        type: 'sankey',
        sourceField: 'origin',
        targetField: 'destination',
        valueField: 'flow',
      });

      expect(output).toContain('origin:');
      expect(output).toContain('destination:');
      expect(output).toContain('flow:');
    });

    it('includes nodeAlign option', () => {
      const output = generateNetworkScaffold({ type: 'sankey' });

      expect(output).toContain('nodeAlign="justify"');
    });

    it('includes multiple flow stages', () => {
      const output = generateNetworkScaffold({ type: 'sankey' });

      // Should have sources, processes, and outputs
      expect(output).toContain('Source A');
      expect(output).toContain('Process 1');
      expect(output).toContain('Output X');
    });
  });
});

describe('validateNetworkScaffoldOptions', () => {
  it('returns valid for any type', () => {
    const types: NetworkScaffoldOptions['type'][] = ['treemap', 'sunburst', 'force-graph', 'sankey'];

    for (const type of types) {
      const result = validateNetworkScaffoldOptions({ type });
      expect(result.valid).toBe(true);
    }
  });

  it('warns when force-graph missing source/target fields', () => {
    const result = validateNetworkScaffoldOptions({ type: 'force-graph' });

    expect(result.warnings).toContain('force-graph typically requires sourceField and targetField for links');
  });

  it('warns when sankey missing source/target fields', () => {
    const result = validateNetworkScaffoldOptions({ type: 'sankey' });

    expect(result.warnings).toContain('sankey typically requires sourceField and targetField for links');
  });

  it('no warning when source/target provided for network types', () => {
    const result = validateNetworkScaffoldOptions({
      type: 'force-graph',
      sourceField: 'from',
      targetField: 'to',
    });

    expect(result.warnings).not.toContain('force-graph typically requires sourceField and targetField for links');
  });

  it('warns when hierarchy types missing valueField', () => {
    const treemapResult = validateNetworkScaffoldOptions({ type: 'treemap' });
    const sunburstResult = validateNetworkScaffoldOptions({ type: 'sunburst' });

    expect(treemapResult.warnings).toContain('treemap works best with a valueField for sizing');
    expect(sunburstResult.warnings).toContain('sunburst works best with a valueField for sizing');
  });

  it('no warning when valueField provided for hierarchy types', () => {
    const result = validateNetworkScaffoldOptions({
      type: 'treemap',
      valueField: 'size',
    });

    expect(result.warnings).not.toContain('treemap works best with a valueField for sizing');
  });
});

describe('scaffold type normalization', () => {
  it('generates correct scaffold for each type', () => {
    const treemapOutput = generateNetworkScaffold({ type: 'treemap' });
    const sunburstOutput = generateNetworkScaffold({ type: 'sunburst' });
    const graphOutput = generateNetworkScaffold({ type: 'force-graph' });
    const sankeyOutput = generateNetworkScaffold({ type: 'sankey' });

    // Each should have distinct component imports
    expect(treemapOutput).toContain('Treemap');
    expect(treemapOutput).not.toContain('Sunburst');

    expect(sunburstOutput).toContain('Sunburst');
    expect(sunburstOutput).not.toContain('Treemap');

    expect(graphOutput).toContain('ForceGraph');
    expect(graphOutput).not.toContain('Sankey');

    expect(sankeyOutput).toContain('Sankey');
    expect(sankeyOutput).not.toContain('ForceGraph');
  });
});

describe('scaffold accessibility', () => {
  it('includes description prop for all types', () => {
    const types: NetworkScaffoldOptions['type'][] = ['treemap', 'sunburst', 'force-graph', 'sankey'];

    for (const type of types) {
      const output = generateNetworkScaffold({ type });
      expect(output).toContain('description=');
    }
  });

  it('includes showTable prop for all types', () => {
    const types: NetworkScaffoldOptions['type'][] = ['treemap', 'sunburst', 'force-graph', 'sankey'];

    for (const type of types) {
      const output = generateNetworkScaffold({ type, showTable: true });
      expect(output).toContain('showTable={true}');
    }
  });
});
