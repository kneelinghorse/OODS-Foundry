import type { Meta, StoryObj } from '@storybook/react';

import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Grid,
  Input,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from '../../packages/components-react/src/index.js';

const meta = {
  title: 'Components/React nucleus',
  parameters: {
    layout: 'padded',
    oodsComponentIds: [
      'Badge', 'Banner', 'Button', 'Card', 'Checkbox', 'DatePicker', 'Grid',
      'Input', 'Select', 'Stack', 'Table', 'Tabs', 'Text', 'Textarea',
    ],
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BadgeScenario: Story = {
  parameters: { oodsComponentId: 'Badge' },
  render: () => <Badge status="past_due" domain="subscription" emphasis="solid" />,
};

export const BannerScenario: Story = {
  parameters: { oodsComponentId: 'Banner' },
  render: () => <Banner title="Payment failed" detail="Update the card" tone="critical" />,
};

export const ButtonScenario: Story = {
  parameters: { oodsComponentId: 'Button' },
  render: () => <Button>Save changes</Button>,
};

export const CardScenario: Story = {
  parameters: { oodsComponentId: 'Card' },
  render: () => <Card elevated>Account summary</Card>,
};

export const CheckboxScenario: Story = {
  parameters: { oodsComponentId: 'Checkbox' },
  render: () => <Checkbox id="story-marketing" label="Product updates" help="Choose whether to subscribe" />,
};

export const DatePickerScenario: Story = {
  parameters: { oodsComponentId: 'DatePicker' },
  render: () => <DatePicker id="story-renewal" label="Renewal date" defaultValue="2026-09-30" min="2026-09-01" max="2026-12-31" />,
};

export const GridScenario: Story = {
  parameters: { oodsComponentId: 'Grid' },
  render: () => <Grid minColumnWidth="12rem"><Card>First</Card><Card>Second</Card></Grid>,
};

export const InputScenario: Story = {
  parameters: { oodsComponentId: 'Input' },
  render: () => <Input id="story-email" label="Email" defaultValue="invalid" help="Use a work address" validation={{ state: 'error', message: 'Enter a valid email' }} />,
};

export const SelectScenario: Story = {
  parameters: { oodsComponentId: 'Select' },
  render: () => <Select id="story-plan" label="Plan" defaultValue="pro" options={[{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }]} />,
};

export const StackScenario: Story = {
  parameters: { oodsComponentId: 'Stack' },
  render: () => <Stack direction="row" wrap><Button>Primary</Button><Button intent="secondary">Secondary</Button></Stack>,
};

export const TableScenario: Story = {
  parameters: { oodsComponentId: 'Table' },
  render: () => <Table caption="Subscriptions" columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]} rows={[{ id: 'sub-1', name: 'Acme', status: 'Active' }]} selectable />,
};

export const TabsScenario: Story = {
  parameters: { oodsComponentId: 'Tabs' },
  render: () => <Tabs ariaLabel="Account sections" items={[{ id: 'overview', label: 'Overview', panel: 'Summary' }, { id: 'billing', label: 'Billing', panel: 'Invoices' }]} />,
};

export const TextScenario: Story = {
  parameters: { oodsComponentId: 'Text' },
  render: () => <Text as="strong" weight="semibold">Account owner</Text>,
};

export const TextareaScenario: Story = {
  parameters: { oodsComponentId: 'Textarea' },
  render: () => <Textarea id="story-notes" label="Notes" defaultValue="Call before renewal" rows={4} help="Visible to account managers" />,
};
