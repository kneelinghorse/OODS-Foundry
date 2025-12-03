import type { Meta, StoryObj } from '@storybook/react';

import type { NetworkInput } from '~/src/types/viz/network-flow';
import { ForceGraph } from '~/src/components/viz/ForceGraph';

const meta: Meta<typeof ForceGraph> = {
  title: 'Visualization/Network/ForceGraph',
  component: ForceGraph,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: { control: { type: 'number', min: 400, max: 1200 } },
    height: { control: { type: 'number', min: 300, max: 900 } },
    zoom: { control: 'boolean' },
    draggable: { control: 'boolean' },
    showLabels: { control: 'boolean' },
    showEdgeLabels: { control: 'boolean' },
    showLegend: { control: 'boolean' },
    showTable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ForceGraph>;

const socialNetworkData: NetworkInput = {
  nodes: [
    { id: 'alice', group: 'engineering' },
    { id: 'bob', group: 'engineering' },
    { id: 'charlie', group: 'engineering' },
    { id: 'diana', group: 'design' },
    { id: 'eve', group: 'design' },
    { id: 'frank', group: 'product' },
    { id: 'grace', group: 'product' },
    { id: 'henry', group: 'marketing' },
  ],
  links: [
    { source: 'alice', target: 'bob', value: 10 },
    { source: 'alice', target: 'charlie', value: 8 },
    { source: 'bob', target: 'charlie', value: 12 },
    { source: 'alice', target: 'diana', value: 5 },
    { source: 'diana', target: 'eve', value: 15 },
    { source: 'diana', target: 'frank', value: 6 },
    { source: 'frank', target: 'grace', value: 9 },
    { source: 'grace', target: 'henry', value: 7 },
    { source: 'frank', target: 'henry', value: 4 },
    { source: 'charlie', target: 'frank', value: 3 },
  ],
};

const serviceArchitectureData: NetworkInput = {
  nodes: [
    { id: 'gateway', group: 'infrastructure' },
    { id: 'auth', group: 'core' },
    { id: 'users', group: 'core' },
    { id: 'orders', group: 'business' },
    { id: 'payments', group: 'business' },
    { id: 'inventory', group: 'business' },
    { id: 'notifications', group: 'support' },
    { id: 'analytics', group: 'support' },
    { id: 'database', group: 'infrastructure' },
    { id: 'cache', group: 'infrastructure' },
  ],
  links: [
    { source: 'gateway', target: 'auth', value: 100 },
    { source: 'gateway', target: 'users', value: 80 },
    { source: 'gateway', target: 'orders', value: 60 },
    { source: 'auth', target: 'users', value: 50 },
    { source: 'orders', target: 'payments', value: 40 },
    { source: 'orders', target: 'inventory', value: 35 },
    { source: 'payments', target: 'notifications', value: 30 },
    { source: 'orders', target: 'notifications', value: 25 },
    { source: 'users', target: 'database', value: 90 },
    { source: 'orders', target: 'database', value: 70 },
    { source: 'auth', target: 'cache', value: 45 },
    { source: 'inventory', target: 'database', value: 20 },
    { source: 'analytics', target: 'database', value: 15 },
  ],
};

const simpleGraph: NetworkInput = {
  nodes: [
    { id: 'A', group: 'primary' },
    { id: 'B', group: 'primary' },
    { id: 'C', group: 'secondary' },
    { id: 'D', group: 'secondary' },
  ],
  links: [
    { source: 'A', target: 'B', value: 10 },
    { source: 'B', target: 'C', value: 8 },
    { source: 'C', target: 'D', value: 6 },
    { source: 'D', target: 'A', value: 4 },
    { source: 'A', target: 'C', value: 3 },
  ],
};

export const Default: Story = {
  args: {
    data: socialNetworkData,
    name: 'Team Collaboration',
    width: 800,
    height: 600,
    colorField: 'group',
    showLabels: true,
    showLegend: true,
    showTable: true,
  },
};

export const ServiceArchitecture: Story = {
  args: {
    data: serviceArchitectureData,
    name: 'Microservices Architecture',
    width: 900,
    height: 650,
    colorField: 'group',
    showLabels: true,
    showEdgeLabels: false,
    showTable: true,
  },
};

export const SimpleGraph: Story = {
  args: {
    data: simpleGraph,
    name: 'Simple Network',
    width: 500,
    height: 400,
    showLabels: true,
    showTable: true,
  },
};

export const CustomForceParams: Story = {
  args: {
    data: socialNetworkData,
    name: 'Custom Force Layout',
    width: 800,
    height: 600,
    force: {
      repulsion: 200,
      gravity: 0.15,
      edgeLength: 80,
      friction: 0.5,
    },
    showLabels: true,
  },
};

export const NoDragging: Story = {
  args: {
    data: simpleGraph,
    name: 'Static Graph (No Drag)',
    width: 500,
    height: 400,
    draggable: false,
    zoom: false,
    showLabels: true,
  },
};

export const WithEdgeLabels: Story = {
  args: {
    data: simpleGraph,
    name: 'Graph with Edge Labels',
    width: 600,
    height: 450,
    showLabels: true,
    showEdgeLabels: true,
    showTable: false,
  },
};

export const Interactive: Story = {
  args: {
    data: socialNetworkData,
    name: 'Interactive Network',
    width: 800,
    height: 600,
    colorField: 'group',
  },
  render: (args) => (
    <ForceGraph
      {...args}
      onSelect={(node) => {
        console.log('Node selected:', node);
        alert(`Selected node: ${node.name}\nGroup: ${node.group ?? 'N/A'}`);
      }}
      onLinkSelect={(link) => {
        console.log('Link selected:', link);
        alert(`Connection: ${link.source} → ${link.target}\nWeight: ${link.value ?? 'N/A'}`);
      }}
    />
  ),
};
