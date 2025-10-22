import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionTimelineExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionTimelineExample> = {
  title: 'Domains/Billing/Subscription/Timeline',
  component: SubscriptionTimelineExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const LifecycleFeed: Story = {
  name: 'Lifecycle feed',
  render: () => <SubscriptionTimelineExample scenario="success" />
};

export const RetryBackoff: Story = {
  name: 'Retry backoff',
  render: () => <SubscriptionTimelineExample scenario="retry" />
};

export const RefundCancellation: Story = {
  name: 'Refund + cancellation',
  render: () => <SubscriptionTimelineExample scenario="refund" />
};
