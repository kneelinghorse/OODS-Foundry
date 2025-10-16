import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceTimelineExample } from './components/BillingContexts';

const meta: Meta<typeof InvoiceTimelineExample> = {
  title: 'Billing/Invoice.Timeline',
  component: InvoiceTimelineExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const CollectionsEvents: Story = {
  name: 'Collections events'
};
