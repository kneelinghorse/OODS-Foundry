import type { ComponentProps } from 'react';
import { Badge } from '../../components/base/Badge';

type BadgeStoryProps = ComponentProps<typeof Badge>;

const intents: BadgeStoryProps['intent'][] = [
  'neutral',
  'success',
  'warning',
  'danger',
];

export default {
  title: 'Base/Badge',
  component: Badge,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Default = {
  render: (args: BadgeStoryProps) => <Badge {...args}>Active</Badge>,
  args: {
    intent: 'neutral',
  },
};

export const Intents = {
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
