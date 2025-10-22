import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionFormScenarios } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionFormScenarios> = {
  title: 'Domains/Billing/Subscription/Form Scenarios',
  component: SubscriptionFormScenarios,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const ValidationStates: Story = {
  name: 'Validation States'
};
