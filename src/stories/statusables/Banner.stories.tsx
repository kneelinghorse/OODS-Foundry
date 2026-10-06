/* c8 ignore start */
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import '../../styles/globals.css';
import { Banner } from '../../components/base/Banner';
import { listStatuses } from '../../components/statusables/statusRegistry.js';

type BannerStoryProps = ComponentProps<typeof Banner>;

const meta: Meta<typeof Banner> = {
  title: 'Components/Statusables/Banner',
  component: Banner,
  decorators: [withPage({ fullWidth: true })],
  args: {
    status: 'active',
    domain: 'subscription',
    emphasis: 'subtle',
    title: 'Everything looks good',
    description: 'Subscription is active and up to date.',
  },
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    status: { control: 'text' },
    domain: { control: 'text' },
    emphasis: {
      control: { type: 'inline-radio' },
      options: ['subtle', 'solid'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Banner>;

export const Default: Story = {
  render: (args: BannerStoryProps) => <Banner {...args} />,
};

export const SnapshotGrid: Story = {
  render: () => {
    const statuses = listStatuses('subscription');
    const emphases: Array<BannerStoryProps['emphasis']> = ['subtle', 'solid'];

    return (
      <div className="flex flex-col gap-6">
        {emphases.map((emphasis) => (
          <section key={emphasis} className="flex flex-col gap-3">
            <header className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Emphasis: {emphasis}
            </header>
            <div className="flex flex-col gap-3">
              {statuses.map((entry) => (
                <Banner
                  key={`${entry.status}-${emphasis}`}
                  status={entry.status}
                  domain={entry.domain}
                  emphasis={emphasis}
                  title={entry.label}
                  description={entry.description}
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
