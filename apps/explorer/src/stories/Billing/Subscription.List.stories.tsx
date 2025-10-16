import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionListExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionListExample> = {
  title: 'Billing/Subscription.List',
  component: SubscriptionListExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const NormalizedProviders: Story = {
  name: 'Normalized providers'
};
