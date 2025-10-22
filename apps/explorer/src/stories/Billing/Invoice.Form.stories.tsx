import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceFormExample } from './components/BillingContexts';

const meta: Meta<typeof InvoiceFormExample> = {
  title: 'Domains/Billing/Invoice/Form',
  component: InvoiceFormExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const CreditWorkflow: Story = {
  name: 'Credit workflow'
};
