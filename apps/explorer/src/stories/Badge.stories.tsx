import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../components/Badge';
import '../styles/index.css';

const meta: Meta<typeof Badge> = {
  title: 'Explorer/Components/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      source: { state: 'hidden' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Primary: Story = {
  args: {
    children: 'Badge',
  },
};
