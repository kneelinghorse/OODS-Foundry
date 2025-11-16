import type { Meta, StoryObj } from '@storybook/react';
import '~/apps/explorer/src/styles/index.css';
import { UserDashboardPreview } from '~/examples/dashboards/user-adoption';
import { SubscriptionDashboardPreview } from '~/examples/dashboards/subscription-mrr';
import { ProductDashboardPreview } from '~/examples/dashboards/product-analytics';

const meta: Meta<typeof UserDashboardPreview> = {
  title: 'Proofs/Dashboard Contexts',
  component: UserDashboardPreview,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof UserDashboardPreview>;

export const UserDashboard: Story = {
  name: 'User adoption dashboard',
  render: () => <UserDashboardPreview />,
};

export const SubscriptionDashboard: Story = {
  name: 'Subscription MRR dashboard',
  render: () => <SubscriptionDashboardPreview />,
};

export const ProductDashboard: Story = {
  name: 'Product analytics dashboard',
  render: () => <ProductDashboardPreview />,
};
