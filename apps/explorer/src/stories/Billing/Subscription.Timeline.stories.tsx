import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionTimelineExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionTimelineExample> = {
  title: 'Billing/Subscription.Timeline',
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
  name: 'Lifecycle feed'
};
