import { useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { NetworkInput } from '~/src/types/viz/network-flow';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { adaptGraphToECharts } from '~/src/viz/adapters/echarts/graph-adapter';

const meta: Meta = {
  title: 'Visualization/ECharts/Graph',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

type GraphStorySpec = NormalizedVizSpec & {
  interaction?: { zoom?: boolean; drag?: boolean };
  encoding?: NormalizedVizSpec['encoding'] & {
    size?: { field?: string; base?: number; max?: number };
    linkWidth?: { field?: string; base?: number; max?: number };
    label?: { show?: boolean };
    edgeLabel?: { show?: boolean };
  };
  layout?: {
    force?: {
      repulsion?: number;
      gravity?: number;
      edgeLength?: number;
      friction?: number;
    };
  };
  legend?: { show?: boolean };
};

const baseSpec: GraphStorySpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:graph:basic',
  name: 'Network Graph',
  data: { values: [] },
  marks: [{ trait: 'MarkPoint' }],
  encoding: {},
  config: { layout: { width: 800, height: 600 } },
  a11y: { description: 'Force-directed network graph visualization.' },
};

// Basic 10-node network
const basicInput: NetworkInput = {
  nodes: [
    { id: 'A', group: 'core' },
    { id: 'B', group: 'core' },
    { id: 'C', group: 'edge' },
    { id: 'D', group: 'edge' },
    { id: 'E', group: 'edge' },
    { id: 'F', group: 'leaf' },
    { id: 'G', group: 'leaf' },
    { id: 'H', group: 'leaf' },
    { id: 'I', group: 'leaf' },
    { id: 'J', group: 'leaf' },
  ],
  links: [
    { source: 'A', target: 'B' },
    { source: 'A', target: 'C' },
    { source: 'A', target: 'D' },
    { source: 'B', target: 'C' },
    { source: 'B', target: 'E' },
    { source: 'C', target: 'F' },
    { source: 'C', target: 'G' },
    { source: 'D', target: 'H' },
    { source: 'E', target: 'I' },
    { source: 'E', target: 'J' },
  ],
};

// Categorized network with named nodes
const categorizedInput: NetworkInput = {
  nodes: [
    { id: 'server1', name: 'Web Server 1', group: 'servers' },
    { id: 'server2', name: 'Web Server 2', group: 'servers' },
    { id: 'db1', name: 'Primary DB', group: 'databases' },
    { id: 'db2', name: 'Replica DB', group: 'databases' },
    { id: 'cache1', name: 'Redis Cache', group: 'cache' },
    { id: 'client1', name: 'Client App 1', group: 'clients' },
    { id: 'client2', name: 'Client App 2', group: 'clients' },
    { id: 'client3', name: 'Client App 3', group: 'clients' },
  ],
  links: [
    { source: 'client1', target: 'server1' },
    { source: 'client2', target: 'server1' },
    { source: 'client3', target: 'server2' },
    { source: 'server1', target: 'cache1' },
    { source: 'server2', target: 'cache1' },
    { source: 'server1', target: 'db1' },
    { source: 'server2', target: 'db1' },
    { source: 'db1', target: 'db2' },
  ],
};

// Network with sized nodes (value encoding)
const sizedInput: NetworkInput = {
  nodes: [
    { id: 'hub', name: 'Central Hub', value: 100, group: 'hub' },
    { id: 'n1', name: 'Node 1', value: 40, group: 'medium' },
    { id: 'n2', name: 'Node 2', value: 60, group: 'medium' },
    { id: 'n3', name: 'Node 3', value: 25, group: 'small' },
    { id: 'n4', name: 'Node 4', value: 15, group: 'small' },
    { id: 'n5', name: 'Node 5', value: 10, group: 'small' },
  ],
  links: [
    { source: 'hub', target: 'n1' },
    { source: 'hub', target: 'n2' },
    { source: 'hub', target: 'n3' },
    { source: 'n1', target: 'n4' },
    { source: 'n2', target: 'n5' },
  ],
};

// Network with sized edges
const sizedEdgesInput: NetworkInput = {
  nodes: [
    { id: 'source', name: 'Data Source', group: 'source' },
    { id: 'proc1', name: 'Processor 1', group: 'processor' },
    { id: 'proc2', name: 'Processor 2', group: 'processor' },
    { id: 'sink', name: 'Data Sink', group: 'sink' },
  ],
  links: [
    { source: 'source', target: 'proc1', value: 100 },
    { source: 'source', target: 'proc2', value: 50 },
    { source: 'proc1', target: 'sink', value: 80 },
    { source: 'proc2', target: 'sink', value: 40 },
  ],
};

// Large network (100+ nodes)
function generateLargeNetwork(): NetworkInput {
  const nodes: NetworkInput['nodes'] = [];
  const links: NetworkInput['links'] = [];
  const groups = ['cluster-a', 'cluster-b', 'cluster-c', 'cluster-d', 'cluster-e'];

  for (let i = 0; i < 100; i++) {
    nodes.push({
      id: `node-${i}`,
      name: `Node ${i}`,
      group: groups[i % groups.length],
      value: Math.random() * 50 + 10,
    });
  }

  // Create clustered connections
  for (let i = 0; i < 100; i++) {
    // Connect within cluster
    const clusterStart = Math.floor(i / 20) * 20;
    const inClusterTarget = clusterStart + Math.floor(Math.random() * 20);
    if (inClusterTarget !== i && inClusterTarget < 100) {
      links.push({
        source: `node-${i}`,
        target: `node-${inClusterTarget}`,
        value: Math.random() * 10 + 1,
      });
    }

    // Some cross-cluster connections
    if (Math.random() < 0.1) {
      const crossTarget = Math.floor(Math.random() * 100);
      if (crossTarget !== i) {
        links.push({
          source: `node-${i}`,
          target: `node-${crossTarget}`,
          value: Math.random() * 5 + 1,
        });
      }
    }
  }

  return { nodes, links };
}

const largeInput = generateLargeNetwork();

// Network with fixed nodes
const fixedNodesInput: NetworkInput = {
  nodes: [
    { id: 'center', name: 'Fixed Center', fixed: true, x: 400, y: 300, group: 'fixed' },
    { id: 'left', name: 'Fixed Left', fixed: true, x: 150, y: 300, group: 'fixed' },
    { id: 'right', name: 'Fixed Right', fixed: true, x: 650, y: 300, group: 'fixed' },
    { id: 'free1', name: 'Free Node 1', group: 'free' },
    { id: 'free2', name: 'Free Node 2', group: 'free' },
    { id: 'free3', name: 'Free Node 3', group: 'free' },
    { id: 'free4', name: 'Free Node 4', group: 'free' },
  ],
  links: [
    { source: 'center', target: 'left' },
    { source: 'center', target: 'right' },
    { source: 'left', target: 'free1' },
    { source: 'left', target: 'free2' },
    { source: 'right', target: 'free3' },
    { source: 'right', target: 'free4' },
    { source: 'free1', target: 'free3' },
    { source: 'free2', target: 'free4' },
  ],
};

interface GraphPreviewProps {
  readonly input: NetworkInput;
  readonly spec?: GraphStorySpec;
  readonly height?: number;
}

function GraphPreview({ input, spec = baseSpec, height = 600 }: GraphPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(() => adaptGraphToECharts(spec, input), [input, spec]);

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

export const BasicForceGraph: Story = {
  name: 'Basic force graph (10 nodes)',
  render: () => <GraphPreview input={basicInput} />,
};

export const CategorizedGraph: Story = {
  name: 'Categorized graph with legend',
  render: () => (
    <GraphPreview
      input={categorizedInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:categorized',
        name: 'Server Architecture',
        a11y: { description: 'Server architecture showing clients, servers, databases, and cache.' },
      }}
    />
  ),
};

export const SizedNodes: Story = {
  name: 'Graph with sized nodes (value encoding)',
  render: () => (
    <GraphPreview
      input={sizedInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:sized-nodes',
        name: 'Weighted Network',
        encoding: {
          size: { field: 'value', base: 10, max: 40 },
        },
        a11y: { description: 'Network graph where node size represents value.' },
      }}
    />
  ),
};

