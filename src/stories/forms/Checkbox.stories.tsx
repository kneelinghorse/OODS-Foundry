/* c8 ignore start */
import type { Meta, StoryObj } from '@storybook/react';
import '../../styles/globals.css';
import { Checkbox } from '../../components/base/Checkbox.js';

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Primitives/Checkbox',
  component: Checkbox,
  args: {
    id: 'terms',
    label: 'I agree to the terms of service',
  },
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    density: {
      control: { type: 'inline-radio' },
      options: ['comfortable', 'compact'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => <Checkbox {...args} />,
};

export const ValidationStates: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Checkbox
        id="checkbox-info"
        label="Notify me about balance updates"
        description="Includes weekly digest emails and monthly summaries."
        validation={{ state: 'info', message: 'You can change this later in account settings.' }}
        defaultChecked
      />
      <Checkbox
        id="checkbox-success"
        label="Enable payment retries"
        validation={{ state: 'success', message: 'Retries configured for three attempts.' }}
        defaultChecked
      />
      <Checkbox
        id="checkbox-error"
        label="Acknowledge billing policies"
        validation={{ state: 'error', message: 'You must acknowledge billing policies to continue.' }}
        required
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const DensityVariants: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Checkbox
        id="checkbox-density-comfortable"
        label="Enable compact mode"
        description="Comfortable spacing is ideal for standard forms."
        density="comfortable"
      />
      <Checkbox
        id="checkbox-density-compact"
        label="Enable compact mode"
        description="Compact spacing fits dense operational tools."
        density="compact"
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
  },
};

/* c8 ignore end */
