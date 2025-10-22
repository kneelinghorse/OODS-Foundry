import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from '../components/Checkbox';
import '../styles/index.css';
import '../styles/forms.css';

const meta: Meta<typeof Checkbox> = {
  title: 'Explorer/Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Primary: Story = {
  args: {
    label: 'Receive updates',
    defaultChecked: true,
  },
};
