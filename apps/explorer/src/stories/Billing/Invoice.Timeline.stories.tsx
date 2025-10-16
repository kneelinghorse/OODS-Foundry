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
  name: 'Collections events',
  render: () => <InvoiceTimelineExample scenario="success" />
};

export const CollectionsDunning: Story = {
  name: 'Collections dunning',
  render: () => <InvoiceTimelineExample scenario="retry" />
};

export const CollectionsRefunds: Story = {
  name: 'Collections refunds',
  render: () => <InvoiceTimelineExample scenario="refund" />
};
