import type { Meta, StoryObj } from '@storybook/react';
import { TextArea } from '../components/TextArea';
import '../styles/index.css';
import '../styles/forms.css';

const meta: Meta<typeof TextArea> = {
  title: 'Components/Primitives/Text Area',
  component: TextArea,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof TextArea>;

export const Primary: Story = {
  args: {
    label: 'Notes',
    placeholder: 'Enter details...'
  },
};
