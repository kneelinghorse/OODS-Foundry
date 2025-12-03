import { useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { SankeyInput } from '~/src/types/viz/network-flow';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { adaptSankeyToECharts } from '~/src/viz/adapters/echarts/sankey-adapter';

const meta: Meta = {
  title: 'Visualization/ECharts/Sankey',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

type SankeyStorySpec = NormalizedVizSpec & {
  layout?: {
    orientation?: 'horizontal' | 'vertical';
    nodeAlign?: 'justify' | 'left' | 'right';
    nodeWidth?: number;
    nodeGap?: number;
    iterations?: number;
  };
  encoding?: NormalizedVizSpec['encoding'] & {
    link?: { color?: 'gradient' | 'source' | 'target' | string };
    label?: { show?: boolean };
  };
};

const baseSpec: SankeyStorySpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:sankey:basic',
  name: 'Sankey Diagram',
  data: { values: [] },
  marks: [{ trait: 'MarkSankey' }],
  encoding: {},
  config: { layout: { width: 900, height: 500 } },
  a11y: { description: 'Sankey flow diagram visualization.' },
};

// Classic energy flow example (common in Sankey diagrams)
const energyFlowInput: SankeyInput = {
  nodes: [
    { name: 'Coal' },
    { name: 'Natural Gas' },
    { name: 'Nuclear' },
    { name: 'Renewables' },
    { name: 'Electricity Generation' },
    { name: 'Heat Production' },
    { name: 'Losses' },
    { name: 'Residential' },
    { name: 'Commercial' },
    { name: 'Industrial' },
    { name: 'Transportation' },
  ],
  links: [
    // Primary energy sources to conversion
    { source: 'Coal', target: 'Electricity Generation', value: 250 },
    { source: 'Coal', target: 'Heat Production', value: 50 },
    { source: 'Natural Gas', target: 'Electricity Generation', value: 180 },
    { source: 'Natural Gas', target: 'Heat Production', value: 120 },
    { source: 'Nuclear', target: 'Electricity Generation', value: 200 },
    { source: 'Renewables', target: 'Electricity Generation', value: 100 },

    // Electricity distribution
    { source: 'Electricity Generation', target: 'Losses', value: 150 },
    { source: 'Electricity Generation', target: 'Residential', value: 200 },
    { source: 'Electricity Generation', target: 'Commercial', value: 180 },
    { source: 'Electricity Generation', target: 'Industrial', value: 120 },
    { source: 'Electricity Generation', target: 'Transportation', value: 80 },

    // Heat distribution
    { source: 'Heat Production', target: 'Residential', value: 80 },
    { source: 'Heat Production', target: 'Industrial', value: 70 },
    { source: 'Heat Production', target: 'Losses', value: 20 },
  ],
};

// Data designed to show nodeAlign differences clearly
// Has paths of different lengths: some nodes terminate early, others continue further
// Left-align: terminal nodes stay at their natural depth (not pushed right)
// Right-align: source nodes start at their natural depth (not pushed left)
// Justify: spreads everything across full width
const alignmentDemoInput: SankeyInput = {
  nodes: [
    // Sources (level 0)
    { name: 'Source A' },
    { name: 'Source B' },
    { name: 'Source C' },
    // Processing (level 1)
    { name: 'Process 1' },
    { name: 'Process 2' },
    // Distribution (level 2)
    { name: 'Distribute' },
    // Final consumers (level 3)
    { name: 'Consumer X' },
    { name: 'Consumer Y' },
    // Early terminal node (ends at level 1) - key for showing alignment diff
    { name: 'Direct Use' },
    // Another early terminal (ends at level 2)
    { name: 'Storage' },
  ],
  links: [
    // Source A flows through full pipeline (4 levels)
    { source: 'Source A', target: 'Process 1', value: 100 },
    { source: 'Process 1', target: 'Distribute', value: 80 },
    { source: 'Distribute', target: 'Consumer X', value: 50 },
    { source: 'Distribute', target: 'Consumer Y', value: 30 },

    // Source B goes to Process 2, but some ends at Storage (3 levels)
    { source: 'Source B', target: 'Process 2', value: 120 },
    { source: 'Process 2', target: 'Distribute', value: 70 },
    { source: 'Process 2', target: 'Storage', value: 50 },

    // Source C goes DIRECTLY to consumers (bypasses processing - only 2 levels)
    { source: 'Source C', target: 'Direct Use', value: 80 },

    // Some Process 1 goes to Direct Use too
    { source: 'Process 1', target: 'Direct Use', value: 20 },
  ],
};

// Simple budget allocation flow
const budgetInput: SankeyInput = {
  nodes: [
    { name: 'Revenue' },
    { name: 'Operations' },
    { name: 'R&D' },
    { name: 'Marketing' },
    { name: 'Salaries' },
    { name: 'Infrastructure' },
    { name: 'Campaigns' },
    { name: 'Research' },
    { name: 'Development' },
  ],
  links: [
    { source: 'Revenue', target: 'Operations', value: 400 },
    { source: 'Revenue', target: 'R&D', value: 300 },
    { source: 'Revenue', target: 'Marketing', value: 200 },
    { source: 'Operations', target: 'Salaries', value: 250 },
    { source: 'Operations', target: 'Infrastructure', value: 150 },
    { source: 'Marketing', target: 'Campaigns', value: 150 },
    { source: 'Marketing', target: 'Salaries', value: 50 },
    { source: 'R&D', target: 'Research', value: 120 },
    { source: 'R&D', target: 'Development', value: 180 },
  ],
};

// Multi-level supply chain
const supplyChainInput: SankeyInput = {
  nodes: [
    { name: 'Supplier A' },
    { name: 'Supplier B' },
    { name: 'Supplier C' },
    { name: 'Factory 1' },
    { name: 'Factory 2' },
    { name: 'Warehouse East' },
    { name: 'Warehouse West' },
    { name: 'Retail North' },
    { name: 'Retail South' },
    { name: 'E-commerce' },
  ],
  links: [
    { source: 'Supplier A', target: 'Factory 1', value: 500 },
    { source: 'Supplier A', target: 'Factory 2', value: 300 },
    { source: 'Supplier B', target: 'Factory 1', value: 400 },
    { source: 'Supplier C', target: 'Factory 2', value: 600 },
    { source: 'Factory 1', target: 'Warehouse East', value: 600 },
    { source: 'Factory 1', target: 'Warehouse West', value: 300 },
    { source: 'Factory 2', target: 'Warehouse East', value: 400 },
    { source: 'Factory 2', target: 'Warehouse West', value: 500 },
    { source: 'Warehouse East', target: 'Retail North', value: 500 },
    { source: 'Warehouse East', target: 'E-commerce', value: 500 },
    { source: 'Warehouse West', target: 'Retail South', value: 400 },
    { source: 'Warehouse West', target: 'E-commerce', value: 400 },
  ],
};

// Generate large Sankey (50+ nodes)
function generateLargeSankey(): SankeyInput {
  const nodes: SankeyInput['nodes'] = [];
  const links: SankeyInput['links'] = [];

  // 5 stages with 10 nodes each = 50 nodes
  const stages = ['Raw', 'Process', 'Manufacture', 'Distribute', 'Consume'];

  for (let stage = 0; stage < stages.length; stage++) {
    for (let i = 0; i < 10; i++) {
      nodes.push({ name: `${stages[stage]}-${i + 1}` });
    }
  }

  // Connect each stage to the next
  for (let stage = 0; stage < stages.length - 1; stage++) {
    for (let i = 0; i < 10; i++) {
      const source = `${stages[stage]}-${i + 1}`;
      // Connect to 2-3 nodes in next stage
      const targets = [
        `${stages[stage + 1]}-${(i % 10) + 1}`,
        `${stages[stage + 1]}-${((i + 1) % 10) + 1}`,
      ];

      for (const target of targets) {
        links.push({
          source,
          target,
          value: Math.floor(Math.random() * 50) + 20,
        });
      }
    }
  }

  return { nodes, links };
}

const largeSankeyInput = generateLargeSankey();

// Custom colored nodes
const coloredNodesInput: SankeyInput = {
  nodes: [
    { name: 'Input', color: '#3498db' },
    { name: 'Process A', color: '#2ecc71' },
    { name: 'Process B', color: '#f1c40f' },
    { name: 'Output', color: '#e74c3c' },
  ],
  links: [
    { source: 'Input', target: 'Process A', value: 60 },
    { source: 'Input', target: 'Process B', value: 40 },
    { source: 'Process A', target: 'Output', value: 60 },
    { source: 'Process B', target: 'Output', value: 40 },
  ],
};

interface SankeyPreviewProps {
  readonly input: SankeyInput;
  readonly spec?: SankeyStorySpec;
  readonly height?: number;
}

function SankeyPreview({ input, spec = baseSpec, height = 500 }: SankeyPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(() => adaptSankeyToECharts(spec, input), [input, spec]);

  useEffect(() => {
    let instance: unknown;

    const render = async () => {
      if (!containerRef.current) {
        return;
      }
      const echarts = await import('echarts');
      instance = echarts.init(containerRef.current, undefined, { useDirtyRect: true });
      (instance as { setOption: (opt: unknown) => void }).setOption(option);
    };

    render();
    return () => {
      if (instance && typeof (instance as { dispose?: () => void }).dispose === 'function') {
        (instance as { dispose: () => void }).dispose();
      }
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        minHeight: 400,
        background: 'var(--sys-surface-canvas, var(--cmp-surface-canvas, transparent))',
      }}
    />
  );
}

export const BasicEnergyFlow: Story = {
  name: 'Basic energy flow (classic example)',
  render: () => (
    <SankeyPreview
      input={energyFlowInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:energy',
        name: 'Energy Flow Diagram',
        a11y: { description: 'Energy flow from sources through conversion to end uses.' },
      }}
      height={550}
    />
  ),
};

