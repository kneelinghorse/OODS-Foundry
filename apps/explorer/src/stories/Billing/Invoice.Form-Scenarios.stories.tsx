import type { Meta, StoryObj } from '@storybook/react';
import { InvoiceFormScenarios } from './components/BillingContexts';

const meta: Meta<typeof InvoiceFormScenarios> = {
  title: 'Billing/Invoice.Form-Scenarios',
  component: InvoiceFormScenarios,
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
