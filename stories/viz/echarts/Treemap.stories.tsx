import { useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { HierarchyInput } from '~/src/types/viz/network-flow';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { adaptTreemapToECharts } from '~/src/viz/adapters/echarts/treemap-adapter';

const meta: Meta = {
  title: 'Visualization/ECharts/Treemap',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

type HierarchyStorySpec = NormalizedVizSpec & {
  interaction?: { drilldown?: boolean; zoom?: boolean; breadcrumb?: boolean };
};

const baseSpec: HierarchyStorySpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:hierarchy:treemap',
  name: 'Revenue Breakdown',
  data: { values: [] },
  marks: [{ trait: 'MarkRect' }],
  encoding: {},
  config: { layout: { width: 840, height: 520 } },
  a11y: { description: 'Treemap showing revenue distribution across regions and segments.' },
};

const nestedInput: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Revenue',
    children: [
      {
        name: 'North America',
        value: 320,
        children: [
          { name: 'Enterprise', value: 180 },
          { name: 'Mid-Market', value: 90 },
          { name: 'SMB', value: 50 },
        ],
      },
      {
        name: 'EMEA',
        value: 280,
        children: [
          { name: 'Enterprise', value: 140 },
          { name: 'Mid-Market', value: 90 },
          { name: 'SMB', value: 50 },
        ],
      },
      {
        name: 'APAC',
        value: 260,
        children: [
          { name: 'Enterprise', value: 130 },
          { name: 'Mid-Market', value: 80 },
          { name: 'SMB', value: 50 },
        ],
      },
    ],
  },
};

const adjacencyInput: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 1000, name: 'All Products' },
    { id: 'data', parentId: 'root', value: 420, name: 'Data Platform' },
    { id: 'ai', parentId: 'root', value: 320, name: 'AI Suite' },
    { id: 'infra', parentId: 'root', value: 260, name: 'Infrastructure' },
    { id: 'data-etl', parentId: 'data', value: 180, name: 'ETL' },
    { id: 'data-stream', parentId: 'data', value: 140, name: 'Streaming' },
    { id: 'ai-chat', parentId: 'ai', value: 170, name: 'Chat' },
    { id: 'ai-vision', parentId: 'ai', value: 150, name: 'Vision' },
  ],
};

interface TreemapPreviewProps {
  readonly input: HierarchyInput;
  readonly spec?: HierarchyStorySpec;
  readonly height?: number;
}

function TreemapPreview({ input, spec = baseSpec, height = 520 }: TreemapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(() => adaptTreemapToECharts(spec, input), [input, spec]);

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
        minHeight: 360,
        background: 'var(--sys-surface-canvas, var(--cmp-surface-canvas, transparent))',
      }}
    />
  );
}

export const NestedTreemap: Story = {
  name: 'Nested data',
  render: () => <TreemapPreview input={nestedInput} />,
};

export const AdjacencyTreemap: Story = {
  name: 'Adjacency list with drilldown',
  render: () => (
    <TreemapPreview
      input={adjacencyInput}
      spec={{
        ...baseSpec,
        id: 'stories:hierarchy:treemap:adjacency',
        interaction: { drilldown: true, zoom: true, breadcrumb: true },
      }}
    />
  ),
};
