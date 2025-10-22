import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionFormExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionFormExample> = {
  title: 'Domains/Billing/Subscription/Form',
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
