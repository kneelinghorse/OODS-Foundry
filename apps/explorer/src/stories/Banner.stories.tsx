import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from '../components/Banner';
import '../styles/index.css';

const meta: Meta<typeof Banner> = {
  title: 'Explorer/Components/Banner',
  component: Banner,
  parameters: {
    layout: 'centered',
    docs: {
      source: { state: 'hidden' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Banner>;

export const Primary: Story = {
  args: {
    title: 'Banner',
    description: 'Example',
  },
};
