import type { Meta, StoryObj } from '@storybook/react';

import type { HierarchyInput } from '~/src/types/viz/network-flow';
import { Treemap } from '~/src/components/viz/Treemap';

const meta: Meta<typeof Treemap> = {
  title: 'Visualization/Hierarchical/Treemap',
  component: Treemap,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: { control: { type: 'number', min: 200, max: 1200 } },
    height: { control: { type: 'number', min: 200, max: 800 } },
    drilldown: { control: 'boolean' },
    breadcrumb: { control: 'boolean' },
    zoom: { control: 'boolean' },
    showTable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Treemap>;

const revenueData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Revenue',
    value: 1000,
    children: [
      {
        name: 'North America',
        value: 400,
        children: [
          { name: 'Enterprise', value: 220 },
          { name: 'Mid-Market', value: 120 },
          { name: 'SMB', value: 60 },
        ],
      },
      {
        name: 'EMEA',
        value: 350,
        children: [
          { name: 'Enterprise', value: 180 },
          { name: 'Mid-Market', value: 110 },
          { name: 'SMB', value: 60 },
        ],
      },
      {
        name: 'APAC',
        value: 250,
        children: [
          { name: 'Enterprise', value: 130 },
          { name: 'Mid-Market', value: 80 },
          { name: 'SMB', value: 40 },
        ],
      },
    ],
  },
};

const productData: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 1000, name: 'All Products' },
    { id: 'data', parentId: 'root', value: 420, name: 'Data Platform' },
    { id: 'ai', parentId: 'root', value: 320, name: 'AI Suite' },
    { id: 'infra', parentId: 'root', value: 260, name: 'Infrastructure' },
    { id: 'data-etl', parentId: 'data', value: 180, name: 'ETL Tools' },
    { id: 'data-stream', parentId: 'data', value: 140, name: 'Streaming' },
    { id: 'data-lake', parentId: 'data', value: 100, name: 'Data Lake' },
    { id: 'ai-chat', parentId: 'ai', value: 170, name: 'Chat AI' },
    { id: 'ai-vision', parentId: 'ai', value: 100, name: 'Vision AI' },
    { id: 'ai-nlp', parentId: 'ai', value: 50, name: 'NLP' },
    { id: 'infra-k8s', parentId: 'infra', value: 150, name: 'Kubernetes' },
    { id: 'infra-cloud', parentId: 'infra', value: 110, name: 'Cloud Services' },
  ],
};

export const Default: Story = {
  args: {
    data: revenueData,
    name: 'Revenue by Region',
    width: 700,
    height: 500,
    drilldown: true,
    breadcrumb: true,
    showTable: true,
  },
};

export const ProductBreakdown: Story = {
  args: {
    data: productData,
    name: 'Product Revenue',
    width: 800,
    height: 550,
    drilldown: true,
    breadcrumb: true,
    showTable: true,
  },
};

export const NoBreadcrumb: Story = {
  args: {
    data: revenueData,
    name: 'Revenue (No Breadcrumb)',
    width: 600,
    height: 400,
    breadcrumb: false,
    showTable: false,
  },
};

export const WithZoom: Story = {
  args: {
    data: revenueData,
    name: 'Zoomable Treemap',
    width: 700,
    height: 500,
    zoom: true,
    drilldown: true,
  },
};

export const Interactive: Story = {
  args: {
    data: revenueData,
    name: 'Interactive Treemap',
    width: 700,
    height: 500,
  },
  render: (args) => (
    <Treemap
      {...args}
      onSelect={(node) => {
        console.log('Selected node:', node);
        alert(`Selected: ${node.name} (Value: ${node.value})`);
      }}
      onDrillDown={(path) => {
        console.log('Drilled down to:', path.join(' > '));
      }}
    />
  ),
};
