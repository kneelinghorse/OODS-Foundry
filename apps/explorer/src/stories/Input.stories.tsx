import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/Input';
import '../styles/index.css';

const meta: Meta<typeof Input> = {
  title: 'Components/Primitives/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      source: { state: 'hidden' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  args: {
    label: 'Label',
    defaultValue: 'Value',
  },
};
