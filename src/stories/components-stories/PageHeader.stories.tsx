import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import { PageHeader } from '../../components/page/PageHeader';

type StoryProps = ComponentProps<typeof PageHeader>;

const meta: Meta<typeof PageHeader> = {
  title: 'Patterns/Page Header',
  component: PageHeader,
  decorators: [withPage({ fullWidth: true })],
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  render: (args: StoryProps) => <PageHeader {...args} />,
  args: {
    title: 'Acme, Inc.',
    subtitle: 'Customer Account',
    description: 'Lifecycle overview, billing health, and subscription entitlements.',
    metadata: 'Last updated 2 days ago by J. Smith',
    badges: [
      { id: 'status-active', label: 'Active', tone: 'success' },
      { id: 'status-priority', label: 'Priority', tone: 'info' },
    ],
    actions: [
      { id: 'primary', label: 'Edit Account', intent: 'success' },
      { id: 'secondary', label: 'Disable', intent: 'danger' },
    ],
  } satisfies StoryProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const Minimal: Story = {
  render: () => <PageHeader title="Untitled Record" />,
};
