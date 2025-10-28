import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';

const meta: Meta<typeof StatusChip> = {
  title: 'Components/Statusables/Status Chip',
  component: StatusChip,
  decorators: [withPage()],
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  args: {
    status: 'active',
    domain: 'subscription',
    context: 'detail'
  }
};

export default meta;

type Story = StoryObj<typeof StatusChip>;
type StatusChipArgs = ComponentProps<typeof StatusChip>;

export const SubscriptionStates: Story = {
  render: (args: StatusChipArgs) => (
    <div className="story-grid status-chip-grid">
      <StatusChip {...args} status="future" />
      <StatusChip {...args} status="trialing" />
      <StatusChip {...args} status="active" />
      <StatusChip {...args} status="paused" />
      <StatusChip {...args} status="pending_cancellation" />
      <StatusChip {...args} status="delinquent" />
      <StatusChip {...args} status="terminated" />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const InvoiceStates: Story = {
  args: {
    domain: 'invoice'
  },
  render: (args: StatusChipArgs) => (
    <div className="story-grid status-chip-grid">
      <StatusChip {...args} status="draft" />
      <StatusChip {...args} status="posted" />
      <StatusChip {...args} status="paid" />
      <StatusChip {...args} status="past_due" />
      <StatusChip {...args} status="void" />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const PaymentIntentStates: Story = {
  args: {
    domain: 'payment_intent'
  },
  render: (args: StatusChipArgs) => (
    <div className="story-grid status-chip-grid">
      <StatusChip {...args} status="requires_payment_method" />
      <StatusChip {...args} status="requires_confirmation" />
      <StatusChip {...args} status="processing" />
      <StatusChip {...args} status="requires_action" />
      <StatusChip {...args} status="succeeded" />
      <StatusChip {...args} status="canceled" />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const TicketStates: Story = {
  args: {
    domain: 'ticket'
  },
  render: (args: StatusChipArgs) => (
    <div className="story-grid status-chip-grid">
      <StatusChip {...args} status="new" />
      <StatusChip {...args} status="open" />
      <StatusChip {...args} status="pending" />
      <StatusChip {...args} status="on_hold" />
      <StatusChip {...args} status="solved" />
      <StatusChip {...args} status="closed" />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const UserStates: Story = {
  args: {
    domain: 'user'
  },
  render: (args: StatusChipArgs) => (
    <div className="story-grid status-chip-grid">
      <StatusChip {...args} status="invited" />
      <StatusChip {...args} status="active" />
      <StatusChip {...args} status="suspended" />
      <StatusChip {...args} status="locked" />
      <StatusChip {...args} status="deactivated" />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};
