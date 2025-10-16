import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceListExample } from './components/BillingContexts';

const meta: Meta<typeof InvoiceListExample> = {
  title: 'Billing/Invoice.List',
  component: InvoiceListExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const CollectionsBoard: Story = {
  name: 'Collections board'
};
