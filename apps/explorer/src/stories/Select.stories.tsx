import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '../components/Select';
import '../styles/index.css';
import '../styles/overlays.css';

const meta: Meta<typeof Select> = {
  title: 'Explorer/Components/Select',
  component: Select,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Primary: Story = {
  render: () => (
    <Select
      ariaLabel="Choose status"
      options={[
        { value: 'open', label: 'Open' },
        { value: 'processing', label: 'Processing' },
        { value: 'closed', label: 'Closed' },
      ]}
      defaultValue="open"
    />
  ),
};
