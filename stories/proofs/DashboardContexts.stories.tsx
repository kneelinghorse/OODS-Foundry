import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import '~/apps/explorer/src/styles/index.css';
import { listDashboardExamples } from '~/examples/dashboards';

const DASHBOARD_EXAMPLES = listDashboardExamples();

// Storybook canvas constrains width more than the Explorer shell; widen the view shell
// so dashboard grids can render multiple columns without clipping.
const DASHBOARD_STORY_STYLE: React.CSSProperties = {
  '--view-shell-max-width': 'min(96rem, 100vw - 2rem)',
  '--view-main-gap-default': 'clamp(1.25rem, 1vw + 1rem, 1.75rem)',
  '--view-section-gap-detail': 'clamp(1.25rem, 1vw + 1rem, 1.75rem)',
} as React.CSSProperties;

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
    render: () => (
      <div style={DASHBOARD_STORY_STYLE}>
        <Preview />
      </div>
    ),
  };
}

export const UserDashboard: Story = storyFromExample('user-adoption');

export const SubscriptionDashboard: Story = storyFromExample('subscription-mrr');

export const ProductDashboard: Story = storyFromExample('product-analytics');

export const SpatialDashboard: Story = storyFromExample('spatial-dashboard');

export const NetworkFlowDashboard: Story = storyFromExample('network-flow');