export const BudgetAllocation: Story = {
  name: 'Budget allocation flow',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:budget',
        name: 'Budget Allocation',
        a11y: { description: 'Company budget allocation across departments.' },
      }}
    />
  ),
};

export const VerticalSankey: Story = {
  name: 'Vertical Sankey',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:vertical',
        name: 'Vertical Budget Flow',
        layout: { orientation: 'vertical' },
        a11y: { description: 'Budget flow in vertical orientation.' },
      }}
      height={600}
    />
  ),
};

export const MultiLevelSupplyChain: Story = {
  name: 'Multi-level Sankey (supply chain)',
  render: () => (
    <SankeyPreview
      input={supplyChainInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:supply-chain',
        name: 'Supply Chain Flow',
        a11y: { description: 'Supply chain from suppliers through factories to retail.' },
      }}
      height={550}
    />
  ),
};

export const GradientLinks: Story = {
  name: 'Sankey with gradient links (default)',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:gradient',
        name: 'Gradient Link Sankey',
        encoding: { link: { color: 'gradient' } },
        a11y: { description: 'Sankey with gradient-colored links between nodes.' },
      }}
    />
  ),
};

export const SourceColorLinks: Story = {
  name: 'Sankey with source-colored links',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:source-color',
        name: 'Source-Colored Links',
        encoding: { link: { color: 'source' } },
        a11y: { description: 'Sankey with links colored by source node.' },
      }}
    />
  ),
};

