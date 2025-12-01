import { useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { HierarchyInput } from '~/src/types/viz/network-flow';
import type { NormalizedVizSpec } from '~/src/viz/spec/normalized-viz-spec';
import { adaptSunburstToECharts } from '~/src/viz/adapters/echarts/sunburst-adapter';

const meta: Meta = {
  title: 'Visualization/ECharts/Sunburst',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

type HierarchyStorySpec = NormalizedVizSpec & {
  interaction?: { drilldown?: boolean; zoom?: boolean; breadcrumb?: boolean };
};

const baseSpec: HierarchyStorySpec = {
  $schema: 'https://oods.dev/viz-spec/v1',
  id: 'stories:hierarchy:sunburst',
  name: 'Product Portfolio',
  data: { values: [] },
  marks: [{ trait: 'MarkRect' }],
  encoding: {},
  config: { layout: { width: 720, height: 720 } },
  a11y: { description: 'Sunburst chart showing product portfolio allocation.' },
};

const nestedInput: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Products',
    children: [
      {
        name: 'Cloud',
        children: [
          { name: 'Compute', value: 120 },
          { name: 'Storage', value: 90 },
          { name: 'Networking', value: 70 },
        ],
      },
      {
        name: 'Data',
        children: [
          { name: 'Warehouse', value: 80 },
          { name: 'Streaming', value: 60 },
          { name: 'ML', value: 110 },
        ],
      },
      {
        name: 'Services',
        children: [
          { name: 'Support', value: 45 },
          { name: 'Consulting', value: 55 },
        ],
      },
    ],
  },
};

const adjacencyInput: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 100, name: 'Root' },
    { id: 'alpha', parentId: 'root', value: 35, name: 'Alpha' },
    { id: 'beta', parentId: 'root', value: 25, name: 'Beta' },
    { id: 'gamma', parentId: 'root', value: 40, name: 'Gamma' },
    { id: 'alpha-a', parentId: 'alpha', value: 15, name: 'Alpha A' },
    { id: 'alpha-b', parentId: 'alpha', value: 20, name: 'Alpha B' },
    { id: 'gamma-a', parentId: 'gamma', value: 25, name: 'Gamma A' },
    { id: 'gamma-b', parentId: 'gamma', value: 15, name: 'Gamma B' },
  ],
};

interface SunburstPreviewProps {
  readonly input: HierarchyInput;
  readonly spec?: HierarchyStorySpec;
  readonly height?: number;
}

function SunburstPreview({ input, spec = baseSpec, height = 640 }: SunburstPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(() => adaptSunburstToECharts(spec, input), [input, spec]);

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

export const NestedSunburst: Story = {
  name: 'Nested data',
  render: () => <SunburstPreview input={nestedInput} />,
};

export const AdjacencySunburst: Story = {
  name: 'Adjacency list',
  render: () => (
    <SunburstPreview
      input={adjacencyInput}
      spec={{
        ...baseSpec,
        id: 'stories:hierarchy:sunburst:adjacency',
      }}
    />
  ),
};
