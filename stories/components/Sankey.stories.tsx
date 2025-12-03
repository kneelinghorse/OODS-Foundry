import type { Meta, StoryObj } from '@storybook/react';

import type { SankeyInput } from '~/src/types/viz/network-flow';
import { Sankey } from '~/src/components/viz/Sankey';

const meta: Meta<typeof Sankey> = {
  title: 'Visualization/Network/Sankey',
  component: Sankey,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: { control: { type: 'number', min: 400, max: 1200 } },
    height: { control: { type: 'number', min: 300, max: 800 } },
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    nodeAlign: { control: 'select', options: ['justify', 'left', 'right'] },
    linkColor: { control: 'select', options: ['gradient', 'source', 'target'] },
    showLabels: { control: 'boolean' },
    showTable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Sankey>;

const energyFlowData: SankeyInput = {
  nodes: [
    { name: 'Coal' },
    { name: 'Natural Gas' },
    { name: 'Nuclear' },
    { name: 'Renewables' },
    { name: 'Electricity' },
    { name: 'Heat' },
    { name: 'Residential' },
    { name: 'Commercial' },
    { name: 'Industrial' },
    { name: 'Transport' },
  ],
  links: [
    { source: 'Coal', target: 'Electricity', value: 250 },
    { source: 'Coal', target: 'Heat', value: 100 },
    { source: 'Natural Gas', target: 'Electricity', value: 180 },
    { source: 'Natural Gas', target: 'Heat', value: 150 },
    { source: 'Nuclear', target: 'Electricity', value: 200 },
    { source: 'Renewables', target: 'Electricity', value: 120 },
    { source: 'Electricity', target: 'Residential', value: 280 },
    { source: 'Electricity', target: 'Commercial', value: 220 },
    { source: 'Electricity', target: 'Industrial', value: 180 },
    { source: 'Electricity', target: 'Transport', value: 70 },
    { source: 'Heat', target: 'Residential', value: 120 },
    { source: 'Heat', target: 'Industrial', value: 130 },
  ],
};

// User journey as a proper funnel (DAG - no cycles allowed in Sankey)
const userJourneyData: SankeyInput = {
  nodes: [
    { name: 'Landing Page' },
    { name: 'Product List' },
    { name: 'Product Details' },
    { name: 'Add to Cart' },
    { name: 'Checkout' },
    { name: 'Purchase' },
    { name: 'Bounce' },
    { name: 'Browse Exit' },
    { name: 'Cart Abandon' },
    { name: 'Checkout Abandon' },
  ],
  links: [
    { source: 'Landing Page', target: 'Product List', value: 1000 },
    { source: 'Landing Page', target: 'Bounce', value: 300 },
    { source: 'Product List', target: 'Product Details', value: 700 },
    { source: 'Product List', target: 'Browse Exit', value: 150 },
    { source: 'Product Details', target: 'Add to Cart', value: 400 },
    { source: 'Product Details', target: 'Browse Exit', value: 300 },
    { source: 'Add to Cart', target: 'Checkout', value: 300 },
    { source: 'Add to Cart', target: 'Cart Abandon', value: 100 },
    { source: 'Checkout', target: 'Purchase', value: 250 },
    { source: 'Checkout', target: 'Checkout Abandon', value: 50 },
  ],
};

const budgetAllocationData: SankeyInput = {
  nodes: [
    { name: 'Total Budget' },
    { name: 'Engineering' },
    { name: 'Marketing' },
    { name: 'Operations' },
    { name: 'Salaries' },
    { name: 'Tools' },
    { name: 'Cloud' },
    { name: 'Ads' },
    { name: 'Content' },
    { name: 'Events' },
    { name: 'Office' },
    { name: 'Support' },
  ],
  links: [
    { source: 'Total Budget', target: 'Engineering', value: 500 },
    { source: 'Total Budget', target: 'Marketing', value: 300 },
    { source: 'Total Budget', target: 'Operations', value: 200 },
    { source: 'Engineering', target: 'Salaries', value: 350 },
    { source: 'Engineering', target: 'Tools', value: 80 },
    { source: 'Engineering', target: 'Cloud', value: 70 },
    { source: 'Marketing', target: 'Ads', value: 150 },
    { source: 'Marketing', target: 'Content', value: 100 },
    { source: 'Marketing', target: 'Events', value: 50 },
    { source: 'Operations', target: 'Office', value: 120 },
    { source: 'Operations', target: 'Support', value: 80 },
  ],
};

export const Default: Story = {
  args: {
    data: energyFlowData,
    name: 'Energy Flow',
    width: 900,
    height: 500,
    showLabels: true,
    showTable: true,
  },
};

export const UserJourney: Story = {
  args: {
    data: userJourneyData,
    name: 'User Conversion Funnel',
    width: 850,
    height: 450,
    linkColor: 'gradient',
    showTable: true,
  },
};

export const BudgetAllocation: Story = {
  args: {
    data: budgetAllocationData,
    name: 'Budget Allocation',
    width: 800,
    height: 400,
    nodeAlign: 'left',
    showTable: true,
  },
};

export const Vertical: Story = {
  args: {
    data: userJourneyData,
    name: 'Vertical User Flow',
    width: 500,
    height: 700,
    orientation: 'vertical',
    showTable: false,
  },
};

export const SourceColorLinks: Story = {
  args: {
    data: energyFlowData,
    name: 'Energy Flow (Source Colors)',
    width: 900,
    height: 500,
    linkColor: 'source',
  },
};

export const TargetColorLinks: Story = {
  args: {
    data: energyFlowData,
    name: 'Energy Flow (Target Colors)',
    width: 900,
    height: 500,
    linkColor: 'target',
  },
};

export const CustomNodeSizing: Story = {
  args: {
    data: energyFlowData,
    name: 'Custom Node Dimensions',
    width: 950,
    height: 550,
    nodeWidth: 30,
    nodeGap: 15,
    showTable: false,
  },
};

export const Interactive: Story = {
  args: {
    data: energyFlowData,
    name: 'Interactive Energy Flow',
    width: 900,
    height: 500,
  },
  render: (args) => (
    <Sankey
      {...args}
      onSelect={(node) => {
        console.log('Node selected:', node);
        alert(`Selected: ${node.name}\nTotal Flow: ${node.value.toLocaleString()}`);
      }}
      onLinkSelect={(link) => {
        console.log('Flow selected:', link);
        alert(`Flow: ${link.source} → ${link.target}\nValue: ${link.value.toLocaleString()}`);
      }}
    />
  ),
};
