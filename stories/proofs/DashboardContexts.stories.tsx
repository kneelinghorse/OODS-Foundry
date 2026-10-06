import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import '~/apps/explorer/src/styles/index.css';
import { listDashboardExamples } from '~/examples/dashboards';

const DASHBOARD_EXAMPLES = listDashboardExamples();

const meta: Meta<ComponentType> = {
  title: 'Proofs/Dashboard Contexts',
  component: DASHBOARD_EXAMPLES[0]!.Preview,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<ComponentType>;

function storyFromExample(id: string): Story {
  const example = DASHBOARD_EXAMPLES.find((entry) => entry.id === id);
  if (!example) {
    throw new Error(`Unknown dashboard example "${id}"`);
  }
  const Preview = example.Preview;
  return {
    name: example.title,
    parameters: {
      docs: {
        description: {
          story: example.summary,
        },
      },
    },
    render: () => <Preview />,
  };
}

export const UserDashboard: Story = storyFromExample('user-adoption');

export const SubscriptionDashboard: Story = storyFromExample('subscription-mrr');

export const ProductDashboard: Story = storyFromExample('product-analytics');
