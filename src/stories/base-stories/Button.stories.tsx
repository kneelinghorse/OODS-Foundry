import { Fragment } from 'react';
import type { ComponentProps } from 'react';
import '../../styles/globals.css';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../components/base/Button';

type ButtonStoryProps = ComponentProps<typeof Button>;

const intents: ButtonStoryProps['intent'][] = [
  'neutral',
  'success',
  'warning',
  'danger',
];

const sizes: ButtonStoryProps['size'][] = ['sm', 'md', 'lg'];

const meta: Meta<typeof Button> = {
  title: 'Components/Primitives/Button',
  component: Button,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  render: (args: ButtonStoryProps) => <Button {...args}>Action</Button>,
  args: {
    intent: 'neutral',
    size: 'md',
  },
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const Intents: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {intents.map((intent) => (
        <div key={intent} className="flex items-center gap-2">
          <span className="w-20 text-sm font-medium capitalize">{intent}</span>
          <Button intent={intent}>Continue</Button>
        </div>
      ))}
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <Fragment key={size}>
          <span className="text-sm font-medium uppercase">{size}</span>
          <div className="flex items-center gap-2">
            <Button size={size}>Primary</Button>
            <Button size={size} intent="success">
              Confirm
            </Button>
          </div>
        </Fragment>
      ))}
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};
