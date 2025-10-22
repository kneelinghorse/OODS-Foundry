import type { Meta, StoryObj } from '@storybook/react';
import { SubscriptionDetailExample } from './components/BillingContexts';

const meta: Meta<typeof SubscriptionDetailExample> = {
  title: 'Domains/Billing/Subscription/Detail',
  component: SubscriptionDetailExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const CrossProviderDossier: Story = {
  name: 'Cross-provider dossier'
};
