/* c8 ignore start */
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../../styles/globals.css';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '../../components/base/Table.js';

type SubscriptionRow = {
  readonly id: string;
  readonly customer: string;
  readonly plan: string;
  readonly status: string;
  readonly mrr: string;
};

const SUBSCRIPTIONS: readonly SubscriptionRow[] = [
  {
    id: 'SUB-1024',
    customer: 'Acme Analytics',
    plan: 'Growth',
    status: 'active',
    mrr: '$1,200',
  },
  {
    id: 'SUB-1064',
    customer: 'Helios Labs',
    plan: 'Scale',
    status: 'delinquent',
    mrr: '$2,440',
  },
  {
    id: 'SUB-1088',
    customer: 'Northwind Ops',
    plan: 'Starter',
    status: 'pending_cancellation',
    mrr: '$640',
  },
];

const meta: Meta<typeof Table> = {
  title: 'Components/Data/Table',
  component: Table,
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: true },
  },
  args: {
    density: 'comfortable',
  },
  argTypes: {
    density: {
      control: { type: 'inline-radio' },
      options: ['comfortable', 'compact'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Subscription</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Plan</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell numeric>MRR</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SUBSCRIPTIONS.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.customer}</TableCell>
            <TableCell>{row.plan}</TableCell>
            <TableCell status={row.status} statusDomain="subscription" />
            <TableCell numeric>{row.mrr}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>Subscriptions across Brand A and Brand B.</TableCaption>
    </Table>
  ),
};

export const SelectableRows: Story = {
  render: (args) => {
    const [selectedId, setSelectedId] = useState<string>('SUB-1024');

    return (
      <Table {...args}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Subscription</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell numeric>MRR</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SUBSCRIPTIONS.map((row) => (
            <TableRow
              key={row.id}
              selectable
              selected={row.id === selectedId}
              onActivate={() => setSelectedId(row.id)}
            >
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell status={row.status} statusDomain="subscription" />
              <TableCell numeric>{row.mrr}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  },
};

export const CompactStatusMatrix: Story = {
  render: () => (
    <Table density="compact">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Description</TableHeaderCell>
          <TableHeaderCell numeric>Accounts</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell status="active" statusDomain="subscription" />
          <TableCell>
            Brand-aligned experience — all guardrails passing with latest deployments.
          </TableCell>
          <TableCell numeric>128</TableCell>
        </TableRow>
        <TableRow>
          <TableCell status="trialing" statusDomain="subscription" />
          <TableCell>Trial instances awaiting billing activation.</TableCell>
          <TableCell numeric>42</TableCell>
        </TableRow>
        <TableRow>
          <TableCell status="delinquent" statusDomain="subscription" />
          <TableCell status="delinquent" statusDomain="subscription" statusEmphasis="text">
            Payment outstanding — retries scheduled through policy.
          </TableCell>
          <TableCell numeric>17</TableCell>
        </TableRow>
        <TableRow>
          <TableCell status="terminated" statusDomain="subscription" />
          <TableCell>Ended subscriptions retained for historical reporting.</TableCell>
          <TableCell numeric>9</TableCell>
        </TableRow>
      </TableBody>
      <TableCaption>Compact density with status-aware cells for monitoring.</TableCaption>
    </Table>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

/* c8 ignore end */
