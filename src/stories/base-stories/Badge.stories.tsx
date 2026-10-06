/* c8 ignore start */
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import '../../styles/globals.css';
import { Badge } from '../../components/base/Badge';
import { listStatuses } from '../../components/statusables/statusRegistry.js';

type BadgeStoryProps = ComponentProps<typeof Badge>;

const meta: Meta<typeof Badge> = {
  title: 'Components/Statusables/Badge',
  component: Badge,
  decorators: [withPage()],
  args: {
    status: 'active',
    domain: 'subscription',
    emphasis: 'subtle',
  },
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    status: {
      control: 'text',
    },
    domain: {
      control: 'text',
    },
    emphasis: {
      control: {
        type: 'inline-radio',
      },
      options: ['subtle', 'solid'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  render: (args: BadgeStoryProps) => <Badge {...args} />,
  parameters: {
    layout: 'centered',
  },
};

export const SnapshotGrid: Story = {
  render: () => {
    const statuses = listStatuses('subscription');
    const emphases: Array<BadgeStoryProps['emphasis']> = ['subtle', 'solid'];

    return (
      <div className="flex flex-col gap-6">
        {emphases.map((emphasis) => (
          <section key={emphasis} className="flex flex-col gap-3">
            <header className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Emphasis: {emphasis}
            </header>
            <div className="flex flex-wrap gap-2">
              {statuses.map((entry) => (
                <Badge
                  key={`${entry.status}-${emphasis}`}
                  status={entry.status}
                  domain={entry.domain}
                  emphasis={emphasis}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  },
  parameters: {
    chromatic: { disableSnapshot: false },
    layout: 'fullscreen',
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

/* c8 ignore end */
