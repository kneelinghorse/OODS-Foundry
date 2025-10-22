import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceDetailExample } from './components/BillingContexts';

const meta: Meta<typeof InvoiceDetailExample> = {
  title: 'Domains/Billing/Invoice/Detail',
  component: InvoiceDetailExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { state: 'hidden' }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const FinanceDossier: Story = {
  name: 'Finance dossier'
};
