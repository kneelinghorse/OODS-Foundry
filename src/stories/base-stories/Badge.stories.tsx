import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import '../../styles/globals.css';
import { Badge } from '../../components/base/Badge';

type BadgeStoryProps = ComponentProps<typeof Badge>;

const intents: BadgeStoryProps['intent'][] = [
  'neutral',
  'success',
  'warning',
  'danger',
];

const meta: Meta<typeof Badge> = {
  title: 'Base/Badge',
  component: Badge,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  render: (args: BadgeStoryProps) => <Badge {...args}>Active</Badge>,
  args: {
    intent: 'neutral',
  },
};

export const Intents: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {intents.map((intent) => (
        <Badge key={intent} intent={intent}>
          {intent}
        </Badge>
      ))}
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};