export const SizedEdges: Story = {
  name: 'Graph with sized edges',
  render: () => (
    <GraphPreview
      input={sizedEdgesInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:sized-edges',
        name: 'Data Flow',
        encoding: {
          linkWidth: { field: 'value', base: 1, max: 8 },
          edgeLabel: { show: true },
        },
        a11y: { description: 'Data flow graph where edge width represents throughput.' },
      }}
    />
  ),
};

export const LargeGraph: Story = {
  name: 'Large graph (100+ nodes)',
  render: () => (
    <GraphPreview
      input={largeInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:large',
        name: 'Large Network',
        encoding: {
          size: { field: 'value', base: 6, max: 20 },
          label: { show: false },
        },
        layout: {
          force: {
            repulsion: 150,
            gravity: 0.15,
            friction: 0.7,
          },
        },
        a11y: { description: 'Large network visualization with 100+ nodes in clustered layout.' },
      }}
      height={700}
    />
  ),
};

export const FixedNodes: Story = {
  name: 'Graph with fixed nodes',
  render: () => (
    <GraphPreview
      input={fixedNodesInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:fixed-nodes',
        name: 'Fixed Layout',
        a11y: { description: 'Graph with some nodes fixed in position while others move freely.' },
      }}
    />
  ),
};

export const CustomForceParameters: Story = {
  name: 'Graph with custom force parameters',
  render: () => (
    <GraphPreview
      input={basicInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:custom-force',
        name: 'Custom Force Layout',
        layout: {
          force: {
            repulsion: 300,
            gravity: 0.05,
            edgeLength: 80,
            friction: 0.4,
          },
        },
        a11y: { description: 'Graph with custom force parameters for wider spread.' },
      }}
    />
  ),
};

export const NoLabels: Story = {
  name: 'Graph without labels',
  render: () => (
    <GraphPreview
      input={categorizedInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:no-labels',
        name: 'Clean Network',
        encoding: {
          label: { show: false },
        },
        a11y: { description: 'Network graph with labels hidden for a cleaner appearance.' },
      }}
    />
  ),
};

export const NoZoom: Story = {
  name: 'Graph with zoom disabled',
  render: () => (
    <GraphPreview
      input={basicInput}
      spec={{
        ...baseSpec,
        id: 'stories:graph:no-zoom',
        name: 'Fixed View Graph',
        interaction: {
          zoom: false,
          drag: true,
        },
        a11y: { description: 'Graph with zoom/pan disabled but node dragging enabled.' },
      }}
    />
  ),
};
