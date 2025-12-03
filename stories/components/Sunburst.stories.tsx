import type { Meta, StoryObj } from '@storybook/react';

import type { HierarchyInput } from '~/src/types/viz/network-flow';
import { Sunburst } from '~/src/components/viz/Sunburst';

const meta: Meta<typeof Sunburst> = {
  title: 'Visualization/Hierarchical/Sunburst',
  component: Sunburst,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: { control: { type: 'number', min: 300, max: 800 } },
    height: { control: { type: 'number', min: 300, max: 800 } },
    drilldown: { control: 'boolean' },
    showTable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Sunburst>;

const budgetData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Budget 2024',
    value: 10000,
    children: [
      {
        name: 'Operations',
        value: 4500,
        children: [
          { name: 'Salaries', value: 2800 },
          { name: 'Infrastructure', value: 1200 },
          { name: 'Utilities', value: 500 },
        ],
      },
      {
        name: 'Marketing',
        value: 2500,
        children: [
          { name: 'Digital', value: 1200 },
          { name: 'Events', value: 800 },
          { name: 'Print', value: 500 },
        ],
      },
      {
        name: 'R&D',
        value: 2000,
        children: [
          { name: 'Engineering', value: 1200 },
          { name: 'Research', value: 500 },
          { name: 'Prototyping', value: 300 },
        ],
      },
      {
        name: 'Admin',
        value: 1000,
        children: [
          { name: 'Legal', value: 400 },
          { name: 'HR', value: 350 },
          { name: 'Finance', value: 250 },
        ],
      },
    ],
  },
};

const diskUsageData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Disk Usage',
    value: 500,
    children: [
      {
        name: 'System',
        value: 120,
        children: [
          { name: 'OS', value: 80 },
          { name: 'Apps', value: 30 },
          { name: 'Cache', value: 10 },
        ],
      },
      {
        name: 'User Data',
        value: 280,
        children: [
          { name: 'Documents', value: 100 },
          { name: 'Photos', value: 80 },
          { name: 'Videos', value: 60 },
          { name: 'Music', value: 40 },
        ],
      },
      {
        name: 'Downloads',
        value: 100,
        children: [
          { name: 'Archives', value: 50 },
          { name: 'Installers', value: 30 },
          { name: 'Other', value: 20 },
        ],
      },
    ],
  },
};

export const Default: Story = {
  args: {
    data: budgetData,
    name: 'Budget Allocation',
    width: 550,
    height: 550,
    drilldown: true,
    showTable: true,
  },
};

export const DiskUsage: Story = {
  args: {
    data: diskUsageData,
    name: 'Disk Usage (GB)',
    width: 500,
    height: 500,
    showTable: true,
  },
};

export const LargeChart: Story = {
  args: {
    data: budgetData,
    name: 'Large Sunburst',
    width: 700,
    height: 700,
    drilldown: true,
    showTable: false,
  },
};

export const NoTable: Story = {
  args: {
    data: budgetData,
    name: 'Sunburst (Visual Only)',
    width: 500,
    height: 500,
    showTable: false,
  },
};

export const Interactive: Story = {
  args: {
    data: budgetData,
    name: 'Interactive Sunburst',
    width: 550,
    height: 550,
  },
  render: (args) => (
    <Sunburst
      {...args}
      onSelect={(node) => {
        console.log('Selected segment:', node);
        alert(`Selected: ${node.name}\nValue: ${node.value}\nPath: ${node.path.join(' > ')}`);
      }}
    />
  ),
};
