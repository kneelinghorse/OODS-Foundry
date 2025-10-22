import type { Meta, StoryObj } from '@storybook/react';
import { Toggle } from '../components/Toggle';
import '../styles/index.css';
import '../styles/forms.css';

const meta: Meta<typeof Toggle> = {
  title: 'Components/Primitives/Toggle',
  component: Toggle,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Toggle>;

export const Primary: Story = {
  args: {
    label: 'Enable feature',
    defaultChecked: true,
  },
};
