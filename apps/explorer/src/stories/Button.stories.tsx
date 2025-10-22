import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/Button';
import '../styles/index.css';

const meta: Meta<typeof Button> = {
  title: 'Explorer/Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      source: { state: 'hidden' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Primary',
  },
};
