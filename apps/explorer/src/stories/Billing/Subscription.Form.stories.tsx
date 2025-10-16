import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionFormExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionFormExample> = {
  title: 'Billing/Subscription.Form',
  component: SubscriptionFormExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const ContractAdjustments: Story = {
  name: 'Contract adjustments'
};