export const TargetColorLinks: Story = {
  name: 'Sankey with target-colored links',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:target-color',
        name: 'Target-Colored Links',
        encoding: { link: { color: 'target' } },
        a11y: { description: 'Sankey with links colored by target node.' },
      }}
    />
  ),
};

export const SolidColorLinks: Story = {
  name: 'Sankey with solid color links',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:solid-links',
        name: 'Solid Color Links',
        encoding: { link: { color: '#7f8c8d' } },
        a11y: { description: 'Sankey with solid gray links.' },
      }}
    />
  ),
};

export const LargeSankey: Story = {
  name: 'Large Sankey (50+ nodes)',
  render: () => (
    <SankeyPreview
      input={largeSankeyInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:large',
        name: 'Large Production Flow',
        encoding: { label: { show: false } },
        a11y: { description: 'Large Sankey with 50+ nodes across 5 stages.' },
      }}
      height={700}
    />
  ),
};

export const CustomNodeColors: Story = {
  name: 'Sankey with custom node colors',
  render: () => (
    <SankeyPreview
      input={coloredNodesInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:custom-colors',
        name: 'Custom Colored Nodes',
        a11y: { description: 'Sankey with custom colors for each node.' },
      }}
    />
  ),
};

export const LeftAligned: Story = {
  name: 'Left-aligned nodes',
  render: () => (
    <SankeyPreview
      input={alignmentDemoInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:left-align',
        name: 'Left-Aligned Sankey',
        layout: { nodeAlign: 'left' },
        a11y: { description: 'Sankey with nodes aligned to the left. Notice how "Direct Use" and "Storage" appear at their natural depth (not pushed to the right edge). Compare with Justify-aligned to see the difference.' },
      }}
      height={450}
    />
  ),
};

