import type { ComponentProps } from 'react';
import { PageHeader } from '../../components/page/PageHeader';

type StoryProps = ComponentProps<typeof PageHeader>;

export default {
  title: 'Components/PageHeader',
  component: PageHeader,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {
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

export const Minimal = {
  render: () => <PageHeader title="Untitled Record" />,
};