export const RightAligned: Story = {
  name: 'Right-aligned nodes',
  render: () => (
    <SankeyPreview
      input={alignmentDemoInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:right-align',
        name: 'Right-Aligned Sankey',
        layout: { nodeAlign: 'right' },
        a11y: { description: 'Sankey with nodes aligned to the right. Notice how "Source C" is NOT at the left edge - it starts at its natural depth relative to other sources. Compare with Justify-aligned.' },
      }}
      height={450}
    />
  ),
};

export const JustifyAligned: Story = {
  name: 'Justify-aligned nodes (default)',
  render: () => (
    <SankeyPreview
      input={alignmentDemoInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:justify-align',
        name: 'Justify-Aligned Sankey',
        layout: { nodeAlign: 'justify' },
        a11y: { description: 'Sankey with nodes justified across full width. All sources are pushed to the left edge, all sinks to the right edge, regardless of actual path length. This is the default ECharts behavior.' },
      }}
      height={450}
    />
  ),
};

export const WideNodes: Story = {
  name: 'Wide nodes (40px width, 20px gap)',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:wide-nodes',
        name: 'Wide Node Sankey',
        layout: { nodeWidth: 40, nodeGap: 20 },
        a11y: { description: 'Sankey with wider nodes (40px vs default 20px) and larger gaps (20px vs default 8px). Compare with standard stories to see the difference.' },
      }}
    />
  ),
};

export const NarrowNodes: Story = {
  name: 'Narrow nodes (10px width, 4px gap)',
  render: () => (
    <SankeyPreview
      input={budgetInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:narrow-nodes',
        name: 'Narrow Node Sankey',
        layout: { nodeWidth: 10, nodeGap: 4 },
        a11y: { description: 'Sankey with narrower nodes (10px vs default 20px) and smaller gaps (4px vs default 8px). Creates a more compact, data-dense visualization.' },
      }}
    />
  ),
};

export const NoLabels: Story = {
  name: 'Sankey without labels',
  render: () => (
    <SankeyPreview
      input={energyFlowInput}
      spec={{
        ...baseSpec,
        id: 'stories:sankey:no-labels',
        name: 'Minimal Sankey',
        encoding: { label: { show: false } },
        a11y: { description: 'Sankey with labels hidden.' },
      }}
    />
  ),
};
